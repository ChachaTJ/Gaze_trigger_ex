#!/bin/bash
# ============================================
# 🚀 B2TXT API Server Launcher
# 바탕화면에서 더블클릭으로 실행 가능
# ============================================

# 프로젝트 경로 설정
PROJECT_DIR="/Users/chayoonmin/Downloads/CPU _ Phoneme Decoder"
CONDA_PATH="/opt/miniconda3"
CONDA_ENV="b2txt25_UI"

echo "🚀 B2TXT API Server 시작..."
echo "================================"

# Conda 환경 초기화
source "$CONDA_PATH/etc/profile.d/conda.sh"

# 프로젝트 디렉토리로 이동
cd "$PROJECT_DIR"

# 1. API 서버 실행 (백그라운드)
echo "1️⃣ API 서버 시작 중..."
"$CONDA_PATH/envs/$CONDA_ENV/bin/python" api_server.py &
API_PID=$!
sleep 3

# 2. 정적 파일 서버 실행 (백그라운드)
echo "2️⃣ 정적 파일 서버 시작 중..."
python3 -m http.server 8889 &
HTTP_PID=$!
sleep 1

# 3. ngrok 터널 열기 (백그라운드)
echo "3️⃣ ngrok 터널 열기..."
ngrok http 5001 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!
sleep 3

# ngrok URL 가져오기
NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; t=json.load(sys.stdin).get('tunnels',[]); print(t[0]['public_url'] if t else 'Not available')" 2>/dev/null || echo "Not available")

echo ""
echo "================================"
echo "✅ 모든 서버 시작 완료!"
echo "================================"
echo ""
echo "📍 로컬 접속:"
echo "   - API 서버: http://localhost:5001"
echo "   - Gaze 데모: http://localhost:8889/gaze_demo.html"
echo "   - Head Tracking: http://localhost:8889/head_gaze_demo.html"
echo ""
echo "🌐 외부 접속 (ngrok):"
echo "   - $NGROK_URL"
echo ""
echo "⏹️ 종료하려면 Ctrl+C를 누르세요"
echo ""

# 종료 핸들러
cleanup() {
    echo ""
    echo "🛑 서버 종료 중..."
    kill $API_PID 2>/dev/null
    kill $HTTP_PID 2>/dev/null
    kill $NGROK_PID 2>/dev/null
    echo "✅ 모든 서버 종료됨"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 메인 프로세스 대기
wait
