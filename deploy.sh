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
DOMAIN="ksxh.vn"  # Thay bằng domain của bạn
DB_NAME="ksxh_eforms"
DB_USER="ksxh_eforms"
DB_PASS=""  # Sẽ hỏi khi chạy
PROJECT_DIR="/home/ksxh/public_html"  # Đường dẫn project
PHP_VERSION="8.3"

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
    npm install
    print_success "Đã cài đặt NPM dependencies"
}

# Step 2: Setup backend .env
step_setup_backend_env() {
    print_header "Bước 2: Cấu hình Backend .env"
    
    cd "$PROJECT_DIR/backend"
    
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            print_info "Tạo file .env từ .env.example..."
            cp .env.example .env
            print_success "Đã tạo file .env"
        else
            print_warning ".env.example không tồn tại, tạo file .env mới..."
            # Extract domain base for SESSION_DOMAIN
            DOMAIN_BASE=$(echo $DOMAIN | sed 's/^[^.]*\.//')
            
            # Tạo file .env mới với các giá trị mặc định
            cat > .env << EOF
APP_NAME=eForms
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://$DOMAIN

LOG_CHANNEL=stack
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=$DB_NAME
DB_USERNAME=$DB_USER
DB_PASSWORD=$DB_PASS

BROADCAST_DRIVER=log
CACHE_DRIVER=file
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync
SESSION_DRIVER=file
SESSION_LIFETIME=120

MEMCACHED_HOST=127.0.0.1

REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_HOST=mailpit
MAIL_PORT=1025
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="\${APP_NAME}"

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

VITE_APP_NAME="\${APP_NAME}"

SANCTUM_STATEFUL_DOMAINS=$DOMAIN
SESSION_DOMAIN=.$DOMAIN_BASE
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax

FRONTEND_URL=https://$DOMAIN
EOF
            print_success "Đã tạo file .env mới"
        fi
    else
        print_warning "File .env đã tồn tại, cập nhật các giá trị..."
    fi
    
    # Update .env with production values (in case file already exists)
    print_info "Cập nhật .env với thông tin production..."
    
    sed -i "s|APP_ENV=.*|APP_ENV=production|g" .env
    sed -i "s|APP_DEBUG=.*|APP_DEBUG=false|g" .env
    sed -i "s|APP_URL=.*|APP_URL=https://$DOMAIN|g" .env
    
    sed -i "s|DB_DATABASE=.*|DB_DATABASE=$DB_NAME|g" .env
    sed -i "s|DB_USERNAME=.*|DB_USERNAME=$DB_USER|g" .env
    # Escape special characters in password for sed
    ESCAPED_PASS=$(printf '%s\n' "$DB_PASS" | sed 's/[[\.*^$()+?{|]/\\&/g')
    sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=$ESCAPED_PASS|g" .env
    
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
    print_header "Bước 4: Kiểm tra Database"
    
    # Check if database already exists using the provided credentials
    print_info "Kiểm tra database đã tồn tại..."
    
    # Try to connect to database with provided credentials
    if mysql -u "$DB_USER" -p"$DB_PASS" -h 127.0.0.1 -e "USE $DB_NAME;" 2>/dev/null; then
        print_success "Database '$DB_NAME' đã tồn tại và user '$DB_USER' đã có quyền truy cập"
        print_info "Bỏ qua bước tạo database"
        return 0
    fi
    
    # Database doesn't exist or user doesn't have access
    print_warning "Database chưa tồn tại hoặc user chưa có quyền truy cập"
    print_info "Bạn có muốn tạo database ngay bây giờ? (y/n)"
    read -p "Nhập lựa chọn: " create_db
    
    if [ "$create_db" != "y" ] && [ "$create_db" != "Y" ]; then
        print_info "Bỏ qua tạo database. Vui lòng tạo database thủ công:"
        print_info "  CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        print_info "  CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';"
        print_info "  GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
        print_info "  FLUSH PRIVILEGES;"
        return 0
    fi
    
    # Try to create database (will prompt for root password)
    print_info "Cần password MySQL root để tạo database..."
    mysql -u root -p <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF
    
    if [ $? -eq 0 ]; then
        print_success "Đã tạo database: $DB_NAME"
    else
        print_error "Không thể tạo database. Vui lòng tạo thủ công."
    fi
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
    
    # Test database connection before migrations
    print_info "Kiểm tra kết nối database..."
    
    # Read database config from .env
    DB_HOST_ENV=$(grep "^DB_HOST=" .env | cut -d'=' -f2 | tr -d ' ')
    DB_PORT_ENV=$(grep "^DB_PORT=" .env | cut -d'=' -f2 | tr -d ' ')
    DB_DATABASE_ENV=$(grep "^DB_DATABASE=" .env | cut -d'=' -f2 | tr -d ' ')
    DB_USERNAME_ENV=$(grep "^DB_USERNAME=" .env | cut -d'=' -f2 | tr -d ' ')
    DB_PASSWORD_ENV=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2- | tr -d ' ')
    
    # Test connection with mysql command
    if mysql -u "$DB_USERNAME_ENV" -p"$DB_PASSWORD_ENV" -h "${DB_HOST_ENV:-127.0.0.1}" -P "${DB_PORT_ENV:-3306}" -e "USE $DB_DATABASE_ENV;" 2>/dev/null; then
        print_success "Kết nối database thành công"
    else
        print_error "Không thể kết nối database!"
        print_warning "Vui lòng kiểm tra lại thông tin trong file .env:"
        print_info "  DB_HOST=$DB_HOST_ENV"
        print_info "  DB_DATABASE=$DB_DATABASE_ENV"
        print_info "  DB_USERNAME=$DB_USERNAME_ENV"
        print_warning "Kiểm tra password có đúng không bằng lệnh:"
        print_info "  mysql -u $DB_USERNAME_ENV -p -h ${DB_HOST_ENV:-127.0.0.1} -e 'USE $DB_DATABASE_ENV;'"
        print_warning "Nếu vẫn lỗi, vui lòng kiểm tra lại password trong file .env"
        exit 1
    fi
    
    # Run migrations
    print_info "Chạy migrations..."
    php artisan migrate --force
    if [ $? -eq 0 ]; then
        print_success "Đã chạy migrations"
    else
        print_error "Lỗi khi chạy migrations. Vui lòng kiểm tra lại thông tin database trong .env"
        exit 1
    fi
    
    # Create storage link
    print_info "Tạo storage link..."
    php artisan storage:link
    print_success "Đã tạo storage link"
    
    # Create thumbnails directory
    print_info "Tạo thư mục thumbnails..."
    mkdir -p ../storage/thumbnails
    print_success "Đã tạo thư mục thumbnails"
    
    # Cache config
    print_info "Cache config, routes..."
    php artisan config:cache
    php artisan route:cache
    
    # Only cache views if resources/views directory exists
    if [ -d "resources/views" ] && [ "$(ls -A resources/views 2>/dev/null)" ]; then
        print_info "Cache views..."
        php artisan view:cache
        print_success "Đã cache views"
    else
        print_warning "Thư mục resources/views không tồn tại, bỏ qua cache views (API-only app)"
    fi
    
    print_success "Đã cache config và routes"
}

# Step 6: Build frontend
step_build_frontend() {
    print_header "Bước 6: Build Frontend"
    
    cd "$PROJECT_DIR/frontend"
    
    # Check if node_modules exists and vite is installed
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/vite" ]; then
        print_warning "Vite chưa được cài đặt, đang cài đặt dependencies..."
        npm install
    fi
    
    print_info "Đang build frontend (có thể mất vài phút)..."
    npm run build
    
    if [ $? -eq 0 ]; then
        print_success "Đã build frontend thành công"
    else
        print_error "Lỗi khi build frontend. Vui lòng kiểm tra lại."
        exit 1
    fi
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

