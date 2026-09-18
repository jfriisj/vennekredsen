#!/bin/bash

# Frontend Code Formatting Script
echo "🔧 Fixing Frontend code formatting and issues..."

cd frontend

echo "📦 Installing dependencies..."
npm install

echo "🔍 Running ESLint with auto-fix..."
npm run lint:fix

echo "🎨 Running Prettier (code formatting)..."
npm run format

echo "✅ Frontend code formatting complete!"
echo "Run './scripts/check-frontend-quality.sh' to verify all issues are resolved."