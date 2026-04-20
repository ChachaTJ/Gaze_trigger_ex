/**
 * Task 2: Browse Without Acting, Then Select
 * 
 * User must browse targets in sequence without activating them.
 * Only the final target should be selected.
 * Measures Midas Touch: any activation before final target = false activation.
 */

export class BrowseSelectTask {
    constructor(container, logger) {
        this.container = container;
        this.logger = logger;
        this.targets = [];
        this.targetElements = [];
        this.browseSequence = [];
        this.selectTarget = -1;
        this.currentBrowseStep = 0;
        this.hoveredTarget = null;
        this.hoverStartTime = 0;
        this.falseActivations = 0;
        this.browsedTargets = new Set();
        this.onComplete = null;
        this.active = false;
    }

    render(trialData) {
        this.active = true;
        this.falseActivations = 0;
        this.hoveredTarget = null;
        this.currentBrowseStep = 0;
        this.browsedTargets = new Set();
        this.browseSequence = trialData.browseSequence;
        this.selectTarget = trialData.selectTarget;
        
        const targets = trialData.taskDef.targets;
        
        // Build instruction text
        const browseLabels = this.browseSequence.map(i => targets[i].label);
        const selectLabel = targets[this.selectTarget].label;
        
        this.container.innerHTML = `
            <div class="task-area" id="browse-select-area">
                <div class="task-header">
                    <h2 class="task-title">Browse & Select</h2>
                    <p class="task-instruction">
                        Browse: <strong>${browseLabels.join(' → ')}</strong><br>
                        Then SELECT only: <strong class="highlight-text">${selectLabel}</strong>
                    </p>
                    <p class="task-trial-info">Trial ${trialData.trialIndex + 1} / ${trialData.totalTrials}</p>
                    <div class="browse-progress" id="browse-progress">
                        ${this.browseSequence.map((idx, step) => `
                            <span class="browse-step ${step === 0 ? 'current' : ''}" 
                                  data-step="${step}"
                                  id="browse-step-${step}">
                                ${targets[idx].icon} ${targets[idx].label}
                            </span>
                        `).join(' → ')}
                        <span class="browse-step select-step"> → 🎯 Select ${selectLabel}</span>
                    </div>
                </div>
                <div class="target-grid browse-grid" id="browse-grid">
                    ${targets.map((item, i) => `
                        <div class="target-card browse-target" 
                             data-target-index="${i}" 
                             data-target-label="${item.label}"
                             id="browse-target-${i}"
                             style="--target-color: ${item.color}">
                            <div class="target-icon">${item.icon}</div>
                            <div class="target-label">${item.label}</div>
                            <div class="dwell-progress" id="dwell-progress-browse-${i}"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.targetElements = Array.from(this.container.querySelectorAll('.browse-target'));
        this._updateBrowseHighlight();
    }

    _updateBrowseHighlight() {
        // Highlight current browse target
        this.targetElements.forEach(el => el.classList.remove('browse-current', 'goal-target'));
        
        if (this.currentBrowseStep < this.browseSequence.length) {
            const currentIdx = this.browseSequence[this.currentBrowseStep];
            this.targetElements[currentIdx]?.classList.add('browse-current');
        } else {
            // All browsed — highlight the select target
            this.targetElements[this.selectTarget]?.classList.add('goal-target');
        }

        // Update progress indicator
        for (let i = 0; i < this.browseSequence.length; i++) {
            const stepEl = document.getElementById(`browse-step-${i}`);
            if (stepEl) {
                stepEl.classList.toggle('completed', i < this.currentBrowseStep);
                stepEl.classList.toggle('current', i === this.currentBrowseStep);
            }
        }
    }

    checkPointer(x, y, tolerance = 30) {
        if (!this.active) return null;
        
        let found = null;
        
        this.targetElements.forEach((el, i) => {
            const rect = el.getBoundingClientRect();
            const inBounds = (
                x >= rect.left - tolerance &&
                x <= rect.right + tolerance &&
                y >= rect.top - tolerance &&
                y <= rect.bottom + tolerance
            );
            
            el.classList.toggle('pointer-hover', inBounds);
            
            if (inBounds) {
                found = { index: i, element: el, label: el.dataset.targetLabel };
                
                // Track browse progress (gazing at the correct browse target)
                if (this.currentBrowseStep < this.browseSequence.length) {
                    const expectedTarget = this.browseSequence[this.currentBrowseStep];
                    if (i === expectedTarget && !this.browsedTargets.has(i)) {
                        this.browsedTargets.add(i);
                        this.currentBrowseStep++;
                        this._updateBrowseHighlight();
                    }
                }
            }
        });

        const foundIndex = found ? found.index : null;
        if (foundIndex !== this.hoveredTarget) {
            if (this.hoveredTarget !== null) {
                this.logger.targetLeave(
                    `browse-target-${this.hoveredTarget}`, x, y,
                    performance.now() - this.hoverStartTime
                );
            }
            if (found) {
                this.logger.targetEnter(found.label, x, y);
                this.hoverStartTime = performance.now();
            }
            this.hoveredTarget = foundIndex;
        }

        return found;
    }

    handleSelect(triggerSource, pointerX, pointerY) {
        if (!this.active || this.hoveredTarget === null) return null;
        
        const el = this.targetElements[this.hoveredTarget];
        const isCorrectFinalTarget = this.hoveredTarget === this.selectTarget && 
                                      this.currentBrowseStep >= this.browseSequence.length;
        
        this.logger.actionTriggered({
            actionName: 'select',
            triggerSource,
            pointerX,
            pointerY,
            activeTarget: el.dataset.targetLabel,
            success: isCorrectFinalTarget,
            intended: isCorrectFinalTarget,
            latencyFromAcquisitionMs: performance.now() - this.hoverStartTime
        });

        if (isCorrectFinalTarget) {
            el.classList.add('target-success');
            this.active = false;
            
            const result = {
                success: true,
                falseActivations: this.falseActivations,
                wrongTarget: false,
                browseComplete: true,
                triggerSource
            };

            // Call onComplete synchronously — ExperimentApp manages all timing
            if (this.onComplete) this.onComplete(result);
            return result;
        } else {
            this.falseActivations++;
            el.classList.add('target-error');
            setTimeout(() => el.classList.remove('target-error'), 400);
            
            this.logger.errorEvent({
                type: this.currentBrowseStep < this.browseSequence.length ? 
                    'premature_activation' : 'wrong_target',
                selectedTarget: el.dataset.targetLabel,
                browseStep: this.currentBrowseStep,
                triggerSource
            });
            
            return { success: false, falseActivation: true };
        }
    }

    getHoveredTarget() {
        return this.hoveredTarget;
    }

    destroy() {
        this.active = false;
        this.container.innerHTML = '';
    }
}
