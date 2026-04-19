/**
 * Mouth Trigger Phoneme Provider
 * 
 * Uses HeadTracker's mouthRatio calculation to simulate a trigger hold.
 * Allows using mouth open/close as a universal proxy trigger (translating to Y phoneme events).
 * This enables gaze_demo style interactions where mouth open = touch start, 
 * mouth close = touch end (triggering tap, swipe, scroll based on gaze movement).
 */

export class MouthProvider {
    constructor() {
        this.listeners = [];
        this.active = false;
        this.mouthHeld = false;
        this.mouthStartTime = 0;
        this.threshold = 0.5; // fallback
        this.hysteresisRatio = 0.8; // require closing a bit more to release
        
        this._onMouthRatio = this._handleMouthRatio.bind(this);
    }

    start() {
        if (this.active) return;
        
        // Ensure HeadTracker is available
        if (typeof HeadTracker === 'undefined') {
            console.error('[MouthProvider] HeadTracker is not available.');
            return;
        }

        // Get calibration
        const cal = HeadTracker.getCalibration();
        if (cal && cal.mouth && cal.mouth.threshold) {
            this.threshold = cal.mouth.threshold;
        } else {
            console.warn('[MouthProvider] No mouth calibration found. Using fallback threshold.');
        }

        this.active = true;
        HeadTracker.on('mouthRatio', this._onMouthRatio);
        console.log('[MouthProvider] Started with threshold:', this.threshold);
    }

    stop() {
        this.active = false;
        if (this.mouthHeld) {
            this._emitYEnd();
        }
        if (typeof HeadTracker !== 'undefined') {
            HeadTracker.off?.('mouthRatio', this._onMouthRatio); // Assuming off is supported, or we filter in the handler
        }
        console.log('[MouthProvider] Stopped');
    }

    onPhoneme(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    _emit(event) {
        this.listeners.forEach(cb => {
            try { cb(event); } catch (e) { console.error('[MouthProvider] Listener error:', e); }
        });
    }

    _handleMouthRatio(ratio) {
        if (!this.active) return;

        const now = performance.now();

        if (!this.mouthHeld && ratio > this.threshold) {
            this.mouthHeld = true;
            this.mouthStartTime = now;
            this._emit({
                phoneme: 'Y',
                phase: 'start',
                source: 'mouth_trigger',
                confidence: 1.0,
                emittedAt: now,
                detectorLatencyMs: 0,
                synthetic: true
            });
        } 
        else if (this.mouthHeld && ratio < this.threshold * this.hysteresisRatio) {
            this._emitYEnd();
        }
    }

    _emitYEnd() {
        if (!this.mouthHeld) return;
        const now = performance.now();
        this.mouthHeld = false;
        this._emit({
            phoneme: 'Y',
            phase: 'end',
            source: 'mouth_trigger',
            confidence: 1.0,
            emittedAt: now,
            detectorLatencyMs: 0,
            synthetic: true,
            holdDurationMs: now - this.mouthStartTime
        });
        this.mouthStartTime = 0;
    }

    getType() {
        return 'mouth_trigger';
    }
}
