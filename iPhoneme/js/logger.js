/**
 * iPhoneme Experiment Logger
 * Structured JSONL event logging for experiment sessions.
 * 
 * Logs accumulate in memory and can be exported as JSONL files.
 * Path convention: data/logs/<participantId>/<sessionId>.jsonl
 */

export class ExperimentLogger {
    constructor() {
        this.events = [];
        this.participantId = '';
        this.sessionId = '';
        this.condition = '';
        this.taskType = '';
        this.trialIndex = -1;
        this.isActive = false;
    }

    /**
     * Set session context
     */
    setContext({ participantId, sessionId, condition, taskType, trialIndex }) {
        if (participantId !== undefined) this.participantId = participantId;
        if (sessionId !== undefined) this.sessionId = sessionId;
        if (condition !== undefined) this.condition = condition;
        if (taskType !== undefined) this.taskType = taskType;
        if (trialIndex !== undefined) this.trialIndex = trialIndex;
    }

    /**
     * Log an event with automatic context fields
     */
    log(eventType, payload = {}) {
        const event = {
            timestamp: Date.now(),
            participantId: this.participantId,
            sessionId: this.sessionId,
            condition: this.condition,
            taskType: this.taskType,
            trialIndex: this.trialIndex,
            eventType,
            payload
        };
        this.events.push(event);
        
        // Debug output for development
        if (eventType !== 'pointer_move') {
            console.log(`[Logger] ${eventType}`, payload);
        }
        
        return event;
    }

    // ---- Convenience methods for required event types ----

    sessionStart(metadata = {}) {
        this.isActive = true;
        return this.log('session_start', {
            ...metadata,
            userAgent: navigator.userAgent,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            startTime: new Date().toISOString()
        });
    }

    sessionEnd(metadata = {}) {
        this.isActive = false;
        return this.log('session_end', {
            ...metadata,
            endTime: new Date().toISOString(),
            totalEvents: this.events.length
        });
    }

    conditionStart(conditionId, metadata = {}) {
        this.condition = conditionId;
        return this.log('condition_start', { conditionId, ...metadata });
    }

    conditionEnd(conditionId, metadata = {}) {
        return this.log('condition_end', { conditionId, ...metadata });
    }

    calibrationStart(calibrationType) {
        return this.log('calibration_start', { calibrationType });
    }

    calibrationEnd(calibrationType, success, calibrationData = {}) {
        return this.log('calibration_end', { calibrationType, success, ...calibrationData });
    }

    taskStart(taskType, trialIndex, metadata = {}) {
        this.taskType = taskType;
        this.trialIndex = trialIndex;
        return this.log('task_start', { taskType, trialIndex, ...metadata });
    }

    taskEnd(taskType, trialIndex, result = {}) {
        return this.log('task_end', { taskType, trialIndex, ...result });
    }

    targetEnter(targetId, pointerX, pointerY) {
        return this.log('target_enter', { targetId, pointerX, pointerY });
    }

    targetLeave(targetId, pointerX, pointerY, dwellDurationMs) {
        return this.log('target_leave', { targetId, pointerX, pointerY, dwellDurationMs });
    }

    targetAcquired(targetId, pointerX, pointerY, acquisitionTimeMs) {
        return this.log('target_acquired', { targetId, pointerX, pointerY, acquisitionTimeMs });
    }

    dwellStart(targetId, pointerX, pointerY) {
        return this.log('dwell_start', { targetId, pointerX, pointerY });
    }

    dwellCommit(targetId, pointerX, pointerY, dwellDurationMs) {
        return this.log('dwell_commit', { targetId, pointerX, pointerY, dwellDurationMs });
    }

    phonemeEvent(phonemeData) {
        return this.log('phoneme_event', { ...phonemeData });
    }

    actionTriggered(actionData) {
        return this.log('action_triggered', {
            actionName: actionData.actionName,
            triggerSource: actionData.triggerSource,
            pointerX: actionData.pointerX,
            pointerY: actionData.pointerY,
            activeTarget: actionData.activeTarget,
            success: actionData.success,
            intended: actionData.intended,
            latencyFromAcquisitionMs: actionData.latencyFromAcquisitionMs
        });
    }

    actionCompleted(actionData) {
        return this.log('action_completed', { ...actionData });
    }

    actionCancelled(actionData) {
        return this.log('action_cancelled', { ...actionData });
    }

    errorEvent(errorData) {
        return this.log('error_event', { ...errorData });
    }

    questionnaireSubmitted(questionnaireData) {
        return this.log('questionnaire_submitted', { ...questionnaireData });
    }

    // ---- Export ----

    /**
     * Export all events as JSONL string
     */
    toJSONL() {
        return this.events.map(e => JSON.stringify(e)).join('\n');
    }

    /**
     * Download logs as a JSONL file
     */
    downloadLogs() {
        const jsonl = this.toJSONL();
        const blob = new Blob([jsonl], { type: 'application/x-ndjson' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const filename = `${this.participantId || 'unknown'}_${this.sessionId || 'session'}_${Date.now()}.jsonl`;
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        console.log(`[Logger] Downloaded ${this.events.length} events as ${filename}`);
        return filename;
    }

    /**
     * Get event count
     */
    getEventCount() {
        return this.events.length;
    }

    /**
     * Get events filtered by type
     */
    getEventsByType(eventType) {
        return this.events.filter(e => e.eventType === eventType);
    }

    /**
     * Clear all events (use after export)
     */
    clear() {
        this.events = [];
    }
}

// Singleton instance
export const logger = new ExperimentLogger();
