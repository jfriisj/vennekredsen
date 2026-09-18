#!/bin/bash

# API Code Formatting Script
echo "🔧 Fixing API code formatting and issues..."

cd api

if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN=python3
elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN=python
else
    echo "❌ Python 3 is required but neither 'python3' nor 'python' was found."
    exit 1
fi

echo "📦 Installing dependencies..."
if "$PYTHON_BIN" -m pip --version >/dev/null 2>&1; then
    "$PYTHON_BIN" -m pip install -r requirements.txt
    "$PYTHON_BIN" -m pip install -r requirements-dev.txt
elif command -v uv >/dev/null 2>&1; then
    uv pip install --system -r requirements.txt
    uv pip install --system -r requirements-dev.txt
else
    echo "❌ Neither pip nor uv is available to install API quality dependencies."
    exit 1
fi

echo "🎨 Running Black (code formatting)..."
"$PYTHON_BIN" -m black .

echo "📋 Running isort (import sorting)..."
"$PYTHON_BIN" -m isort .

echo "✅ API code formatting complete!"
echo "Run './scripts/check-api-quality.sh' to verify all issues are resolved."