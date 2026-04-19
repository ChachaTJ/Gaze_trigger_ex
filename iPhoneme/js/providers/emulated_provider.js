/**
 * Emulated Phoneme Detector Provider
 * 
 * Simulates ALS-relevant phoneme detector constraints.
 * Uses keyboard input as the trigger source, but applies:
 *   - Configurable confirmation latency
 *   - Configurable miss rate
 *   - Configurable false positive rate
 *   - Hold timing constraints
 *   - Cooldown between events
 * 
 * Key mapping (same as keyboard provider):
 *   1 → AY, 2 → AW, 3 → UW, 4 hold → Y
 */

export class EmulatedProvider {
    constructor(config = {}) {
        this.listeners = [];
        this.active = false;
        this.yHeld = false;
        this.yStartTime = 0;
        this.lastEventTime = 0;

        // ALS simulation parameters
        this.config = {
            phonemeConfirmationLatencyMs: config.phonemeConfirmationLatencyMs ?? 180,
            phonemeHoldMinMs: config.phonemeHoldMinMs ?? 300,
            phonemeHoldMaxMs: config.phonemeHoldMaxMs ?? 700,
            missRate: config.missRate ?? 0.00,
            falsePositiveRate: config.falsePositiveRate ?? 0.00,
            cooldownMs: config.cooldownMs ?? 500
        };

        this._pendingTimers = [];
        this._fpInterval = null;
        this._onKeyDown = this._handleKeyDown.bind(this);
        this._onKeyUp = this._handleKeyUp.bind(this);
    }

    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        console.log('[EmulatedProvider] Config updated:', this.config);
        
        // Restart false positive injection if running
        if (this.active && this._fpInterval) {
            clearInterval(this._fpInterval);
            this._startFalsePositiveInjection();
        }
    }

    start() {
        if (this.active) return;
        this.active = true;
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
        this._startFalsePositiveInjection();
        console.log('[EmulatedProvider] Started with config:', this.config);
    }

    stop() {
        this.active = false;
        if (this.yHeld) {
            this._emitYEnd();
        }
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        
        // Clear pending timers
        this._pendingTimers.forEach(t => clearTimeout(t));
        this._pendingTimers = [];
        
        if (this._fpInterval) {
            clearInterval(this._fpInterval);
            this._fpInterval = null;
        }
        console.log('[EmulatedProvider] Stopped');
    }

    onPhoneme(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    _emit(event) {
        this.listeners.forEach(cb => {
            try { cb(event); } catch (e) { console.error('[EmulatedProvider] Listener error:', e); }
        });
    }

    _shouldMiss() {
        return Math.random() < this.config.missRate;
    }

    _isInCooldown() {
        return (performance.now() - this.lastEventTime) < this.config.cooldownMs;
    }

    _emitWithLatency(event) {
        const latency = this.config.phonemeConfirmationLatencyMs;
        const timer = setTimeout(() => {
            event.detectorLatencyMs = latency;
            event.emittedAt = performance.now();
            this.lastEventTime = event.emittedAt;
            this._emit(event);
            this._pendingTimers = this._pendingTimers.filter(t => t !== timer);
        }, latency);
        this._pendingTimers.push(timer);
    }

    _startFalsePositiveInjection() {
        if (this.config.falsePositiveRate <= 0) return;
        
        // Check for false positives periodically (every 2 seconds)
        this._fpInterval = setInterval(() => {
            if (!this.active) return;
            if (Math.random() < this.config.falsePositiveRate) {
                const phonemes = ['AY', 'AW', 'UW'];
                const randomPhoneme = phonemes[Math.floor(Math.random() * phonemes.length)];
                console.log(`[EmulatedProvider] FALSE POSITIVE: ${randomPhoneme}`);
                this._emit({
                    phoneme: randomPhoneme,
                    phase: 'discrete',
                    source: 'emulated',
                    confidence: 0.3 + Math.random() * 0.4,
                    emittedAt: performance.now(),
                    detectorLatencyMs: this.config.phonemeConfirmationLatencyMs,
                    synthetic: true
                });
            }
        }, 2000);
    }

    _handleKeyDown(e) {
        if (!this.active) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        const now = performance.now();

        switch (e.key) {
            case '1':
                e.preventDefault();
                if (this._isInCooldown() || this._shouldMiss()) {
                    if (this._shouldMiss()) console.log('[EmulatedProvider] MISSED: AY');
                    return;
                }
                this._emitWithLatency({
                    phoneme: 'AY',
                    phase: 'discrete',
                    source: 'emulated',
                    confidence: 0.7 + Math.random() * 0.3,
                    emittedAt: now,
                    detectorLatencyMs: 0,
                    synthetic: false
                });
                break;
            case '2':
                e.preventDefault();
                if (this._isInCooldown() || this._shouldMiss()) {
                    if (this._shouldMiss()) console.log('[EmulatedProvider] MISSED: AW');
                    return;
                }
                this._emitWithLatency({
                    phoneme: 'AW',
                    phase: 'discrete',
                    source: 'emulated',
                    confidence: 0.7 + Math.random() * 0.3,
                    emittedAt: now,
                    detectorLatencyMs: 0,
                    synthetic: false
                });
                break;
            case '3':
                e.preventDefault();
                if (this._isInCooldown() || this._shouldMiss()) {
                    if (this._shouldMiss()) console.log('[EmulatedProvider] MISSED: UW');
                    return;
                }
                this._emitWithLatency({
                    phoneme: 'UW',
                    phase: 'discrete',
                    source: 'emulated',
                    confidence: 0.7 + Math.random() * 0.3,
                    emittedAt: now,
                    detectorLatencyMs: 0,
                    synthetic: false
                });
                break;
            case '4':
                e.preventDefault();
                if (!this.yHeld) {
                    if (this._isInCooldown() || this._shouldMiss()) {
                        if (this._shouldMiss()) console.log('[EmulatedProvider] MISSED: Y start');
                        return;
                    }
                    this.yHeld = true;
                    this.yStartTime = now;
                    this._emitWithLatency({
                        phoneme: 'Y',
                        phase: 'start',
                        source: 'emulated',
                        confidence: 0.7 + Math.random() * 0.3,
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
        if (e.key === '4' && this.yHeld) {
            e.preventDefault();
            this._emitYEnd();
        }
    }

    _emitYEnd() {
        const now = performance.now();
        const holdDuration = now - this.yStartTime;
        this.yHeld = false;
        
        // Check hold duration constraints
        if (holdDuration < this.config.phonemeHoldMinMs) {
            console.log(`[EmulatedProvider] Y hold too short: ${holdDuration.toFixed(0)}ms < ${this.config.phonemeHoldMinMs}ms`);
            // Still emit end but mark as invalid
            this._emitWithLatency({
                phoneme: 'Y',
                phase: 'end',
                source: 'emulated',
                confidence: 0.3,
                emittedAt: now,
                detectorLatencyMs: 0,
                synthetic: false,
                holdDurationMs: holdDuration,
                holdValid: false
            });
            return;
        }

        this._emitWithLatency({
            phoneme: 'Y',
            phase: 'end',
            source: 'emulated',
            confidence: 0.7 + Math.random() * 0.3,
            emittedAt: now,
            detectorLatencyMs: 0,
            synthetic: false,
            holdDurationMs: holdDuration,
            holdValid: true
        });
        this.yStartTime = 0;
    }

    isYHeld() {
        return this.yHeld;
    }

    getType() {
        return 'emulated';
    }

    getConfig() {
        return { ...this.config };
    }
}
