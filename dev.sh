#!/bin/bash

# Development startup script for Vennekredsen
# Dette script gør det nemt at starte udviklings-miljøet

set -e

echo "🚀 Starting Vennekredsen Development Environment..."
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed or not in PATH"
    exit 1
fi

# Check if .env.dev.local exists, if not create from template
if [ ! -f .env.dev.local ]; then
    echo "📝 Creating .env.dev.local from template..."
    cp .env.dev .env.dev.local
    echo "✅ Please review and update .env.dev.local with your settings"
    echo ""
fi

# Function to show help
show_help() {
    echo "Usage: ./dev.sh [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start, up     Start all development services"
    echo "  stop, down    Stop all development services"
    echo "  restart       Restart all development services" 
    echo "  logs          Show logs from all services"
    echo "  logs-api      Show API logs only"
    echo "  logs-db       Show database logs only"
    echo "  build         Rebuild all services"
    echo "  clean         Stop services and remove volumes"
    echo "  shell-api     Open shell in API container"
    echo "  shell-db      Open PostgreSQL shell"
    echo "  test          Run API tests"
    echo "  status        Show running containers"
    echo "  tools         Start with pgAdmin and Redis"
    echo "  create-admin  Create admin user in database"
    echo "  help          Show this help"
    echo ""
}

# Parse command
COMMAND=${1:-start}

case $COMMAND in
    "start"|"up")
        echo "🔧 Starting development services..."
        docker-compose -f docker-compose.local.yml --env-file .env.dev.local up -d
        echo ""
        echo "✅ Development environment started!"
        echo ""
        echo "🌐 Services available at:"
        echo "   Frontend: http://localhost:85"
        echo "   API:      http://localhost:5000"
        echo "   Database: localhost:5432"
        echo ""
        echo "📊 To view logs: ./dev.sh logs"
        ;;
    
    "stop"|"down")
        echo "🛑 Stopping development services..."
        docker-compose -f docker-compose.local.yml down
        echo "✅ Development environment stopped!"
        ;;
    
    "restart")
        echo "🔄 Restarting development services..."
        docker-compose -f docker-compose.local.yml restart
        echo "✅ Development environment restarted!"
        ;;
    
    "logs")
        echo "📋 Showing logs from all services..."
        docker-compose -f docker-compose.local.yml logs -f
        ;;
    
    "logs-api")
        echo "📋 Showing API logs..."
        docker-compose -f docker-compose.local.yml logs -f api
        ;;
    
    "logs-db")
        echo "📋 Showing database logs..."
        docker-compose -f docker-compose.local.yml logs -f db
        ;;
    
    "build")
        echo "🔨 Rebuilding development services..."
        docker-compose -f docker-compose.local.yml build --no-cache
        echo "✅ Services rebuilt!"
        ;;
    
    "clean")
        echo "🧹 Cleaning development environment..."
        docker-compose -f docker-compose.local.yml down -v
        docker-compose -f docker-compose.local.yml build --no-cache
        echo "✅ Development environment cleaned!"
        ;;
    
    "shell-api")
        echo "🐚 Opening shell in API container..."
        docker-compose -f docker-compose.local.yml exec api bash
        ;;
    
    "shell-db")
        echo "🐚 Opening PostgreSQL shell..."
        # Load environment variables if .env.dev.local exists
        if [ -f .env.dev.local ]; then
            source .env.dev.local
        fi
        docker-compose -f docker-compose.local.yml exec db psql -U ${POSTGRES_USER:-dev_user} -d ${POSTGRES_DB:-vennekredsen_dev}
        ;;
    
    "test")
        echo "🧪 Running API tests..."
        docker-compose -f docker-compose.local.yml exec api python -m pytest -v --cov=. --cov-report=term-missing
        ;;
    
    "status")
        echo "📊 Development services status:"
        docker-compose -f docker-compose.local.yml ps
        ;;
    
    "tools")
        echo "🔧 Starting development services with tools (pgAdmin)..."
        docker-compose -f docker-compose.local.yml --profile tools --env-file .env.dev.local up -d
        echo ""
        echo "✅ Development environment with tools started!"
        echo ""
        echo "🌐 Services available at:"
        echo "   Frontend:  http://localhost:85"
        echo "   API:       http://localhost:5000"
        echo "   pgAdmin:   http://localhost:5050"
        echo "   Database:  localhost:5432"
        ;;
    
    "create-admin")
        echo "👤 Creating admin user in database..."
        
        # Check if services are running
        if ! docker-compose -f docker-compose.local.yml ps | grep -q "Up"; then
            echo "⚠️  Services not running. Starting them first..."
            docker-compose -f docker-compose.local.yml --env-file .env.dev.local up -d
            echo "⏳ Waiting for services to be ready..."
            sleep 10
        fi
        
        # Run the admin creation script
        docker-compose -f docker-compose.local.yml exec api python create_admin.py
        ;;
    
    "help"|"-h"|"--help")
        show_help
        ;;
    
    *)
        echo "❌ Unknown command: $COMMAND"
        echo ""
        show_help
        exit 1
        ;;
esac