/**
 * Task Engine
 * 
 * Manages task sequencing, trial state, and lifecycle events.
 * Coordinates with the condition engine and logger.
 */

export class TaskEngine {
    constructor(logger) {
        this.logger = logger;
        this.taskDefinitions = null;
        this.currentTaskType = null;
        this.currentTrialIndex = -1;
        this.currentTrial = null;
        this.trialState = 'idle'; // idle | instruction | active | completed | failed
        this.trialStartTime = 0;
        this.targetAcquisitionTime = 0;
        this.trialResults = [];
        this.listeners = [];
        this.isPractice = false;
        this.practiceTrialCount = 3;
        this.trialsPerTask = 5;
    }

    /**
     * Load task definitions from JSON
     */
    async loadDefinitions(url = './data/task_definitions.json') {
        try {
            const response = await fetch(url);
            this.taskDefinitions = await response.json();
            console.log('[TaskEngine] Loaded task definitions:', Object.keys(this.taskDefinitions));
            return true;
        } catch (err) {
            console.error('[TaskEngine] Failed to load task definitions:', err);
            return false;
        }
    }

    /**
     * Set task definitions directly (for testing)
     */
    setDefinitions(definitions) {
        this.taskDefinitions = definitions;
    }

    /**
     * Configure trial counts
     */
    configure({ trialsPerTask, practiceTrials }) {
        if (trialsPerTask !== undefined) this.trialsPerTask = trialsPerTask;
        if (practiceTrials !== undefined) this.practiceTrialCount = practiceTrials;
    }

    /**
     * Start a specific task type
     */
    startTask(taskType, isPractice = false) {
        if (!this.taskDefinitions || !this.taskDefinitions[taskType]) {
            console.error(`[TaskEngine] Unknown task type: ${taskType}`);
            return null;
        }

        this.currentTaskType = taskType;
        this.isPractice = isPractice;
        this.currentTrialIndex = -1;
        this.trialResults = [];
        
        const taskDef = this.taskDefinitions[taskType];
        console.log(`[TaskEngine] Starting task: ${taskType} (${isPractice ? 'practice' : 'experiment'})`);
        
        this._emit('taskStart', { taskType, isPractice, definition: taskDef });
        return taskDef;
    }

    /**
     * Advance to next trial
     * Returns the trial definition or null if no more trials
     */
    nextTrial() {
        if (!this.currentTaskType || !this.taskDefinitions[this.currentTaskType]) {
            return null;
        }

        this.currentTrialIndex++;
        const taskDef = this.taskDefinitions[this.currentTaskType];
        const maxTrials = this.isPractice ? this.practiceTrialCount : this.trialsPerTask;

        if (this.currentTrialIndex >= maxTrials || this.currentTrialIndex >= taskDef.trials.length) {
            this._emit('taskComplete', { 
                taskType: this.currentTaskType, 
                results: this.trialResults,
                isPractice: this.isPractice 
            });
            return null;
        }

        this.currentTrial = taskDef.trials[this.currentTrialIndex];
        this.trialState = 'instruction';
        this.trialStartTime = 0;
        this.targetAcquisitionTime = 0;
        
        this.logger.setContext({
            taskType: this.currentTaskType,
            trialIndex: this.currentTrialIndex
        });

        this.logger.taskStart(this.currentTaskType, this.currentTrialIndex, {
            isPractice: this.isPractice,
            trialDef: this.currentTrial
        });

        this._emit('trialStart', {
            taskType: this.currentTaskType,
            trialIndex: this.currentTrialIndex,
            trial: this.currentTrial,
            isPractice: this.isPractice,
            description: taskDef.description,
            instruction: taskDef.instruction
        });

        return {
            ...this.currentTrial,
            trialIndex: this.currentTrialIndex,
            taskType: this.currentTaskType,
            totalTrials: Math.min(
                this.isPractice ? this.practiceTrialCount : this.trialsPerTask,
                taskDef.trials.length
            ),
            taskDef
        };
    }

    /**
     * Mark trial as actively started (after instruction period)
     */
    activateTrial() {
        this.trialState = 'active';
        this.trialStartTime = performance.now();
        this._emit('trialActivated', {
            taskType: this.currentTaskType,
            trialIndex: this.currentTrialIndex
        });
    }

    /**
     * Record target acquisition
     */
    recordTargetAcquisition(targetId) {
        this.targetAcquisitionTime = performance.now();
        const acquisitionTimeMs = this.trialStartTime > 0 ? 
            this.targetAcquisitionTime - this.trialStartTime : 0;
        
        this.logger.targetAcquired(targetId, 0, 0, acquisitionTimeMs);
    }

    /**
     * Complete the current trial with results
     */
    completeTrial(result = {}) {
        const now = performance.now();
        const completionTimeMs = this.trialStartTime > 0 ? now - this.trialStartTime : 0;
        const selectionLatencyMs = this.targetAcquisitionTime > 0 ? 
            now - this.targetAcquisitionTime : 0;

        this.trialState = 'completed';
        
        const trialResult = {
            trialIndex: this.currentTrialIndex,
            taskType: this.currentTaskType,
            completionTimeMs,
            selectionLatencyMs,
            success: result.success ?? true,
            falseActivations: result.falseActivations ?? 0,
            wrongTarget: result.wrongTarget ?? false,
            retries: result.retries ?? 0,
            isPractice: this.isPractice,
            ...result
        };

        this.trialResults.push(trialResult);
        
        this.logger.taskEnd(this.currentTaskType, this.currentTrialIndex, trialResult);

        this._emit('trialComplete', trialResult);
        return trialResult;
    }

    /**
     * Fail the current trial
     */
    failTrial(reason = '') {
        const now = performance.now();
        const completionTimeMs = this.trialStartTime > 0 ? now - this.trialStartTime : 0;

        this.trialState = 'failed';
        
        const trialResult = {
            trialIndex: this.currentTrialIndex,
            taskType: this.currentTaskType,
            completionTimeMs,
            success: false,
            reason,
            isPractice: this.isPractice
        };

        this.trialResults.push(trialResult);
        this.logger.taskEnd(this.currentTaskType, this.currentTrialIndex, trialResult);
        this._emit('trialFailed', trialResult);
        return trialResult;
    }

    /**
     * Get current trial state
     */
    getState() {
        return {
            taskType: this.currentTaskType,
            trialIndex: this.currentTrialIndex,
            trialState: this.trialState,
            trial: this.currentTrial,
            isPractice: this.isPractice,
            results: this.trialResults
        };
    }

    /**
     * Get task types
     */
    getTaskTypes() {
        return this.taskDefinitions ? Object.keys(this.taskDefinitions) : [];
    }

    // Event system
    on(event, callback) {
        this.listeners.push({ event, callback });
        return () => {
            this.listeners = this.listeners.filter(l => l.callback !== callback);
        };
    }

    _emit(event, data) {
        this.listeners
            .filter(l => l.event === event)
            .forEach(l => {
                try { l.callback(data); } catch (e) { console.error('[TaskEngine]', e); }
            });
    }
}
