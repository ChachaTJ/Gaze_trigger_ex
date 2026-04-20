/**
 * Task 4: Drag / Text Selection
 * 
 * Displays a sentence with specific words to select.
 * User holds Y phoneme (onset), moves gaze across target words, releases (offset).
 * Demonstrates sustained phoneme interaction with onset/offset.
 * 
 * In dwell condition: uses start/end dwell targets at word boundaries.
 * In binary condition: two AY presses for start/end.
 */

export class DragTextSelectTask {
    constructor(container, logger) {
        this.container = container;
        this.logger = logger;
        this.words = [];
        this.targetWords = [];
        this.targetText = '';
        this.wordElements = [];
        this.isSelecting = false;
        this.selectionStartWord = -1;
        this.selectionEndWord = -1;
        this.hoveredWord = null;
        this.hoverStartTime = 0;
        this.onComplete = null;
        this.active = false;
        this.selectStarted = false; // For binary condition
        this.falseActivations = 0;
    }

    render(trialData) {
        this.active = true;
        this.isSelecting = false;
        this.selectStarted = false;
        this.selectionStartWord = -1;
        this.selectionEndWord = -1;
        this.hoveredWord = null;
        this.falseActivations = 0;
        
        this.words = trialData.sentence.split(' ');
        this.targetWords = trialData.targetWords;
        this.targetText = trialData.targetText;

        this.container.innerHTML = `
            <div class="task-area" id="drag-text-area">
                <div class="task-header">
                    <h2 class="task-title">Text Selection</h2>
                    <p class="task-instruction">
                        Select these words: <strong class="highlight-text">"${this.targetText}"</strong>
                    </p>
                    <p class="task-instruction-detail">
                        Hold <kbd>Y</kbd> (key 4) to start selection, move across words, release to end.
                    </p>
                    <p class="task-trial-info">Trial ${trialData.trialIndex + 1} / ${trialData.totalTrials}</p>
                </div>
                <div class="text-selection-area" id="text-selection-area">
                    <div class="text-line" id="text-line">
                        ${this.words.map((word, i) => `
                            <span class="selectable-word ${this.targetWords.includes(i) ? 'target-word' : ''}" 
                                  data-word-index="${i}" 
                                  id="word-${i}">${word}</span>
                        `).join(' ')}
                    </div>
                </div>
                <div class="selection-status" id="selection-status">
                    <div class="selection-indicator" id="selection-indicator">
                        Ready — Hold Y (key 4) to begin selection
                    </div>
                </div>
                <div class="selection-result" id="selection-result" style="display: none;">
                    <div class="selection-result-label">Selected:</div>
                    <div class="selection-result-text" id="selection-result-text"></div>
                </div>
            </div>
        `;

        this.wordElements = Array.from(this.container.querySelectorAll('.selectable-word'));
    }

    /**
     * Check pointer over words
     */
    checkPointer(x, y, tolerance = 15) {
        if (!this.active) return null;
        
        let found = null;
        
        this.wordElements.forEach((el, i) => {
            const rect = el.getBoundingClientRect();
            const inBounds = (
                x >= rect.left - tolerance &&
                x <= rect.right + tolerance &&
                y >= rect.top - tolerance &&
                y <= rect.bottom + tolerance
            );
            
            el.classList.toggle('word-hover', inBounds);
            
            if (inBounds) {
                found = { index: i, element: el, word: el.textContent };
            }
        });

        // If currently selecting (Y held), extend selection
        if (this.isSelecting && found) {
            this.selectionEndWord = found.index;
            this._updateSelectionHighlight();
        }

        const foundIndex = found ? found.index : null;
        if (foundIndex !== this.hoveredWord) {
            this.hoveredWord = foundIndex;
            this.hoverStartTime = performance.now();
        }

        return found;
    }

    /**
     * Start text selection (Y onset)
     */
    startSelection(triggerSource) {
        if (!this.active) return;
        
        this.isSelecting = true;
        
        if (this.hoveredWord !== null) {
            this.selectionStartWord = this.hoveredWord;
            this.selectionEndWord = this.hoveredWord;
        }

        this.logger.actionTriggered({
            actionName: 'drag_start',
            triggerSource,
            pointerX: 0, pointerY: 0,
            activeTarget: this.hoveredWord !== null ? this.words[this.hoveredWord] : 'none',
            success: true,
            intended: true,
            latencyFromAcquisitionMs: 0
        });

        const indicator = document.getElementById('selection-indicator');
        if (indicator) {
            indicator.textContent = '⏺ Selecting... Move gaze across words, release to confirm';
            indicator.classList.add('selecting');
        }
        
        this._updateSelectionHighlight();
    }

    /**
     * End text selection (Y offset)
     */
    endSelection(triggerSource, holdValid = true) {
        if (!this.active || !this.isSelecting) return null;
        
        this.isSelecting = false;
        
        if (!holdValid) {
            // Hold was too short
            this._clearSelectionHighlight();
            const indicator = document.getElementById('selection-indicator');
            if (indicator) {
                indicator.textContent = '⚠️ Hold was too short. Try again.';
                indicator.classList.remove('selecting');
            }
            return { success: false, reason: 'hold_too_short' };
        }

        // Calculate selected range
        const startIdx = Math.min(this.selectionStartWord, this.selectionEndWord);
        const endIdx = Math.max(this.selectionStartWord, this.selectionEndWord);
        const selectedWords = [];
        
        for (let i = startIdx; i <= endIdx; i++) {
            selectedWords.push(i);
        }

        // Calculate accuracy
        const selectedSet = new Set(selectedWords);
        const targetSet = new Set(this.targetWords);
        const correctWords = selectedWords.filter(w => targetSet.has(w));
        const accuracy = targetSet.size > 0 ? correctWords.length / targetSet.size : 0;
        const precision = selectedWords.length > 0 ? correctWords.length / selectedWords.length : 0;
        
        // F1 score
        const f1 = (precision + accuracy) > 0 ? 
            2 * (precision * accuracy) / (precision + accuracy) : 0;

        const selectedText = selectedWords.map(i => this.words[i]).join(' ');
        const isExactMatch = JSON.stringify(selectedWords.sort()) === JSON.stringify([...this.targetWords].sort());

        this.logger.actionTriggered({
            actionName: 'drag_end',
            triggerSource,
            pointerX: 0, pointerY: 0,
            activeTarget: selectedText,
            success: isExactMatch,
            intended: true,
            latencyFromAcquisitionMs: 0
        });

        // Show result
        const resultEl = document.getElementById('selection-result');
        const resultTextEl = document.getElementById('selection-result-text');
        if (resultEl && resultTextEl) {
            resultEl.style.display = 'block';
            resultTextEl.textContent = `"${selectedText}"`;
            resultEl.classList.toggle('result-success', f1 >= 0.5);
            resultEl.classList.toggle('result-error', f1 < 0.5);
        }

        const indicator = document.getElementById('selection-indicator');
        if (indicator) {
            indicator.textContent = isExactMatch ? '✅ Perfect selection!' : 
                `Selection complete (accuracy: ${(accuracy * 100).toFixed(0)}%)`;
            indicator.classList.remove('selecting');
        }

        this.active = false;
        
        const result = {
            success: isExactMatch,
            selectedWords,
            targetWords: this.targetWords,
            selectedText,
            targetText: this.targetText,
            accuracy,
            precision,
            f1Score: f1,
            triggerSource
        };

        // Call onComplete synchronously — ExperimentApp manages all timing
        if (this.onComplete) this.onComplete(result);

        return result;
    }

    /**
     * Handle select for binary/dwell conditions (two-press start/end)
     */
    handleSelect(triggerSource, pointerX, pointerY) {
        if (!this.active) return null;

        if (!this.selectStarted) {
            // First press: start selection
            this.selectStarted = true;
            this.startSelection(triggerSource);
            return { started: true };
        } else {
            // Second press: end selection
            this.selectStarted = false;
            return this.endSelection(triggerSource, true);
        }
    }

    _updateSelectionHighlight() {
        if (this.selectionStartWord < 0) return;
        
        const startIdx = Math.min(this.selectionStartWord, this.selectionEndWord);
        const endIdx = Math.max(this.selectionStartWord, this.selectionEndWord);
        
        this.wordElements.forEach((el, i) => {
            el.classList.toggle('word-selected', i >= startIdx && i <= endIdx);
        });
    }

    _clearSelectionHighlight() {
        this.wordElements.forEach(el => el.classList.remove('word-selected'));
        this.selectionStartWord = -1;
        this.selectionEndWord = -1;
    }

    getHoveredTarget() {
        return this.hoveredWord;
    }

    isCurrentlySelecting() {
        return this.isSelecting;
    }

    destroy() {
        this.active = false;
        this.container.innerHTML = '';
    }
}
