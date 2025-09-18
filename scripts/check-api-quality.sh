#!/bin/bash

# API Quality Checks Script
echo "🔍 Running API code quality checks..."

cd api

echo "📦 Installing dependencies..."
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt

echo "🎨 Running Black (code formatting)..."
python -m black --check --diff . || {
    echo "❌ Black formatting issues found. Run 'python -m black .' to fix."
    exit 1
}

echo "📋 Running isort (import sorting)..."
python -m isort --check-only --diff . || {
    echo "❌ Import sorting issues found. Run 'python -m isort .' to fix."
    exit 1
}

echo "🔍 Running Flake8 (linting)..."
python -m flake8 . || {
    echo "❌ Linting issues found."
    exit 1
}

echo "🛡️ Running Bandit (security check)..."
python -m bandit -r . -ll || {
    echo "❌ Security issues found."
    exit 1
}

echo "🔒 Running Safety (dependency security)..."
python -m safety check --ignore 77744 --ignore 77745 --ignore 78688 --ignore 78279 --ignore 78558 --ignore 59234 --ignore 77942 --ignore 78057 --ignore 72086 || {
    echo "❌ Vulnerable dependencies found."
    exit 1
}

echo "✅ All API quality checks passed!"