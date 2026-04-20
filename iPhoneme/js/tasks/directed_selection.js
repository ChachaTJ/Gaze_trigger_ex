/**
 * Task 1: Directed Target Selection
 * 
 * Displays a grid of cards with one highlighted target.
 * User moves pointer to target and activates it.
 * Metrics: selection time, wrong-target errors, success rate, false activations.
 */

export class DirectedSelectionTask {
    constructor(container, logger) {
        this.container = container;
        this.logger = logger;
        this.targets = [];
        this.targetElements = [];
        this.goalTargetIndex = -1;
        this.hoveredTarget = null;
        this.hoverStartTime = 0;
        this.falseActivations = 0;
        this.onComplete = null;
        this.active = false;
    }

    /**
     * Render the task UI
     */
    render(trialData) {
        this.active = true;
        this.falseActivations = 0;
        this.hoveredTarget = null;
        this.goalTargetIndex = trialData.targetIndex;
        
        const gridItems = trialData.taskDef.gridItems;
        
        this.container.innerHTML = `
            <div class="task-area" id="directed-selection-area">
                <div class="task-header">
                    <h2 class="task-title">Directed Selection</h2>
                    <p class="task-instruction">Select the highlighted target: <strong>${gridItems[this.goalTargetIndex].label}</strong></p>
                    <p class="task-trial-info">Trial ${trialData.trialIndex + 1} / ${trialData.totalTrials}</p>
                </div>
                <div class="target-grid" id="target-grid">
                    ${gridItems.map((item, i) => `
                        <div class="target-card ${i === this.goalTargetIndex ? 'goal-target' : ''}" 
                             data-target-index="${i}" 
                             data-target-label="${item.label}"
                             id="target-${i}">
                            <div class="target-icon">${item.icon}</div>
                            <div class="target-label">${item.label}</div>
                            <div class="dwell-progress" id="dwell-progress-${i}"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.targetElements = Array.from(this.container.querySelectorAll('.target-card'));
    }

    /**
     * Check if pointer is over a target
     */
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
            }
        });

        // Track hover changes
        const foundIndex = found ? found.index : null;
        if (foundIndex !== this.hoveredTarget) {
            if (this.hoveredTarget !== null) {
                this.logger.targetLeave(
                    `target-${this.hoveredTarget}`, x, y,
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

    /**
     * Handle a select action on the currently hovered target
     */
    handleSelect(triggerSource, pointerX, pointerY) {
        if (!this.active || this.hoveredTarget === null) return null;
        
        const isCorrect = this.hoveredTarget === this.goalTargetIndex;
        const el = this.targetElements[this.hoveredTarget];
        
        this.logger.actionTriggered({
            actionName: 'select',
            triggerSource,
            pointerX,
            pointerY,
            activeTarget: el.dataset.targetLabel,
            success: isCorrect,
            intended: isCorrect,
            latencyFromAcquisitionMs: performance.now() - this.hoverStartTime
        });

        if (isCorrect) {
            el.classList.add('target-success');
            this.active = false;
            
            const result = {
                success: true,
                falseActivations: this.falseActivations,
                wrongTarget: false,
                selectedTarget: el.dataset.targetLabel,
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
                type: 'wrong_target',
                selectedTarget: el.dataset.targetLabel,
                goalTarget: this.targetElements[this.goalTargetIndex]?.dataset.targetLabel,
                triggerSource
            });
            
            return { success: false, wrongTarget: true };
        }
    }

    /**
     * Get the currently hovered target index
     */
    getHoveredTarget() {
        return this.hoveredTarget;
    }

    /**
     * Clean up
     */
    destroy() {
        this.active = false;
        this.container.innerHTML = '';
    }
}
