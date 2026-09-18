#!/bin/bash

# Master Quality Check Script
echo "🚀 Running all code quality checks..."

# Make scripts executable
chmod +x scripts/check-api-quality.sh
chmod +x scripts/check-frontend-quality.sh

# Run API checks
echo "🐍 Running API quality checks..."
./scripts/check-api-quality.sh || {
    echo "❌ API quality checks failed!"
    exit 1
}

# Run Frontend checks
echo "🌐 Running Frontend quality checks..."
./scripts/check-frontend-quality.sh || {
    echo "❌ Frontend quality checks failed!"
    exit 1
}

echo "✅ All quality checks passed! 🎉"
echo "Your code is ready for commit!"