#!/bin/bash

# ============================================
# eForms Auto Deployment Script
# ============================================
# Script tự động deploy eForms lên server
# Sử dụng: chmod +x deploy.sh && ./deploy.sh
# ============================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - THAY ĐỔI CÁC THÔNG TIN NÀY
DOMAIN="eforms.domain.com"  # Thay bằng domain của bạn
DB_NAME="eforms_production"
DB_USER="eforms_user"
DB_PASS=""  # Sẽ hỏi khi chạy
PROJECT_DIR="/var/www/eforms"  # Đường dẫn project
PHP_VERSION="8.2"

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then 
        print_error "Vui lòng chạy script với quyền root (sudo ./deploy.sh)"
        exit 1
    fi
}

# Check if project directory exists
check_project_dir() {
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "Thư mục project không tồn tại: $PROJECT_DIR"
        print_info "Vui lòng clone code trước: git clone https://github.com/quangthe2104/eforms.git $PROJECT_DIR"
        exit 1
    fi
}

# Get database password
get_db_password() {
    if [ -z "$DB_PASS" ]; then
        echo -n "Nhập password cho database user '$DB_USER': "
        read -s DB_PASS
        echo ""
    fi
}

# Step 1: Install dependencies
step_install_dependencies() {
    print_header "Bước 1: Cài đặt dependencies"
    
    cd "$PROJECT_DIR/backend"
    print_info "Đang cài đặt Composer dependencies..."
    composer install --optimize-autoloader --no-dev --no-interaction
    print_success "Đã cài đặt Composer dependencies"
    
    cd "$PROJECT_DIR/frontend"
    print_info "Đang cài đặt NPM dependencies..."
    npm install --production
    print_success "Đã cài đặt NPM dependencies"
}

# Step 2: Setup backend .env
step_setup_backend_env() {
    print_header "Bước 2: Cấu hình Backend .env"
    
    cd "$PROJECT_DIR/backend"
    
    if [ ! -f .env ]; then
        print_info "Tạo file .env từ .env.example..."
        cp .env.example .env
        print_success "Đã tạo file .env"
    else
        print_warning "File .env đã tồn tại, bỏ qua..."
    fi
    
    # Update .env with production values
    print_info "Cập nhật .env với thông tin production..."
    
    sed -i "s|APP_ENV=.*|APP_ENV=production|g" .env
    sed -i "s|APP_DEBUG=.*|APP_DEBUG=false|g" .env
    sed -i "s|APP_URL=.*|APP_URL=https://$DOMAIN|g" .env
    
    sed -i "s|DB_DATABASE=.*|DB_DATABASE=$DB_NAME|g" .env
    sed -i "s|DB_USERNAME=.*|DB_USERNAME=$DB_USER|g" .env
    sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=$DB_PASS|g" .env
    
    # Extract domain without subdomain for SESSION_DOMAIN
    DOMAIN_BASE=$(echo $DOMAIN | sed 's/^[^.]*\.//')
    sed -i "s|SESSION_DOMAIN=.*|SESSION_DOMAIN=.$DOMAIN_BASE|g" .env
    sed -i "s|SESSION_SECURE_COOKIE=.*|SESSION_SECURE_COOKIE=true|g" .env
    
    sed -i "s|SANCTUM_STATEFUL_DOMAINS=.*|SANCTUM_STATEFUL_DOMAINS=$DOMAIN|g" .env
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|g" .env
    
    print_success "Đã cập nhật .env"
    print_warning "Vui lòng kiểm tra lại file .env: $PROJECT_DIR/backend/.env"
}

# Step 3: Setup frontend .env
step_setup_frontend_env() {
    print_header "Bước 3: Cấu hình Frontend .env"
    
    cd "$PROJECT_DIR/frontend"
    
    if [ ! -f .env ]; then
        print_info "Tạo file .env..."
        cat > .env << EOF
VITE_API_URL=https://$DOMAIN/api
VITE_FRONTEND_URL=https://$DOMAIN
EOF
        print_success "Đã tạo file .env"
    else
        print_warning "File .env đã tồn tại, cập nhật..."
        sed -i "s|VITE_API_URL=.*|VITE_API_URL=https://$DOMAIN/api|g" .env
        sed -i "s|VITE_FRONTEND_URL=.*|VITE_FRONTEND_URL=https://$DOMAIN|g" .env
        print_success "Đã cập nhật .env"
    fi
}

# Step 4: Setup database
step_setup_database() {
    print_header "Bước 4: Tạo Database"
    
    print_info "Tạo database và user..."
    
    mysql -u root -p <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF
    
    print_success "Đã tạo database: $DB_NAME"
}

# Step 5: Laravel setup
step_laravel_setup() {
    print_header "Bước 5: Cấu hình Laravel"
    
    cd "$PROJECT_DIR/backend"
    
    # Generate key if not set
    if ! grep -q "APP_KEY=base64:" .env; then
        print_info "Generate application key..."
        php artisan key:generate --force
        print_success "Đã generate key"
    else
        print_warning "APP_KEY đã có, bỏ qua..."
    fi
    
    # Run migrations
    print_info "Chạy migrations..."
    php artisan migrate --force
    print_success "Đã chạy migrations"
    
    # Create storage link
    print_info "Tạo storage link..."
    php artisan storage:link
    print_success "Đã tạo storage link"
    
    # Create thumbnails directory
    print_info "Tạo thư mục thumbnails..."
    mkdir -p ../storage/thumbnails
    print_success "Đã tạo thư mục thumbnails"
    
    # Cache config
    print_info "Cache config, routes, views..."
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    print_success "Đã cache config"
}

# Step 6: Build frontend
step_build_frontend() {
    print_header "Bước 6: Build Frontend"
    
    cd "$PROJECT_DIR/frontend"
    
    print_info "Đang build frontend (có thể mất vài phút)..."
    npm run build
    print_success "Đã build frontend thành công"
}

# Step 7: Set permissions
step_set_permissions() {
    print_header "Bước 7: Set Permissions"
    
    print_info "Đang set permissions..."
    chown -R www-data:www-data "$PROJECT_DIR"
    chmod -R 775 "$PROJECT_DIR/backend/storage"
    chmod -R 775 "$PROJECT_DIR/backend/bootstrap/cache"
    chmod -R 775 "$PROJECT_DIR/storage"
    print_success "Đã set permissions"
}

# Step 8: Create Nginx config
step_create_nginx_config() {
    print_header "Bước 8: Tạo Nginx Configuration"
    
    NGINX_CONFIG="/etc/nginx/sites-available/eforms"
    
    # Extract domain base for SSL path
    DOMAIN_BASE=$(echo $DOMAIN | sed 's/^[^.]*\.//')
    
    print_info "Tạo file Nginx config..."
    
    cat > "$NGINX_CONFIG" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    root $PROJECT_DIR/frontend/dist;
    
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    index index.html;
    
    # Frontend - serve static files
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Backend API
    location /api {
        alias $PROJECT_DIR/backend/public;
        try_files \$uri \$uri/ @api;
        
        location ~ \.php\$ {
            include fastcgi_params;
            fastcgi_pass unix:/var/run/php/php${PHP_VERSION}-fpm.sock;
            fastcgi_param SCRIPT_FILENAME $PROJECT_DIR/backend/public/index.php;
        }
    }
    
    location @api {
        rewrite /api/(.*)\$ /api/index.php?/\$1 last;
    }
    
    # Sanctum CSRF cookie
    location /sanctum/csrf-cookie {
        alias $PROJECT_DIR/backend/public;
        try_files \$uri @sanctum;
        
        location ~ \.php\$ {
            include fastcgi_params;
            fastcgi_pass unix:/var/run/php/php${PHP_VERSION}-fpm.sock;
            fastcgi_param SCRIPT_FILENAME $PROJECT_DIR/backend/public/index.php;
        }
    }
    
    location @sanctum {
        rewrite ^(.*)\$ /index.php?/\$1 last;
    }
    
    # Storage files (thumbnails, uploads)
    location /storage {
        alias $PROJECT_DIR/storage;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Disable access to hidden files
    location ~ /\. {
        deny all;
    }
}
EOF
    
    print_success "Đã tạo Nginx config: $NGINX_CONFIG"
    
    # Enable site
    if [ ! -L "/etc/nginx/sites-enabled/eforms" ]; then
        print_info "Enable Nginx site..."
        ln -s "$NGINX_CONFIG" /etc/nginx/sites-enabled/
        print_success "Đã enable site"
    else
        print_warning "Site đã được enable"
    fi
    
    # Test Nginx config
    print_info "Test Nginx configuration..."
    if nginx -t; then
        print_success "Nginx config hợp lệ"
        print_info "Reload Nginx..."
        systemctl reload nginx
        print_success "Đã reload Nginx"
    else
        print_error "Nginx config có lỗi, vui lòng kiểm tra lại"
        exit 1
    fi
}

# Step 9: SSL Certificate
step_ssl_certificate() {
    print_header "Bước 9: Cài đặt SSL Certificate"
    
    if command -v certbot &> /dev/null; then
        print_info "Certbot đã được cài đặt"
    else
        print_info "Đang cài đặt Certbot..."
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
        print_success "Đã cài đặt Certbot"
    fi
    
    print_warning "Bạn có muốn cài đặt SSL certificate ngay bây giờ? (y/n)"
    read -p "Nhập lựa chọn: " install_ssl
    
    if [ "$install_ssl" = "y" ] || [ "$install_ssl" = "Y" ]; then
        print_info "Đang lấy SSL certificate cho $DOMAIN..."
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect
        print_success "Đã cài đặt SSL certificate"
    else
        print_warning "Bỏ qua cài đặt SSL. Bạn có thể chạy sau:"
        print_info "certbot --nginx -d $DOMAIN"
    fi
}

# Main execution
main() {
    print_header "🚀 eForms Auto Deployment Script"
    
    print_info "Domain: $DOMAIN"
    print_info "Database: $DB_NAME"
    print_info "Project Directory: $PROJECT_DIR"
    echo ""
    
    # Confirm before proceeding
    print_warning "Bạn có chắc chắn muốn tiếp tục? (y/n)"
    read -p "Nhập lựa chọn: " confirm
    
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        print_info "Đã hủy deployment"
        exit 0
    fi
    
    # Get database password
    get_db_password
    
    # Run steps
    check_root
    check_project_dir
    
    step_install_dependencies
    step_setup_backend_env
    step_setup_frontend_env
    step_setup_database
    step_laravel_setup
    step_build_frontend
    step_set_permissions
    step_create_nginx_config
    step_ssl_certificate
    
    # Final message
    print_header "✅ Deployment hoàn tất!"
    print_success "eForms đã được deploy thành công!"
    print_info "Truy cập: https://$DOMAIN"
    echo ""
    print_warning "Lưu ý:"
    echo "  - Kiểm tra lại file .env nếu cần"
    echo "  - Nếu chưa cài SSL, chạy: certbot --nginx -d $DOMAIN"
    echo "  - Kiểm tra logs: tail -f $PROJECT_DIR/backend/storage/logs/laravel.log"
    echo ""
}

# Run main function
main

