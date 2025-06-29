#!/bin/bash

# SnapConnect Human-Bot Comment System
# Automatic AI bot commenting on human Photos/Discover content

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "🔍 Checking prerequisites for human-bot commenting..."
    
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
    
    # Check if base bot system exists
    if [[ ! -f scripts/botSocialInteractions.ts ]]; then
        error "Base bot system not found. Please ensure bot system is set up first."
        exit 1
    fi
    
    log "✅ Prerequisites check completed"
}

# Install dependencies
install_dependencies() {
    log "📦 Installing dependencies..."
    npm ci
    log "✅ Dependencies installed"
}

# Test system with specific user
test_system() {
    local test_user=${1:-"test@test.com"}
    log "🧪 Testing human-bot comment system with user: $test_user"
    
    if npm run human-bot:health; then
        log "✅ System health check passed"
        
        # Run dry-run test on specific user
        info "🏃 Running dry-run test on $test_user..."
        if npm run human-bot:test -- --user="$test_user" --dry-run; then
            log "✅ Dry-run test passed for $test_user - system ready"
        else
            warn "⚠️ Dry-run test failed for $test_user - check configuration"
            exit 1
        fi
    else
        error "❌ System health check failed"
        exit 1
    fi
}

# Test with real comments on specific user
test_real_comments() {
    local test_user=${1:-"test@test.com"}
    log "🎯 Testing REAL comments on $test_user account..."
    
    warn "⚠️ This will post REAL comments on $test_user posts"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Test cancelled"
        exit 0
    fi
    
    info "🚀 Running real comment test on $test_user..."
    if npm run human-bot:test -- --user="$test_user"; then
        log "✅ Real comment test completed for $test_user"
    else
        error "❌ Real comment test failed"
        exit 1
    fi
}

# Start local scheduler
start_local() {
    log "🚀 Starting automatic human-bot comment scheduler..."
    log "📋 Features:"
    log "   👥 AI bots automatically comment on ALL human Photos/Discover content"
    log "   🎯 Quality filtered (posts with 2+ likes or existing engagement)"
    log "   ⏱️ Rate limited (0-2 comments per post, natural timing)"
    log "   🧠 Context-aware personality-driven comments"
    log "   🔄 Automatic - no user setup required"
    log ""
    log "📅 Schedule:"
    log "   📸 Photos scan every 20 minutes"
    log "   🎬 Discover scan every 30 minutes"
    log "   🏥 Health checks every hour"
    log ""
    log "🟢 Human-bot comment scheduler starting... Press Ctrl+C to stop."
    
    npm run human-bot:scheduler
}

# Start with PM2
start_pm2() {
    log "🚀 Starting human-bot comment scheduler with PM2..."
    
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
        log "📦 Installing PM2..."
        npm install -g pm2
    fi
    
    # Start with PM2
    pm2 start ecosystem.humanbot.config.js
    pm2 save
    
    log "✅ Human-bot comment scheduler started with PM2"
    log "📊 Monitor with: pm2 monit"
    log "📋 View logs with: pm2 logs snapconnect-human-bot-scheduler"
    log "🛑 Stop with: pm2 stop snapconnect-human-bot-scheduler"
}

# Disable human-bot commenting
disable_system() {
    log "🛑 Disabling human-bot comment system..."
    
    # Stop PM2 if running
    if command -v pm2 &> /dev/null; then
        pm2 delete snapconnect-human-bot-scheduler 2>/dev/null || true
    fi
    
    log "✅ Human-bot comment system disabled"
    info "💡 To re-enable, run: $0 local"
}

# Manual triggers
trigger_routine() {
    local routine=$1
    local user_filter=${2:-}
    local dry_run=${3:-}
    
    case $routine in
        photos)
            log "📸 Triggering Photos comment routine..."
            npm run human-bot:photos $user_filter $dry_run
            ;;
        discover)
            log "🎬 Triggering Discover comment routine..."
            npm run human-bot:discover $user_filter $dry_run
            ;;
        social)
            log "👥 Triggering full social engagement..."
            npm run human-bot:social $user_filter $dry_run
            ;;
        health)
            log "🏥 Triggering health check..."
            npm run human-bot:health
            ;;
        *)
            error "Unknown routine: $routine"
            echo "Available routines: photos, discover, social, health"
            exit 1
            ;;
    esac
}

# Show help
show_help() {
    echo -e "${PURPLE}SnapConnect Human-Bot Comment System (Automatic)${NC}"
    echo ""
    echo "AI bots automatically comment on human Photos/Discover content"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  local          Start automatic comment scheduler"
    echo "  pm2            Start with PM2 process manager"
    echo "  test [user]    Test system with dry-run (default: test@test.com)"
    echo "  test-real [user] Test with REAL comments (default: test@test.com)"
    echo "  trigger <type> Manually trigger comment routines"
    echo "  disable        Disable all human-bot commenting"
    echo "  help           Show this help"
    echo ""
    echo "Manual trigger routines:"
    echo "  photos         Comment on recent Photos posts"
    echo "  discover       Comment on recent Discover videos" 
    echo "  social         Full social engagement (both photos + discover)"
    echo "  health         System health check"
    echo ""
    echo "Options:"
    echo "  --user=email   Target specific user for testing"
    echo "  --dry-run      Test mode (no actual comments posted)"
    echo ""
    echo "Examples:"
    echo "  $0 test                           # Test with test@test.com (dry-run)"
    echo "  $0 test user@example.com          # Test specific user (dry-run)"
    echo "  $0 test-real test@test.com        # Test with REAL comments"
    echo "  $0 trigger photos --dry-run       # Test photos commenting"
    echo "  $0 local                          # Start automatic scheduler"
    echo "  $0 pm2                            # Start background with PM2"
    echo "  $0 disable                        # Disable system completely"
    echo ""
    echo "🤖 System Features:"
    echo "   • Automatic engagement (no user setup required)"
    echo "   • Quality filtered (posts with 2+ likes or existing engagement)"
    echo "   • Conservative (0-2 comments per post maximum)"
    echo "   • Natural timing (10-90 minute delays)"
    echo "   • Personality-driven contextual comments"
}

# Main execution
main() {
    local command=${1:-help}
    local param=${2:-}
    
    # Show help if no command provided
    if [[ $command == "help" || -z $command ]]; then
        show_help
        exit 0
    fi
    
    # Always check prerequisites except for help
    check_prerequisites
    install_dependencies
    
    case $command in
        local)
            start_local
            ;;
        pm2)
            start_pm2
            ;;
        test)
            test_system $param
            ;;
        test-real)
            test_real_comments $param
            ;;
        trigger)
            if [[ -z $2 ]]; then
                error "Please specify a routine to trigger"
                show_help
                exit 1
            fi
            trigger_routine $2 $3 $4
            ;;
        disable)
            disable_system
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