# Implementation Prompt for Another AI

You are implementing a research prototype for an ASSETS submission.

Read this entire prompt carefully before writing code.

## Context

I am working on an `ALS-oriented` interaction paper called `iPhoneme`.

The research idea is:

- gaze-like pointing specifies `where`
- phoneme events specify `when` and `how`
- the goal is not only binary click confirmation
- the central contribution is a `richer command vocabulary`, including:
  - selection
  - back or cancel
  - swipe-style navigation
  - drag-style interaction
  - text selection

The intended target environment is `ALS + phoneme detector`, but we do not currently have access to ALS participants or EEG data collection for the user study. Therefore, the prototype and study should be implemented as a `proxy / analogue evaluation under ALS-relevant constraints`, not as representative-user validation.

## Reference Code and Paper Inputs

Use these as the main references:

- `/Users/chayoonmin/Downloads/CPU _ Phoneme Decoder/gaze_demo.html`
- `/Users/chayoonmin/Downloads/CPU _ Phoneme Decoder/head_tracker.js`
- `/Users/chayoonmin/Downloads/CPU _ Phoneme Decoder/head_calibration.js`
- `/Users/chayoonmin/Downloads/CPU _ Phoneme Decoder/mouth_calibration.js`
- `/Users/chayoonmin/Downloads/assets_iphoneme_main_tex.txt`

Important:

- Reuse the useful parts of `gaze_demo`, especially head or face tracked pointing and calibration
- Do not keep stale assumptions like inconsistent port numbers
- Do not reduce the system to only a dwell-versus-click comparison

## What You Must Build

Build a local experiment prototype that supports three experimental conditions:

### Condition A: Dwell Baseline

- webcam-based face or head tracked pointing
- dwell-based confirmation
- use `800 ms` dwell by default

### Condition B: Binary Phoneme Confirm

- same pointing method
- single explicit phoneme confirmation only
- default trigger phoneme: `AY`

### Condition C: Rich iPhoneme Vocabulary

- same pointing method
- richer command vocabulary using phoneme events
- minimum command mapping:
  - `AY`: select or commit
  - `AW`: back or cancel
  - `UW`: swipe or next or scroll
  - `Y`: sustained hold for drag or text selection

At least one sustained command must use explicit onset and offset.

## Experimental Tasks to Implement

The app must support at least these four task types:

1. Directed target selection
2. Browse without acting, then final select
3. Swipe-style navigation
4. Drag or text selection

The fourth task is mandatory because the paper claims richer command vocabulary, not only click replacement.

## Required Architecture

Implement a phoneme event abstraction layer with interchangeable providers.

### Provider 1: Live Voice Proxy

- microphone-based
- can use existing logic or a simpler command detector
- emits normalized phoneme command events

### Provider 2: Emulated Detector

- required
- simulates ALS-relevant phoneme detector constraints
- configurable:
  - latency
  - miss rate
  - false positive rate
  - hold timing

### Provider 3: Keyboard Debug

- required for testing
- suggested mapping:
  - `1` => AY
  - `2` => AW
  - `3` => UW
  - `4` keydown => Y start
  - `4` keyup => Y end

Use a normalized event shape like:

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

## ALS-Relevant Simulation Requirements

The study should model the target context, not just healthy live voice.

Implement configuration for:

- `phonemeConfirmationLatencyMs`, default `180`
- `phonemeHoldMinMs`, default `300`
- `phonemeHoldMaxMs`, default `700`
- `missRate`, default `0.00`
- `falsePositiveRate`, default `0.00`
- `cooldownMs`, default `500`

If possible, make these adjustable in an experimenter panel and also loadable from a JSON config file.

## Logging Requirements

This prototype must be usable for a real study, so logging is mandatory.

Write one JSONL log file per session.

Recommended path:

- `data/logs/<participant_id>/<session_id>.jsonl`

Required event types:

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

Common fields should include:

- timestamp
- participantId
- sessionId
- condition
- taskType
- trialIndex
- eventType
- payload

For every action, log:

- action name
- trigger source
- pointer coordinates
- active target
- success or failure
- whether the action was intended
- latency from target acquisition to action

## Research Metrics the App Must Support

Primary metrics:

- false activations
- wrong-target activations
- task completion rate
- completion time
- drag or selection accuracy

Secondary metrics:

- retries
- recovery actions
- hover duration
- target acquisition time

Subjective data support:

- NASA-TLX or lightweight workload form
- perceived control
- reliability
- fatigue
- frustration
- preference

The app does not need to administer all questionnaires in a fancy way, but it should have a clean way to record them.

## UI Requirements

The UI should be an experiment prototype, not only a visual demo.

Required UI areas:

- participant and session setup
- condition label or condition selector
- task instructions
- live pointer display
- target highlight
- command legend
- trial feedback
- experimenter control panel

The experimenter panel should include:

- participant ID
- session ID
- condition selection or counterbalanced order
- phoneme provider selection
- latency and detector error controls
- start trial
- next trial
- pause
- export logs

## Implementation Guidance

- Prefer building on the existing `gaze_demo` logic instead of rewriting from scratch without reason.
- Keep the app reproducible on a laptop with a webcam.
- Use relative paths where possible.
- Keep dependencies reasonable.
- Do not over-engineer the stack.
- If a backend is needed, make startup simple and clearly documented.
- Unify ports and configuration if a backend is used.

## Deliverables You Must Produce

At minimum, produce:

- working experiment prototype
- all three conditions
- all four task types
- richer command vocabulary implementation
- emulated detector mode
- structured logging
- README with run instructions
- analysis starter script or notebook

Recommended files:

- `README.md`
- `RUN_EXPERIMENT.md`
- `config/experiment.default.json`
- `data/task_definitions.json`
- `scripts/analyze_logs.py` or `analysis/analysis.ipynb`

## Acceptance Criteria

Your work is not complete unless all of the following are true:

1. The app runs locally with documented startup steps.
2. It supports:
   - dwell baseline
   - binary phoneme confirm
   - rich iPhoneme vocabulary
3. It includes tasks for:
   - selection
   - browse/no-select
   - swipe
   - drag or text selection
4. At least one sustained phoneme interaction uses onset and offset.
5. Emulated detector mode supports configurable latency and detector errors.
6. Logs are automatically saved per session.
7. There is a simple analysis path from logs to condition-level summaries.
8. The README clearly states that this is a proxy or analogue evaluation of an ALS-oriented system, not representative-user validation.

## Important Framing Constraints

Do not write copy or documentation that says:

- this validates ALS end-user efficacy
- this replaces representative-user testing
- this is a clinically validated system

Do write copy or documentation that says:

- ALS-oriented
- proxy-user analogue evaluation
- emulated phoneme detector
- ALS-relevant constraints

## Output Format I Want From You

When you finish implementation, report back with:

1. a short summary of what you built
2. the files you added or changed
3. how to run the prototype
4. what remains risky or incomplete
5. how the richer command vocabulary is implemented
