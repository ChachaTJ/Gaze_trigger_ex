# Running the iPhoneme Experiment

## Pre-Session Checklist

- [ ] Browser: Chrome or Edge (latest)
- [ ] Webcam: connected and working
- [ ] Lighting: adequate for face detection
- [ ] Local server running (see below)
- [ ] Participant ID and condition order prepared

## Starting the Server

```bash
cd "/path/to/CPU _ Phoneme Decoder"
python3 -m http.server 8080
```

Open: `http://localhost:8080/iPhoneme/`

## Session Protocol

### 1. Setup (2 min)

1. Enter **Participant ID** (e.g., P01, P02, ...)
2. Enter **Session ID** (e.g., S01)
3. Select **initial condition** based on counterbalance order:
   - Participant 1: Dwell → Binary → Rich
   - Participant 2: Binary → Rich → Dwell
   - Participant 3: Rich → Dwell → Binary
   - (Repeats with 6 Latin-square orders)
4. Select **Phoneme Provider**:
   - **Keyboard Debug**: for testing (keys 1-4)
   - **Emulated Detector**: for the actual study (adds latency, miss rate)
   - **Live Voice**: for demos only
5. Click **Start Experiment Session**

### 2. Calibration (3 min)

1. Click **⚙️ Head Calibration** (or press Alt+H)
2. Follow the 6-step calibration (center, left, right, up, down, center)
3. Optionally calibrate mouth click via **👄 Mouth Calibration** (Alt+M)
4. Verify the gaze cursor tracks your head movement

### 3. Training Block (5 min per condition)

1. Open experimenter panel (⚙️ button on right edge)
2. Check **Practice Mode**
3. Select each task type and run 3 practice trials
4. Ensure the participant understands the commands

### 4. Experiment Blocks (10 min per condition)

For each condition (counterbalanced):

1. Set condition via experimenter panel
2. Uncheck Practice Mode
3. For each task type (directed_selection, browse_select, swipe_navigation, drag_text_select):
   a. Select the task type
   b. Click **▶ Start**
   c. Let the participant complete 5 trials
   d. Click **⏭ Next** to skip if needed
4. After all 4 task types: click **📋 Questionnaire**
5. Participant fills out NASA-TLX and interaction quality scales

### 5. Between Conditions

1. Click **Apply Condition** to switch conditions
2. Brief explanation of new commands
3. Run training block for new condition
4. Run experiment block

### 6. Final Debrief

1. After all 3 conditions are complete
2. Show final preference questionnaire
3. Click **📥 Export Logs** to download the session JSONL
4. Save the file to `data/logs/<participant_id>/`

## ALS Simulation Settings

For the actual study with the **Emulated Detector** provider:

| Parameter | Default | Range |
|-----------|---------|-------|
| Confirmation Latency | 180ms | 0-500ms |
| Hold Min | 300ms | 100-1000ms |
| Hold Max | 700ms | 200-2000ms |
| Miss Rate | 0% | 0-30% |
| False Positive Rate | 0% | 0-10% |
| Cooldown | 500ms | 200-1000ms |

Recommended study settings:
- **Low noise**: latency=180ms, miss=0%, FP=0%
- **Medium noise**: latency=180ms, miss=10%, FP=2%

## Troubleshooting

- **Head tracking not starting**: Ensure webcam permissions are granted. Try refreshing.
- **Cursor jittery**: Run head calibration again. Ensure good lighting.
- **Keys not working**: Click somewhere in the page first (not in an input field).
- **No logs**: Logs are in-memory. Always export before closing the browser.

## Data Files

After export, organize as:
```
data/logs/
├── P01/
│   └── P01_S01_1713471000000.jsonl
├── P02/
│   └── P02_S01_1713471100000.jsonl
└── ...
```

Then run analysis:
```bash
python3 scripts/analyze_logs.py --input data/logs/ --output data/results/
```
