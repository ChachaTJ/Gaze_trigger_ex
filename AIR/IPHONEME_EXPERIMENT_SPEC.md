# iPhoneme Proxy Experiment Spec for ASSETS

## Purpose
This document is a build spec and research handoff for implementing an experiment prototype based on the existing `gaze_demo` program.

The target paper is still an ALS-oriented paper. The interaction concept is intended for an `ALS + phoneme detector` environment. However, because representative ALS participants and EEG-based phoneme decoding are not currently available, the implementation and study in this phase should be framed as an `analogue / proxy evaluation of the interaction mechanism under ALS-relevant constraints`, not as end-user validation with ALS participants.

The core claim to preserve is:

- `iPhoneme` is not only a click replacement.
- Its main contribution is a `richer command vocabulary` in which gaze-like pointing specifies `where`, and phoneme events specify `when` and `how`.
- The richer vocabulary should support:
  - selection
  - back or cancel
  - swipe-style navigation
  - drag-style interaction
  - text selection

## Source References

Use these as the implementation reference:

- Main interaction reference:
  - `/Users/chayoonmin/Downloads/CPU _ Phoneme Decoder/gaze_demo.html`
  - `/Users/chayoonmin/Downloads/CPU _ Phoneme Decoder/head_tracker.js`
  - `/Users/chayoonmin/Downloads/CPU _ Phoneme Decoder/head_calibration.js`
  - `/Users/chayoonmin/Downloads/CPU _ Phoneme Decoder/mouth_calibration.js`
- Paper draft reference:
  - `/Users/chayoonmin/Downloads/assets_iphoneme_main_tex.txt`

Important notes from the current reference implementation:

- `gaze_demo` already has:
  - face/head-tracked pointing
  - dwell behavior
  - mouth click behavior
  - phoneme-to-command mapping for `AY`, `AW`, `UW`, `Y`
- `gaze_demo` does not yet implement a complete richer vocabulary based on phoneme onset and offset for drag, text selection, and swipe interaction.
- Some current demo files have stale port assumptions such as `5003`; the new implementation should unify the backend around one port and avoid hidden mismatches.

## Research Positioning

### What the prototype is for

The prototype should support an ASSETS-style experiment that tests whether phoneme-confirmed gaze interaction:

1. reduces unintended activation relative to dwell-based interaction
2. supports a richer command vocabulary than binary confirm alone
3. remains plausible under ALS-relevant latency and detector unreliability

### What the prototype is not for

The prototype should not present itself as:

- clinically validated for ALS users
- an actual EEG-based deployment
- a substitute for representative-user evaluation

Use wording like:

- `ALS-oriented interaction concept`
- `proxy-user analogue study`
- `emulated phoneme detector`
- `ALS-relevant latency and detector constraints`

Avoid wording like:

- `validated for ALS`
- `tested with ALS-equivalent users`
- `eye tracking replacement for ALS users`

## Experimental Conditions

Implement three conditions in the same prototype so the experimenter can switch conditions without changing apps.

### Condition A: Dwell Baseline

- Pointing modality: webcam-based face/head-tracked pointing
- Selection: dwell-based
- Recommended dwell threshold: `800 ms`
- Purpose: baseline for accidental activation and slower but familiar gaze-style confirmation

### Condition B: Binary Phoneme Confirm

- Pointing modality: same face/head-tracked pointing
- Confirmation: one explicit phoneme trigger only
- Recommended trigger: `AY`
- Supported actions:
  - select / commit
  - optional cancel via UI button, but no full richer vocabulary
- Purpose: test whether explicit confirmation reduces Midas Touch even before richer commands are added

### Condition C: Rich iPhoneme Vocabulary

- Pointing modality: same face/head-tracked pointing
- Confirmation and command primitives should use phoneme events
- Required minimum command set:
  - `AY`: select / commit
  - `AW`: back / cancel
  - `UW`: swipe or next / scroll down
  - `Y`: hold-to-drag or hold-to-start-selection, release-to-end
- The implementation must support onset, active state, and offset for at least one sustained command.
- Purpose: test the actual paper claim that phoneme-mediated interaction supports more than binary click replacement.

## Phoneme Event Model

The prototype must not hard-wire itself to live Whisper-based STT only.

Instead, implement a `phoneme event abstraction layer` with at least two interchangeable providers:

### Provider 1: Live Voice Proxy

- Uses microphone input
- Can be based on the current pipeline or a simplified command spotter
- Emits normalized phoneme command events
- Best for demos and qualitative validation

### Provider 2: Emulated Detector

- Simulates an EEG or phoneme detector environment
- Allows experimenter control of:
  - latency
  - miss rate
  - false positive rate
  - onset / offset timing
- This provider is required for the actual experiment because it lets the study test `ALS-relevant detector constraints` without requiring EEG hardware

### Recommended Event Shape

Use a normalized event model similar to:

```ts
type PhonemeEvent = {
  phoneme: "AY" | "AW" | "UW" | "Y";
  phase: "start" | "active" | "end" | "discrete";
  source: "live" | "emulated" | "keyboard";
  confidence?: number;
  emittedAt: number;
  detectorLatencyMs?: number;
  synthetic?: boolean;
};
```

### Required Fallback

Also implement a `keyboard debug provider` for rapid testing.

Example:

- `1` => AY
- `2` => AW
- `3` => UW
- `4` key down / key up => Y start / end

This is for debugging only, not the main study mode.

## ALS-Relevant Constraints to Simulate

The experiment should model the target environment, not just healthy speech input.

Add a configuration panel or config file that supports:

- `phonemeConfirmationLatencyMs`
  - default recommended value: `180`
- `phonemeHoldMinMs`
  - default recommended value: `300`
- `phonemeHoldMaxMs`
  - default recommended value: `700`
- `missRate`
  - recommended levels: `0.00`, `0.10`
- `falsePositiveRate`
  - recommended levels: `0.00`, `0.02`
- `cooldownMs`
  - recommended default: `500`

If time is limited, only the first four are required.

## Experimental Tasks

Implement at least four task types.

### Task 1: Directed Selection

- User sees a designated target
- Goal: move pointer to target and activate it
- Used for:
  - selection time
  - wrong-target errors
  - success rate

### Task 2: Browse Without Acting, Then Select

- User is instructed to inspect multiple targets in sequence
- Only the final target should be selected
- Used for:
  - false activations
  - Midas Touch behavior
  - recovery cost

### Task 3: Swipe-Style Navigation

- Example:
  - move across items in a carousel
  - navigate next / previous screens
  - scroll through content
- A phoneme should trigger or segment the navigation behavior
- Used for:
  - command completion rate
  - navigation time
  - overshoot or reversal errors

### Task 4: Drag or Text Selection

- Example:
  - drag a card from one area to another
  - select a contiguous range of words in a sentence
- This task is essential because it demonstrates richer interaction beyond click confirmation
- Used for:
  - drag success
  - selected span accuracy
  - time to completion

## Experimental Design

### Participants

Recommended proxy-user study:

- `N = 20 to 24` nondisabled adult participants
- Normal or corrected-to-normal vision
- Exclude participants with severe webcam issues or inability to complete calibration

Optional stakeholder validation:

- `4 to 8` ALS-adjacent stakeholders such as AAC practitioners, caregivers, clinicians, assistive technology researchers, or disability advocates

### Design Type

- `within-subjects`
- Counterbalance condition order with Latin-square style assignment if possible

### Session Structure

Recommended order:

1. consent and introduction
2. calibration
3. training block per condition
4. task blocks
5. post-condition subjective ratings
6. final comparative interview

### Training

Each condition should have:

- a short guided tutorial
- at least 3 practice trials per task type
- a visible cheat sheet for command mapping

## Metrics

### Primary Metrics

- false activations
- wrong-target activations
- task completion rate
- task completion time
- drag or text-selection accuracy

### Secondary Metrics

- recovery actions after an error
- number of command retries
- hover duration
- dwell duration used
- time from target acquisition to confirmation

### Subjective Measures

- NASA-TLX or a lighter workload questionnaire
- perceived control
- perceived reliability
- fatigue
- frustration
- condition preference

## Logging Requirements

The prototype must log enough data for later analysis without modifying code again.

### Required Log Format

Write one JSONL file per session and optionally one CSV summary.

Recommended JSONL path:

- `data/logs/<participant_id>/<session_id>.jsonl`

### Required Event Types

- session_start
- session_end
- condition_start
- condition_end
- calibration_start
- calibration_end
- task_start
- task_end
- target_enter
- target_leave
- target_acquired
- dwell_start
- dwell_commit
- phoneme_event
- action_triggered
- action_completed
- action_cancelled
- error_event
- questionnaire_submitted

### Recommended Common Fields

```json
{
  "timestamp": 1713471000000,
  "participantId": "P03",
  "sessionId": "S01",
  "condition": "rich_phoneme",
  "taskType": "drag_text_selection",
  "trialIndex": 12,
  "eventType": "phoneme_event",
  "payload": {}
}
```

### Action Log Requirements

For every triggered interaction, record:

- action name
- trigger source
- pointer coordinates
- active target
- whether it was intended
- whether it succeeded
- latency from acquisition to action

## Analysis Requirements

The implementation handoff should include basic analysis helpers.

Required analysis outputs:

- per-condition summary table
- false activation counts
- completion time distributions
- task success rates
- per-task command accuracy

If possible, include:

- a simple Jupyter notebook or Python script that reads the JSONL logs and outputs CSV summaries and plots

## UI Requirements

The experiment UI should be explicit and not look like a generic demo.

Required UI areas:

- condition selector or condition label
- live pointer visualization
- current target highlight
- current command mapping legend
- training hint area
- trial instruction area
- feedback area after each trial
- experimenter-only status panel

### Experimenter Controls

The experimenter panel should support:

- participant ID input
- condition selection or counterbalanced order
- provider selection:
  - live voice
  - emulated
  - keyboard debug
- latency and error injection settings
- start / pause / next trial
- export logs

## Implementation Requirements

### Preferred Tech Direction

Stay close to the current web demo stack.

Recommended:

- frontend: vanilla JS modules or a lightweight framework only if clearly justified
- backend: Python or Node only if needed for logging, live voice proxy, or experiment control
- avoid unnecessary framework churn

### Reuse Guidance

Reuse from the current reference where possible:

- head tracking
- calibration logic
- action targeting
- visual highlight logic

Do not keep old hidden assumptions that make the prototype hard to reproduce.

### Normalize the App

The new implementation should:

- use one clear backend port if a backend is needed
- document startup clearly
- avoid stale `5003` versus `5001` inconsistencies
- allow a backend-free mode for keyboard and emulated testing if possible

## Deliverables the Coding AI Must Produce

Minimum deliverables:

- experiment prototype application
- condition switching support
- emulated phoneme event provider
- richer command vocabulary interactions
- logging system
- experiment README
- analysis starter script or notebook

Recommended deliverables:

- `README.md`
- `RUN_EXPERIMENT.md`
- `data/task_definitions.json`
- `config/experiment.default.json`
- `scripts/analyze_logs.py` or `analysis/analysis.ipynb`

## Acceptance Criteria

The task is complete only if all of the following are true:

1. The prototype runs locally with documented steps.
2. The app supports all three conditions:
   - dwell
   - binary phoneme confirm
   - rich phoneme vocabulary
3. The app supports all four task types:
   - selection
   - browse/no-select
   - swipe
   - drag or text selection
4. At least one sustained phoneme-based interaction is implemented with onset and offset logic.
5. Emulated detector mode supports configurable latency and error behavior.
6. Logs are written automatically per session.
7. A researcher can export and summarize results without manually editing raw logs.
8. The README clearly explains the study framing as proxy or analogue evaluation for an ALS-oriented system.

## File Format Recommendations for Handoff

There is no universal mandatory extension for prompting another AI, but these are the most practical choices:

- Use `.md` for full specs and handoff documents.
- Use `.prompt.md` for a file whose main purpose is to be pasted into another AI as an implementation prompt.
- Use `.json` for task definitions and configs.
- Use `.jsonl` for event logs.
- Use `.csv` for exported summaries.

Recommended files for this project:

- `IPHONEME_EXPERIMENT_SPEC.md`
- `IPHONEME_IMPLEMENTATION_PROMPT.prompt.md`

## Non-Negotiable Constraints for the Coding AI

- Do not claim representative-user validation.
- Do not remove the ALS-oriented framing.
- Do not collapse the study into only click-versus-dwell.
- Preserve richer command vocabulary as a central contribution.
- Prefer reproducible relative paths over machine-specific absolute paths.
- Add comments and docs only where they reduce ambiguity.
- Build for desktop and laptop webcam use.
- Support calibration and recovery from failed calibration.
- Keep logs structured from the first version.
