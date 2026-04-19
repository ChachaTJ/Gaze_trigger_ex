# 👁️ Gaze Controller API Guide

A drop-in JavaScript module for browser-based eye tracking control.

## Quick Start

```html
<!-- 1. Include WebGazer.js -->
<script src="https://webgazer.cs.brown.edu/webgazer.js"></script>

<!-- 2. Include Gaze Controller -->
<script src="gaze_controller.js"></script>

<!-- 3. Initialize -->
<script>
  // Start eye tracking (auto-shows calibration)
  GazeController.init();
  
  // Register clickable elements
  GazeController.registerTargets('.my-buttons');
  
  // Listen for dwell clicks (1.5s gaze = click)
  GazeController.on('gazeDwell', (element) => {
    element.click();
  });
</script>
```

---

## API Reference

### `GazeController.init(options)`
Initialize eye tracking and start webcam.

**Options:**
| Option | Default | Description |
|:---|:---|:---|
| `DWELL_TIME` | `1500` | Milliseconds to gaze before triggering click |
| `GAZE_TOLERANCE` | `50` | Pixel tolerance for element detection |
| `SHOW_PREDICTION` | `true` | Show gaze dot on screen |
| `SHOW_VIDEO` | `false` | Show webcam preview |

```javascript
GazeController.init({
  DWELL_TIME: 2000,     // 2 seconds
  SHOW_PREDICTION: true
});
```

---

### `GazeController.registerTarget(element)`
Register a single DOM element as a gaze-interactive target.

```javascript
const btn = document.getElementById('my-button');
GazeController.registerTarget(btn);
```

---

### `GazeController.registerTargets(selector)`
Register multiple elements using a CSS selector.

```javascript
// All elements with class "gaze-btn"
GazeController.registerTargets('.gaze-btn');

// All buttons
GazeController.registerTargets('button');
```

---

### `GazeController.on(event, callback)`
Subscribe to gaze events.

**Available Events:**

| Event | Trigger | Callback Arg |
|:---|:---|:---|
| `gazeEnter` | User starts looking at element | `element` |
| `gazeLeave` | User looks away from element | `element` |
| `gazeDwell` | User gazed for DWELL_TIME | `element` |
| `calibrationComplete` | Calibration finished | none |

```javascript
GazeController.on('gazeEnter', (el) => {
  el.style.boxShadow = '0 0 10px #7bed9f';
});

GazeController.on('gazeLeave', (el) => {
  el.style.boxShadow = 'none';
});

GazeController.on('gazeDwell', (el) => {
  console.log('Clicked via gaze:', el);
  el.click();
});
```

---

### `GazeController.showCalibration()`
Manually trigger the calibration UI.

```javascript
document.getElementById('recalibrate-btn').onclick = () => {
  GazeController.showCalibration();
};
```

---

### `GazeController.resetCalibration()`
Clear saved calibration data and restart calibration.

```javascript
GazeController.resetCalibration();
```

---

### `GazeController.pause()` / `resume()`
Temporarily pause or resume eye tracking.

```javascript
// Pause when showing a modal
modal.onopen = () => GazeController.pause();
modal.onclose = () => GazeController.resume();
```

---

### `GazeController.destroy()`
Completely stop tracking and clean up.

```javascript
GazeController.destroy();
```

---

## CSS Classes (Auto-Applied)

| Class | Applied When |
|:---|:---|
| `.gaze-target` | Element is registered as a target |
| `.gaze-active` | User is currently looking at element |
| `.gaze-clicked` | Element was just triggered (flash effect) |

**Example Styling:**
```css
.gaze-active {
  box-shadow: 0 0 20px rgba(123, 237, 159, 0.5);
  transform: scale(1.02);
}

.gaze-clicked {
  background: #7bed9f;
  transform: scale(0.95);
}
```

---

## Integration with Voice Phonemes

Combine gaze control with voice shortcuts for a complete hands-free experience:

```javascript
// Voice server connection
const socket = io('http://localhost:5003');

// Voice -> Action mapping
const voiceActions = { 'AY': 'click', 'AW': 'back' };

socket.on('result', (data) => {
  const phonemes = data.phonemes.split(' ');
  const last = phonemes[phonemes.length - 1];
  
  if (voiceActions[last] === 'click') {
    // Click the element user is currently looking at
    const activeEl = document.querySelector('.gaze-active');
    if (activeEl) activeEl.click();
  }
});
```

---

## Browser Support
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Edge 79+
- ✅ Safari 11+
- ❌ Mobile browsers (webcam API limitations)

---

## Privacy Note
All processing happens **client-side**. No video data is sent to any server.
