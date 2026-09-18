#!/bin/bash

# API Quality Checks Script
echo "🔍 Running API code quality checks..."

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
"$PYTHON_BIN" -m black --check --diff . || {
    echo "❌ Black formatting issues found. Run '"$PYTHON_BIN" -m black .' to fix."
    exit 1
}

echo "📋 Running isort (import sorting)..."
"$PYTHON_BIN" -m isort --check-only --diff . || {
    echo "❌ Import sorting issues found. Run '"$PYTHON_BIN" -m isort .' to fix."
    exit 1
}

echo "🔍 Running Flake8 (linting)..."
"$PYTHON_BIN" -m flake8 . || {
    echo "❌ Linting issues found."
    exit 1
}

echo "🛡️ Running Bandit (security check)..."
"$PYTHON_BIN" -m bandit -r . -ll || {
    echo "❌ Security issues found."
    exit 1
}

echo "🔒 Running Safety (dependency security)..."
# Scan only project dependency files, not the full local environment.
"$PYTHON_BIN" -m safety check \
    -r requirements.txt \
    -r requirements-dev.txt \
    --ignore 77744 --ignore 77745 --ignore 78688 --ignore 78279 --ignore 78558 --ignore 59234 --ignore 77942 --ignore 78057 --ignore 72086 || {
    echo "❌ Vulnerable dependencies found."
    exit 1
}

echo "✅ All API quality checks passed!"