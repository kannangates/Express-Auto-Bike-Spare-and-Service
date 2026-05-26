#!/bin/bash

# Express Auto Bike Management System - Vercel Frontend Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="express-auto-bike-frontend"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking deployment requirements..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        log_warning "Vercel CLI is not installed. Installing..."
        npm install -g vercel
    fi
    
    log_success "All requirements met"
}

install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$SCRIPT_DIR"
    npm ci
    
    log_success "Dependencies installed"
}

build_application() {
    log_info "Building application..."
    
    cd "$SCRIPT_DIR"
    
    # Use hybrid configuration for build
    cp next.config.hybrid.js next.config.js
    
    # Build the application
    npm run build
    
    log_success "Application built successfully"
}

deploy_to_vercel() {
    log_info "Deploying to Vercel..."
    
    cd "$SCRIPT_DIR"
    
    # Deploy to Vercel
    vercel --prod
    
    log_success "Deployed to Vercel successfully"
}

setup_environment_variables() {
    log_info "Setting up environment variables..."
    
    echo "Please set the following environment variables in your Vercel dashboard:"
    echo
    echo "=== Required Environment Variables ==="
    echo "NEXT_PUBLIC_API_URL=https://api.yourdomain.com"
    echo "NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com"
    echo "NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id"
    echo "NEXT_PUBLIC_PWA_ENABLED=true"
    echo "NEXT_PUBLIC_OFFLINE_ENABLED=true"
    echo "NEXT_PUBLIC_BARCODE_SCANNER_ENABLED=true"
    echo "NEXT_PUBLIC_PUSH_NOTIFICATIONS_ENABLED=true"
    echo "NEXT_PUBLIC_OFFLINE_SYNC_ENABLED=true"
    echo "NODE_ENV=production"
    echo
    echo "=== Optional Environment Variables ==="
    echo "NEXT_PUBLIC_GA_TRACKING_ID=your-ga-tracking-id"
    echo "NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn"
    echo
    echo "You can set these variables using:"
    echo "vercel env add NEXT_PUBLIC_API_URL"
    echo
}

configure_domain() {
    log_info "Domain configuration..."
    
    echo "To configure your custom domain:"
    echo "1. Go to your Vercel dashboard"
    echo "2. Select your project: $PROJECT_NAME"
    echo "3. Go to Settings > Domains"
    echo "4. Add your domain (e.g., app.yourdomain.com)"
    echo "5. Configure DNS records as instructed by Vercel"
    echo
}

display_deployment_info() {
    log_success "Frontend deployment completed!"
    echo
    echo "=== Deployment Information ==="
    echo "Project: $PROJECT_NAME"
    echo "Platform: Vercel"
    echo "Build Command: npm run build"
    echo "Output Directory: .next"
    echo
    echo "=== Next Steps ==="
    echo "1. Configure environment variables in Vercel dashboard"
    echo "2. Set up custom domain if needed"
    echo "3. Test the application"
    echo "4. Monitor deployment logs in Vercel dashboard"
    echo
    echo "=== Useful Commands ==="
    echo "Deploy: vercel --prod"
    echo "Preview: vercel"
    echo "Logs: vercel logs"
    echo "Domains: vercel domains"
    echo "Environment: vercel env ls"
    echo
}

# Main deployment process
main() {
    log_info "Starting Express Auto Bike Management System frontend deployment to Vercel..."
    
    check_requirements
    install_dependencies
    build_application
    
    # Ask user if they want to deploy now
    read -p "Do you want to deploy to Vercel now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        deploy_to_vercel
    else
        log_info "Skipping deployment. You can deploy later with: vercel --prod"
    fi
    
    setup_environment_variables
    configure_domain
    display_deployment_info
    
    log_success "Frontend setup completed!"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "build")
        log_info "Building application..."
        install_dependencies
        build_application
        log_success "Build completed"
        ;;
    "env")
        setup_environment_variables
        ;;
    "domain")
        configure_domain
        ;;
    *)
        echo "Usage: $0 {deploy|build|env|domain}"
        echo "  deploy - Full deployment process (default)"
        echo "  build  - Build application only"
        echo "  env    - Show environment variables setup"
        echo "  domain - Show domain configuration steps"
        exit 1
        ;;
esac