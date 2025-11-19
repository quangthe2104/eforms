#!/bin/bash

# eForms Deployment Script
# This script automates the deployment process
# Replace eforms.domain.com with your actual domain

set -e  # Exit on error

echo "🚀 Starting eForms deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/var/www/eforms"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
DOMAIN="eforms.domain.com"  # Replace with your actual domain

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Step 1: Pull latest code
echo -e "${YELLOW}📥 Pulling latest code from Git...${NC}"
cd $PROJECT_DIR
git pull origin main

# Step 2: Backend setup
echo -e "${YELLOW}🔧 Setting up backend...${NC}"
cd $BACKEND_DIR

# Install dependencies
composer install --optimize-autoloader --no-dev --no-interaction

# Check if .env exists, if not create from example
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${RED}⚠️  IMPORTANT: Please configure .env file with production settings!${NC}"
    echo -e "${RED}   Edit: $BACKEND_DIR/.env${NC}"
    read -p "Press Enter after configuring .env file..."
fi

# Generate key if not set
if ! grep -q "APP_KEY=base64:" .env; then
    php artisan key:generate
fi

# Run migrations
php artisan migrate --force

# Clear and cache config
php artisan config:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set permissions
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

# Step 3: Frontend setup
echo -e "${YELLOW}🎨 Building frontend...${NC}"
cd $FRONTEND_DIR

# Install dependencies
npm install --production

# Build for production
npm run build

# Step 4: Reload services
echo -e "${YELLOW}🔄 Reloading services...${NC}"
systemctl reload nginx
systemctl reload php8.2-fpm

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Visit: https://$DOMAIN${NC}"

