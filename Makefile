# Vennekredsen Project Makefile
.PHONY: help install-dev check-quality fix-format test clean

# Default target
help:
	@echo "🎯 Vennekredsen Project Commands"
	@echo ""
	@echo "Development Setup:"
	@echo "  install-dev     Install all development dependencies"
	@echo "  install-hooks   Install pre-commit hooks"
	@echo ""
	@echo "Code Quality:"
	@echo "  check-quality   Run all quality checks"
	@echo "  check-api       Run API quality checks only"
	@echo "  check-frontend  Run frontend quality checks only"
	@echo "  fix-format      Fix all formatting issues"
	@echo "  fix-api         Fix API formatting issues"
	@echo "  fix-frontend    Fix frontend formatting issues"
	@echo ""
	@echo "Testing:"
	@echo "  test           Run all tests"
	@echo "  test-api       Run API tests with coverage"
	@echo ""
	@echo "Docker:"
	@echo "  build          Build all Docker images"
	@echo "  up             Start all services"
	@echo "  down           Stop all services"
	@echo "  logs           Show service logs"
	@echo ""
	@echo "Cleanup:"
	@echo "  clean          Clean temporary files and caches"

# Development setup
install-dev:
	@echo "📦 Installing API dependencies..."
	cd api && pip install -r requirements.txt -r requirements-dev.txt
	@echo "📦 Installing Frontend dependencies..."
	cd frontend && npm install
	@echo "✅ Development setup complete!"

install-hooks:
	@echo "🪝 Installing pre-commit hooks..."
	pip install pre-commit
	pre-commit install
	@echo "✅ Pre-commit hooks installed!"

# Quality checks
check-quality:
	@chmod +x scripts/*.sh
	@./scripts/check-all-quality.sh

check-api:
	@chmod +x scripts/check-api-quality.sh
	@./scripts/check-api-quality.sh

check-frontend:
	@chmod +x scripts/check-frontend-quality.sh
	@./scripts/check-frontend-quality.sh

# Format fixing
fix-format:
	@chmod +x scripts/*.sh
	@./scripts/fix-api-format.sh
	@./scripts/fix-frontend-format.sh

fix-api:
	@chmod +x scripts/fix-api-format.sh
	@./scripts/fix-api-format.sh

fix-frontend:
	@chmod +x scripts/fix-frontend-format.sh
	@./scripts/fix-frontend-format.sh

# Testing
test: test-api

test-api:
	@echo "🧪 Running API tests..."
	cd api && pytest --cov=. --cov-report=html --cov-report=term-missing

# Docker commands
build:
	@echo "🐳 Building Docker images..."
	docker-compose build

up:
	@echo "🚀 Starting services..."
	docker-compose up -d

down:
	@echo "🛑 Stopping services..."
	docker-compose down

logs:
	@echo "📋 Showing logs..."
	docker-compose logs -f

# Cleanup
clean:
	@echo "🧹 Cleaning temporary files..."
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name ".pytest_cache" -delete
	find . -type f -name ".coverage" -delete
	find . -type d -name "htmlcov" -delete
	find . -type d -name "node_modules" -delete
	find . -type f -name "package-lock.json" -delete
	@echo "✅ Cleanup complete!"