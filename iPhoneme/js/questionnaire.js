/**
 * Questionnaire Module
 * 
 * Post-condition subjective measures:
 * - NASA-TLX subscales (6 items, 7-point)
 * - Perceived control, reliability, fatigue, frustration
 * - Free-text comments
 * - Final condition preference
 */

export class Questionnaire {
    constructor(container, logger) {
        this.container = container;
        this.logger = logger;
        this.onSubmit = null;
        this.currentCondition = '';
    }

    show(conditionLabel = '') {
        this.currentCondition = conditionLabel;
        
        this.container.innerHTML = `
            <div class="questionnaire-overlay" id="questionnaire-overlay">
                <div class="questionnaire-panel">
                    <h2 class="q-title">Post-Condition Questionnaire</h2>
                    <p class="q-subtitle">Condition: <strong>${conditionLabel}</strong></p>
                    
                    <form id="questionnaire-form" class="q-form">
                        <!-- NASA-TLX -->
                        <div class="q-section">
                            <h3>Workload Assessment (NASA-TLX)</h3>
                            ${this._renderScale('mental_demand', 'Mental Demand', 'How mentally demanding was this condition?')}
                            ${this._renderScale('physical_demand', 'Physical Demand', 'How physically demanding was this condition?')}
                            ${this._renderScale('temporal_demand', 'Temporal Demand', 'How hurried or rushed was the pace?')}
                            ${this._renderScale('performance', 'Performance', 'How successful were you? (1=poor, 7=excellent)')}
                            ${this._renderScale('effort', 'Effort', 'How hard did you work to accomplish your task?')}
                            ${this._renderScale('frustration', 'Frustration', 'How insecure, discouraged, or stressed?')}
                        </div>

                        <!-- Additional Measures -->
                        <div class="q-section">
                            <h3>Interaction Quality</h3>
                            ${this._renderScale('perceived_control', 'Perceived Control', 'How much control did you feel over the interface?')}
                            ${this._renderScale('perceived_reliability', 'Perceived Reliability', 'How reliable was the interaction?')}
                            ${this._renderScale('fatigue', 'Fatigue', 'How fatigued did you feel?')}
                            ${this._renderScale('frustration_level', 'Frustration', 'How frustrated did you feel?')}
                        </div>

                        <!-- Comments -->
                        <div class="q-section">
                            <h3>Comments</h3>
                            <label class="q-label">
                                Any observations or issues with this condition?
                                <textarea id="q-comments" class="q-textarea" rows="3" 
                                          placeholder="Optional comments..."></textarea>
                            </label>
                        </div>

                        <div class="q-actions">
                            <button type="submit" class="q-submit-btn">Submit & Continue</button>
                            <button type="button" class="q-skip-btn" id="q-skip">Skip</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Bind events
        document.getElementById('questionnaire-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handleSubmit();
        });

        document.getElementById('q-skip')?.addEventListener('click', () => {
            this.hide();
            if (this.onSubmit) this.onSubmit({ skipped: true });
        });
    }

    showPreference() {
        this.container.innerHTML = `
            <div class="questionnaire-overlay" id="questionnaire-overlay">
                <div class="questionnaire-panel">
                    <h2 class="q-title">Final Preference</h2>
                    
                    <form id="preference-form" class="q-form">
                        <div class="q-section">
                            <h3>Which condition did you prefer?</h3>
                            <div class="q-radio-group">
                                <label class="q-radio">
                                    <input type="radio" name="preference" value="dwell"> 
                                    Condition A: Dwell Baseline
                                </label>
                                <label class="q-radio">
                                    <input type="radio" name="preference" value="binary_phoneme"> 
                                    Condition B: Binary Phoneme
                                </label>
                                <label class="q-radio">
                                    <input type="radio" name="preference" value="rich_phoneme"> 
                                    Condition C: Rich iPhoneme
                                </label>
                            </div>
                        </div>

                        <div class="q-section">
                            <label class="q-label">
                                Why did you prefer this condition?
                                <textarea id="pref-reason" class="q-textarea" rows="3" 
                                          placeholder="Explain your preference..."></textarea>
                            </label>
                        </div>

                        <div class="q-actions">
                            <button type="submit" class="q-submit-btn">Submit</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('preference-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const preference = document.querySelector('input[name="preference"]:checked')?.value || '';
            const reason = document.getElementById('pref-reason')?.value || '';
            
            this.logger.questionnaireSubmitted({
                type: 'preference',
                preference,
                reason
            });

            this.hide();
            if (this.onSubmit) this.onSubmit({ preference, reason });
        });
    }

    _renderScale(id, label, description) {
        const points = [1, 2, 3, 4, 5, 6, 7];
        return `
            <div class="q-scale-item">
                <div class="q-scale-label">${label}</div>
                <div class="q-scale-desc">${description}</div>
                <div class="q-scale-row">
                    <span class="q-scale-anchor">Low</span>
                    ${points.map(p => `
                        <label class="q-scale-point">
                            <input type="radio" name="q-${id}" value="${p}">
                            <span>${p}</span>
                        </label>
                    `).join('')}
                    <span class="q-scale-anchor">High</span>
                </div>
            </div>
        `;
    }

    _handleSubmit() {
        const form = document.getElementById('questionnaire-form');
        if (!form) return;

        const data = {
            type: 'post_condition',
            condition: this.currentCondition,
            responses: {}
        };

        const scales = [
            'mental_demand', 'physical_demand', 'temporal_demand',
            'performance', 'effort', 'frustration',
            'perceived_control', 'perceived_reliability', 'fatigue', 'frustration_level'
        ];

        scales.forEach(scale => {
            const checked = form.querySelector(`input[name="q-${scale}"]:checked`);
            data.responses[scale] = checked ? parseInt(checked.value) : null;
        });

        data.responses.comments = document.getElementById('q-comments')?.value || '';

        this.logger.questionnaireSubmitted(data);
        this.hide();
        if (this.onSubmit) this.onSubmit(data);
    }

    hide() {
        this.container.innerHTML = '';
    }
}
