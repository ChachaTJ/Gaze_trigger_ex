# B2TXT Phoneme Decoder API Integration Guide

This guide provides instructions for integrating the local B2TXT Phoneme Decoding engine into external web applications. This service consolidates **neural decoding**, **audio-to-phoneme conversion**, and **real-time phoneme streaming** into a single API server.

## 1. Overview & Connection

The API server runs locally on **PORT 5001**.
To access it from an external web app (HTTPS), we expose it via `ngrok`.

### Base URL
- **Local:** `http://localhost:5001`
- **Remote (HTTPS):** `https://[YOUR-NGROK-ID].ngrok-free.app` (Run `ngrok http 5001`)

---

## 2. Real-Time Streaming (WebSocket)

Connect via **Socket.IO** to receive real-time phoneme updates from the local microphone/engine.

### Connection
**Protocol:** Socket.IO v4+ (WebSocket + Polling)

```javascript
import io from 'socket.io-client';

// Remote connection (via ngrok)
const socket = io('https://your-ngrok-url.app', {
    transports: ['websocket', 'polling'] 
});
```

### Events

#### Send Audio (Client -> Server)
Send raw **Float32** audio buffers (PCM, 16kHz preferred).

```javascript
// Example: Using AudioContext ScriptProcessor
processor.onaudioprocess = (e) => {
    const rawData = e.inputBuffer.getChannelData(0); // Float32Array
    socket.emit('audio_raw', rawData.buffer);       // Send ArrayBuffer
};
```

#### Receive Results (Server -> Client)
Receive transcribed text and ARPAbet phonemes.

```javascript
socket.on('result', (data) => {
    console.log(data);
    // {
    //   "text": "hello",
    //   "phonemes": "HH AH L OW"
    // }
    
    // Example: Trigger Action on Phoneme
    if (data.phonemes.includes('AY')) {
        triggerSelectAction();
    }
});
```

---

## 3. REST API Endpoints

### 3.1 Neural Decoding (`/predict`)
Uploads a Neural HDF5/MAT file and returns decoded phonemes.

- **Method:** `POST`
- **Body:** `multipart/form-data` with `file`
- **Response:**
```json
{
  "results": [
    {
      "phonemes": "AY L AY K",
      "confidences": [0.99, 0.85, 0.99, 0.95],
      "confusion_analysis": { ... },
      "brain_activity": { ... }
    }
  ]
}
```

### 3.2 Post-Processing (`/generate_sentence`)
Converts a raw phoneme string into a coherent sentence using LLM (Claude).

- **Method:** `POST`
- **Body:**
```json
{
  "phonemes": "AY L AY K"
}
```
- **Response:**
```json
{
  "primary_sentence": "I like",
  "alternatives": ["I lie", "Eye like"],
  "confidence": 0.92
}
```
---

## 4. Implementation Checklist for Developers
1. [ ] Ensure `ngrok http 5001` is running on the local machine.
2. [ ] Update the Web App's API_URL config with the new ngrok address.
3. [ ] For streaming:
   - Ensure the browser page is HTTPS (required for `navigator.mediaDevices`).
   - Connect Socket.IO to the same ngrok URL.

---

## 5. Reference Demo Logic (Eye Gaze + Voice)

To replicate the **"Eye Gaze + Voice"** experience in your application, you can map specific **Vowel Phonemes** to UI actions. This allows users to "look" at a button and "make a sound" to trigger it.

### Recommended Phoneme Triggers (Optimized for Accuracy)
Based on our confusion matrix analysis, these are the **most distinct** sounds with >95% accuracy:

| Voice Sound | Phoneme | Accuracy | Action | Mnemonic |
|:---:|:---:|:---:|:---|:---|
| **"Eye"** | `AY` | **95%** | **Select** | "Aye!" (Select) |
| **"Oooo"** | `UW` | **100%** | **Scroll** | "Move" (Smooth) |
| **"Ow!"** | `AW` | **96%** | **Back** | "Out" (Go back) |
| **"Ye"** | `Y` | **99%** | **Home** | "Yes" (Confirm) |

*> Note: `UW` (Blue) and `AW` (Cow) are statistically the least confused sounds in our model.*

### Implementation Example
```javascript
// Check the last 1-2 received phonemes
const triggers = {
    'AY': 'CLICK', 'EY': 'CLICK', // Select
    'UW': 'SCROLL',               // Scroll (High Acc)
    'AW': 'BACK',                 // Back (High Acc)
    'Y':  'HOME'                  // Home (High Acc)
};

socket.on('result', (data) => {
    // data.phonemes = "HH AY L OW"
    const phonemeList = data.phonemes.split(' ');
    // Check last 2 phonemes to catch diphthongs/transitions
    const recent = phonemeList.slice(-2);
    
    recent.forEach(p => {
        if (triggers[p]) {
            console.log(`🎯 Trigger Action: ${triggers[p]}`);
            // Execute Action
        }
    });
});
```

