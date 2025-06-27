#!/bin/bash

# SnapConnect Bot Automation Startup Script
# Handles different deployment methods for bot automation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "🔍 Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js 18 or later."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed. Please install npm."
        exit 1
    fi
    
    # Check .env file
    if [[ ! -f .env ]]; then
        warn ".env file not found. Please create one with required environment variables."
        warn "Required variables: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EXPO_PUBLIC_OPENAI_API_KEY"
    fi
    
    log "✅ Prerequisites check completed"
}

# Install dependencies
install_dependencies() {
    log "📦 Installing dependencies..."
    npm ci
    log "✅ Dependencies installed"
}

# Test bot system
test_system() {
    log "🧪 Testing bot system..."
    
    if npm run bot:scheduler:health; then
        log "✅ System health check passed"
    else
        error "❌ System health check failed"
        exit 1
    fi
}

# Start local scheduler
start_local() {
    log "🚀 Starting local bot scheduler..."
    log "📅 Schedule:"
    log "   🌅 7:00 AM  - Morning posts + health check"
    log "   ☀️ 12:00 PM - Midday social engagement"
    log "   🌤️ 2:00 PM  - Afternoon posts"
    log "   🌆 5:00 PM  - Evening social engagement"
    log "   🌙 7:00 PM  - Night routine (friends + posts + social)"
    log "   🏥 3:00 AM  - Daily health check"
    log ""
    log "🟢 Bot scheduler is starting... Press Ctrl+C to stop."
    
    npm run bot:scheduler
}

# Start with PM2
start_pm2() {
    log "🚀 Starting bot scheduler with PM2..."
    
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
        log "📦 Installing PM2..."
        npm install -g pm2
    fi
    
    # Start with PM2
    pm2 start ecosystem.config.js
    pm2 save
    
    log "✅ Bot scheduler started with PM2"
    log "📊 Monitor with: pm2 monit"
    log "📋 View logs with: pm2 logs snapconnect-bot-scheduler"
    log "🛑 Stop with: pm2 stop snapconnect-bot-scheduler"
}

# Start with Docker
start_docker() {
    log "🐳 Starting bot scheduler with Docker..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker."
        exit 1
    fi
    
    # Build and start
    docker-compose -f docker-compose.scheduler.yml up -d --build
    
    log "✅ Bot scheduler started with Docker"
    log "📊 Monitor with: docker-compose -f docker-compose.scheduler.yml logs -f"
    log "🛑 Stop with: docker-compose -f docker-compose.scheduler.yml down"
}

# Setup systemd service
setup_systemd() {
    log "⚙️ Setting up systemd service..."
    
    if [[ $EUID -eq 0 ]]; then
        error "Don't run this script as root. Use: sudo ./scripts/startAutomation.sh systemd"
        exit 1
    fi
    
    # Copy service file
    sudo cp deployment/snapconnect-bots.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable snapconnect-bots
    sudo systemctl start snapconnect-bots
    
    log "✅ Systemd service installed and started"
    log "📊 Check status with: sudo systemctl status snapconnect-bots"
    log "📋 View logs with: sudo journalctl -u snapconnect-bots -f"
    log "🛑 Stop with: sudo systemctl stop snapconnect-bots"
}

# Manual triggers
trigger_routine() {
    local routine=$1
    case $routine in
        morning)
            log "🌅 Triggering morning routine..."
            npm run bot:scheduler:morning
            ;;
        social)
            log "👥 Triggering social engagement..."
            npm run bot:scheduler:social
            ;;
        friends)
            log "🤝 Triggering friendship building..."
            npm run bot:scheduler:friends
            ;;
        health)
            log "🏥 Triggering health check..."
            npm run bot:scheduler:health
            ;;
        *)
            error "Unknown routine: $routine"
            echo "Available routines: morning, social, friends, health"
            exit 1
            ;;
    esac
}

# Show help
show_help() {
    echo -e "${BLUE}SnapConnect Bot Automation${NC}"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  local          Start local scheduler (default)"
    echo "  pm2            Start with PM2 process manager"
    echo "  docker         Start with Docker"
    echo "  systemd        Setup systemd service (requires sudo)"
    echo "  test           Test system health"
    echo "  trigger <routine>  Manually trigger a routine"
    echo "  help           Show this help"
    echo ""
    echo "Manual trigger routines:"
    echo "  morning        Run morning routine"
    echo "  social         Run social engagement"
    echo "  friends        Run friendship building"
    echo "  health         Run health check"
    echo ""
    echo "Examples:"
    echo "  $0                     # Start local scheduler"
    echo "  $0 pm2                 # Start with PM2"
    echo "  $0 trigger morning     # Run morning routine now"
    echo "  $0 test                # Test system health"
}

# Main execution
main() {
    local command=${1:-local}
    
    # Always check prerequisites and install dependencies
    if [[ $command != "help" ]]; then
        check_prerequisites
        install_dependencies
    fi
    
    case $command in
        local)
            test_system
            start_local
            ;;
        pm2)
            test_system
            start_pm2
            ;;
        docker)
            test_system
            start_docker
            ;;
        systemd)
            test_system
            setup_systemd
            ;;
        test)
            test_system
            ;;
        trigger)
            if [[ -z $2 ]]; then
                error "Please specify a routine to trigger"
                show_help
                exit 1
            fi
            trigger_routine $2
            ;;
        help)
            show_help
            ;;
        *)
            error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"