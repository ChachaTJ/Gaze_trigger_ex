/**
 * Experimenter Panel
 * 
 * Collapsible sidebar for experiment control.
 */

export class ExperimenterPanel {
    constructor(container, config = {}) {
        this.container = container;
        this.config = config;
        this.listeners = {};
        this.collapsed = true;
    }

    render() {
        this.container.innerHTML = `
            <button class="exp-panel-toggle" id="exp-panel-toggle" title="Toggle Experimenter Panel">
                ⚙️
            </button>
            <div class="exp-panel ${this.collapsed ? 'collapsed' : ''}" id="exp-panel">
                <div class="exp-panel-content" id="exp-panel-content">
                    <h3 class="exp-panel-title">Experimenter Controls</h3>
                    
                    <!-- Session Setup -->
                    <div class="exp-section">
                        <div class="exp-section-title">Session</div>
                        <label class="exp-label">
                            Participant ID
                            <input type="text" id="exp-participant-id" class="exp-input" 
                                   value="" placeholder="P01">
                        </label>
                        <label class="exp-label">
                            Session ID
                            <input type="text" id="exp-session-id" class="exp-input" 
                                   value="" placeholder="S01">
                        </label>
                    </div>

                    <!-- Condition -->
                    <div class="exp-section">
                        <div class="exp-section-title">Condition</div>
                        <select id="exp-condition" class="exp-select">
                            <option value="dwell">A: Dwell Baseline</option>
                            <option value="binary_phoneme">B: Binary Phoneme</option>
                            <option value="rich_phoneme">C: Rich iPhoneme</option>
                        </select>
                        <button class="exp-btn" id="exp-apply-condition">Apply Condition</button>
                    </div>

                    <!-- Provider -->
                    <div class="exp-section">
                        <div class="exp-section-title">Phoneme Provider</div>
                        <select id="exp-provider" class="exp-select">
                            <option value="keyboard">Keyboard Debug</option>
                            <option value="mouth">Mouth Trigger</option>
                            <option value="emulated">Emulated Detector</option>
                            <option value="live">Live Voice</option>
                        </select>
                        <button class="exp-btn" id="exp-apply-provider">Apply Provider</button>
                    </div>

                    <!-- ALS Simulation -->
                    <div class="exp-section">
                        <div class="exp-section-title">ALS Simulation</div>
                        <label class="exp-label">
                            Confirmation Latency: <span id="exp-latency-val">${this.config.alsSimulation?.phonemeConfirmationLatencyMs ?? 180}</span>ms
                            <input type="range" id="exp-latency" class="exp-slider" 
                                   min="0" max="500" step="10" 
                                   value="${this.config.alsSimulation?.phonemeConfirmationLatencyMs ?? 180}">
                        </label>
                        <label class="exp-label">
                            Miss Rate: <span id="exp-miss-rate-val">${((this.config.alsSimulation?.missRate ?? 0) * 100).toFixed(0)}</span>%
                            <input type="range" id="exp-miss-rate" class="exp-slider" 
                                   min="0" max="30" step="1" 
                                   value="${((this.config.alsSimulation?.missRate ?? 0) * 100).toFixed(0)}">
                        </label>
                        <label class="exp-label">
                            False Positive Rate: <span id="exp-fp-rate-val">${((this.config.alsSimulation?.falsePositiveRate ?? 0) * 100).toFixed(0)}</span>%
                            <input type="range" id="exp-fp-rate" class="exp-slider" 
                                   min="0" max="10" step="1" 
                                   value="${((this.config.alsSimulation?.falsePositiveRate ?? 0) * 100).toFixed(0)}">
                        </label>
                        <label class="exp-label">
                            Hold Min: <span id="exp-hold-min-val">${this.config.alsSimulation?.phonemeHoldMinMs ?? 300}</span>ms
                            <input type="range" id="exp-hold-min" class="exp-slider" 
                                   min="100" max="1000" step="50" 
                                   value="${this.config.alsSimulation?.phonemeHoldMinMs ?? 300}">
                        </label>
                        <label class="exp-label">
                            Hold Max: <span id="exp-hold-max-val">${this.config.alsSimulation?.phonemeHoldMaxMs ?? 700}</span>ms
                            <input type="range" id="exp-hold-max" class="exp-slider" 
                                   min="200" max="2000" step="50" 
                                   value="${this.config.alsSimulation?.phonemeHoldMaxMs ?? 700}">
                        </label>
                        <label class="exp-label">
                            Cooldown: <span id="exp-cooldown-val">${this.config.alsSimulation?.cooldownMs ?? 500}</span>ms
                            <input type="range" id="exp-cooldown" class="exp-slider" 
                                   min="200" max="1000" step="50" 
                                   value="${this.config.alsSimulation?.cooldownMs ?? 500}">
                        </label>
                        <button class="exp-btn" id="exp-apply-als">Apply ALS Config</button>
                    </div>

                    <!-- Dwell -->
                    <div class="exp-section">
                        <div class="exp-section-title">Dwell Settings</div>
                        <label class="exp-label">
                            Dwell Time: <span id="exp-dwell-val">${this.config.dwellTimeMs ?? 800}</span>ms
                            <input type="range" id="exp-dwell-time" class="exp-slider" 
                                   min="400" max="2000" step="100" 
                                   value="${this.config.dwellTimeMs ?? 800}">
                        </label>
                    </div>

                    <!-- Trial Controls -->
                    <div class="exp-section">
                        <div class="exp-section-title">Trial Controls</div>
                        <div class="exp-btn-group">
                            <button class="exp-btn exp-btn-primary" id="exp-start-trial">▶ Start</button>
                            <button class="exp-btn" id="exp-next-trial">⏭ Next</button>
                            <button class="exp-btn" id="exp-pause-trial">⏸ Pause</button>
                        </div>
                        <select id="exp-task-type" class="exp-select">
                            <option value="directed_selection">Task 1: Directed Selection</option>
                            <option value="browse_select">Task 2: Browse & Select</option>
                            <option value="swipe_navigation">Task 3: Swipe Navigation</option>
                            <option value="drag_text_select">Task 4: Text Selection</option>
                        </select>
                        <div class="exp-checkbox-row">
                            <label>
                                <input type="checkbox" id="exp-practice-mode"> Practice Mode
                            </label>
                        </div>
                    </div>

                    <!-- Status -->
                    <div class="exp-section">
                        <div class="exp-section-title">Status</div>
                        <div class="exp-status" id="exp-status">
                            <div>Events logged: <span id="exp-event-count">0</span></div>
                            <div>Condition: <span id="exp-current-condition">—</span></div>
                            <div>Provider: <span id="exp-current-provider">—</span></div>
                            <div>Trial: <span id="exp-current-trial">—</span></div>
                        </div>
                    </div>

                    <!-- Export -->
                    <div class="exp-section">
                        <button class="exp-btn exp-btn-export" id="exp-export-logs">📥 Export Logs</button>
                        <button class="exp-btn" id="exp-show-questionnaire">📋 Questionnaire</button>
                    </div>
                </div>
            </div>
        `;

        this._bindEvents();
    }

    _bindEvents() {
        // Toggle panel
        const toggleBtn = document.getElementById('exp-panel-toggle');
        toggleBtn?.addEventListener('click', () => {
            this.collapsed = !this.collapsed;
            document.getElementById('exp-panel')?.classList.toggle('collapsed', this.collapsed);
            // Move toggle button: when open, sits at left edge of panel (right: 280px)
            toggleBtn.style.right = this.collapsed ? '0px' : '280px';
        });

        // Slider value displays
        const sliders = [
            { id: 'exp-latency', valId: 'exp-latency-val', suffix: 'ms' },
            { id: 'exp-miss-rate', valId: 'exp-miss-rate-val', suffix: '%' },
            { id: 'exp-fp-rate', valId: 'exp-fp-rate-val', suffix: '%' },
            { id: 'exp-hold-min', valId: 'exp-hold-min-val', suffix: 'ms' },
            { id: 'exp-hold-max', valId: 'exp-hold-max-val', suffix: 'ms' },
            { id: 'exp-cooldown', valId: 'exp-cooldown-val', suffix: 'ms' },
            { id: 'exp-dwell-time', valId: 'exp-dwell-val', suffix: 'ms' }
        ];

        sliders.forEach(({ id, valId }) => {
            const slider = document.getElementById(id);
            const display = document.getElementById(valId);
            if (slider && display) {
                slider.addEventListener('input', () => {
                    display.textContent = slider.value;
                });
            }
        });

        // Button events
        const buttonMap = {
            'exp-apply-condition': 'applyCondition',
            'exp-apply-provider': 'applyProvider',
            'exp-apply-als': 'applyALS',
            'exp-start-trial': 'startTrial',
            'exp-next-trial': 'nextTrial',
            'exp-pause-trial': 'pauseTrial',
            'exp-export-logs': 'exportLogs',
            'exp-show-questionnaire': 'showQuestionnaire'
        };

        Object.entries(buttonMap).forEach(([elementId, event]) => {
            document.getElementById(elementId)?.addEventListener('click', () => {
                this._fireEvent(event, this._gatherValues());
            });
        });
    }

    _gatherValues() {
        return {
            participantId: document.getElementById('exp-participant-id')?.value || '',
            sessionId: document.getElementById('exp-session-id')?.value || '',
            condition: document.getElementById('exp-condition')?.value || 'dwell',
            provider: document.getElementById('exp-provider')?.value || 'keyboard',
            taskType: document.getElementById('exp-task-type')?.value || 'directed_selection',
            practiceMode: document.getElementById('exp-practice-mode')?.checked || false,
            alsConfig: {
                phonemeConfirmationLatencyMs: parseInt(document.getElementById('exp-latency')?.value || '180'),
                missRate: parseInt(document.getElementById('exp-miss-rate')?.value || '0') / 100,
                falsePositiveRate: parseInt(document.getElementById('exp-fp-rate')?.value || '0') / 100,
                phonemeHoldMinMs: parseInt(document.getElementById('exp-hold-min')?.value || '300'),
                phonemeHoldMaxMs: parseInt(document.getElementById('exp-hold-max')?.value || '700'),
                cooldownMs: parseInt(document.getElementById('exp-cooldown')?.value || '500')
            },
            dwellTimeMs: parseInt(document.getElementById('exp-dwell-time')?.value || '800')
        };
    }

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    _fireEvent(event, data) {
        (this.listeners[event] || []).forEach(cb => {
            try { cb(data); } catch (e) { console.error('[ExperimenterPanel]', e); }
        });
    }

    updateStatus(updates) {
        if (updates.eventCount !== undefined) {
            const el = document.getElementById('exp-event-count');
            if (el) el.textContent = updates.eventCount;
        }
        if (updates.condition !== undefined) {
            const el = document.getElementById('exp-current-condition');
            if (el) el.textContent = updates.condition;
        }
        if (updates.provider !== undefined) {
            const el = document.getElementById('exp-current-provider');
            if (el) el.textContent = updates.provider;
        }
        if (updates.trial !== undefined) {
            const el = document.getElementById('exp-current-trial');
            if (el) el.textContent = updates.trial;
        }
    }

    getValues() {
        return this._gatherValues();
    }
}
