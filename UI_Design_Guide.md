# 🎨 UI Design System & Interaction Guide
This document details the visual style, animations, and interaction logic used in the Real-Time Phoneme Decoder.

## 1. Visual Concept: Modern Glassmorphism
The design uses a dark, semi-transparent aesthetic to emphasize "futuristic" and "high-tech" vibes suitable for a BCI/Voice interface.
- **Background**: Deep gradient (Navy to Blue)
- **Cards**: Semi-transparent white with blur (Glass effect)
- **Active State**: Neon Mint (#7bed9f) for high contrast visibility

---

## 2. Color Palette
| Name | Hex Code | Usage |
|:---|:---|:---|
| **Deep Ocean** | `#1e3c72` → `#2a5298` | Main Background Gradient |
| **Neon Mint** | `#7bed9f` | **Active Trigger**, Phoneme Text, Highlights |
| **Alert Red** | `#ff4757` | Microphones, Stop Buttons |
| **Glass White** | `rgba(255, 255, 255, 0.1)` | Inactive Cards, Containers |
| **Text White** | `rgba(255, 255, 255, 0.9)` | Primary Text |

---

## 3. Interaction & Animation Logic

### A. The "Pop & Glow" Effect (Active State)
When a phoneme triggers a card, it doesn't just change color; it **scales up** and **glows**.

**CSS Snippet:**
```css
/* Base Card Style */
.card {
    background: rgba(255, 255, 255, 0.05); /* Subtle Glass */
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Bouncy Transition */
}

/* 🌟 Active State (Triggered) */
.card.active {
    background: #7bed9f;           /* Neon Mint Background */
    color: #1e3c72;                /* Dark Text for Contrast */
    border-color: #7bed9f;         
    transform: scale(1.15);        /* Pop Effect (15% larger) */
    box-shadow: 0 0 30px rgba(123, 237, 159, 0.6); /* Outer Glow */
}
```

### B. JavaScript Trigger Logic
The JS adds the `.active` class temporarily to create a "flash" effect.

**Logic Flow:**
1. Listen to Phoneme Stream.
2. Detect Target Phoneme (e.g., "AY").
3. **Add Class**: `card.classList.add('active')`
4. **Wait**: Set a timeout for 800ms.
5. **Remove Class**: `card.classList.remove('active')`

```javascript
function triggerVisual(elementId) {
    const el = document.getElementById(elementId);
    
    // Reset others
    document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
    
    // Activate current
    el.classList.add('active');
    
    // Auto-reset after 0.8s
    setTimeout(() => {
        el.classList.remove('active');
    }, 800);
}
```

---

## 4. Phoneme Stream Design
Phonemes are displayed as a stream of "tags" rather than plain text to look like code tokens.

**CSS Snippet:**
```css
.phoneme-tag {
    font-family: 'Courier New', monospace; /* Monospace for code look */
    color: #7bed9f;
    border: 1px solid rgba(123, 237, 159, 0.5);
    background: rgba(123, 237, 159, 0.1);
    padding: 2px 8px;
    border-radius: 4px;
    margin-right: 6px;
    display: inline-block;
}
```

## 5. Microphone Button Animation
To indicate "Listening" state without text, the button pulses.

**CSS Animation:**
```css
@keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.7); }
    70% { box-shadow: 0 0 0 20px rgba(255, 71, 87, 0); } /* Expands & Fades */
    100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); }
}

.record-btn.recording {
    animation: pulse 1.5s infinite;
    background: white;
    color: #ff4757;
}
```

---
**Summary for Developer:**
- Use **Classes** (`.active`, `.recording`) to toggle states.
- Rely on **CSS Transitions** for smoothness (don't animate with JS).
- Key Colors: `#1e3c72` (Bg), `#7bed9f` (Active), `#ff4757` (Record).
