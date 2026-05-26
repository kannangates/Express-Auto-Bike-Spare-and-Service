#!/bin/bash
# Setup Permanent Cloudflare Tunnel (One-Time Setup)
# This creates a FREE permanent tunnel that never changes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

echo "=========================================="
echo "  Permanent Cloudflare Tunnel Setup"
echo "  (FREE - No Credit Card Required)"
echo "=========================================="
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    print_error "cloudflared is not installed!"
    echo ""
    print_info "Installing cloudflared..."
    
    # Detect OS and install
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install cloudflare/cloudflare/cloudflared
        else
            print_error "Homebrew not found. Please install from: https://brew.sh/"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
        sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
        sudo chmod +x /usr/local/bin/cloudflared
    else
        print_error "Unsupported OS. Please install manually from:"
        echo "  https://github.com/cloudflare/cloudflared/releases"
        exit 1
    fi
    
    print_success "cloudflared installed!"
fi

echo ""
print_info "Step 1: Login to Cloudflare"
print_warning "A browser window will open. Login with your Cloudflare account."
echo ""
read -p "Press Enter to continue..."

cloudflared tunnel login

if [ $? -ne 0 ]; then
    print_error "Login failed. Please try again."
    exit 1
fi

print_success "Logged in successfully!"
echo ""

# Ask for tunnel name
print_info "Step 2: Choose a tunnel name"
echo "  This is just for identification (e.g., 'express-auto-bike')"
read -p "Enter tunnel name: " TUNNEL_NAME

if [ -z "$TUNNEL_NAME" ]; then
    TUNNEL_NAME="express-auto-bike"
    print_info "Using default name: $TUNNEL_NAME"
fi

echo ""
print_info "Creating tunnel: $TUNNEL_NAME"
cloudflared tunnel create $TUNNEL_NAME

if [ $? -ne 0 ]; then
    print_error "Failed to create tunnel. It might already exist."
    print_info "Listing existing tunnels..."
    cloudflared tunnel list
    exit 1
fi

print_success "Tunnel created!"
echo ""

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}')
print_info "Tunnel ID: $TUNNEL_ID"
echo ""

# Ask for domain
print_info "Step 3: Choose your domain"
print_warning "You need a domain name. Options:"
echo "  1. Use a free subdomain from Cloudflare (e.g., yourname.pages.dev)"
echo "  2. Use your own domain (must be added to Cloudflare)"
echo "  3. Skip for now (use temporary URL)"
echo ""
read -p "Enter your domain (or press Enter to skip): " DOMAIN

if [ -z "$DOMAIN" ]; then
    print_warning "Skipping domain setup. You can add it later."
    print_info "Your tunnel is ready but not routed to a domain yet."
    echo ""
    print_info "To route it later, run:"
    echo "  cloudflared tunnel route dns $TUNNEL_NAME yourdomain.com"
else
    print_info "Routing tunnel to: $DOMAIN"
    cloudflared tunnel route dns $TUNNEL_NAME $DOMAIN
    
    if [ $? -eq 0 ]; then
        print_success "Domain routed successfully!"
        TUNNEL_URL="https://$DOMAIN"
    else
        print_error "Failed to route domain. You can do this manually later."
        TUNNEL_URL=""
    fi
fi

echo ""
print_info "Step 4: Creating tunnel configuration..."

# Create config directory
mkdir -p ~/.cloudflared

# Create config file
cat > ~/.cloudflared/config.yml <<EOF
tunnel: $TUNNEL_ID
credentials-file: ~/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: ${DOMAIN:-"*"}
    service: http://localhost:3000
  - service: http_status:404
EOF

print_success "Configuration created!"
echo ""

# Update .env file
print_info "Step 5: Updating .env file..."

if [ -f .env ]; then
    # Update DEPLOYMENT_MODE
    if grep -q "^DEPLOYMENT_MODE=" .env; then
        sed -i.bak "s|^DEPLOYMENT_MODE=.*|DEPLOYMENT_MODE=tunnel|" .env
    fi
    
    # Update DEBUG
    if grep -q "^DEBUG=" .env; then
        sed -i.bak "s|^DEBUG=.*|DEBUG=0|" .env
    fi
    
    if [ -n "$TUNNEL_URL" ]; then
        # Update tunnel URLs
        if grep -q "^TUNNEL_FRONTEND_URL=" .env; then
            sed -i.bak "s|^TUNNEL_FRONTEND_URL=.*|TUNNEL_FRONTEND_URL=$TUNNEL_URL|" .env
        else
            echo "TUNNEL_FRONTEND_URL=$TUNNEL_URL" >> .env
        fi
        
        if grep -q "^TUNNEL_BACKEND_URL=" .env; then
            sed -i.bak "s|^TUNNEL_BACKEND_URL=.*|TUNNEL_BACKEND_URL=$TUNNEL_URL|" .env
        else
            echo "TUNNEL_BACKEND_URL=$TUNNEL_URL" >> .env
        fi
    fi
    
    # Add tunnel config
    if ! grep -q "^CLOUDFLARE_TUNNEL_NAME=" .env; then
        echo "CLOUDFLARE_TUNNEL_NAME=$TUNNEL_NAME" >> .env
    fi
    
    rm -f .env.bak
    print_success ".env file updated!"
else
    print_warning ".env file not found. Please create it first."
fi

echo ""
echo "=========================================="
print_success "Permanent Tunnel Setup Complete!"
echo "=========================================="
echo ""

if [ -n "$TUNNEL_URL" ]; then
    print_info "Your permanent URL: $TUNNEL_URL"
    echo ""
    print_info "This URL will NEVER change!"
else
    print_info "Tunnel created but not routed to a domain yet."
    echo ""
    print_info "To add a domain later:"
    echo "  cloudflared tunnel route dns $TUNNEL_NAME yourdomain.com"
fi

echo ""
print_info "Next steps:"
echo "  1. Update Google OAuth with your permanent URL"
echo "  2. Run: ./deploy.sh"
echo "  3. Your app will be accessible at: ${TUNNEL_URL:-'(domain not set yet)'}"
echo ""
print_info "To run tunnel manually:"
echo "  cloudflared tunnel run $TUNNEL_NAME"
echo ""
print_info "Or let Docker manage it (recommended)"
echo ""

print_success "All done! 🎉"
