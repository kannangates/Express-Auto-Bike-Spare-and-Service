#!/bin/bash
# First-Time Setup — Express Auto Bike Management System
#
# Run this ONCE on any new machine. It will:
#   1. Install rclone + link your Google Drive account  (gdrive-setup)
#   2. Pull the latest backup from Google Drive         (restore)
#   3. Start the app + schedule daily noon backups      (start)
#
# Usage:
#   ./deploy-first-time.sh              # Full setup (gdrive + restore + start)
#   ./deploy-first-time.sh gdrive-setup # Re-run Google Drive setup only
#   ./deploy-first-time.sh --fresh      # Skip restore, start with empty DB

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

BACKUP_DIR="backups"
GDRIVE_REMOTE="gdrive:ExpressAutoBikeBackups"

print_info()    { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error()   { echo -e "${RED}✗${NC} $1"; }

# ── Preflight ─────────────────────────────────────────────────────────────────

if [ ! -f .env ]; then
    print_error ".env not found. Copy .env.example → .env, fill in values, then re-run."
    exit 1
fi
if ! command -v docker &>/dev/null; then
    print_error "Docker is not installed."
    print_info "Install: https://docs.docker.com/engine/install/"
    exit 1
fi

# Server mode — validate required .env values before doing anything
if [ "$DEPLOYMENT_MODE" = "server" ]; then
    MISSING=()
    [ -z "${FRONTEND_DOMAIN:-}" ] && MISSING+=("FRONTEND_DOMAIN")
    [ -z "${BACKEND_DOMAIN:-}"  ] && MISSING+=("BACKEND_DOMAIN")
    [ -z "${ACME_EMAIL:-}"      ] && MISSING+=("ACME_EMAIL")
    [ "${SECRET_KEY:-}" = "change-this-to-a-random-50-character-string-in-production" ] && MISSING+=("SECRET_KEY (still default)")
    if [ ${#MISSING[@]} -gt 0 ]; then
        print_error "Server mode requires these .env values to be set:"
        for v in "${MISSING[@]}"; do echo "  ✗ $v"; done
        echo ""
        print_info "Edit .env, then re-run this script."
        exit 1
    fi
    print_success "Server config looks good:"
    echo "  Frontend : https://${FRONTEND_DOMAIN}"
    echo "  Backend  : https://${BACKEND_DOMAIN}"
    echo "  SSL email: ${ACME_EMAIL}"
    echo ""
fi

set -a; source <(grep -v '^#' .env); set +a
DEPLOYMENT_MODE=${DEPLOYMENT_MODE:-development}

case "$DEPLOYMENT_MODE" in
    development) COMPOSE_FILES="-f docker-compose.yml -f docker-compose-local.yml" ;;
    tunnel)      COMPOSE_FILES="-f docker-compose.yml -f docker-compose-trycloudflare.yml" ;;
    server)      COMPOSE_FILES="-f docker-compose.yml -f docker-compose-server.yml" ;;
    *) print_error "Invalid DEPLOYMENT_MODE: $DEPLOYMENT_MODE (use: development | tunnel | server)"; exit 1 ;;
esac

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Google Drive setup (install rclone + link account)
# ══════════════════════════════════════════════════════════════════════════════

gdrive_setup() {
    echo ""
    echo "━━━━ Step 1: Google Drive Setup ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Install rclone if missing
    if command -v rclone &>/dev/null; then
        print_success "rclone already installed: $(rclone version | head -1)"
    else
        print_info "Installing rclone..."
        curl -fsSL https://rclone.org/install.sh | sudo bash
        print_success "rclone installed."
    fi

    # Configure Google Drive remote
    if rclone listremotes | grep -q "^gdrive:"; then
        print_success "Google Drive already linked."
    else
        echo ""
        print_info "Linking your Google account..."
        echo "  A browser window will open — sign in with the Google account"
        echo "  where backups should be stored."
        echo ""
        read -p "Press Enter to continue..."
        rclone config create gdrive drive scope drive config_is_local false
        print_success "Google Drive linked."
    fi

    # Create backup folder
    print_info "Creating '$GDRIVE_REMOTE' folder on Google Drive (if not exists)..."
    rclone mkdir "$GDRIVE_REMOTE"
    print_success "Google Drive folder ready."

    # Test
    if rclone lsd "$GDRIVE_REMOTE" &>/dev/null; then
        print_success "Google Drive connection verified."
    else
        print_error "Cannot access Google Drive. Re-run: ./deploy-first-time.sh gdrive-setup"
        exit 1
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Restore latest backup from Google Drive
# ══════════════════════════════════════════════════════════════════════════════

restore_from_drive() {
    echo ""
    echo "━━━━ Step 2: Restore from Google Drive ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    print_info "Looking for latest backup on Google Drive..."
    LATEST=$(rclone ls "$GDRIVE_REMOTE" --include "db_backup_*.sql" 2>/dev/null \
        | awk '{print $2}' | sort | tail -1)

    if [ -z "$LATEST" ]; then
        print_warning "No backup found on Google Drive."
        read -p "Start with an empty database instead? (yes/no): " -r
        [[ $REPLY =~ ^[Yy] ]] && return 0 || exit 1
    fi

    print_success "Found: $LATEST"
    mkdir -p "$BACKUP_DIR"
    LOCAL="$BACKUP_DIR/$LATEST"

    if [ ! -f "$LOCAL" ]; then
        print_info "Downloading..."
        rclone copy "$GDRIVE_REMOTE/$LATEST" "$BACKUP_DIR/"
        print_success "Downloaded: $LOCAL"
    else
        print_info "Already downloaded locally — skipping download."
    fi

    # Start DB container only, restore, then start the rest
    print_info "Starting PostgreSQL..."
    docker-compose $COMPOSE_FILES up -d postgres
    sleep 8

    print_info "Restoring database..."
    docker-compose $COMPOSE_FILES exec -T postgres \
        psql -U "${POSTGRES_USER:-postgres}" -c \
        "DROP DATABASE IF EXISTS ${POSTGRES_DB:-express_auto_bike};" postgres
    docker-compose $COMPOSE_FILES exec -T postgres \
        psql -U "${POSTGRES_USER:-postgres}" -c \
        "CREATE DATABASE ${POSTGRES_DB:-express_auto_bike};" postgres
    docker-compose $COMPOSE_FILES exec -T postgres \
        psql -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-express_auto_bike}" \
        < "$LOCAL"
    print_success "Database restored!"
}

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Start app + schedule daily backups
# ══════════════════════════════════════════════════════════════════════════════

start_app() {
    echo ""
    echo "━━━━ Step 3: Start App ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    print_info "Starting all services..."
    docker-compose $COMPOSE_FILES up -d

    print_info "Applying any pending migrations..."
    sleep 8
    docker-compose $COMPOSE_FILES exec -T backend python manage.py migrate
    print_success "App is running."

    # Schedule daily noon backup (idempotent)
    SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy.sh"
    PROJECT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    CRON_JOB="0 12 * * * cd $PROJECT_PATH && $SCRIPT_PATH backup >> $PROJECT_PATH/backups/backup.log 2>&1"
    if ! crontab -l 2>/dev/null | grep -q "deploy.sh backup"; then
        (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
        print_success "Daily backup scheduled at 12:00 noon → Google Drive."
    else
        print_info "Daily backup cron already set."
    fi

    echo ""
    print_success "Setup complete!"
    echo ""
    case "$DEPLOYMENT_MODE" in
        development)
            echo "  Access: http://localhost:${FRONTEND_PORT:-3000}"
            ;;
        tunnel)
            print_info "The tunnel URL appears in the in-app banner automatically."
            echo "  Run: ./deploy.sh up   (then share the trycloudflare.com URL shown)"
            ;;
        server)
            echo "  Frontend : https://${FRONTEND_DOMAIN}"
            echo "  Backend  : https://${BACKEND_DOMAIN}"
            echo "  Admin    : https://${BACKEND_DOMAIN}/admin/"
            print_info "SSL will be issued automatically on first request (Let's Encrypt)."
            ;;
    esac
}

# ══════════════════════════════════════════════════════════════════════════════
# Entry point
# ══════════════════════════════════════════════════════════════════════════════

case "${1:-}" in
    gdrive-setup)
        gdrive_setup
        ;;
    --fresh)
        print_info "Fresh start — skipping restore."
        start_app
        ;;
    *)
        gdrive_setup
        restore_from_drive
        start_app
        ;;
esac
