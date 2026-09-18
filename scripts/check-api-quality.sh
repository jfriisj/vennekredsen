#!/bin/bash
set -e

echo "🔍 Running API code quality checks in Docker..."

docker compose --env-file .env.dev.local -f docker-compose.local.yml run --rm --no-deps api sh -lc '
    uv pip install --system -r requirements-dev.txt

    echo "🎨 Running Black (code formatting)..."
    python -m black --check --diff .

    echo "📋 Running isort (import sorting)..."
    python -m isort --check-only --diff .

    echo "🔍 Running Flake8 (linting)..."
    python -m flake8 .

    echo "🛡️ Running Bandit (security check)..."
    python -m bandit -r . -ll

    echo "🔒 Running Safety (dependency security)..."
    python -m safety check         -r requirements.txt         -r requirements-dev.txt         --ignore 77744 --ignore 77745 --ignore 78688 --ignore 78279 --ignore 78558 --ignore 59234 --ignore 77942 --ignore 78057 --ignore 72086
'

echo "✅ All API quality checks passed!"
