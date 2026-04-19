/**
 * Condition Engine
 * 
 * Manages the three experimental conditions:
 *   A: Dwell Baseline (800ms dwell confirmation)
 *   B: Binary Phoneme Confirm (AY only)
 *   C: Rich iPhoneme Vocabulary (AY, AW, UW, Y)
 */

export class ConditionEngine {
    constructor() {
        this.currentCondition = null;
        this.listeners = [];
        
        this.conditions = {
            dwell: {
                id: 'dwell',
                label: 'Condition A: Dwell Baseline',
                shortLabel: 'Dwell',
                color: '#70a1ff',
                description: 'Dwell-based confirmation (800ms gaze hold)',
                confirmationMethod: 'dwell',
                availableCommands: {
                    select: { method: 'dwell', label: 'Look & Hold', hint: 'Hold gaze on target for 800ms' }
                },
                phonemeCommands: {},
                dwellEnabled: true
            },
            binary_phoneme: {
                id: 'binary_phoneme',
                label: 'Condition B: Binary Phoneme',
                shortLabel: 'Binary',
                color: '#7bed9f',
                description: 'Single phoneme confirmation (AY only)',
                confirmationMethod: 'phoneme',
                availableCommands: {
                    select: { method: 'phoneme', phoneme: 'AY', label: 'Say AY / Press 1', hint: 'Produce AY phoneme to confirm' }
                },
                phonemeCommands: {
                    'AY': 'select'
                },
                dwellEnabled: false
            },
            rich_phoneme: {
                id: 'rich_phoneme',
                label: 'Condition C: Rich iPhoneme',
                shortLabel: 'Rich',
                color: '#a29bfe',
                description: 'Full phoneme vocabulary (AY, AW, UW, Y)',
                confirmationMethod: 'phoneme',
                availableCommands: {
                    select: { method: 'phoneme', phoneme: 'AY', label: 'AY / Key 1', hint: 'Select or commit' },
                    back: { method: 'phoneme', phoneme: 'AW', label: 'AW / Key 2', hint: 'Back or cancel' },
                    swipe: { method: 'phoneme', phoneme: 'UW', label: 'UW / Key 3', hint: 'Swipe or next' },
                    drag: { method: 'phoneme', phoneme: 'Y', label: 'Y / Hold 4', hint: 'Hold to drag or select text' }
                },
                phonemeCommands: {
                    'AY': 'select',
                    'AW': 'back',
                    'UW': 'swipe',
                    'Y': 'drag'
                },
                dwellEnabled: false
            }
        };
    }

    /**
     * Set the active condition
     */
    setCondition(conditionId) {
        if (!this.conditions[conditionId]) {
            console.error(`[ConditionEngine] Unknown condition: ${conditionId}`);
            return null;
        }
        
        this.currentCondition = this.conditions[conditionId];
        console.log(`[ConditionEngine] Switched to: ${this.currentCondition.label}`);
        
        this.listeners.forEach(cb => {
            try { cb(this.currentCondition); } catch (e) { console.error(e); }
        });
        
        return this.currentCondition;
    }

    /**
     * Get the current condition configuration
     */
    getCondition() {
        return this.currentCondition;
    }

    /**
     * Get available commands for the current condition
     */
    getAvailableCommands() {
        return this.currentCondition ? this.currentCondition.availableCommands : {};
    }

    /**
     * Map a phoneme event to a command action in the current condition
     * Returns: { action: string, command: object } or null
     */
    mapPhonemeToAction(phonemeEvent) {
        if (!this.currentCondition) return null;
        
        const action = this.currentCondition.phonemeCommands[phonemeEvent.phoneme];
        if (!action) return null;
        
        const command = this.currentCondition.availableCommands[action];
        return { action, command, phonemeEvent };
    }

    /**
     * Check if dwell is enabled for current condition
     */
    isDwellEnabled() {
        return this.currentCondition ? this.currentCondition.dwellEnabled : false;
    }

    /**
     * Register condition change listener
     */
    onChange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Get all condition definitions
     */
    getAllConditions() {
        return { ...this.conditions };
    }

    /**
     * Get Latin-square counterbalanced order for a participant
     */
    getCounterbalancedOrder(participantNumber, orders) {
        const idx = (participantNumber - 1) % orders.length;
        return orders[idx];
    }
}
