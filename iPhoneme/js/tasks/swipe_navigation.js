/**
 * Task 3: Swipe-Style Navigation
 * 
 * Carousel of items — user must navigate to a specific card
 * using UW (next) or AW (back) commands.
 * In dwell condition: uses next/prev buttons with dwell.
 */

export class SwipeNavigationTask {
    constructor(container, logger) {
        this.container = container;
        this.logger = logger;
        this.carouselItems = [];
        this.currentIndex = 0;
        this.targetIndex = 0;
        this.hoveredTarget = null;
        this.hoverStartTime = 0;
        this.swipeCount = 0;
        this.overshootCount = 0;
        this.onComplete = null;
        this.active = false;
        this.hoveredButton = null;
    }

    render(trialData) {
        this.active = true;
        this.swipeCount = 0;
        this.overshootCount = 0;
        this.hoveredTarget = null;
        this.hoveredButton = null;
        this.currentIndex = trialData.startIndex;
        this.targetIndex = trialData.targetIndex;
        this.carouselItems = trialData.taskDef.carouselItems;
        
        const targetItem = this.carouselItems[this.targetIndex];
        
        this.container.innerHTML = `
            <div class="task-area" id="swipe-navigation-area">
                <div class="task-header">
                    <h2 class="task-title">Swipe Navigation</h2>
                    <p class="task-instruction">
                        Navigate to: <strong>${targetItem.icon} ${targetItem.label}</strong>
                    </p>
                    <p class="task-instruction-detail">
                        Hold <strong>Y</strong> + move gaze left/right to swipe, then <strong>AY</strong> to confirm
                    </p>
                </div>
                <div class="carousel-container">
                    <div class="carousel-nav-btn" id="carousel-prev" data-action="prev">
                        <span>◀</span>
                        <small>Swipe Left / Dwell</small>
                        <div class="dwell-progress" id="dwell-progress-prev"></div>
                    </div>
                    <div class="carousel-viewport" id="carousel-viewport">
                        <div class="carousel-card" id="carousel-current-card">
                            <!-- Updated dynamically -->
                        </div>
                    </div>
                    <div class="carousel-nav-btn" id="carousel-next" data-action="next">
                        <span>▶</span>
                        <small>Swipe Right / Dwell</small>
                        <div class="dwell-progress" id="dwell-progress-next"></div>
                    </div>
                </div>
                <div class="carousel-indicators" id="carousel-indicators">
                    ${this.carouselItems.map((item, i) => `
                        <div class="carousel-dot ${i === this.currentIndex ? 'active' : ''} ${i === this.targetIndex ? 'target' : ''}" 
                             data-index="${i}" 
                             title="${item.label}">
                        </div>
                    `).join('')}
                </div>
                <div class="carousel-select-area">
                    <div class="target-card carousel-select-btn" id="carousel-select-btn" data-action="select">
                        <div class="target-label">✅ Select This Card</div>
                        <small>AY / Dwell</small>
                        <div class="dwell-progress" id="dwell-progress-select"></div>
                    </div>
                </div>
            </div>
        `;

        this._updateCarousel();
    }

    _updateCarousel() {
        const card = document.getElementById('carousel-current-card');
        const item = this.carouselItems[this.currentIndex];
        if (!card) return;
        
        card.style.setProperty('--card-color', item.color);
        card.innerHTML = `
            <div class="carousel-card-icon">${item.icon}</div>
            <div class="carousel-card-label">${item.label}</div>
            <div class="carousel-card-index">${this.currentIndex + 1} / ${this.carouselItems.length}</div>
        `;

        // Animate card
        card.classList.remove('card-enter');
        void card.offsetWidth; // Force reflow
        card.classList.add('card-enter');

        // Update dots
        const dots = this.container.querySelectorAll('.carousel-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentIndex);
        });

        // Check if at target
        if (this.currentIndex === this.targetIndex) {
            card.classList.add('at-target');
        } else {
            card.classList.remove('at-target');
        }
    }

    /**
     * Navigate forward (UW/swipe)
     */
    navigateNext(triggerSource) {
        if (!this.active) return;
        
        const prevIndex = this.currentIndex;
        this.currentIndex = Math.min(this.currentIndex + 1, this.carouselItems.length - 1);
        this.swipeCount++;
        
        // Check overshoot
        if (this._passedTarget(prevIndex, this.currentIndex)) {
            this.overshootCount++;
        }

        this.logger.actionTriggered({
            actionName: 'swipe_next',
            triggerSource,
            pointerX: 0, pointerY: 0,
            activeTarget: this.carouselItems[this.currentIndex].label,
            success: true,
            intended: true,
            latencyFromAcquisitionMs: 0
        });

        this._updateCarousel();
    }

    /**
     * Navigate backward (AW/back)
     */
    navigatePrev(triggerSource) {
        if (!this.active) return;
        
        const prevIndex = this.currentIndex;
        this.currentIndex = Math.max(this.currentIndex - 1, 0);
        this.swipeCount++;

        if (this._passedTarget(prevIndex, this.currentIndex)) {
            this.overshootCount++;
        }

        this.logger.actionTriggered({
            actionName: 'swipe_prev',
            triggerSource,
            pointerX: 0, pointerY: 0,
            activeTarget: this.carouselItems[this.currentIndex].label,
            success: true,
            intended: true,
            latencyFromAcquisitionMs: 0
        });

        this._updateCarousel();
    }

    _passedTarget(prevIdx, newIdx) {
        // If we were closer and now further, that's an overshoot
        const prevDist = Math.abs(prevIdx - this.targetIndex);
        const newDist = Math.abs(newIdx - this.targetIndex);
        return newDist > prevDist && prevDist <= 1;
    }

    /**
     * Check pointer against navigation buttons and select button
     */
    checkPointer(x, y, tolerance = 30) {
        if (!this.active) return null;
        
        const buttons = [
            { id: 'carousel-prev', action: 'prev' },
            { id: 'carousel-next', action: 'next' },
            { id: 'carousel-select-btn', action: 'select' }
        ];

        let found = null;
        
        buttons.forEach(btn => {
            const el = document.getElementById(btn.id);
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const inBounds = (
                x >= rect.left - tolerance &&
                x <= rect.right + tolerance &&
                y >= rect.top - tolerance &&
                y <= rect.bottom + tolerance
            );
            
            el.classList.toggle('pointer-hover', inBounds);
            
            if (inBounds) {
                found = { id: btn.id, action: btn.action, element: el };
            }
        });

        const foundId = found ? found.id : null;
        if (foundId !== this.hoveredButton) {
            this.hoveredButton = foundId;
            this.hoverStartTime = performance.now();
        }

        return found;
    }

    /**
     * Handle select action (confirm current card)
     */
    handleSelect(triggerSource, pointerX, pointerY) {
        if (!this.active) return null;
        
        const isCorrect = this.currentIndex === this.targetIndex;
        
        this.logger.actionTriggered({
            actionName: 'carousel_select',
            triggerSource,
            pointerX, pointerY,
            activeTarget: this.carouselItems[this.currentIndex].label,
            success: isCorrect,
            intended: isCorrect,
            latencyFromAcquisitionMs: 0
        });

        if (isCorrect) {
            const card = document.getElementById('carousel-current-card');
            if (card) card.classList.add('target-success');
            this.active = false;
            
            const result = {
                success: true,
                swipeCount: this.swipeCount,
                overshootCount: this.overshootCount,
                triggerSource
            };

            setTimeout(() => {
                if (this.onComplete) this.onComplete(result);
            }, 500);
            return result;
        } else {
            const card = document.getElementById('carousel-current-card');
            if (card) {
                card.classList.add('target-error');
                setTimeout(() => card.classList.remove('target-error'), 400);
            }
            
            this.logger.errorEvent({
                type: 'wrong_card_selected',
                currentIndex: this.currentIndex,
                targetIndex: this.targetIndex,
                triggerSource
            });
            
            return { success: false };
        }
    }

    getHoveredTarget() {
        return this.hoveredButton;
    }

    getCurrentIndex() {
        return this.currentIndex;
    }

    destroy() {
        this.active = false;
        this.container.innerHTML = '';
    }
}
