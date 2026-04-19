/**
 * Keyboard Debug Phoneme Provider
 * 
 * Maps keyboard keys to phoneme events for rapid testing.
 * Key mapping:
 *   1 → AY (discrete)
 *   2 → AW (discrete)
 *   3 → UW (discrete)
 *   4 keydown → Y start, 4 keyup → Y end
 */

export class KeyboardProvider {
    constructor() {
        this.listeners = [];
        this.active = false;
        this.yHeld = false;
        this.yStartTime = 0;
        this._onKeyDown = this._handleKeyDown.bind(this);
        this._onKeyUp = this._handleKeyUp.bind(this);
    }

    start() {
        if (this.active) return;
        this.active = true;
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
        console.log('[KeyboardProvider] Started');
    }

    stop() {
        this.active = false;
        // Release any held Y
        if (this.yHeld) {
            this._emitYEnd();
        }
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        console.log('[KeyboardProvider] Stopped');
    }

    onPhoneme(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    _emit(event) {
        this.listeners.forEach(cb => {
            try { cb(event); } catch (e) { console.error('[KeyboardProvider] Listener error:', e); }
        });
    }

    _handleKeyDown(e) {
        if (!this.active) return;
        // Ignore if focus is in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        
        // Ignore OS key repeats
        if (e.repeat) return;

        const now = performance.now();

        switch (e.key) {
            case '1':
                e.preventDefault();
                this._emit({
                    phoneme: 'AY',
                    phase: 'discrete',
                    source: 'keyboard',
                    confidence: 1.0,
                    emittedAt: now,
                    detectorLatencyMs: 0,
                    synthetic: false
                });
                break;
            case '2':
                e.preventDefault();
                this._emit({
                    phoneme: 'AW',
                    phase: 'discrete',
                    source: 'keyboard',
                    confidence: 1.0,
                    emittedAt: now,
                    detectorLatencyMs: 0,
                    synthetic: false
                });
                break;
            case '3':
                e.preventDefault();
                this._emit({
                    phoneme: 'UW',
                    phase: 'discrete',
                    source: 'keyboard',
                    confidence: 1.0,
                    emittedAt: now,
                    detectorLatencyMs: 0,
                    synthetic: false
                });
                break;
            case '4':
            case ' ': // Spacebar as universal hold trigger
                e.preventDefault();
                if (!this.yHeld) {
                    this.yHeld = true;
                    this.yStartTime = now;
                    this._emit({
                        phoneme: 'Y',
                        phase: 'start',
                        source: 'keyboard',
                        confidence: 1.0,
                        emittedAt: now,
                        detectorLatencyMs: 0,
                        synthetic: false
                    });
                }
                break;
        }
    }

    _handleKeyUp(e) {
        if (!this.active) return;
        if ((e.key === '4' || e.key === ' ') && this.yHeld) {
            e.preventDefault();
            this._emitYEnd();
        }
    }

    _emitYEnd() {
        const now = performance.now();
        this.yHeld = false;
        this._emit({
            phoneme: 'Y',
            phase: 'end',
            source: 'keyboard',
            confidence: 1.0,
            emittedAt: now,
            detectorLatencyMs: 0,
            synthetic: false,
            holdDurationMs: now - this.yStartTime
        });
        this.yStartTime = 0;
    }

    isYHeld() {
        return this.yHeld;
    }

    getType() {
        return 'keyboard';
    }
}
