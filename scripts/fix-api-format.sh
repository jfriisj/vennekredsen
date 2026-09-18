#!/bin/bash

# API Code Formatting Script
echo "🔧 Fixing API code formatting and issues..."

cd api

echo "📦 Installing dependencies..."
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt

echo "🎨 Running Black (code formatting)..."
python -m black .

echo "📋 Running isort (import sorting)..."
python -m isort .

echo "✅ API code formatting complete!"
echo "Run './scripts/check-api-quality.sh' to verify all issues are resolved."