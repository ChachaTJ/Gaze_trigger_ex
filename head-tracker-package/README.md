# 🎯 Head Tracker Package

Human.js 기반 웹캠 머리 추적 마우스 제어 모듈

## 설치 (npm)

```bash
cd head-tracker-package
npm install
```

## 사용법 (Vite/Webpack)

```javascript
import { HeadTracker } from './src/index.js';

// 초기화
await HeadTracker.init();
await HeadTracker.start();

// 시선 좌표 수신
HeadTracker.on('point', (x, y) => {
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
});

// 입 벌림 클릭
HeadTracker.on('mouthClick', () => {
    console.log('Click!');
});
```

## 빌드

```bash
npm run build
```

`dist/` 폴더에 번들 파일 생성:
- `head-tracker.es.js` - ES Module
- `head-tracker.umd.js` - UMD (브라우저 직접 사용)

## API

| Method | Description |
|--------|-------------|
| `init()` | Human.js 모델 로드 |
| `start()` | 카메라 시작 & 트래킹 |
| `stop()` | 트래킹 중지 |
| `on('point', cb)` | 시선 좌표 이벤트 |
| `on('mouthClick', cb)` | 입 벌림 클릭 이벤트 |
| `on('mouthRatio', cb)` | 입 벌림 비율 이벤트 |
| `setMouthClickEnabled(bool)` | 입 벌림 클릭 On/Off |
| `setHeadCalibration(cal)` | 캘리브레이션 저장 |

## 모델 경로

기본값: CDN (`https://cdn.jsdelivr.net/npm/@vladmandic/human/models/`)

커스텀 경로:
```javascript
await HeadTracker.init({
    modelsPath: '/my/models/path/'
});
```
