/**
 * UI Components
 * 
 * Shared UI helpers for the experiment prototype.
 */

export class UIComponents {
    /**
     * Show toast feedback
     */
    static showToast(message, type = 'info', durationMs = 1500) {
        // Remove existing toast
        const existing = document.getElementById('feedback-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'feedback-toast';
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span class="toast-message">${message}</span>`;
        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => toast.classList.add('toast-visible'));

        // Auto-dismiss
        setTimeout(() => {
            toast.classList.remove('toast-visible');
            setTimeout(() => toast.remove(), 300);
        }, durationMs);
    }

    /**
     * Update condition banner
     */
    static updateConditionBanner(condition) {
        const banner = document.getElementById('condition-banner');
        if (!banner) return;
        
        banner.textContent = condition.label;
        banner.style.setProperty('--condition-color', condition.color);
        banner.className = `condition-banner condition-${condition.id}`;
    }

    /**
     * Update command legend
     */
    static updateCommandLegend(commands, conditionId) {
        const legend = document.getElementById('command-legend');
        if (!legend) return;

        if (conditionId === 'dwell') {
            legend.innerHTML = `
                <div class="legend-title">Commands</div>
                <div class="legend-item">
                    <span class="legend-key">👁️ Dwell</span>
                    <span class="legend-desc">Hold gaze 800ms</span>
                </div>
            `;
        } else {
            const entries = Object.entries(commands).map(([action, cmd]) => `
                <div class="legend-item">
                    <span class="legend-key">${cmd.label}</span>
                    <span class="legend-desc">${cmd.hint}</span>
                </div>
            `).join('');
            
            legend.innerHTML = `
                <div class="legend-title">Commands</div>
                ${entries}
            `;
        }
    }

    /**
     * Update pointer position display
     */
    static updatePointerInfo(x, y) {
        const el = document.getElementById('pointer-coords');
        if (el) {
            el.textContent = `${Math.round(x)}, ${Math.round(y)}`;
        }
    }

    /**
     * Update dwell progress ring on a target
     */
    static updateDwellProgress(targetEl, progress) {
        if (!targetEl) return;
        const ring = targetEl.querySelector('.dwell-progress');
        if (!ring) return;
        
        if (progress <= 0) {
            ring.style.width = '0%';
            ring.classList.remove('dwell-active');
        } else {
            ring.style.width = `${Math.min(100, progress * 100)}%`;
            ring.classList.add('dwell-active');
        }
    }

    /**
     * Show/hide gaze cursor
     */
    static setCursorVisible(visible) {
        const cursor = document.getElementById('gaze-cursor');
        if (cursor) cursor.style.display = visible ? 'block' : 'none';
    }

    /**
     * Update cursor position
     */
    static updateCursor(x, y) {
        const cursor = document.getElementById('gaze-cursor');
        if (cursor) {
            cursor.style.left = `${x}px`;
            cursor.style.top = `${y}px`;
        }
    }

    /**
     * Pulse cursor for phoneme events
     */
    static pulseCursor(phoneme) {
        const cursor = document.getElementById('gaze-cursor');
        if (!cursor) return;
        
        cursor.classList.add('cursor-pulse');
        cursor.dataset.phoneme = phoneme;
        setTimeout(() => {
            cursor.classList.remove('cursor-pulse');
            cursor.dataset.phoneme = '';
        }, 300);
    }

    /**
     * Show phoneme flash indicator
     */
    static showPhonemeFlash(phoneme, action) {
        const flash = document.getElementById('phoneme-flash');
        if (!flash) return;
        
        flash.textContent = `${phoneme} → ${action}`;
        flash.classList.add('flash-visible');
        setTimeout(() => flash.classList.remove('flash-visible'), 600);
    }

    /**
     * Set screen to setup mode or experiment mode
     */
    static setScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.toggle('screen-active', s.id === `screen-${screen}`);
        });
    }
}
