/**
 * 🎯 Head Tracker Module (CDN Version)
 * Human.js 기반 head-tracking 마우스 제어
 * 
 * ⚡ Replit / 일반 웹에서 바로 사용 가능
 * Human.js는 CDN에서 자동 로드됨
 * 
 * Usage:
 *   <script type="module">
 *     import HeadTracker from './head_tracker_cdn.js';
 *     await HeadTracker.init();
 *     HeadTracker.on('point', (x, y) => moveCursor(x, y));
 *   </script>
 */

// ============ Constants ============
const HEAD_FILTER_MIN_CUTOFF = 0.4;
const HEAD_FILTER_BETA = 0.0025;
const HEAD_FILTER_D_CUTOFF = 1.0;
const HEAD_POINTER_LERP = 0.12;
const HEAD_CENTER_LERP = 0.06;
const HEAD_EDGE_LERP = 0.10;
const HEAD_CENTER_THRESHOLD = 0.25;
const HEAD_EDGE_THRESHOLD = 0.7;
const HEAD_ROTATION_INFLUENCE = 0.22;
const HEAD_ROTATION_EDGE_GAIN = 0.35;
const HEAD_YAW_SCALE = 25;
const HEAD_PITCH_SCALE = 20;
const PITCH_FALLBACK_THRESHOLD = 0.32;
const TRANSLATION_MIN_RATIO = 0.24;
const VERTICAL_EDGE_SCALE = 1.35;
const HEAD_MIRROR_X = -1;
const HEAD_MIRROR_Y = 1;
const AUTO_CENTER_ALPHA = 0.05;
const POINT_THROTTLE_MS = 33;
const MOUTH_OPEN_COOLDOWN_MS = 800;
const MOUTH_THRESHOLD_RATIO = 0.7;

const STORAGE_KEY_HEAD_CAL = 'headTrackerCalV2';
const STORAGE_KEY_MOUTH_CAL = 'headTrackerMouthCalV1';

const LEFT_EYE_CANDIDATES = [33, 246, 161, 160, 159, 130];
const RIGHT_EYE_CANDIDATES = [362, 466, 388, 387, 386, 359];
const NOSE_CANDIDATES = [1, 4, 5, 6, 197, 168, 2, 94];

const DEFAULT_HEAD_CAL = {
    cx: 0, cy: 0,
    left: 0.4, right: 0.4,
    up: 0.3, down: 0.35,
    version: 2, ts: 0
};

// ============ State ============
let Human = null;
let human = null;
let video = null;
let stream = null;
let rafHandle = null;
let detectInProgress = false;
let isInitialized = false;
let isRunning = false;

let headCal = null;
let mouthCal = null;
let headFilterX = null;
let headFilterY = null;
let lastHeadPoint = null;
let lastPointTs = 0;
let headAutoCenter = { nx: 0, ny: 0, ready: false };

let mouthClickEnabled = true;
let lastMouthClickTime = 0;
let lastMouthRatio = 0;

const eventListeners = {
    point: [],
    mouthClick: [],
    status: [],
    headFrame: [],
    mouthRatio: []
};

// ============ One-Euro Filter ============
function computeAlpha(fc, dtSeconds) {
    const tau = 1 / (2 * Math.PI * Math.max(1e-3, fc));
    return 1 / (1 + tau / Math.max(1e-4, dtSeconds));
}

function createOneEuroFilter(minCut = HEAD_FILTER_MIN_CUTOFF, beta = HEAD_FILTER_BETA, dCut = HEAD_FILTER_D_CUTOFF) {
    let prevValue = null;
    let prevTimestamp = null;
    let dxEstimate = null;
    let smoothed = null;

    return (value, timestampMs) => {
        if (!Number.isFinite(value) || !Number.isFinite(timestampMs)) return value;
        if (prevTimestamp === null) {
            prevTimestamp = timestampMs;
            prevValue = value;
            smoothed = value;
            dxEstimate = 0;
            return value;
        }
        const dt = Math.max(1e-3, (timestampMs - prevTimestamp) / 1000);
        prevTimestamp = timestampMs;
        const rawDerivative = (value - prevValue) / dt;
        prevValue = value;
        const alphaDerivative = computeAlpha(dCut, dt);
        dxEstimate = dxEstimate == null ? rawDerivative : (alphaDerivative * rawDerivative) + ((1 - alphaDerivative) * dxEstimate);
        const cutoff = minCut + beta * Math.abs(dxEstimate);
        const alpha = computeAlpha(cutoff, dt);
        smoothed = smoothed == null ? value : (alpha * value) + ((1 - alpha) * smoothed);
        return smoothed;
    };
}

// ============ Point Helpers ============
function normalizePoint(point) {
    if (!point) return null;
    if (Array.isArray(point) || ArrayBuffer.isView(point)) {
        const x = point[0], y = point[1];
        if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
        return null;
    }
    if (typeof point === 'object' && point) {
        const x = Number(point.x ?? point[0]);
        const y = Number(point.y ?? point[1]);
        if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
    }
    return null;
}

function pick(mesh, idx) {
    if (!mesh || idx < 0) return null;
    if (Array.isArray(mesh)) {
        if (idx < mesh.length) {
            const direct = normalizePoint(mesh[idx]);
            if (direct) return direct;
        }
        if (typeof mesh[0] === 'number') {
            const base = idx * 3;
            if (base + 1 < mesh.length) {
                const x = mesh[base], y = mesh[base + 1];
                if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
            }
        }
        return null;
    }
    return normalizePoint(mesh[idx]);
}

function centroid(points) {
    if (!Array.isArray(points) || !points.length) return null;
    let x = 0, y = 0, count = 0;
    for (const p of points) {
        const np = normalizePoint(p);
        if (!np) continue;
        x += np[0]; y += np[1]; count++;
    }
    return count ? [x / count, y / count] : null;
}

function resolvePoint(mesh, annotations, candidates, annotationKeys) {
    for (const idx of candidates) {
        const p = pick(mesh, idx);
        if (p) return p;
    }
    if (annotations) {
        for (const key of annotationKeys) {
            const c = centroid(annotations[key]);
            if (c) return c;
        }
    }
    return null;
}

// ============ Head Frame Computation ============
function computeHeadFrame(face) {
    if (!face?.mesh) return null;
    const { mesh, annotations = {} } = face;

    let leftEye = resolvePoint(mesh, annotations, LEFT_EYE_CANDIDATES, ['leftEyeUpper0', 'leftEyeLower0']);
    let rightEye = resolvePoint(mesh, annotations, RIGHT_EYE_CANDIDATES, ['rightEyeUpper0', 'rightEyeLower0']);
    let noseTip = resolvePoint(mesh, annotations, NOSE_CANDIDATES, ['noseTip', 'midwayBetweenEyes']);

    if ((!leftEye || !rightEye) && annotations.midwayBetweenEyes) {
        const fb = centroid(annotations.midwayBetweenEyes);
        if (fb) {
            if (!leftEye) leftEye = [fb[0] - 5, fb[1]];
            if (!rightEye) rightEye = [fb[0] + 5, fb[1]];
        }
    }
    if (!leftEye || !rightEye) return null;
    if (!noseTip) noseTip = [(leftEye[0] + rightEye[0]) / 2, (leftEye[1] + rightEye[1]) / 2];

    const eyeVec = [rightEye[0] - leftEye[0], rightEye[1] - leftEye[1]];
    const iod = Math.hypot(eyeVec[0], eyeVec[1]);
    if (!iod || !Number.isFinite(iod)) return null;

    eyeVec[0] /= iod; eyeVec[1] /= iod;
    const vertical = [-eyeVec[1], eyeVec[0]];
    const center = [(leftEye[0] + rightEye[0]) / 2, (leftEye[1] + rightEye[1]) / 2];
    const noseVec = [noseTip[0] - center[0], noseTip[1] - center[1]];
    const u = noseVec[0] * eyeVec[0] + noseVec[1] * eyeVec[1];
    const v = noseVec[0] * vertical[0] + noseVec[1] * vertical[1];
    const norm = Math.max(0.01, iod);

    return {
        nx: Math.max(-1.5, Math.min(1.5, u / norm)) * HEAD_MIRROR_X,
        ny: Math.max(-1.5, Math.min(1.5, v / norm)) * HEAD_MIRROR_Y,
        iod, center, leftEye, rightEye, nose: noseTip
    };
}

// ============ Coordinate Mapping ============
function mapHeadLocalToXY(nx, ny, cal) {
    if (!cal || !Number.isFinite(nx) || !Number.isFinite(ny)) return null;
    const { cx = 0, cy = 0, left = 0.01, right = 0.01, up = 0.01, down = 0.01 } = cal;
    const dx = nx - cx, dy = ny - cy;

    let tx = dx < 0 ? 0.5 + 0.5 * Math.max(-1, dx / Math.max(1e-3, left))
        : 0.5 + 0.5 * Math.min(1, dx / Math.max(1e-3, right));
    let ty = dy < 0 ? 0.5 + 0.5 * Math.max(-1, dy / Math.max(1e-3, up))
        : 0.5 + 0.5 * Math.min(1, dy / Math.max(1e-3, down));

    tx = Math.max(0, Math.min(1, tx));
    ty = Math.max(0, Math.min(1, ty));

    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    return [Math.max(0, Math.min(vw - 1, tx * vw)), Math.max(0, Math.min(vh - 1, ty * vh))];
}

// ============ Mouth Detection ============
function calculateMouthRatio(annotations) {
    if (!annotations?.lipsUpperOuter || !annotations?.lipsLowerOuter) return 0;
    const upper = annotations.lipsUpperOuter, lower = annotations.lipsLowerOuter;
    const top = upper[Math.floor(upper.length / 2)];
    const bottom = lower[Math.floor(lower.length / 2)];
    if (!top || !bottom) return 0;
    const height = Math.abs(bottom[1] - top[1]);
    const width = Math.abs(upper[upper.length - 1][0] - upper[0][0]);
    return width === 0 ? 0 : height / width;
}

// ============ Event System ============
function emit(event, ...args) {
    eventListeners[event]?.forEach(cb => { try { cb(...args); } catch (e) { console.error(e); } });
}

function on(event, callback) {
    eventListeners[event]?.push(callback);
    return () => off(event, callback);
}

function off(event, callback) {
    const list = eventListeners[event];
    if (list) {
        const idx = list.indexOf(callback);
        if (idx >= 0) list.splice(idx, 1);
    }
}

// ============ Storage ============
function loadCalibration() {
    try { headCal = JSON.parse(localStorage.getItem(STORAGE_KEY_HEAD_CAL)); } catch { }
    try { mouthCal = JSON.parse(localStorage.getItem(STORAGE_KEY_MOUTH_CAL)); } catch { }
}

function saveHeadCalibration(cal) {
    headCal = cal;
    try { localStorage.setItem(STORAGE_KEY_HEAD_CAL, JSON.stringify(cal)); } catch { }
}

function saveMouthCalibration(cal) {
    mouthCal = cal;
    try { localStorage.setItem(STORAGE_KEY_MOUTH_CAL, JSON.stringify(cal)); } catch { }
}

// ============ Detection Loop ============
function processDetection(result, ts) {
    const face = result?.face?.[0];
    if (!face) {
        headFilterX = headFilterY = lastHeadPoint = null;
        headAutoCenter = { nx: headCal?.cx || 0, ny: headCal?.cy || 0, ready: !!headCal };
        return;
    }

    const yawDeg = (face.rotation?.angle?.yaw || 0) * 180 / Math.PI;
    const pitchDeg = (face.rotation?.angle?.pitch || 0) * 180 / Math.PI;

    const headFrame = computeHeadFrame(face);
    if (headFrame) emit('headFrame', { ...headFrame, yawDeg, pitchDeg, ts });

    // Mouth
    if (face.annotations) {
        const mr = calculateMouthRatio(face.annotations);
        lastMouthRatio = mr;
        emit('mouthRatio', mr);
        if (mouthClickEnabled && mouthCal?.threshold && mr > mouthCal.threshold && ts - lastMouthClickTime > MOUTH_OPEN_COOLDOWN_MS) {
            lastMouthClickTime = ts;
            emit('mouthClick', { mouthRatio: mr, ts });
        }
    }

    if (!headFrame) return;
    if (!headFilterX) { headFilterX = createOneEuroFilter(); headFilterY = createOneEuroFilter(); }

    let activeCal = headCal?.version === 2 ? headCal : (() => {
        if (!headAutoCenter.ready) headAutoCenter = { nx: headFrame.nx, ny: headFrame.ny, ready: true };
        else {
            headAutoCenter.nx += (headFrame.nx - headAutoCenter.nx) * AUTO_CENTER_ALPHA;
            headAutoCenter.ny += (headFrame.ny - headAutoCenter.ny) * AUTO_CENTER_ALPHA;
        }
        return { ...DEFAULT_HEAD_CAL, cx: headAutoCenter.nx, cy: headAutoCenter.ny };
    })();

    const { cx = 0, cy = 0, left = 0.01, right = 0.01, up = 0.01, down = 0.01 } = activeCal;
    const yawNorm = Math.max(-1, Math.min(1, yawDeg / HEAD_YAW_SCALE));
    const pitchNorm = Math.max(-1, Math.min(1, pitchDeg / HEAD_PITCH_SCALE));
    const offsetNx = headFrame.nx - cx, offsetNy = headFrame.ny - cy;

    let normX = offsetNx < 0 ? offsetNx / left : offsetNx / right;
    let normY = pitchDeg / HEAD_PITCH_SCALE + (offsetNy < 0 ? offsetNy / up : offsetNy / down) * 0.35;

    if (Math.abs(normX) < 1) normX += yawNorm * HEAD_ROTATION_INFLUENCE * (1 - Math.abs(normX));
    if (Math.abs(normY) < 1) normY += pitchNorm * HEAD_ROTATION_INFLUENCE * 0.6 * (1 - Math.abs(normY));

    normX = Math.max(-1.2, Math.min(1.2, normX));
    normY = Math.max(-1.4, Math.min(1.4, normY));

    const targetNx = normX < 0 ? cx + normX * left : cx + normX * right;
    const targetNy = normY < 0 ? cy + normY * up * VERTICAL_EDGE_SCALE : cy + normY * down * VERTICAL_EDGE_SCALE;
    const mapped = mapHeadLocalToXY(targetNx, targetNy, activeCal);

    if (mapped) {
        let [fx, fy] = [headFilterX(mapped[0], ts), headFilterY(mapped[1], ts)];
        if (!Number.isFinite(fx)) fx = mapped[0];
        if (!Number.isFinite(fy)) fy = mapped[1];

        const alpha = Math.abs(normX) < HEAD_CENTER_THRESHOLD && Math.abs(normY) < HEAD_CENTER_THRESHOLD
            ? HEAD_CENTER_LERP : Math.abs(normX) > HEAD_EDGE_THRESHOLD || Math.abs(normY) > HEAD_EDGE_THRESHOLD
                ? HEAD_EDGE_LERP : HEAD_POINTER_LERP;

        if (lastHeadPoint) {
            fx = lastHeadPoint[0] + alpha * (fx - lastHeadPoint[0]);
            fy = lastHeadPoint[1] + alpha * (fy - lastHeadPoint[1]);
            lastHeadPoint = [fx, fy];
        } else {
            lastHeadPoint = [fx, fy];
        }

        if (ts - lastPointTs >= POINT_THROTTLE_MS) {
            lastPointTs = ts;
            emit('point', fx, fy, { ts });
        }
    }
}

async function detectionLoop() {
    if (!isRunning || !human || !video) { rafHandle = null; return; }
    rafHandle = requestAnimationFrame(detectionLoop);
    if (detectInProgress) return;
    try {
        if (video.readyState >= 2) {
            detectInProgress = true;
            const result = await human.detect(video);
            processDetection(result, performance.now());
            detectInProgress = false;
        }
    } catch (e) { detectInProgress = false; }
}

// ============ Public API ============
async function init(options = {}) {
    if (isInitialized) return true;
    emit('status', 'loading', 'Loading Human.js from CDN...');

    // CDN에서 Human.js 로드
    const cdnUrl = options.humanCdn || 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.4/dist/human.esm.js';

    try {
        const module = await import(cdnUrl);
        Human = module.default || module.Human || module;

        human = new Human({
            backend: 'webgl',
            modelBasePath: options.modelsPath || 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.4/models/',
            cacheSensitivity: 0,
            face: {
                enabled: true,
                detector: { enabled: true, rotation: true, return: true, maxDetected: 1 },
                mesh: { enabled: true },
                iris: { enabled: false },
                emotion: { enabled: false }
            },
            filter: { enabled: true, equalization: false, temporalSmoothing: 0.5 }
        });

        await human.load();
        console.log('[HeadTracker] Human.js loaded from CDN');

        loadCalibration();
        isInitialized = true;
        emit('status', 'ready', 'Head tracker ready');
        return true;
    } catch (error) {
        console.error('[HeadTracker] Failed to load Human.js:', error);
        emit('status', 'error', error.message);
        throw error;
    }
}

async function start() {
    if (!isInitialized) throw new Error('Call init() first');
    if (isRunning) return;

    emit('status', 'starting', 'Starting camera...');
    video = document.createElement('video');
    video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
    video.autoplay = video.playsInline = video.muted = true;
    document.body.appendChild(video);

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } },
            audio: false
        });
        video.srcObject = stream;
        await video.play();
        isRunning = true;
        emit('status', 'live', 'Head tracking active');
        detectionLoop();
    } catch (error) {
        emit('status', 'error', 'Camera access denied');
        throw error;
    }
}

function stop() {
    isRunning = false;
    if (rafHandle) cancelAnimationFrame(rafHandle);
    stream?.getTracks().forEach(t => t.stop());
    video?.parentElement?.removeChild(video);
    video = stream = rafHandle = null;
    emit('status', 'stopped', 'Stopped');
}

// ============ Export ============
const HeadTracker = {
    init, start, stop, on, off,
    setMouthClickEnabled: (v) => { mouthClickEnabled = !!v; },
    getMouthClickEnabled: () => mouthClickEnabled,
    getLastMouthRatio: () => lastMouthRatio,
    getCalibration: () => ({ head: headCal, mouth: mouthCal }),
    setHeadCalibration: (cal) => { saveHeadCalibration(cal); headFilterX = headFilterY = lastHeadPoint = null; },
    setMouthCalibration: saveMouthCalibration,
    resetCalibration: () => {
        headCal = mouthCal = headFilterX = headFilterY = lastHeadPoint = null;
        localStorage.removeItem(STORAGE_KEY_HEAD_CAL);
        localStorage.removeItem(STORAGE_KEY_MOUTH_CAL);
    },
    isActive: () => isRunning,
    getState: () => ({ initialized: isInitialized, running: isRunning, hasHeadCal: !!headCal, hasMouthCal: !!mouthCal, mouthClickEnabled }),
    _internal: { saveHeadCalibration, saveMouthCalibration, STORAGE_KEY_HEAD_CAL, STORAGE_KEY_MOUTH_CAL, MOUTH_THRESHOLD_RATIO }
};

export default HeadTracker;
if (typeof window !== 'undefined') window.HeadTracker = HeadTracker;
