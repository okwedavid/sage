#!/bin/bash
# run_app.sh - SAGE v6.0 Boot
echo "🧠 SAGE v6.0 — Systemic Agentic General Engine"
echo "=============================================="

# Check venv
if [ ! -d ".venv" ]; then
  echo "📦 Creating venv..."
  python3 -m venv .venv
fi

source .venv/bin/activate

echo "📦 Installing dependencies..."
pip install -q -r requirements.txt

# Check .env
if [ ! -f ".env" ]; then
  echo "⚠️  No .env found, creating from template..."
  cp .env.example .env
  echo "🔑 Please edit .env and add your GROQ_API_KEY (gsk_...)"
  echo "   Get key at https://console.groq.com"
fi

echo ""
echo "🧪 Running domain tests..."
python3 main.py

echo ""
echo "🌐 Starting Streamlit UI on http://localhost:8501"
echo "   Press Ctrl+C to stop"
echo ""

streamlit run app.py --server.port 8501 --server.headless false
