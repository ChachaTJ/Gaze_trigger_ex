#!/usr/bin/env python3
"""
iPhoneme Phoneme Server

Lightweight WebSocket server that:
1. Spawns whisper.cpp 'stream' subprocess for real-time speech recognition
2. Filters noise / status lines / hallucinations
3. Deduplicates consecutive identical outputs
4. Converts recognized text to ARPAbet phonemes via g2p_en
5. Strips stress digits (AY1 → AY)
6. Inserts | between words
7. Filters to allowed phoneme inventory
8. Streams phoneme events to the browser via WebSocket

Usage:
    pip install websockets g2p_en
    python3 phoneme_server.py [--port 8765] [--whisper-path ../gesture-demo-deploy/server/whisper]

The browser frontend connects via:
    ws://localhost:8765
"""

import asyncio
import argparse
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
from collections import deque

# ── Dependencies ──
try:
    import websockets
except ImportError:
    print("ERROR: websockets not installed. Run: pip install websockets")
    sys.exit(1)

try:
    from g2p_en import G2p
except ImportError:
    print("ERROR: g2p_en not installed. Run: pip install g2p_en")
    sys.exit(1)


# ── Allowed Phoneme Inventory ──
VALID_PHONEMES = {
    'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'B', 'CH', 'D', 'DH',
    'EH', 'ER', 'EY', 'F', 'G', 'HH', 'IH', 'IY', 'JH', 'K',
    'L', 'M', 'N', 'NG', 'OW', 'OY', 'P', 'R', 'S', 'SH', 'T',
    'TH', 'UH', 'UW', 'V', 'W', 'Y', 'Z', 'ZH'
}

# ── iPhoneme Command Phonemes (subset that triggers actions) ──
COMMAND_PHONEMES = {'AY', 'AW', 'UW', 'Y'}

# ── Whisper hallucination filter ──
HALLUCINATIONS = {
    'thank you', 'thanks for watching', 'thanks for listening',
    'see you next time', 'goodbye', 'bye', 'subscribe',
    'like and subscribe', 'please subscribe', 'thank you for watching',
    'you', 'the', 'a', 'i', 'it', 'is', 'and', 'to', 'of',
    '...', '..', '.', '-', '--', '♪', '♫', '(music)',
    '(footsteps)', '(keyboard clicking)', '(fire crackling)',
    '(silence)', '(coughing)', '(breathing)', '(laughing)',
    '(applause)', '(cheering)'
}

# ANSI escape code stripper
ANSI_RE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]|\x1b\[\?[0-9;]*[a-zA-Z]')


# ── G2P Converter ──
class PhonemeConverter:
    def __init__(self):
        print("[G2P] Loading g2p_en model...")
        self.g2p = G2p()
        print("[G2P] ✓ Ready")

    def text_to_arpabet(self, text):
        """
        Convert text → ARPAbet phoneme string.
        - Strips stress digits (AY1 → AY)
        - Inserts | between words
        - Filters to VALID_PHONEMES only
        """
        if not text:
            return "", []

        raw_seq = self.g2p(text)
        phonemes = []

        for p in raw_seq:
            if p == ' ':
                if not phonemes or phonemes[-1] != '|':
                    phonemes.append('|')
                continue

            # Strip stress digits
            p_clean = re.sub(r'\d', '', p)

            if p_clean in VALID_PHONEMES:
                phonemes.append(p_clean)

        # Remove trailing separator
        if phonemes and phonemes[-1] == '|':
            phonemes.pop()

        phoneme_str = ' '.join(p if p != '|' else '|' for p in phonemes)
        return phoneme_str, phonemes

    def extract_commands(self, phoneme_list):
        """
        Extract iPhoneme command phonemes from a phoneme list.
        Returns list of command phonemes found (in order).
        """
        return [p for p in phoneme_list if p in COMMAND_PHONEMES]


# ── Whisper Stream Reader ──
class WhisperStream:
    def __init__(self, whisper_path, model_path, converter):
        self.whisper_path = whisper_path
        self.model_path = model_path
        self.converter = converter
        self.process = None
        self.running = False
        self.last_text = ""
        self.recent_texts = deque(maxlen=10)
        self.event_queue = queue.Queue()
        self._thread = None

    def get_cmd(self):
        stream_bin = os.path.join(self.whisper_path, "stream")
        return [
            stream_bin,
            "-m", self.model_path,
            "--step", "200",         # 200ms update interval
            "--length", "3000",      # 3s audio window
            "--keep", "200",         # keep 200ms overlap
            "-t", "4",               # 4 threads
            "-l", "en",              # English
            "--vad-thold", "0.7",    # VAD threshold
            "--freq-thold", "200",   # Freq threshold
        ]

    def start(self):
        if self.running:
            return
        self.running = True
        cmd = self.get_cmd()
        print(f"[Whisper] Starting: {' '.join(cmd)}")

        try:
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            print(f"[Whisper] ✓ Started (PID: {self.process.pid})")
        except Exception as e:
            print(f"[Whisper] ✗ Failed: {e}")
            self.running = False
            return

        self._thread = threading.Thread(target=self._read_loop, daemon=True)
        self._thread.start()

    def _read_loop(self):
        """Read whisper stdout in a background thread."""
        try:
            for line in self.process.stdout:
                if not self.running:
                    break

                # Strip ANSI escapes
                line = ANSI_RE.sub('', line).strip()
                if not line:
                    continue

                # Log raw output
                print(f"[whisper.cpp] {line}")

                # ── Filter 1: Status/init lines ──
                if (line.startswith('[') or
                    line.startswith('init:') or
                    line.startswith('whisper') or
                    line.startswith('ggml') or
                    line.startswith('main:')):
                    continue

                # ── Filter 2: Too short / hallucinations ──
                if len(line.strip()) < 3:
                    continue
                if line.lower().strip() in HALLUCINATIONS:
                    continue

                # ── Filter 3: Deduplication ──
                if line == self.last_text:
                    continue
                if line in self.recent_texts:
                    continue

                self.last_text = line
                self.recent_texts.append(line)

                # ── Convert to phonemes ──
                phoneme_str, phoneme_list = self.converter.text_to_arpabet(line)
                commands = self.converter.extract_commands(phoneme_list)

                if not phoneme_str:
                    continue

                print(f"[Phoneme] '{line}' → {phoneme_str}")
                if commands:
                    print(f"[Command] Detected command phonemes: {commands}")

                # Build event
                event = {
                    'type': 'phoneme_result',
                    'text': line,
                    'phonemes': phoneme_str,
                    'phoneme_list': phoneme_list,
                    'commands': commands,
                    'timestamp': time.time()
                }

                # Push to thread-safe queue
                self.event_queue.put(event)

        except Exception as e:
            print(f"[Whisper] Read error: {e}")

        retcode = self.process.poll()
        if retcode is not None:
            print(f"[Whisper] Process exited with code {retcode}")

    def stop(self):
        self.running = False
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.process.kill()
            print("[Whisper] ✓ Stopped")
            self.process = None


# ── WebSocket Server ──
class PhonemeServer:
    def __init__(self, whisper_stream, port=8765):
        self.whisper = whisper_stream
        self.port = port
        self.clients = set()

    async def handler(self, websocket):
        """Handle a new client connection."""
        self.clients.add(websocket)
        client_addr = websocket.remote_address
        print(f"[WS] Client connected: {client_addr} (total: {len(self.clients)})")

        # Send welcome message
        await websocket.send(json.dumps({
            'type': 'connected',
            'message': 'iPhoneme Phoneme Server',
            'validPhonemes': sorted(list(VALID_PHONEMES)),
            'commandPhonemes': sorted(list(COMMAND_PHONEMES))
        }))

        try:
            async for message in websocket:
                # Handle client commands
                try:
                    data = json.loads(message)
                    cmd = data.get('command', '')

                    if cmd == 'ping':
                        await websocket.send(json.dumps({'type': 'pong'}))
                    elif cmd == 'status':
                        await websocket.send(json.dumps({
                            'type': 'status',
                            'whisperRunning': self.whisper.running,
                            'clients': len(self.clients)
                        }))
                except json.JSONDecodeError:
                    pass
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.discard(websocket)
            print(f"[WS] Client disconnected: {client_addr} (total: {len(self.clients)})")

    async def broadcast_loop(self):
        """Continuously poll the thread-safe queue and broadcast to all clients."""
        while True:
            try:
                # Poll the thread-safe queue (non-blocking)
                try:
                    event = self.whisper.event_queue.get_nowait()
                except queue.Empty:
                    await asyncio.sleep(0.05)  # 50ms poll interval
                    continue

                if not self.clients:
                    continue

                message = json.dumps(event)
                # Broadcast to all connected clients
                disconnected = set()
                for client in self.clients:
                    try:
                        await client.send(message)
                    except websockets.exceptions.ConnectionClosed:
                        disconnected.add(client)

                self.clients -= disconnected

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[WS] Broadcast error: {e}")
                await asyncio.sleep(0.1)

    async def run(self):
        """Start the WebSocket server."""
        # Start whisper stream
        self.whisper.start()

        # Start broadcast loop
        broadcast_task = asyncio.create_task(self.broadcast_loop())

        print(f"\n{'='*50}")
        print(f"  iPhoneme Phoneme Server")
        print(f"  WebSocket: ws://localhost:{self.port}")
        print(f"  Whisper.cpp: {'Running' if self.whisper.running else 'Failed'}")
        print(f"{'='*50}\n")

        try:
            async with websockets.serve(self.handler, "localhost", self.port):
                await asyncio.Future()  # Run forever
        except asyncio.CancelledError:
            pass
        finally:
            broadcast_task.cancel()
            self.whisper.stop()


def main():
    parser = argparse.ArgumentParser(description='iPhoneme Phoneme Server')
    parser.add_argument('--port', type=int, default=8765,
                        help='WebSocket server port (default: 8765)')
    parser.add_argument('--whisper-path', type=str,
                        default=None,
                        help='Path to whisper.cpp directory containing stream binary')
    parser.add_argument('--model', type=str,
                        default=None,
                        help='Path to whisper model file')
    args = parser.parse_args()

    # Resolve whisper paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)  # iPhoneme/..

    if args.whisper_path:
        whisper_path = args.whisper_path
    else:
        # Try known locations
        candidates = [
            os.path.join(project_root, "gesture-demo-deploy", "server", "whisper"),
            os.path.join(project_root, "server", "whisper"),
        ]
        whisper_path = None
        for c in candidates:
            if os.path.isdir(c) and os.path.isfile(os.path.join(c, "stream")):
                whisper_path = c
                break
        if not whisper_path:
            print("ERROR: Could not find whisper.cpp stream binary.")
            print("  Try: --whisper-path /path/to/whisper/dir")
            print(f"  Searched: {candidates}")
            sys.exit(1)

    if args.model:
        model_path = args.model
    else:
        model_path = os.path.join(whisper_path, "models", "ggml-base.en-q5_1.bin")

    # Validate
    stream_bin = os.path.join(whisper_path, "stream")
    if not os.path.isfile(stream_bin):
        print(f"ERROR: stream binary not found at: {stream_bin}")
        sys.exit(1)
    if not os.path.isfile(model_path):
        print(f"ERROR: model not found at: {model_path}")
        sys.exit(1)

    os.chmod(stream_bin, 0o755)
    print(f"[Config] Whisper binary: {stream_bin}")
    print(f"[Config] Model: {model_path}")

    # Initialize
    converter = PhonemeConverter()
    whisper = WhisperStream(whisper_path, model_path, converter)
    server = PhonemeServer(whisper, port=args.port)

    # Run
    try:
        asyncio.run(server.run())
    except KeyboardInterrupt:
        print("\n[Server] Shutting down...")
        whisper.stop()


if __name__ == '__main__':
    main()
