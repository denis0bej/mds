#!/bin/bash

# Oprește toate procesele la Ctrl+C
trap "kill 0" EXIT

echo "🚀 Pornesc D&D Vibe Project..."

# Eliberează portul 8000 dacă e ocupat de un proces vechi
if lsof -ti :8000 > /dev/null 2>&1; then
    echo "  ⚠️  Port 8000 ocupat — opresc procesul vechi..."
    kill $(lsof -ti :8000) 2>/dev/null
    sleep 1
fi

# Pornire Backend
echo "📂 Pregătire Backend (FastAPI)..."
cd backend

if [ ! -d "venv" ]; then
    echo "  📦 Creare mediu virtual (venv)..."
    python3 -m venv venv 2>/dev/null || python -m venv venv
fi

source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null

echo "  pip install (verificare dependențe)..."
pip install fastapi uvicorn openai python-dotenv httpx supabase --quiet
if [ $? -ne 0 ]; then
    echo "  ❌ Eroare la instalarea dependențelor Python."
    exit 1
fi

echo "  🚀 Pornesc serverul FastAPI pe portul 8000..."
uvicorn main:app --reload --port 8000 > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Pornire Frontend
echo "📂 Pregătire Frontend (Vite)..."
cd ../frontend

# Sincronizează variabilele VITE_ din backend/.env -> frontend/.env (Vite nu citește .env din altă locație)
if [ -f "../backend/.env" ]; then
    grep '^VITE_' ../backend/.env > .env 2>/dev/null || true
fi

echo "  📦 Verificare dependențe npm..."
npm install --legacy-peer-deps --quiet
if [ $? -ne 0 ]; then
    echo "  ❌ Eroare la instalarea npm. Încearcă 'npm install --legacy-peer-deps' manual în frontend/."
    exit 1
fi

echo "  🚀 Pornesc serverul Vite pe portul 8080..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Ambele servere sunt în curs de pornire."
echo "🔗 Frontend: http://localhost:8080"
echo "🔗 Backend API: http://localhost:8000"
echo "Log-uri backend: tail -f /tmp/backend.log"
echo "Presionează Ctrl+C pentru a opri ambele servere."

# Așteaptă procesele
wait
