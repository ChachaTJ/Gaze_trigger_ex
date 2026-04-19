/**
 * Live Voice Phoneme Provider (Whisper + G2P)
 * 
 * Connects to the iPhoneme phoneme server via WebSocket.
 * The server runs whisper.cpp stream → g2p_en → ARPAbet phonemes.
 * 
 * Receives real-time phoneme events and maps command phonemes
 * (AY, AW, UW, Y) to iPhoneme actions.
 * 
 * Server: iPhoneme/server/phoneme_server.py
 * Protocol: ws://localhost:8765
 */

export class LiveVoiceProvider {
    constructor(config = {}) {
        this.listeners = [];
        this.active = false;
        this.ws = null;
        this.connected = false;
        this.reconnectTimer = null;
        this.reconnectInterval = 3000;
        
        // Server config
        this.serverUrl = config.serverUrl ?? 'ws://localhost:8765';
        
        // Cooldown to prevent rapid-fire commands from a single utterance
        this.cooldownMs = config.cooldownMs ?? 600;
        this.lastCommandTime = {};  // per-phoneme cooldowns
        
        // Y hold state — inferred from consecutive Y detections
        this.yHeld = false;
        this.yLastSeen = 0;
        this.yHoldTimeout = null;
        this.yHoldThresholdMs = config.yHoldThresholdMs ?? 400; // ms without Y = release
        this.yStartTime = 0;
        
        // Full phoneme stream display
        this.onPhonemeStream = null; // optional callback for full stream display
        this.lastPhonemeStr = '';
    }

    async start() {
        if (this.active) return;
        this.active = true;
        
        this._connect();
        console.log('[LiveVoiceProvider] Starting — connecting to', this.serverUrl);
    }

    _connect() {
        if (!this.active) return;
        
        try {
            this.ws = new WebSocket(this.serverUrl);
            
            this.ws.onopen = () => {
                this.connected = true;
                console.log('[LiveVoiceProvider] ✓ Connected to phoneme server');
                
                // Clear reconnect timer
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
            };

            this.ws.onmessage = (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    this._handleServerMessage(data);
                } catch (e) {
                    console.warn('[LiveVoiceProvider] Parse error:', e);
                }
            };

            this.ws.onclose = () => {
                this.connected = false;
                console.log('[LiveVoiceProvider] Disconnected');
                
                // Auto-reconnect
                if (this.active && !this.reconnectTimer) {
                    this.reconnectTimer = setTimeout(() => {
                        console.log('[LiveVoiceProvider] Reconnecting...');
                        this.reconnectTimer = null;
                        this._connect();
                    }, this.reconnectInterval);
                }
            };

            this.ws.onerror = (err) => {
                console.error('[LiveVoiceProvider] WebSocket error:', err);
            };
            
        } catch (err) {
            console.error('[LiveVoiceProvider] Connection failed:', err);
            
            // Schedule reconnect
            if (this.active && !this.reconnectTimer) {
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectTimer = null;
                    this._connect();
                }, this.reconnectInterval);
            }
        }
    }

    _handleServerMessage(data) {
        if (data.type === 'connected') {
            console.log('[LiveVoiceProvider] Server info:', data.message);
            console.log('[LiveVoiceProvider] Command phonemes:', data.commandPhonemes);
            return;
        }

        if (data.type === 'pong') return;

        if (data.type === 'phoneme_result') {
            const { text, phonemes, phoneme_list, commands, timestamp } = data;
            
            // Notify full phoneme stream (for display)
            if (this.onPhonemeStream && phonemes !== this.lastPhonemeStr) {
                this.lastPhonemeStr = phonemes;
                this.onPhonemeStream(text, phonemes);
            }
            
            // Process command phonemes
            if (commands && commands.length > 0) {
                this._processCommands(commands, timestamp);
            }
        }
    }

    _processCommands(commands, serverTimestamp) {
        const now = performance.now();
        
        for (const phoneme of commands) {
            // Per-phoneme cooldown
            const lastTime = this.lastCommandTime[phoneme] || 0;
            if ((now - lastTime) < this.cooldownMs) {
                continue;
            }
            this.lastCommandTime[phoneme] = now;
            
            if (phoneme === 'Y') {
                // Y triggers sustained hold logic
                this._handleYDetection(now);
            } else {
                // Discrete commands: AY, AW, UW
                this._emit({
                    phoneme,
                    phase: 'discrete',
                    source: 'live',
                    confidence: 0.8,
                    emittedAt: now,
                    detectorLatencyMs: 0,
                    synthetic: false
                });
            }
        }
    }

    /**
     * Y hold inference:
     * Whisper detects "Y" phoneme repeatedly while being spoken.
     * We infer onset when first Y appears, and offset when Y stops
     * appearing for yHoldThresholdMs.
     */
    _handleYDetection(now) {
        this.yLastSeen = now;
        
        if (!this.yHeld) {
            // Start hold
            this.yHeld = true;
            this.yStartTime = now;
            
            this._emit({
                phoneme: 'Y',
                phase: 'start',
                source: 'live',
                confidence: 0.8,
                emittedAt: now,
                detectorLatencyMs: 0,
                synthetic: false
            });
        }
        
        // Reset release timer
        if (this.yHoldTimeout) {
            clearTimeout(this.yHoldTimeout);
        }
        this.yHoldTimeout = setTimeout(() => {
            this._releaseY();
        }, this.yHoldThresholdMs);
    }

    _releaseY() {
        if (!this.yHeld) return;
        
        const now = performance.now();
        const holdDuration = now - this.yStartTime;
        this.yHeld = false;
        
        this._emit({
            phoneme: 'Y',
            phase: 'end',
            source: 'live',
            confidence: 0.8,
            emittedAt: now,
            detectorLatencyMs: 0,
            synthetic: false,
            holdDurationMs: holdDuration,
            holdValid: holdDuration >= 300
        });
        
        this.yStartTime = 0;
    }

    stop() {
        this.active = false;
        
        if (this.yHeld) {
            this._releaseY();
        }
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.yHoldTimeout) {
            clearTimeout(this.yHoldTimeout);
            this.yHoldTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.connected = false;
        console.log('[LiveVoiceProvider] Stopped');
    }

    onPhoneme(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    _emit(event) {
        this.listeners.forEach(cb => {
            try { cb(event); } catch (e) { console.error('[LiveVoiceProvider] Listener error:', e); }
        });
    }

    isYHeld() {
        return this.yHeld;
    }

    isConnected() {
        return this.connected;
    }

    getType() {
        return 'live';
    }
}
