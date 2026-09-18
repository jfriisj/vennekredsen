#!/bin/bash
set -e

echo "🔧 Fixing API code formatting in Docker..."

docker compose --env-file .env.dev.local -f docker-compose.local.yml run --rm --no-deps api sh -lc '
    uv pip install --system -r requirements-dev.txt

    echo "🎨 Running Black..."
    python -m black .

    echo "📋 Running isort..."
    python -m isort .
'

echo "✅ API code formatting complete!"
echo "Run './scripts/check-api-quality.sh' to verify all issues are resolved."
