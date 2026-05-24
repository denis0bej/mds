#!/bin/bash

# Funcție pentru a opri toate procesele la închiderea scriptului (Ctrl+C)
trap "kill 0" EXIT

echo "🚀 Pornesc D&D Vibe Project..."

# Pornire Backend
echo "📂 Pregătire Backend (FastAPI)..."
cd backend

if [ ! -d "venv" ]; then
    echo "  📦 Creare mediu virtual (venv)..."
    python3 -m venv venv 2>/dev/null || python -m venv venv
fi

source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null

echo "  pip install (verificare dependențe)..."
# Nu mai ascundem erorile complet pentru a vedea progresul dacă durează
pip install fastapi uvicorn openai python-dotenv httpx --quiet

echo "  🚀 Pornesc serverul FastAPI pe portul 8000..."
uvicorn main:app --reload --port 8000 > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Pornire Frontend
echo "📂 Pregătire Frontend (Vite)..."
cd ../frontend

if [ ! -d "node_modules" ]; then
    echo "  📦 Instalare dependențe npm (prima dată, poate dura)..."
    # Folosim --legacy-peer-deps pentru a ignora conflictele de versiune între vite 8 și pachete mai vechi
    npm install --legacy-peer-deps
    if [ $? -ne 0 ]; then
        echo "  ❌ Eroare la instalarea npm. Încearcă să rulezi 'npm install --legacy-peer-deps' manual în folderul frontend."
        exit 1
    fi
else
    echo "  ✅ node_modules deja instalat."
fi

echo "  🚀 Pornesc serverul Vite pe portul 5173..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Ambele servere sunt în curs de pornire."
echo "🔗 Frontend: http://localhost:5173"
echo "🔗 Backend API: http://localhost:8000"
echo "Log-uri backend: tail -f /tmp/backend.log"
echo "Presionează Ctrl+C pentru a opri ambele servere."

# Așteaptă procesele
wait
