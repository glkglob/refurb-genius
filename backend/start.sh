#!/bin/bash
# Simple helper script to start the Refurb Genius backend locally

set -e

echo "🚀 Starting Refurb Genius Backend..."

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Activate venv
echo "🔌 Activating virtual environment..."
source .venv/bin/activate

# Install dependencies if needed
if [ ! -f ".venv/requirements_installed" ]; then
    echo "📥 Installing dependencies from requirements.txt..."
    pip install -r requirements.txt
    touch .venv/requirements_installed
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found!"
    echo "   Please copy .env.example to .env and fill in your values."
    echo "   cp .env.example .env"
    exit 1
fi

echo "✅ Environment ready. Starting uvicorn..."
echo "   API will be available at http://localhost:8000"
echo "   API docs at http://localhost:8000/docs"
echo ""

uvicorn main:app --reload --port 8000
