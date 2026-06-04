#!/bin/bash
# Smart Deployment Script for Express Auto Bike Management System
# Automatically detects DEPLOYMENT_MODE from .env and runs appropriate docker-compose

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Backup configuration
BACKUP_DIR="backups"
GDRIVE_REMOTE="gdrive:ExpressAutoBikeBackups"

# Owner Gmail accounts — seeded automatically on every deploy.
# Add more emails here if needed; duplicates are silently skipped.
OWNER_EMAILS=(
    "expressspares78@gmail.com"
    "kannangates@gmail.com"
)

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Seed owner accounts — idempotent, safe to run on every deploy
seed_owners() {
    print_info "Seeding owner accounts..."
    for email in "${OWNER_EMAILS[@]}"; do
        docker-compose $COMPOSE_FILES exec -T backend \
            python manage.py create_owner --email "$email" 2>&1 \
            | while IFS= read -r line; do print_info "  $line"; done
    done
    print_success "Owner accounts ready."
}

# Function to create automatic backup
auto_backup() {
    # Only auto-backup in production and tunnel modes
    if [ "$DEPLOYMENT_MODE" != "development" ]; then
        print_info "Creating automatic backup before operation..."
        
        # Create backup directory if it doesn't exist
        mkdir -p "$BACKUP_DIR"
        
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        DB_BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"
        MEDIA_BACKUP_FILE="$BACKUP_DIR/media_backup_$TIMESTAMP.tar.gz"
        
        # Backup database
        if docker-compose $COMPOSE_FILES ps | grep -q "postgres.*Up"; then
            docker-compose $COMPOSE_FILES exec -T postgres pg_dump -U ${POSTGRES_USER:-postgres} ${POSTGRES_DB:-express_auto_bike} > "$DB_BACKUP_FILE" 2>/dev/null || true
            if [ -f "$DB_BACKUP_FILE" ]; then
                print_success "Database backed up: $DB_BACKUP_FILE"
            fi
        fi
        
        # Backup media files if directory exists
        if [ -d "backend/media" ] && [ "$(ls -A backend/media 2>/dev/null)" ]; then
            tar -czf "$MEDIA_BACKUP_FILE" -C backend media/ 2>/dev/null || true
            if [ -f "$MEDIA_BACKUP_FILE" ]; then
                print_success "Media files backed up: $MEDIA_BACKUP_FILE"
            fi
        fi
        
        # Keep only this latest local backup (Google Drive is the persistent store)
        find "$BACKUP_DIR" -name "db_backup_*.sql" ! -name "db_backup_${TIMESTAMP}.sql" -delete 2>/dev/null || true
        find "$BACKUP_DIR" -name "media_backup_*.tar.gz" ! -name "media_backup_${TIMESTAMP}.tar.gz" -delete 2>/dev/null || true
    fi
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found!"
    print_info "Creating .env from .env.example..."
    cp .env.example .env
    print_warning "Please edit .env with your configuration and run again."
    exit 1
fi

# Function to mask sensitive values in output
mask_value() {
    local value="$1"
    local length=${#value}
    
    if [ $length -eq 0 ]; then
        echo "(empty)"
    elif [ $length -le 4 ]; then
        echo "****"
    else
        # Show first 4 chars, mask the rest
        echo "${value:0:4}****"
    fi
}

# Load environment variables (without exporting sensitive ones to logs)
set -a
source <(grep -v '^#' .env | grep -v 'SECRET\|PASSWORD\|KEY\|TOKEN')
set +a

# Load sensitive variables separately (don't log these)
set -a
source <(grep -v '^#' .env | grep -E 'SECRET|PASSWORD|KEY|TOKEN')
set +a

# Get deployment mode (default to development)
DEPLOYMENT_MODE=${DEPLOYMENT_MODE:-development}

print_info "Detected deployment mode: ${DEPLOYMENT_MODE}"

# Show configuration (with masked sensitive values)
if [ "$DEPLOYMENT_MODE" != "development" ]; then
    print_info "Configuration check:"
    echo "  Database: ${POSTGRES_DB}"
    echo "  Backend Port: ${BACKEND_PORT}"
    echo "  Frontend Port: ${FRONTEND_PORT}"
    
    # Mask sensitive values
    if [ -n "$SECRET_KEY" ]; then
        echo "  Secret Key: $(mask_value "$SECRET_KEY")"
    fi
    if [ -n "$POSTGRES_PASSWORD" ]; then
        echo "  DB Password: $(mask_value "$POSTGRES_PASSWORD")"
    fi
    if [ -n "$GOOGLE_OAUTH2_CLIENT_SECRET" ]; then
        echo "  OAuth Secret: $(mask_value "$GOOGLE_OAUTH2_CLIENT_SECRET")"
    fi
fi

# Determine which docker-compose files to use
case "$DEPLOYMENT_MODE" in
    development)
        COMPOSE_FILES="-f docker-compose.yml -f docker-compose-local.yml"
        print_info "Mode: local development (hot reload)"
        ;;
    tunnel)
        COMPOSE_FILES="-f docker-compose.yml -f docker-compose-trycloudflare.yml"
        print_info "Mode: trycloudflare.com (public shop access)"
        ;;
    server)
        COMPOSE_FILES="-f docker-compose.yml -f docker-compose-server.yml"
        print_info "Mode: server/VPS with Traefik SSL"
        ;;
    *)
        print_error "Invalid DEPLOYMENT_MODE: $DEPLOYMENT_MODE"
        print_info "Valid options: development | tunnel | server"
        exit 1
        ;;
esac

# Parse command line arguments
COMMAND=${1:-up}

case "$COMMAND" in
    up)
        # Check if tunnel mode and ask about domain preference
        if [ "$DEPLOYMENT_MODE" = "tunnel" ]; then
            print_info "Starting in trycloudflare.com mode — URL will appear in the app banner."
        fi
        
        print_info "Starting services..."
        docker-compose $COMPOSE_FILES up -d
        print_success "Services started successfully!"

        # Wait for backend to be ready then migrate + seed owners automatically
        print_info "Waiting for backend to be ready..."
        RETRIES=20
        until docker-compose $COMPOSE_FILES exec -T backend python manage.py migrate --check > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
            sleep 3
            RETRIES=$((RETRIES - 1))
        done

        print_info "Running database migrations..."
        docker-compose $COMPOSE_FILES exec -T backend python manage.py migrate
        print_success "Migrations applied."

        seed_owners

        # Show service status
        echo ""
        docker-compose ps
        
        # Show access URLs
        echo ""
        print_success "Application is running!"
        if [ "$DEPLOYMENT_MODE" = "development" ]; then
            echo "  Frontend: http://localhost:${FRONTEND_PORT:-3000}"
            echo "  Backend:  http://localhost:${BACKEND_PORT:-8000}"
            echo "  Admin:    http://localhost:${BACKEND_PORT:-8000}/admin/"
        elif [ "$DEPLOYMENT_MODE" = "server" ]; then
            echo "  Frontend: https://${FRONTEND_DOMAIN}"
            echo "  Backend:  https://${BACKEND_DOMAIN}"
            echo "  Admin:    https://${BACKEND_DOMAIN}/admin/"
            print_info "SSL certificate will be issued automatically by Let's Encrypt on first request."
        elif [ "$DEPLOYMENT_MODE" = "tunnel" ]; then
            print_info "Waiting for tunnel URL (up to 20 seconds)..."
            sleep 15
            TUNNEL_URL=$(docker-compose $COMPOSE_FILES logs cloudflared 2>/dev/null \
                | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1)

            if [ -n "$TUNNEL_URL" ]; then
                # Store in Redis so the in-app banner shows it automatically
                docker-compose $COMPOSE_FILES exec -T redis \
                    redis-cli SET tunnel_url "$TUNNEL_URL" EX 86400 > /dev/null

                # Update .env for backend CORS/ALLOWED_HOSTS then restart
                for KEY in TUNNEL_FRONTEND_URL TUNNEL_BACKEND_URL; do
                    if grep -q "^${KEY}=" .env; then
                        sed -i.bak "s|^${KEY}=.*|${KEY}=$TUNNEL_URL|" .env
                    else
                        echo "${KEY}=$TUNNEL_URL" >> .env
                    fi
                done
                rm -f .env.bak
                docker-compose $COMPOSE_FILES restart backend frontend

                echo ""
                print_success "Share this URL with customers/staff:"
                echo "  $TUNNEL_URL"
                echo ""
                print_info "The URL also appears in the app's top banner for all logged-in users."
                print_warning "This URL changes every restart."
            else
                print_warning "Tunnel URL not ready yet. Check: ./deploy.sh logs cloudflared"
            fi
        fi
        ;;
        
    down)
        # Auto-backup before stopping
        auto_backup
        
        print_info "Stopping services..."
        docker-compose $COMPOSE_FILES down
        print_success "Services stopped successfully!"
        ;;
        
    restart)
        # Auto-backup before restarting
        auto_backup
        
        print_info "Restarting services..."
        docker-compose $COMPOSE_FILES restart
        print_success "Services restarted successfully!"
        ;;
        
    build)
        print_info "Building containers..."
        docker-compose $COMPOSE_FILES build
        print_success "Build completed successfully!"
        ;;
        
    logs)
        SERVICE=${2:-}
        if [ -z "$SERVICE" ]; then
            docker-compose $COMPOSE_FILES logs -f
        else
            docker-compose $COMPOSE_FILES logs -f $SERVICE
        fi
        ;;
        
    ps)
        docker-compose $COMPOSE_FILES ps
        ;;
        
    exec)
        SERVICE=${2:-backend}
        EXEC_COMMAND=${3:-sh}
        docker-compose $COMPOSE_FILES exec $SERVICE $EXEC_COMMAND
        ;;
        
    migrate)
        print_info "Running database migrations..."
        docker-compose $COMPOSE_FILES exec backend python manage.py migrate
        print_success "Migrations completed successfully!"
        ;;
        
    init)
        print_info "Initializing application..."

        print_info "Running migrations..."
        docker-compose $COMPOSE_FILES exec -T backend python manage.py migrate
        print_success "Migrations applied."

        seed_owners

        print_success "Initialization completed!"
        ;;
        
    backup)
        print_info "Creating backup and uploading to Google Drive..."
        mkdir -p "$BACKUP_DIR"

        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        DB_BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

        # Dump database
        docker-compose $COMPOSE_FILES exec -T postgres \
            pg_dump -U ${POSTGRES_USER:-postgres} ${POSTGRES_DB:-express_auto_bike} \
            > "$DB_BACKUP_FILE"
        print_success "Database dumped: $DB_BACKUP_FILE"

        # Keep only this latest backup locally (delete older ones)
        find "$BACKUP_DIR" -name "db_backup_*.sql" ! -name "db_backup_${TIMESTAMP}.sql" -delete
        print_info "Old local backups removed."

        # Upload to Google Drive and keep only latest there too
        if command -v rclone &>/dev/null && rclone lsd "$GDRIVE_REMOTE" &>/dev/null; then
            print_info "Uploading to Google Drive..."
            rclone copy "$DB_BACKUP_FILE" "$GDRIVE_REMOTE/"
            # Remove old backups from Drive
            rclone ls "$GDRIVE_REMOTE" --include "db_backup_*.sql" \
                | awk '{print $2}' | grep -v "db_backup_${TIMESTAMP}.sql" \
                | while read -r old; do
                    rclone delete "$GDRIVE_REMOTE/$old"
                    print_info "Removed old Drive backup: $old"
                done
            print_success "Uploaded to Google Drive: $(basename "$DB_BACKUP_FILE")"
        else
            print_warning "rclone not configured — backup saved locally only."
            print_info "Run ./deploy-first-time.sh gdrive-setup to configure Google Drive."
        fi
        ;;
        
    restore)
        BACKUP_TIMESTAMP=${2:-}
        if [ -z "$BACKUP_TIMESTAMP" ]; then
            print_error "Please specify backup timestamp: ./deploy.sh restore 20260410_143022"
            print_info "Available backups:"
            ls -1 "$BACKUP_DIR"/db_backup_*.sql 2>/dev/null | sed 's/.*db_backup_/  /' | sed 's/.sql$//' || echo "  No backups found"
            exit 1
        fi
        
        DB_BACKUP_FILE="$BACKUP_DIR/db_backup_${BACKUP_TIMESTAMP}.sql"
        MEDIA_BACKUP_FILE="$BACKUP_DIR/media_backup_${BACKUP_TIMESTAMP}.tar.gz"
        
        if [ ! -f "$DB_BACKUP_FILE" ]; then
            print_error "Database backup not found: $DB_BACKUP_FILE"
            exit 1
        fi
        
        print_warning "This will overwrite current database and media files!"
        read -p "Are you sure? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            print_info "Restore cancelled."
            exit 0
        fi
        
        # Restore database
        print_info "Restoring database from $DB_BACKUP_FILE..."
        docker-compose $COMPOSE_FILES exec -T postgres psql -U ${POSTGRES_USER:-postgres} ${POSTGRES_DB:-express_auto_bike} < "$DB_BACKUP_FILE"
        print_success "Database restored successfully!"
        
        # Restore media files
        if [ -f "$MEDIA_BACKUP_FILE" ]; then
            print_info "Restoring media files from $MEDIA_BACKUP_FILE..."
            rm -rf backend/media
            tar -xzf "$MEDIA_BACKUP_FILE" -C backend/
            print_success "Media files restored successfully!"
        else
            print_warning "No media backup found for this timestamp"
        fi
        
        print_success "Restore completed!"
        ;;
        
    clean)
        print_warning "This will remove all containers, volumes, and data!"
        read -p "Are you sure? (yes/no): " -r
        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            print_info "Cleaning up..."
            docker-compose $COMPOSE_FILES down -v
            print_success "Cleanup completed!"
        else
            print_info "Cleanup cancelled."
        fi
        ;;
        
    schedule-backup)
        print_info "Setting up daily noon backup..."
        SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
        PROJECT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        CRON_JOB="0 12 * * * cd $PROJECT_PATH && $SCRIPT_PATH backup >> $PROJECT_PATH/backups/backup.log 2>&1"

        if crontab -l 2>/dev/null | grep -q "deploy.sh backup"; then
            print_warning "Daily backup cron already exists — skipping."
        else
            (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
            print_success "Daily backup scheduled at 12:00 noon."
            print_info "Logs: $PROJECT_PATH/backups/backup.log"
        fi
        ;;
        
    list-backups)
        print_info "Available backups:"
        echo ""
        
        if [ -d "$BACKUP_DIR" ]; then
            # List database backups
            echo "Database backups:"
            ls -lh "$BACKUP_DIR"/db_backup_*.sql 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}' | sed 's|.*/||' || echo "  No database backups found"
            
            echo ""
            echo "Media backups:"
            ls -lh "$BACKUP_DIR"/media_backup_*.tar.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}' | sed 's|.*/||' || echo "  No media backups found"
            
            echo ""
            print_info "To restore a backup, use the timestamp:"
            echo "  ./deploy.sh restore 20260410_143022"
        else
            print_warning "No backup directory found"
        fi
        ;;
        
    help|--help|-h)
        echo "Express Auto Bike Management System - Deployment Script"
        echo ""
        echo "Usage: ./deploy.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  up                    Start services (default)"
        echo "  down                  Stop services (auto-backup in prod/tunnel)"
        echo "  restart               Restart services (auto-backup in prod/tunnel)"
        echo "  build                 Build containers"
        echo "  logs [service]        View logs (optionally for specific service)"
        echo "  ps                    Show service status"
        echo "  exec [service]        Execute command in container (default: backend sh)"
        echo "  migrate               Run database migrations"
        echo "  init                  Initialize application (migrate + create owner)"
        echo "  backup                Create manual backup (database + media)"
        echo "  restore [timestamp]   Restore from backup (e.g., 20260410_143022)"
        echo "  list-backups          List all available backups"
        echo "  schedule-backup       Setup daily automatic backups (2 AM)"
        echo "  clean                 Remove all containers and volumes"
        echo "  help                  Show this help message"
        echo ""
        echo "Deployment modes (set DEPLOYMENT_MODE= in .env):"
        echo "  development  Local dev, hot reload  → docker-compose-local.yml"
        echo "  tunnel       Shop PC, trycloudflare  → docker-compose-trycloudflare.yml"
        echo "  server       VPS + domain + SSL       → docker-compose-server.yml"
        echo ""
        echo "Backup features:"
        echo "  • Auto-backup before restart/down in production/tunnel modes"
        echo "  • Includes database + media files"
        echo "  • Keeps last 7 days of backups"
        echo "  • Stored in: ./backups/"
        echo ""
        echo "Examples:"
        echo "  ./deploy.sh                      # Start in detected mode"
        echo "  ./deploy.sh up                   # Start services"
        echo "  ./deploy.sh logs backend         # View backend logs"
        echo "  ./deploy.sh backup               # Manual backup"
        echo "  ./deploy.sh list-backups         # Show all backups"
        echo "  ./deploy.sh restore 20260410_143022  # Restore specific backup"
        echo "  ./deploy.sh schedule-backup      # Setup daily backups"
        ;;
        
    *)
        print_error "Unknown command: $COMMAND"
        print_info "Run './deploy.sh help' for usage information"
        exit 1
        ;;
esac
