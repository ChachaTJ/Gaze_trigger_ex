/**
 * iPhoneme Experiment App — Main Controller
 * 
 * Orchestrates head tracking, phoneme events, conditions, tasks, and logging.
 * ALS-oriented proxy evaluation prototype for ASSETS.
 */

import { logger } from './logger.js';
import { PhonemeManager } from './phoneme_manager.js';
import { ConditionEngine } from './condition_engine.js';
import { TaskEngine } from './task_engine.js';
import { UIComponents } from './ui_components.js';
import { ExperimenterPanel } from './experimenter_panel.js';
import { Questionnaire } from './questionnaire.js';
import { DirectedSelectionTask } from './tasks/directed_selection.js';
import { BrowseSelectTask } from './tasks/browse_select.js';
import { SwipeNavigationTask } from './tasks/swipe_navigation.js';
import { DragTextSelectTask } from './tasks/drag_text_select.js';

export class ExperimentApp {
    constructor() {
        this.config = null;
        this.phonemeManager = new PhonemeManager();
        this.conditionEngine = new ConditionEngine();
        this.taskEngine = new TaskEngine(logger);
        this.experimenterPanel = null;
        this.questionnaire = null;
        
        // Active task instance
        this.activeTask = null;
        this.activeTaskType = null;
        // Block/Sequence state
        this.taskSequence = ['directed_selection', 'browse_select', 'swipe_navigation', 'drag_text_select'];
        this.currentTaskIndex = -1;
        this.conditionSequence = ['dwell', 'binary_phoneme', 'rich_phoneme'];
        this.currentConditionIndex = 0;
        this.dwellTarget = null;
        this.dwellStartTime = 0;
        this.dwellTimer = null;
        this.dwellTimeMs = 800;
        
        // Pointer state
        this.pointerX = 0;
        this.pointerY = 0;
        this.trackingActive = false;
        
        // Gesture state — phoneme onset/offset drives GestureController
        this._gestureActive = false;

        // Input lock (cooldown during transitions)
        this.inputLocked = false;
        this._trialAdvancing = false;
        this._lastCompletedTrialIndex = -1;

        // Timer IDs for cleanup
        this._autoStartFallbackTimer = null;
        this._interTaskTimer = null;
        
        // Session state
        this.sessionActive = false;
        this.paused = false;
        
        // Status update interval
        this._statusInterval = null;
    }

    async init() {
        // Load config
        try {
            const resp = await fetch('./config/experiment.default.json');
            this.config = await resp.json();
        } catch (e) {
            console.warn('[App] Could not load config, using defaults');
            this.config = { dwellTimeMs: 800, gazeTolerancePx: 30, alsSimulation: {} };
        }

        this.dwellTimeMs = this.config.dwellTimeMs || 800;

        // Load task definitions
        await this.taskEngine.loadDefinitions('./data/task_definitions.json');
        this.taskEngine.configure({
            trialsPerTask: this.config.trialsPerTaskPerCondition || 5,
            practiceTrials: this.config.practiceTrials || 3
        });

        // Setup experimenter panel
        const panelContainer = document.getElementById('experimenter-panel-container');
        this.experimenterPanel = new ExperimenterPanel(panelContainer, this.config);
        this.experimenterPanel.render();
        this._bindExperimenterEvents();

        // Initialize GestureController for swipe/scroll detection
        this._initGestureController();

        // Setup questionnaire
        const qContainer = document.getElementById('questionnaire-container');
        this.questionnaire = new Questionnaire(qContainer, logger);

        // Auto task start after calibration
        window.addEventListener('headCalibrationCompleted', () => {
            // Cancel the fallback timer — calibration completed normally
            if (this._autoStartFallbackTimer) {
                clearTimeout(this._autoStartFallbackTimer);
                this._autoStartFallbackTimer = null;
            }
            if (this.sessionActive && !this.activeTaskType) {
                console.log('[App] Auto-starting first task after calibration');
                this.startTrial('directed_selection', false);
            }
        });

        // Bind setup form
        this._bindSetupForm();

        // Set initial screen
        UIComponents.setScreen('setup');

        // Start status updates
        this._statusInterval = setInterval(() => this._updateStatus(), 1000);

        console.log('[App] Initialized');
    }

    // ---- Setup ----

    _bindSetupForm() {
        const form = document.getElementById('setup-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const participantId = document.getElementById('setup-participant-id').value || 'P01';
            const sessionId = document.getElementById('setup-session-id').value || 'S01';
            const provider = document.getElementById('setup-provider').value || 'keyboard';
            const condition = document.getElementById('setup-condition').value || 'dwell';

            await this.startSession(participantId, sessionId, provider, condition);
        });
    }

    async startSession(participantId, sessionId, provider, condition) {
        // Configure logger
        logger.setContext({ participantId, sessionId });
        logger.sessionStart({ participantId, sessionId, provider, condition });

        // Update experimenter panel inputs
        const pidInput = document.getElementById('exp-participant-id');
        const sidInput = document.getElementById('exp-session-id');
        if (pidInput) pidInput.value = participantId;
        if (sidInput) sidInput.value = sessionId;

        // Setup phoneme provider
        await this.phonemeManager.setProvider(provider);
        this._bindPhonemeEvents();
        this._setupLiveStreamDisplay(provider);

        // Build condition sequence based on selected starting condition
        const allConditions = ['dwell', 'binary_phoneme', 'rich_phoneme'];
        const startIdx = Math.max(0, allConditions.indexOf(condition));
        this.conditionSequence = [];
        for (let i = 0; i < allConditions.length; i++) {
            this.conditionSequence.push(allConditions[(startIdx + i) % allConditions.length]);
        }
        this.currentConditionIndex = 0;

        // Set initial condition
        this.conditionEngine.setCondition(this.conditionSequence[this.currentConditionIndex]);
        this._applyCondition();

        // Switch to experiment screen
        UIComponents.setScreen('experiment');
        this.sessionActive = true;

        // Start head tracking
        await this._startHeadTracking();

        UIComponents.showToast('Session started! First task will begin shortly.', 'success', 2500);

        // Auto start sequence after 4 seconds if not calibrating
        this._autoStartFallbackTimer = setTimeout(() => {
            this._autoStartFallbackTimer = null;
            const isCalibrating = (typeof HeadCalibration !== 'undefined' && HeadCalibration.isActive && HeadCalibration.isActive());
            if (!this.activeTaskType && !isCalibrating) {
                this.startTrial('directed_selection', false);
            }
        }, 4000);
    }

    // ---- Head Tracking ----

    async _startHeadTracking() {
        if (typeof HeadTracker === 'undefined') {
            console.error('[App] HeadTracker not available');
            UIComponents.showToast('HeadTracker not loaded!', 'error');
            return;
        }

        const statusDot = document.getElementById('tracking-status-dot');
        const statusText = document.getElementById('tracking-status-text');

        try {
            if (statusDot) statusDot.classList.add('loading');
            if (statusText) statusText.textContent = 'Loading...';

            await HeadTracker.init(window.HeadTrackerOptions || {});
            await HeadTracker.start();
            
            this.trackingActive = true;
            if (statusDot) { statusDot.classList.remove('loading'); statusDot.classList.add('active'); }
            if (statusText) statusText.textContent = 'Active';
            UIComponents.setCursorVisible(true);

            // Listen to point events
            HeadTracker.on('point', (x, y) => {
                this.pointerX = x;
                this.pointerY = y;
                UIComponents.updateCursor(x, y);
                UIComponents.updatePointerInfo(x, y);
                this._handlePointerMove(x, y);

                // Feed position to GestureController during active touch
                if (typeof GestureController !== 'undefined' && GestureController.isActive()) {
                    GestureController.updatePosition(x, y);
                }
            });

            // Listen to mouth clicks (used in addition to phoneme for condition A)
            HeadTracker.on('mouthClick', () => {
                if (this.conditionEngine.getCondition()?.id === 'dwell') {
                    // In dwell mode, mouth click can serve as alternative
                    this._handleMouthClick();
                }
            });

            console.log('[App] Head tracking started');
        } catch (err) {
            console.error('[App] Head tracking failed:', err);
            if (statusDot) statusDot.classList.remove('loading');
            if (statusText) statusText.textContent = 'Error';
            UIComponents.showToast('Head tracking failed: ' + err.message, 'error');
        }
    }

    // ---- GestureController Integration ----

    _initGestureController() {
        if (typeof GestureController === 'undefined') {
            console.warn('[App] GestureController not available — swipe gestures disabled');
            return;
        }

        // Gesture events → task actions
        GestureController.on('tap', (data) => {
            console.log('[Gesture] Tap at', data.x, data.y);
            this._doSelect('gesture_tap');
        });

        GestureController.on('swipeLeft', (data) => {
            console.log('[Gesture] Swipe Left, velocity:', data.velocity);
            this._doGestureSwipe('left', data.velocity);
        });

        GestureController.on('swipeRight', (data) => {
            console.log('[Gesture] Swipe Right, velocity:', data.velocity);
            this._doGestureSwipe('right', data.velocity);
        });

        GestureController.on('scroll', (data) => {
            console.log('[Gesture] Scroll', data.direction, data.deltaY);
            this._doGestureScroll(data.direction, data.deltaY);
        });

        console.log('[App] GestureController initialized');
    }

    // ---- Phoneme Events ----

    _bindPhonemeEvents() {
        this.phonemeManager.onPhoneme((event) => {
            if (this.paused) return;
            
            // Log every phoneme event
            logger.phonemeEvent(event);

            // Flash UI
            const mapping = this.conditionEngine.mapPhonemeToAction(event);
            if (mapping) {
                UIComponents.pulseCursor(event.phoneme);
                UIComponents.showPhonemeFlash(event.phoneme, mapping.action);
            }

            // Route to handler based on phase
            if (event.phase === 'discrete') {
                this._handleDiscretePhoneme(event, mapping);
            } else if (event.phase === 'start') {
                this._handlePhonemeStart(event, mapping);
            } else if (event.phase === 'end') {
                this._handlePhonemeEnd(event, mapping);
            }
        });
    }

    /**
     * Discrete phoneme (AY, AW, UW) → treated as a quick touch:
     * Feed through GestureController as a rapid startTouch+endTouch.
     * GestureController will classify as tap (short, low movement).
     * For AW/UW, also check if gaze velocity qualifies as swipe.
     */
    _handleDiscretePhoneme(event, mapping) {
        if (!mapping || !this.activeTask || this.inputLocked) return;

        // For select action (AY) → direct select (no gesture needed)
        if (mapping.action === 'select') {
            this._doSelect(event.source);
            return;
        }

        // For swipe (UW) and back (AW): use GestureController for velocity detection
        // Start and immediately end a touch so GestureController can check velocity
        if (typeof GestureController !== 'undefined') {
            // Quick touch: let the gesture controller analyze recent gaze velocity
            GestureController.startTouch(this.pointerX, this.pointerY);
            // Give one frame for position history, then end
            requestAnimationFrame(() => {
                GestureController.endTouch(this.pointerX, this.pointerY);
            });
        } else {
            // Fallback: direct action
            if (mapping.action === 'back') this._doBack(event.source);
            if (mapping.action === 'swipe') this._doNavigateNext(event.source);
        }
    }

    /**
     * Phoneme hold start (Y) → GestureController.startTouch:
     * While phoneme is held, gaze movement feeds GestureController.updatePosition.
     * This enables scroll and swipe gestures during sustained phoneme.
     */
    _handlePhonemeStart(event, mapping) {
        if (!mapping || !this.activeTask || this.inputLocked) return;

        if (mapping.action === 'drag') {
            // Activate GestureController touch
            if (typeof GestureController !== 'undefined') {
                this._gestureActive = true;
                GestureController.startTouch(this.pointerX, this.pointerY);
            }

            // Also start drag / text selection for Task 4
            if (this.activeTaskType === 'drag_text_select') {
                this.activeTask.startSelection(event.source);
            }
        }
    }

    /**
     * Phoneme hold end (Y release) → GestureController.endTouch:
     * GestureController checks velocity and classifies as tap/swipe/scroll.
     */
    _handlePhonemeEnd(event, mapping) {
        if (!mapping || !this.activeTask) return;

        if (mapping.action === 'drag') {
            // End GestureController touch (triggers gesture classification)
            if (typeof GestureController !== 'undefined' && this._gestureActive) {
                GestureController.endTouch(this.pointerX, this.pointerY);
                this._gestureActive = false;
            }

            // Also end drag / text selection for Task 4
            // Trial completion is handled by the task's onComplete callback
            if (this.activeTaskType === 'drag_text_select') {
                const holdValid = event.holdValid !== false;
                this.activeTask.endSelection(event.source, holdValid);
            }
        }
    }

    _handleMouthClick() {
        // Alternative select for dwell condition
        this._doSelect('mouth');
    }

    // ---- Actions ----

    _doSelect(triggerSource) {
        if (!this.activeTask || this.inputLocked) return;

        // The task itself calls this.onComplete(result) which resolves the trial.
        // Doing it here again causes double trial advancing (e.g., 1 -> 3 -> 5).
        this.activeTask.handleSelect(triggerSource, this.pointerX, this.pointerY);
    }

    /**
     * Execute the action associated with a gazed target element.
     * Used by dwell commit to trigger the correct action based on what the user is looking at.
     */
    _doGazedAction(action, triggerSource) {
        switch (action) {
            case 'select':
                this._doSelect(triggerSource);
                break;
            case 'prev':
                if (this.activeTask && this.activeTask.navigatePrev) {
                    this.activeTask.navigatePrev(triggerSource);
                }
                break;
            case 'next':
                if (this.activeTask && this.activeTask.navigateNext) {
                    this.activeTask.navigateNext(triggerSource);
                }
                break;
            default:
                this._doSelect(triggerSource);
        }
    }

    /**
     * Gesture-triggered swipe: gaze velocity while trigger held determined direction.
     */
    _doGestureSwipe(direction, velocity) {
        if (this.activeTaskType === 'swipe_navigation' && this.activeTask) {
            if (direction === 'left') {
                this.activeTask.navigatePrev('gesture_swipe');
            } else {
                this.activeTask.navigateNext('gesture_swipe');
            }
        }

        logger.actionTriggered({
            actionName: `swipe_${direction}`,
            triggerSource: 'gesture',
            pointerX: this.pointerX,
            pointerY: this.pointerY,
            activeTarget: '',
            success: true,
            intended: true,
            latencyFromAcquisitionMs: 0,
            velocity
        });
    }

    /**
     * Gesture-triggered scroll: gaze moved vertically during hold.
     */
    _doGestureScroll(direction, deltaY) {
        if (this.activeTaskType === 'swipe_navigation' && this.activeTask) {
            // Could be used for vertical carousel, but for now treat up/down
            // as prev/next if the carousel is vertical
        }

        logger.actionTriggered({
            actionName: `scroll_${direction}`,
            triggerSource: 'gesture',
            pointerX: this.pointerX,
            pointerY: this.pointerY,
            activeTarget: '',
            success: true,
            intended: true,
            latencyFromAcquisitionMs: 0,
            deltaY
        });
    }

    /**
     * Fallback direct navigation for non-gesture path
     */
    _doBack(triggerSource) {
        if (this.activeTaskType === 'swipe_navigation' && this.activeTask) {
            this.activeTask.navigatePrev(triggerSource);
        } else {
            logger.actionCancelled({ triggerSource, taskType: this.activeTaskType });
            UIComponents.showToast('Back / Cancel', 'warning', 800);
        }
    }

    _doNavigateNext(triggerSource) {
        if (this.activeTaskType === 'swipe_navigation' && this.activeTask) {
            this.activeTask.navigateNext(triggerSource);
        }
    }

    // ---- Pointer & Dwell ----

    _handlePointerMove(x, y) {
        if (!this.activeTask || this.paused) return;
        
        const tolerance = this.config?.gazeTolerancePx || 30;
        const found = this.activeTask.checkPointer(x, y, tolerance);
        
        // Dwell logic (condition A only)
        if (this.conditionEngine.isDwellEnabled()) {
            this._handleDwell(found);
        }
    }

    _handleDwell(target) {
        const targetId = target ? (target.id || target.index || target.label || null) : null;
        
        if (targetId !== this.dwellTarget) {
            // Target changed — reset dwell
            this._clearDwell();
            
            if (target) {
                this.dwellTarget = targetId;
                this.dwellStartTime = performance.now();
                
                logger.dwellStart(targetId, this.pointerX, this.pointerY);
                
                // Start dwell timer
                this.dwellTimer = setInterval(() => {
                    const elapsed = performance.now() - this.dwellStartTime;
                    const progress = elapsed / this.dwellTimeMs;
                    
                    // Update visual progress
                    if (target.element) {
                        UIComponents.updateDwellProgress(target.element, progress);
                    }
                    
                    if (elapsed >= this.dwellTimeMs) {
                        this._clearDwell();
                        if (this.inputLocked) return;
                        logger.dwellCommit(targetId, this.pointerX, this.pointerY, elapsed);
                        
                        // Dwell triggers the action of the gazed target
                        if (target && target.action) {
                            this._doGazedAction(target.action, 'dwell');
                        } else {
                            this._doSelect('dwell');
                        }
                    }
                }, 50);
            }
        }
    }

    _clearDwell() {
        if (this.dwellTimer) {
            clearInterval(this.dwellTimer);
            this.dwellTimer = null;
        }
        // Clear visual progress on all targets
        document.querySelectorAll('.dwell-progress').forEach(el => {
            el.style.width = '0%';
            el.classList.remove('dwell-active');
        });
        this.dwellTarget = null;
    }

    // ---- Trial Management ----

    startTrial(taskType, isPractice = false) {
        this._clearDwell();

        // Cancel any pending inter-task auto-start timer
        if (this._interTaskTimer) {
            clearTimeout(this._interTaskTimer);
            this._interTaskTimer = null;
        }

        this.activeTaskType = taskType;
        this.currentTaskIndex = this.taskSequence.indexOf(taskType);
        
        const container = document.getElementById('task-container');
        if (!container) return;

        // Create task instance
        switch (taskType) {
            case 'directed_selection':
                this.activeTask = new DirectedSelectionTask(container, logger);
                break;
            case 'browse_select':
                this.activeTask = new BrowseSelectTask(container, logger);
                break;
            case 'swipe_navigation':
                this.activeTask = new SwipeNavigationTask(container, logger);
                break;
            case 'drag_text_select':
                this.activeTask = new DragTextSelectTask(container, logger);
                break;
            default:
                console.error(`[App] Unknown task type: ${taskType}`);
                return;
        }

        // Start task in engine
        this.taskEngine.startTask(taskType, isPractice);
        
        // Advance to first trial
        this.inputLocked = true;
        setTimeout(() => this.inputLocked = false, 600);
        this._advanceTrial();
    }

    _advanceTrial() {
        this._clearDwell();
        this.inputLocked = true;

        console.log('[App] _advanceTrial called. Current engine index:', this.taskEngine.getState().trialIndex);

        const trialData = this.taskEngine.nextTrial();
        
        if (!trialData) {
            // Task complete
            UIComponents.showToast('Task Block Completed!', 'success');
            this.activeTask?.destroy();
            this.activeTask = null;
            
            // Auto advance task (use tracked index, not indexOf)
            const nextTaskIndex = this.currentTaskIndex + 1;
            const nextTaskType = this.taskSequence[nextTaskIndex];

            const container = document.getElementById('task-container');
            if (container) {
                if (nextTaskType) {
                    container.innerHTML = `
                        <div class="task-area" style="text-align: center; padding: 60px;">
                            <h2 style="margin-bottom: 12px;">✅ Task Completed</h2>
                            <p style="color: var(--text-secondary); margin-bottom: 24px;">
                                Get ready for the next task! Starting automatically in 4 seconds...
                            </p>
                            <button id="auto-next-btn" class="setup-btn" style="width: auto; padding: 12px 30px;">
                                Start Now (Or wait 4s)
                            </button>
                            <div style="width: 100%; max-width: 300px; height: 6px; background: rgba(255,255,255,0.1); margin: 20px auto; border-radius: 3px; overflow: hidden;">
                                <div id="auto-next-progress" style="width: 0%; height: 100%; background: var(--accent-green); transition: width 4s linear;"></div>
                            </div>
                        </div>
                    `;
                    
                    const startNext = () => {
                        if (this._interTaskTimer) {
                            clearTimeout(this._interTaskTimer);
                            this._interTaskTimer = null;
                        }
                        this.startTrial(nextTaskType, false);
                    };

                    document.getElementById('auto-next-btn').addEventListener('click', startNext);
                    
                    // Trigger animation
                    setTimeout(() => {
                        const bar = document.getElementById('auto-next-progress');
                        if (bar) bar.style.width = '100%';
                    }, 50);

                    // Auto start (stored for cleanup)
                    this._interTaskTimer = setTimeout(startNext, 4000);
                } else {
                    // All tasks in current condition are complete!
                    // Show post-condition questionnaire
                    const condName = this.conditionEngine.getCondition().name;
                    this.questionnaire.onSubmit = (result) => {
                        this._advanceCondition();
                    };
                    this.questionnaire.show(condName);
                }
            }
            return;
        }

        // Set up completion callback
        this.activeTask.onComplete = (result) => {
            this._handleTrialResult(result);
        };

        // Render trial
        this.activeTask.render(trialData);
        this.taskEngine.activateTrial();

        // Lock inputs briefly to prevent accidental double selections
        this.inputLocked = true;
        setTimeout(() => { this.inputLocked = false; }, 600);

        this.experimenterPanel.updateStatus({
            trial: `${trialData.trialIndex + 1}/${trialData.totalTrials} (${trialData.taskType})`
        });
    }

    _handleTrialResult(result) {
        // Guard 1: re-entry (e.g. simultaneous dwell + keyboard)
        if (this._trialAdvancing) {
            console.warn('[App] _handleTrialResult blocked: already advancing');
            return;
        }

        // Guard 2: stale/duplicate callback for a trial we already completed
        const currentIndex = this.taskEngine.getState().trialIndex;
        if (currentIndex === this._lastCompletedTrialIndex) {
            console.warn('[App] _handleTrialResult blocked: trial', currentIndex, 'already completed');
            return;
        }

        this._trialAdvancing = true;
        this._lastCompletedTrialIndex = currentIndex;
        this.inputLocked = true;
        this._clearDwell();

        this.taskEngine.completeTrial(result);
        
        const msg = result.success ? '✅ Correct!' : '❌ Try again';
        const type = result.success ? 'success' : 'error';
        UIComponents.showToast(msg, type, 1200);

        console.log(`[App] Trial ${currentIndex + 1} completed (success: ${result.success}). Advancing in 1500ms...`);

        // Central timing: 1500ms = 500ms visual feedback + 1000ms toast display
        setTimeout(() => {
            this._trialAdvancing = false;
            this._advanceTrial();
        }, 1500);
    }

    _advanceCondition() {
        this.currentConditionIndex++;
        
        if (this.currentConditionIndex >= this.conditionSequence.length) {
            // All conditions complete! Show final preference questionnaire
            this.questionnaire.onSubmit = () => {
                const container = document.getElementById('task-container');
                if (container) {
                    container.innerHTML = `
                        <div class="task-area" style="text-align: center; padding: 60px;">
                            <h2 style="margin-bottom: 12px;">🎉 Experiment Finished!</h2>
                            <p style="color: var(--text-secondary); margin-bottom: 24px;">
                                Thank you for your participation.
                            </p>
                        </div>
                    `;
                }
            };
            this.questionnaire.showPreference();
        } else {
            // Move to next condition
            const nextCondition = this.conditionSequence[this.currentConditionIndex];
            this.conditionEngine.setCondition(nextCondition);
            this._applyCondition();
            
            const condName = this.conditionEngine.getCondition().name;
            const container = document.getElementById('task-container');
            if (container) {
                container.innerHTML = `
                    <div class="task-area" style="text-align: center; padding: 60px;">
                        <span class="status-dot"></span>
                        <h2 style="margin-bottom: 12px;">Next Block: ${condName}</h2>
                        <p style="color: var(--text-secondary); margin-bottom: 24px; line-height: 1.6;">
                            You will now repeat the tasks using a new interaction method.<br>
                            Please read the condition name and be ready.
                        </p>
                        <button id="auto-next-cond-btn" class="setup-btn" style="width: auto; padding: 12px 30px;">
                            Start ${condName} Block
                        </button>
                    </div>
                `;
                document.getElementById('auto-next-cond-btn').addEventListener('click', () => {
                    this.startTrial(this.taskSequence[0], false);
                });
            }
            
            this.experimenterPanel.updateStatus({
                condition: condName
            });
        }
    }

    // ---- Condition Management ----

    _applyCondition() {
        const condition = this.conditionEngine.getCondition();
        if (!condition) return;
        
        UIComponents.updateConditionBanner(condition);
        UIComponents.updateCommandLegend(condition.availableCommands, condition.id);
        
        logger.conditionStart(condition.id, { label: condition.label });

        this.experimenterPanel.updateStatus({ condition: condition.shortLabel });

        // Update condition select in panel
        const condSelect = document.getElementById('exp-condition');
        if (condSelect) condSelect.value = condition.id;
    }

    // ---- Experimenter Panel Events ----

    _bindExperimenterEvents() {
        const panel = this.experimenterPanel;

        panel.on('applyCondition', (vals) => {
            const prevCondition = this.conditionEngine.getCondition();
            if (prevCondition) {
                logger.conditionEnd(prevCondition.id);
            }
            this.conditionEngine.setCondition(vals.condition);
            this._applyCondition();
            this._clearDwell();
            UIComponents.showToast(`Condition: ${this.conditionEngine.getCondition().shortLabel}`, 'info');
        });

        panel.on('applyProvider', async (vals) => {
            await this.phonemeManager.setProvider(vals.provider);
            this._bindPhonemeEvents();
            this._setupLiveStreamDisplay(vals.provider);
            this.experimenterPanel.updateStatus({ provider: vals.provider });
            UIComponents.showToast(`Provider: ${vals.provider}`, 'info');
        });

        panel.on('applyALS', (vals) => {
            this.phonemeManager.updateEmulatedConfig(vals.alsConfig);
            this.dwellTimeMs = vals.dwellTimeMs;
            UIComponents.showToast('ALS simulation updated', 'info');
        });

        panel.on('startTrial', (vals) => {
            logger.setContext({
                participantId: vals.participantId,
                sessionId: vals.sessionId
            });
            this.startTrial(vals.taskType, vals.practiceMode);
        });

        panel.on('nextTrial', () => {
            if (this.activeTask) {
                this.taskEngine.failTrial('skipped');
                this._advanceTrial();
            }
        });

        panel.on('pauseTrial', () => {
            this.paused = !this.paused;
            UIComponents.showToast(this.paused ? '⏸ Paused' : '▶ Resumed', 'warning', 800);
        });

        panel.on('exportLogs', () => {
            const filename = logger.downloadLogs();
            UIComponents.showToast(`Exported: ${filename}`, 'success', 2000);
        });

        panel.on('showQuestionnaire', () => {
            const condition = this.conditionEngine.getCondition();
            this.questionnaire.show(condition?.label || '');
            this.questionnaire.onSubmit = () => {
                UIComponents.showToast('Questionnaire submitted', 'success');
            };
        });
    }

    // ---- Live Stream Display ----

    _setupLiveStreamDisplay(providerType) {
        const streamBar = document.getElementById('phoneme-stream-bar');
        const sttText = document.getElementById('live-stt-text');
        const phonemesEl = document.getElementById('live-phonemes');
        const wsDot = document.getElementById('ws-status-dot');
        const wsText = document.getElementById('ws-status-text');

        if (providerType === 'live') {
            // Show stream bar
            if (streamBar) streamBar.style.display = 'flex';

            // Get live provider instance
            const liveProvider = this.phonemeManager.getProvider('live');
            if (liveProvider) {
                // Hook up stream display
                liveProvider.onPhonemeStream = (text, phonemes) => {
                    if (sttText) sttText.textContent = text;
                    if (phonemesEl) phonemesEl.textContent = phonemes;
                };

                // Monitor connection status
                this._wsStatusInterval = setInterval(() => {
                    const connected = liveProvider.isConnected();
                    if (wsDot) {
                        wsDot.classList.toggle('ws-connected', connected);
                    }
                    if (wsText) {
                        wsText.textContent = connected ? 'WS: Connected' : 'WS: Disconnected';
                    }
                }, 1000);
            }
        } else {
            // Hide stream bar for non-live providers
            if (streamBar) streamBar.style.display = 'none';
            if (sttText) sttText.textContent = '—';
            if (phonemesEl) phonemesEl.textContent = '—';

            // Clear WS status interval
            if (this._wsStatusInterval) {
                clearInterval(this._wsStatusInterval);
                this._wsStatusInterval = null;
            }
        }
    }

    // ---- Status Updates ----

    _updateStatus() {
        this.experimenterPanel?.updateStatus({
            eventCount: logger.getEventCount(),
            provider: this.phonemeManager.getProviderType() || '—'
        });
    }

    // ---- Calibration ----

    startHeadCalibration() {
        if (typeof HeadCalibration !== 'undefined') {
            logger.calibrationStart('head');
            HeadCalibration.start();
        }
    }

    startMouthCalibration() {
        if (typeof MouthCalibration !== 'undefined') {
            logger.calibrationStart('mouth');
            MouthCalibration.start();
        }
    }

    // ---- Cleanup ----

    endSession() {
        logger.sessionEnd();
        this.phonemeManager.stop();
        this.activeTask?.destroy();
        this._clearDwell();
        
        if (this._statusInterval) {
            clearInterval(this._statusInterval);
        }
        
        UIComponents.showToast('Session ended. Logs exported.', 'info');
        logger.downloadLogs();
    }
}
