# 🎯 Head Tracker - Replit Package

Human.js 기반 웹캠 머리 추적 마우스 제어

## 📦 파일 구성

```
replit-package/
├── head_tracker_cdn.js   ← 핵심 모듈 (Human.js CDN 로드)
├── head_calibration.js   ← 헤드 캘리브레이션 UI (Alt+H)
├── mouth_calibration.js  ← 입 벌림 캘리브레이션 (Alt+M)
└── demo.html             ← 완전한 데모 페이지
```

## 🚀 사용법

### 1. 파일 복사
이 폴더를 Replit 프로젝트에 복사

### 2. HTML에서 사용
```html
<script type="module">
    import HeadTracker from './head_tracker_cdn.js';
    
    await HeadTracker.init();
    await HeadTracker.start();
    
    HeadTracker.on('point', (x, y) => {
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
    });
    
    HeadTracker.on('mouthClick', () => {
        console.log('Click!');
    });
</script>
```

## ✨ 특징

- **CDN 로드**: npm 설치 불필요
- **캘리브레이션**: localStorage에 자동 저장
- **입 벌림 클릭**: 토글 가능

## 🔧 API

| Method | Description |
|--------|-------------|
| `init()` | 모델 로드 |
| `start()` | 카메라 시작 |
| `stop()` | 트래킹 중지 |
| `on('point', cb)` | 시선 좌표 |
| `on('mouthClick', cb)` | 입 벌림 클릭 |
| `on('mouthRatio', cb)` | 입 벌림 비율 |
| `setMouthClickEnabled(bool)` | 입 벌림 On/Off |

## 데모 실행

```bash
# Replit에서 웹 서버가 자동으로 실행됩니다
# 또는 로컬에서:
python3 -m http.server 8888
# 브라우저: http://localhost:8888/demo.html
```
