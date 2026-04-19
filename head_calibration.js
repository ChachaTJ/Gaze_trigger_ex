/**
 * 🎯 Head Calibration UI
 * 6단계 헤드 포인터 캘리브레이션
 * 
 * Usage:
 *   HeadCalibration.start();  // Alt+H 로도 트리거 가능
 */

const HeadCalibration = (function () {
    'use strict';

    const MIN_RANGE_HORIZONTAL = 0.24;
    const MIN_RANGE_VERTICAL = 0.22;
    const MIN_SAMPLES_PER_STEP = 4;
    const MAX_SAMPLES_PER_STEP = 120;
    const CAPTURE_TIMEOUT_MS = 1500;

    const STEPS = [
        { label: 'CENTER를 바라보세요', hint: '머리를 편하게 두고 Space를 누르세요' },
        { label: 'LEFT를 바라보세요', hint: '왼쪽으로 살짝 돌린 후 Space를 누르세요' },
        { label: 'RIGHT를 바라보세요', hint: '오른쪽으로 살짝 돌린 후 Space를 누르세요' },
        { label: 'UP을 바라보세요', hint: '위로 살짝 올린 후 Space를 누르세요' },
        { label: 'DOWN을 바라보세요', hint: '아래로 살짝 내린 후 Space를 누르세요' },
        { label: '다시 CENTER를 바라보세요', hint: '중앙으로 돌아와서 Space를 누르세요' }
    ];

    let ui = null;
    let titleEl = null;
    let hintEl = null;
    let footerEl = null;
    let beginBtn = null;
    let active = false;
    let waitingToStart = false;
    let capturing = false;
    let stepIndex = 0;
    let stepSamples = [];
    let poseAverages = [];
    let calibration = null;
    let captureTimer = null;
    let captureRaf = null;
    let lastHeadFrame = null;
    let headFrameListener = null;

    function ensureUI() {
        if (ui) return ui;

        ui = document.createElement('div');
        ui.id = 'head-calibration-ui';
        ui.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 2147483646;
            display: none;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(12px);
            pointer-events: auto;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            min-width: 320px;
            max-width: 420px;
            padding: 32px;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.95);
            color: #1a1a1a;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center;
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
        `;

        titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size: 22px; font-weight: 700; margin-bottom: 16px; color: #1a1a1a;';

        hintEl = document.createElement('div');
        hintEl.style.cssText = 'font-size: 16px; opacity: 0.75; margin-bottom: 20px; color: #333; line-height: 1.5;';

        beginBtn = document.createElement('button');
        beginBtn.textContent = '캘리브레이션 시작';
        beginBtn.style.cssText = `
            padding: 14px 32px;
            font-size: 16px;
            font-weight: 600;
            color: white;
            background: #3498db;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            margin-bottom: 20px;
            display: none;
            transition: all 0.2s;
        `;
        beginBtn.onclick = handleBeginClick;

        footerEl = document.createElement('div');
        footerEl.style.cssText = 'font-size: 13px; opacity: 0.5; color: #666;';

        panel.appendChild(titleEl);
        panel.appendChild(hintEl);
        panel.appendChild(beginBtn);
        panel.appendChild(footerEl);
        ui.appendChild(panel);
        document.body.appendChild(ui);
        return ui;
    }

    function setUIVisible(visible) {
        ensureUI();
        ui.style.display = visible ? 'flex' : 'none';
    }

    function updateUI(message, hint, footer, showButton = false) {
        ensureUI();
        titleEl.textContent = message;
        hintEl.textContent = hint || '';
        footerEl.textContent = footer || 'Space로 캡처 · Esc로 취소';
        beginBtn.style.display = showButton ? 'inline-block' : 'none';
    }

    function handleBeginClick() {
        waitingToStart = false;
        beginActualCalibration();
    }

    function beginActualCalibration() {
        stepIndex = 0;
        updateUI(`단계 1 / ${STEPS.length}: ${STEPS[0].label}`, STEPS[0].hint);
        console.log('[HeadCalibration] Calibration steps started');
    }

    function stopCapture() {
        capturing = false;
        if (captureTimer) {
            clearTimeout(captureTimer);
            captureTimer = null;
        }
        if (captureRaf) {
            cancelAnimationFrame(captureRaf);
            captureRaf = null;
        }
    }

    function resetSamples() {
        stepSamples = STEPS.map(() => []);
    }

    function startCalibration() {
        if (active) return;

        // HeadTracker가 실행 중인지 확인
        if (typeof HeadTracker === 'undefined' || !HeadTracker.isActive()) {
            alert('Head tracking이 먼저 활성화되어야 합니다.');
            return;
        }

        active = true;
        waitingToStart = true;
        stepIndex = 0;
        calibration = {
            cx: 0, cy: 0,
            left: 0, right: 0, up: 0, down: 0,
            version: 2,
            ts: Date.now()
        };
        resetSamples();
        poseAverages = new Array(STEPS.length);

        // HeadTracker로부터 headFrame 이벤트 수신
        headFrameListener = (data) => {
            lastHeadFrame = data;
        };
        HeadTracker.on('headFrame', headFrameListener);

        setUIVisible(true);
        updateUI(
            '🎯 Head Tracking 캘리브레이션',
            '5개 방향으로 머리를 움직여 캘리브레이션합니다. 시작 버튼을 클릭하세요.',
            'Esc로 취소',
            true
        );

        console.log('[HeadCalibration] Waiting for user to click begin');
    }

    function stopCalibration(message) {
        if (!active) return;
        active = false;
        waitingToStart = false;
        stopCapture();
        setUIVisible(false);

        if (headFrameListener) {
            HeadTracker.off('headFrame', headFrameListener);
            headFrameListener = null;
        }

        if (message) {
            console.log('[HeadCalibration]', message);
            if (message === 'Completed') {
                window.dispatchEvent(new CustomEvent('headCalibrationCompleted'));
            }
        }
    }

    function averageSamples(samples) {
        if (!samples.length) return { nx: NaN, ny: NaN };
        const sum = samples.reduce((acc, cur) => {
            acc.nx += cur.nx;
            acc.ny += cur.ny;
            return acc;
        }, { nx: 0, ny: 0 });
        const count = samples.length || 1;
        return { nx: sum.nx / count, ny: sum.ny / count };
    }

    function collectSamplesForCurrentStep() {
        return new Promise((resolve) => {
            stopCapture();
            capturing = true;
            const samples = [];
            const step = STEPS[stepIndex];
            const start = performance.now();
            hintEl.textContent = `${step.label}: 캡처 중...`;

            const appendSample = () => {
                if (!lastHeadFrame) return;
                const { nx, ny } = lastHeadFrame;
                if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
                const last = samples[samples.length - 1];
                if (last && Math.abs(last.nx - nx) < 1e-4 && Math.abs(last.ny - ny) < 1e-4) return;
                samples.push({ nx, ny });
                if (samples.length >= MIN_SAMPLES_PER_STEP) {
                    hintEl.textContent = `${step.label}: ${samples.length}개 캡처`;
                }
            };

            if (lastHeadFrame) appendSample();

            const tick = () => {
                if (!capturing) return;
                appendSample();
                if (samples.length >= MAX_SAMPLES_PER_STEP) {
                    stopCapture();
                    resolve(samples);
                    return;
                }
                if (performance.now() - start >= CAPTURE_TIMEOUT_MS) {
                    stopCapture();
                    resolve(samples);
                    return;
                }
                captureRaf = requestAnimationFrame(tick);
            };

            captureRaf = requestAnimationFrame(tick);
            captureTimer = setTimeout(() => {
                stopCapture();
                resolve(samples);
            }, CAPTURE_TIMEOUT_MS + 16);
        });
    }

    async function confirmStep() {
        if (!active || capturing) return;

        const step = STEPS[stepIndex];
        const samples = await collectSamplesForCurrentStep();

        if (!samples || samples.length < MIN_SAMPLES_PER_STEP) {
            updateUI(
                `단계 ${stepIndex + 1} / ${STEPS.length}: ${step.label}`,
                `${samples?.length || 0}개만 캡처됨. 다시 Space를 누르세요.`
            );
            return;
        }

        stepSamples[stepIndex] = samples;
        const middleRange = Math.floor(samples.length * 0.35);
        const sorted = samples.slice().sort((a, b) => a.nx - b.nx || a.ny - b.ny);
        const trimmed = sorted.slice(middleRange, sorted.length - middleRange);
        const usable = trimmed.length >= MIN_SAMPLES_PER_STEP ? trimmed : samples;
        const avg = averageSamples(usable);
        poseAverages[stepIndex] = avg;

        switch (stepIndex) {
            case 0:
                calibration.cx = avg.nx;
                calibration.cy = avg.ny;
                break;
            case 1:
                calibration.left = Math.max(1e-3, (calibration.cx || 0) - avg.nx);
                break;
            case 2:
                calibration.right = Math.max(1e-3, avg.nx - (calibration.cx || 0));
                break;
            case 3:
                calibration.up = Math.max(1e-3, (calibration.cy || 0) - avg.ny);
                break;
            case 4:
                calibration.down = Math.max(1e-3, avg.ny - (calibration.cy || 0));
                break;
            case 5:
                calibration.cx = avg.nx;
                calibration.cy = avg.ny;
                break;
        }

        stepIndex++;
        if (stepIndex >= STEPS.length) {
            finalizeCalibration();
        } else {
            const nextStep = STEPS[stepIndex];
            updateUI(`단계 ${stepIndex + 1} / ${STEPS.length}: ${nextStep.label}`, nextStep.hint);
        }
    }

    function finalizeCalibration() {
        const centerPrimary = poseAverages[0] || { nx: calibration.cx, ny: calibration.cy };
        const centerFinal = poseAverages[5] || centerPrimary;
        const leftAvg = poseAverages[1] || centerPrimary;
        const rightAvg = poseAverages[2] || centerPrimary;
        const upAvg = poseAverages[3] || centerPrimary;
        const downAvg = poseAverages[4] || centerPrimary;

        const finalCenter = {
            nx: Number.isFinite(centerFinal.nx) ? centerFinal.nx : centerPrimary.nx || 0,
            ny: Number.isFinite(centerFinal.ny) ? centerFinal.ny : centerPrimary.ny || 0
        };

        calibration.cx = finalCenter.nx;
        calibration.cy = finalCenter.ny;

        calibration.left = Number.isFinite(leftAvg.nx) ?
            Math.max(MIN_RANGE_HORIZONTAL, Math.abs(finalCenter.nx - leftAvg.nx)) : MIN_RANGE_HORIZONTAL;
        calibration.right = Number.isFinite(rightAvg.nx) ?
            Math.max(MIN_RANGE_HORIZONTAL, Math.abs(rightAvg.nx - finalCenter.nx)) : MIN_RANGE_HORIZONTAL;
        calibration.up = Number.isFinite(upAvg.ny) ?
            Math.max(MIN_RANGE_VERTICAL, Math.abs(finalCenter.ny - upAvg.ny)) : MIN_RANGE_VERTICAL;
        calibration.down = Number.isFinite(downAvg.ny) ?
            Math.max(MIN_RANGE_VERTICAL, Math.abs(downAvg.ny - finalCenter.ny)) : MIN_RANGE_VERTICAL;

        calibration.ts = Date.now();

        // HeadTracker에 캘리브레이션 저장
        HeadTracker.setHeadCalibration(calibration);

        updateUI('✅ 캘리브레이션 완료!', 'Head tracking이 향상되었습니다.');
        console.log('[HeadCalibration] Saved calibration', calibration);

        setTimeout(() => stopCalibration('Completed'), 1500);
    }

    // Keyboard listener
    document.addEventListener('keydown', (event) => {
        const code = event.code || event.key;

        // Alt+H: 캘리브레이션 토글
        if (event.altKey && !event.ctrlKey && !event.metaKey && code === 'KeyH') {
            event.preventDefault();
            if (active) {
                stopCalibration('Cancelled');
            } else {
                startCalibration();
            }
            return;
        }

        if (!active) return;

        if (event.key === ' ') {
            event.preventDefault();
            if (waitingToStart) return;
            confirmStep().catch(e => console.warn('[HeadCalibration] capture failed:', e));
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            stopCalibration('Cancelled via Escape');
        }
    }, true);

    return {
        start: startCalibration,
        stop: stopCalibration,
        isActive: () => active
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeadCalibration;
}
