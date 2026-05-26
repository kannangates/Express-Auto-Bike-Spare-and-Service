#!/bin/bash
# Simple Permanent Cloudflare Tunnel Setup (No Domain Required)
# Creates a tunnel with a permanent cfargotunnel.com URL

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
echo "  Simple Cloudflare Tunnel Setup"
echo "  (No Domain Required - FREE)"
echo "=========================================="
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    print_error "cloudflared is not installed!"
    echo ""
    print_info "Installing cloudflared..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install cloudflare/cloudflare/cloudflared
        else
            print_error "Homebrew not found. Install from: https://brew.sh/"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
        sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
        sudo chmod +x /usr/local/bin/cloudflared
    else
        print_error "Unsupported OS. Install manually from:"
        echo "  https://github.com/cloudflare/cloudflared/releases"
        exit 1
    fi
    
    print_success "cloudflared installed!"
fi

echo ""
print_info "Step 1: Login to Cloudflare"
print_warning "A browser will open. Just click 'Authorize' - no domain needed!"
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
echo "  Examples: expressbikespare-test, test-shop, my-tunnel"
read -p "Enter tunnel name: " TUNNEL_NAME

if [ -z "$TUNNEL_NAME" ]; then
    TUNNEL_NAME="expressbikespare-test"
    print_info "Using default name: $TUNNEL_NAME"
fi

echo ""
print_info "Creating tunnel: $TUNNEL_NAME"
cloudflared tunnel create $TUNNEL_NAME

if [ $? -ne 0 ]; then
    print_error "Failed to create tunnel."
    print_info "Listing existing tunnels..."
    cloudflared tunnel list
    echo ""
    print_info "If tunnel already exists, you can delete it:"
    echo "  cloudflared tunnel delete $TUNNEL_NAME"
    exit 1
fi

print_success "Tunnel created!"
echo ""

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}')
print_info "Tunnel ID: $TUNNEL_ID"
echo ""

# Create config directory
print_info "Step 3: Creating configuration..."
mkdir -p ~/.cloudflared

# Create config file (no domain needed)
cat > ~/.cloudflared/config.yml <<EOF
tunnel: $TUNNEL_ID
credentials-file: ~/.cloudflared/$TUNNEL_ID.json

ingress:
  - service: http://localhost:3000
EOF

print_success "Configuration created!"
echo ""

# The tunnel URL will be: https://<tunnel-id>.cfargotunnel.com
TUNNEL_URL="https://${TUNNEL_ID}.cfargotunnel.com"

print_info "Step 4: Updating .env file..."

if [ -f .env ]; then
    # Update DEPLOYMENT_MODE
    if grep -q "^DEPLOYMENT_MODE=" .env; then
        sed -i.bak "s|^DEPLOYMENT_MODE=.*|DEPLOYMENT_MODE=tunnel|" .env
    fi
    
    # Update DEBUG
    if grep -q "^DEBUG=" .env; then
        sed -i.bak "s|^DEBUG=.*|DEBUG=0|" .env
    fi
    
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
    
    # Add tunnel config
    if grep -q "^CLOUDFLARE_TUNNEL_NAME=" .env; then
        sed -i.bak "s|^CLOUDFLARE_TUNNEL_NAME=.*|CLOUDFLARE_TUNNEL_NAME=$TUNNEL_NAME|" .env
    else
        echo "CLOUDFLARE_TUNNEL_NAME=$TUNNEL_NAME" >> .env
    fi
    
    rm -f .env.bak
    print_success ".env file updated!"
else
    print_warning ".env file not found. Please create it first."
fi

echo ""
echo "=========================================="
print_success "Tunnel Setup Complete!"
echo "=========================================="
echo ""
print_success "Your permanent URL: $TUNNEL_URL"
echo ""
print_info "This URL will NEVER change!"
echo ""
print_info "Next steps:"
echo "  1. Update Google OAuth with: $TUNNEL_URL"
echo "  2. Run: ./deploy.sh"
echo "  3. Access your app at: $TUNNEL_URL"
echo ""
print_info "Tunnel name: $TUNNEL_NAME"
print_info "Tunnel ID: $TUNNEL_ID"
echo ""
print_success "All done! 🎉"
