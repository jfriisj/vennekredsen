#!/bin/bash

# Frontend Quality Checks Script
echo "🔍 Running Frontend code quality checks..."

cd frontend

echo "📦 Installing dependencies..."
npm install

echo "🔍 Running ESLint (JavaScript linting)..."
npm run lint || {
    echo "❌ ESLint issues found. Run 'npm run lint:fix' to fix auto-fixable issues."
    exit 1
}

echo "🎨 Running Prettier (code formatting check)..."
npm run format:check || {
    echo "❌ Prettier formatting issues found. Run 'npm run format' to fix."
    exit 1
}

echo "📄 Running HTML validation..."
npm run validate:html || {
    echo "❌ HTML validation issues found."
    exit 1
}

echo "🎨 Running Stylelint (CSS linting)..."
npx stylelint "html/**/*.css" || {
    echo "❌ CSS linting issues found."
    exit 1
}

echo "✅ All Frontend quality checks passed!"