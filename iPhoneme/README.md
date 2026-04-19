# iPhoneme — ALS-Oriented Proxy Experiment Prototype

## Overview

**iPhoneme** is an experiment prototype that evaluates phoneme-confirmed gaze interaction as a richer command vocabulary for ALS-oriented communication systems. It integrates webcam-based head tracking with phoneme event detection to test whether explicit phoneme confirmation reduces unintended activations (Midas Touch) and supports more than binary click replacement.

> ⚠️ **Research Framing Disclaimer**
> 
> This prototype implements a **proxy / analogue evaluation** of an ALS-oriented interaction concept using an **emulated phoneme detector**. It does not validate ALS end-user efficacy and is not a substitute for representative-user testing with ALS participants. The study uses nondisabled proxy participants under ALS-relevant detector constraints (configurable latency, miss rate, and false positive rate).

## Prerequisites

- Modern web browser (Chrome or Edge recommended)
- Webcam (for head/face tracking)
- No backend server required for keyboard/emulated modes

## Quick Start

1. Start a local HTTP server from the project root:
   ```bash
   cd "/path/to/CPU _ Phoneme Decoder"
   python3 -m http.server 8080
   ```

2. Open in browser:
   ```
   http://localhost:8080/iPhoneme/
   ```

3. Fill in participant/session ID and click **Start Experiment Session**

4. Calibrate head tracking using the ⚙️ button (or Alt+H)

5. Use the experimenter panel (⚙️ toggle on right edge) to start trials

## Experimental Conditions

| Condition | Pointing | Confirmation | Commands |
|-----------|----------|-------------|----------|
| A: Dwell Baseline | Head tracking | 800ms dwell | Select only |
| B: Binary Phoneme | Head tracking | AY phoneme only | Select only |
| C: Rich iPhoneme | Head tracking | Phoneme vocabulary | AY=Select, AW=Back, UW=Swipe, Y=Drag |

## Task Types

1. **Directed Selection** — Select a highlighted target in a grid
2. **Browse & Select** — Browse targets without acting, then select the final one
3. **Swipe Navigation** — Navigate a carousel to reach a target card
4. **Text Selection** — Hold Y phoneme to drag-select words in a sentence

## Keyboard Debug Provider

For testing without voice input:

| Key | Phoneme | Action |
|-----|---------|--------|
| `1` | AY | Select / Commit |
| `2` | AW | Back / Cancel |
| `3` | UW | Swipe / Next |
| `4` (hold) | Y | Drag / Text Selection (onset→offset) |

## Architecture

```
iPhoneme/
├── index.html              # Entry point
├── css/experiment.css       # Styles
├── js/
│   ├── experiment_app.js    # Main controller
│   ├── phoneme_manager.js   # Provider abstraction
│   ├── condition_engine.js  # A/B/C conditions
│   ├── task_engine.js       # Trial sequencing
│   ├── logger.js            # JSONL logging
│   ├── providers/           # Keyboard, Emulated, Live
│   └── tasks/               # 4 task implementations
├── config/                  # experiment.default.json
├── data/                    # task_definitions.json, logs/
└── scripts/                 # analyze_logs.py
```

## Logging

All events are logged as JSONL and can be exported via the experimenter panel. Each event includes timestamp, participant/session IDs, condition, task type, trial index, and event-specific payload.

## Analysis

```bash
python3 scripts/analyze_logs.py --input data/logs/
```

See [RUN_EXPERIMENT.md](RUN_EXPERIMENT.md) for detailed experiment procedures.
