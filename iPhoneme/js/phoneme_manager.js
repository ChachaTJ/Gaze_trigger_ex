/**
 * Phoneme Event Manager
 * 
 * Central abstraction layer for phoneme events.
 * Manages active provider (keyboard / emulated / live).
 * Normalizes all events to PhonemeEvent shape.
 * Tracks sustained phoneme state (Y hold).
 */

import { KeyboardProvider } from './providers/keyboard_provider.js';
import { EmulatedProvider } from './providers/emulated_provider.js';
import { LiveVoiceProvider } from './providers/live_voice_provider.js';
import { MouthProvider } from './providers/mouth_provider.js';

export class PhonemeManager {
    constructor() {
        this.providers = {
            keyboard: new KeyboardProvider(),
            emulated: new EmulatedProvider(),
            live: new LiveVoiceProvider(),
            mouth: new MouthProvider()
        };
        
        this.activeProvider = null;
        this.activeProviderType = null;
        this.listeners = [];
        this._providerUnsubscribe = null;
        
        // Sustained phoneme state
        this.activeHolds = new Map(); // phoneme -> { startTime, startPointer }
    }

    /**
     * Set the active phoneme provider
     * @param {'keyboard'|'emulated'|'live'} providerType
     */
    async setProvider(providerType) {
        // Stop current provider
        if (this.activeProvider) {
            this.activeProvider.stop();
            if (this._providerUnsubscribe) {
                this._providerUnsubscribe();
                this._providerUnsubscribe = null;
            }
        }

        this.activeProviderType = providerType;
        this.activeProvider = this.providers[providerType];
        
        if (!this.activeProvider) {
            console.error(`[PhonemeManager] Unknown provider: ${providerType}`);
            return;
        }

        // Subscribe to provider events
        this._providerUnsubscribe = this.activeProvider.onPhoneme((event) => {
            this._handlePhonemeEvent(event);
        });

        // Start provider
        await this.activeProvider.start();
        console.log(`[PhonemeManager] Active provider: ${providerType}`);
    }

    /**
     * Update emulated provider config
     */
    updateEmulatedConfig(config) {
        this.providers.emulated.updateConfig(config);
    }

    /**
     * Register a phoneme event listener
     */
    onPhoneme(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Internal handler for normalized events
     */
    _handlePhonemeEvent(event) {
        // Track sustained holds
        if (event.phase === 'start') {
            this.activeHolds.set(event.phoneme, {
                startTime: event.emittedAt,
                phoneme: event.phoneme
            });
        } else if (event.phase === 'end') {
            this.activeHolds.delete(event.phoneme);
        }

        // Emit to all listeners
        this.listeners.forEach(cb => {
            try { cb(event); } catch (e) { console.error('[PhonemeManager] Listener error:', e); }
        });
    }

    /**
     * Check if a specific phoneme is currently held
     */
    isHeld(phoneme) {
        return this.activeHolds.has(phoneme);
    }

    /**
     * Get all currently active holds
     */
    getActiveHolds() {
        return new Map(this.activeHolds);
    }

    /**
     * Get current provider type
     */
    getProviderType() {
        return this.activeProviderType;
    }

    /**
     * Stop the active provider
     */
    stop() {
        if (this.activeProvider) {
            this.activeProvider.stop();
        }
        this.activeHolds.clear();
    }

    /**
     * Get provider instance for direct config access
     */
    getProvider(type) {
        return this.providers[type];
    }
}
