#!/bin/bash

# ============================================
# Script kiểm tra và cài đặt phần mềm cần thiết
# Cho eForms Deployment
# ============================================
# Sử dụng: chmod +x check-and-install-requirements.sh && sudo ./check-and-install-requirements.sh
# ============================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PHP_VERSION="8.2"
NODE_VERSION="18"
REQUIRED_PHP_EXTENSIONS=(
    "bcmath"
    "ctype"
    "curl"
    "fileinfo"
    "json"
    "mbstring"
    "openssl"
    "pdo"
    "pdo_mysql"
    "tokenizer"
    "xml"
    "zip"
    "gd"
    "exif"
)

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
        print_error "Vui lòng chạy script với quyền root (sudo ./check-and-install-requirements.sh)"
        exit 1
    fi
}

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
        
        # Handle CentOS/RHEL variations
        if [ "$OS" = "rhel" ] || [ "$ID_LIKE" = "rhel" ] || [ "$ID_LIKE" = "centos" ]; then
            if [ -f /etc/centos-release ]; then
                OS="centos"
            else
                OS="rhel"
            fi
        fi
        
        print_info "Phát hiện hệ điều hành: $OS $OS_VERSION"
    else
        print_error "Không thể phát hiện hệ điều hành"
        exit 1
    fi
}

# Update package list
update_packages() {
    print_info "Đang cập nhật danh sách packages..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt-get update -qq
        print_success "Đã cập nhật packages"
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        if command -v dnf &> /dev/null; then
            dnf check-update -q || true
            print_success "Đã cập nhật packages"
        else
            yum check-update -q || true
            print_success "Đã cập nhật packages"
        fi
    else
        print_error "Hệ điều hành không được hỗ trợ. Chỉ hỗ trợ Ubuntu/Debian/CentOS/RHEL/Fedora"
        exit 1
    fi
}

# Check and install PHP
check_install_php() {
    print_header "Kiểm tra PHP $PHP_VERSION+"
    
    if command -v php &> /dev/null; then
        PHP_CURRENT_VERSION=$(php -r 'echo PHP_VERSION;' | cut -d. -f1,2)
        PHP_MAJOR=$(echo $PHP_CURRENT_VERSION | cut -d. -f1)
        PHP_MINOR=$(echo $PHP_CURRENT_VERSION | cut -d. -f2)
        REQUIRED_MAJOR=$(echo $PHP_VERSION | cut -d. -f1)
        REQUIRED_MINOR=$(echo $PHP_VERSION | cut -d. -f2)
        
        if [ "$PHP_MAJOR" -gt "$REQUIRED_MAJOR" ] || ([ "$PHP_MAJOR" -eq "$REQUIRED_MAJOR" ] && [ "$PHP_MINOR" -ge "$REQUIRED_MINOR" ]); then
            print_success "PHP $PHP_CURRENT_VERSION đã được cài đặt"
        else
            print_warning "PHP $PHP_CURRENT_VERSION đã cài nhưng cần PHP $PHP_VERSION+"
            install_php
        fi
    else
        print_warning "PHP chưa được cài đặt"
        install_php
    fi
    
    # Check PHP extensions
    print_info "Kiểm tra PHP extensions..."
    MISSING_EXTENSIONS=()
    
    for ext in "${REQUIRED_PHP_EXTENSIONS[@]}"; do
        if php -m | grep -qi "^$ext$"; then
            print_success "Extension $ext đã được cài đặt"
        else
            print_warning "Extension $ext chưa được cài đặt"
            MISSING_EXTENSIONS+=("$ext")
        fi
    done
    
    if [ ${#MISSING_EXTENSIONS[@]} -gt 0 ]; then
        print_info "Đang cài đặt các extensions còn thiếu..."
        install_php_extensions
    fi
}

install_php() {
    print_info "Đang cài đặt PHP $PHP_VERSION..."
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        # Add PHP repository
        apt-get install -y software-properties-common
        add-apt-repository -y ppa:ondrej/php
        apt-get update -qq
        
        # Install PHP and common extensions
        apt-get install -y \
            php${PHP_VERSION} \
            php${PHP_VERSION}-fpm \
            php${PHP_VERSION}-cli \
            php${PHP_VERSION}-common \
            php${PHP_VERSION}-mysql \
            php${PHP_VERSION}-zip \
            php${PHP_VERSION}-gd \
            php${PHP_VERSION}-mbstring \
            php${PHP_VERSION}-curl \
            php${PHP_VERSION}-xml \
            php${PHP_VERSION}-bcmath \
            php${PHP_VERSION}-exif
        
        print_success "Đã cài đặt PHP $PHP_VERSION"
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        # Install EPEL and Remi repository for PHP 8.2
        yum install -y epel-release
        yum install -y https://rpms.remirepo.net/enterprise/remi-release-7.rpm
        
        # Enable PHP 8.2
        yum install -y yum-utils
        yum-config-manager --enable remi-php82
        
        # Install PHP and extensions
        yum install -y php php-fpm php-cli php-common php-mysqlnd \
            php-zip php-gd php-mbstring php-curl php-xml \
            php-bcmath php-fileinfo php-exif
        
        print_success "Đã cài đặt PHP $PHP_VERSION"
    elif [ "$OS" = "fedora" ]; then
        dnf install -y php php-fpm php-cli php-common php-mysqlnd \
            php-zip php-gd php-mbstring php-curl php-xml \
            php-bcmath php-fileinfo php-exif
        
        print_success "Đã cài đặt PHP"
    fi
}

install_php_extensions() {
    for ext in "${MISSING_EXTENSIONS[@]}"; do
        print_info "Đang cài đặt php${PHP_VERSION}-${ext}..."
        if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
            # Try to install the extension
            if apt-get install -y php${PHP_VERSION}-${ext} 2>/dev/null; then
                print_success "Đã cài đặt php${PHP_VERSION}-${ext}"
            else
                # Check if extension is already available (might be included in another package)
                if php -m | grep -qi "^$ext$"; then
                    print_success "Extension $ext đã có sẵn (được bao gồm trong package khác)"
                else
                    # For exif, it's often included in gd, so just warn
                    if [ "$ext" = "exif" ]; then
                        print_warning "Extension exif không thể cài đặt riêng, có thể đã được bao gồm trong php-gd"
                    else
                        print_warning "Không thể cài đặt php${PHP_VERSION}-${ext}"
                    fi
                fi
            fi
        elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
            # Map extension names for CentOS/RHEL
            case $ext in
                "pdo_mysql")
                    if command -v yum &> /dev/null; then
                        yum install -y php-mysqlnd 2>/dev/null || print_warning "Không thể cài đặt php-mysqlnd"
                    else
                        dnf install -y php-mysqlnd 2>/dev/null || print_warning "Không thể cài đặt php-mysqlnd"
                    fi
                    ;;
                *)
                    if command -v yum &> /dev/null; then
                        yum install -y php-${ext} 2>/dev/null || print_warning "Không thể cài đặt php-${ext}"
                    else
                        dnf install -y php-${ext} 2>/dev/null || print_warning "Không thể cài đặt php-${ext}"
                    fi
                    ;;
            esac
        fi
    done
    print_success "Đã hoàn tất cài đặt PHP extensions"
}

# Check and install Composer
check_install_composer() {
    print_header "Kiểm tra Composer"
    
    if command -v composer &> /dev/null; then
        COMPOSER_VERSION=$(composer --version | head -n1)
        print_success "Composer đã được cài đặt: $COMPOSER_VERSION"
    else
        print_warning "Composer chưa được cài đặt"
        install_composer
    fi
}

install_composer() {
    print_info "Đang cài đặt Composer..."
    
    cd /tmp
    
    # Try to download using curl first, then wget, then php copy
    if command -v curl &> /dev/null; then
        print_info "Đang tải Composer bằng curl..."
        curl -sS https://getcomposer.org/installer -o composer-setup.php
    elif command -v wget &> /dev/null; then
        print_info "Đang tải Composer bằng wget..."
        wget -q https://getcomposer.org/installer -O composer-setup.php
    else
        print_info "Đang tải Composer bằng PHP..."
        php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
    fi
    
    # Check if file was downloaded
    if [ ! -f composer-setup.php ]; then
        print_error "Không thể tải Composer installer. Vui lòng kiểm tra kết nối internet."
        exit 1
    fi
    
    # Install Composer
    php composer-setup.php --install-dir=/usr/local/bin --filename=composer
    
    # Clean up
    rm -f composer-setup.php
    
    # Verify installation
    if command -v composer &> /dev/null; then
        print_success "Đã cài đặt Composer thành công"
    else
        print_error "Cài đặt Composer thất bại"
        exit 1
    fi
}

# Check and install Node.js and npm
check_install_nodejs() {
    print_header "Kiểm tra Node.js $NODE_VERSION+ và npm"
    
    if command -v node &> /dev/null; then
        NODE_CURRENT_VERSION=$(node -v | cut -d'v' -f2 | cut -d. -f1)
        if [ "$NODE_CURRENT_VERSION" -ge "$NODE_VERSION" ]; then
            print_success "Node.js $(node -v) đã được cài đặt"
        else
            print_warning "Node.js $(node -v) đã cài nhưng cần Node.js $NODE_VERSION+"
            install_nodejs
        fi
    else
        print_warning "Node.js chưa được cài đặt"
        install_nodejs
    fi
    
    if command -v npm &> /dev/null; then
        print_success "npm $(npm -v) đã được cài đặt"
    else
        print_warning "npm chưa được cài đặt"
        install_nodejs
    fi
}

install_nodejs() {
    print_info "Đang cài đặt Node.js $NODE_VERSION và npm..."
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
        apt-get install -y nodejs
        
        # Verify installation
        if command -v node &> /dev/null && command -v npm &> /dev/null; then
            print_success "Đã cài đặt Node.js $(node -v) và npm $(npm -v)"
        else
            print_error "Cài đặt Node.js/npm thất bại"
            exit 1
        fi
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        # Install Node.js from NodeSource
        curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
        
        if command -v yum &> /dev/null; then
            yum install -y nodejs
        else
            dnf install -y nodejs
        fi
        
        # Verify installation
        if command -v node &> /dev/null && command -v npm &> /dev/null; then
            print_success "Đã cài đặt Node.js $(node -v) và npm $(npm -v)"
        else
            print_error "Cài đặt Node.js/npm thất bại"
            exit 1
        fi
    fi
}

# Check and install MySQL
check_install_mysql() {
    print_header "Kiểm tra MySQL"
    
    if command -v mysql &> /dev/null; then
        MYSQL_VERSION=$(mysql --version | awk '{print $5}' | cut -d',' -f1)
        print_success "MySQL đã được cài đặt: $MYSQL_VERSION"
        
        # Check if MySQL service is running
        if systemctl is-active --quiet mysql || systemctl is-active --quiet mysqld; then
            print_success "MySQL service đang chạy"
        else
            print_warning "MySQL service chưa chạy, đang khởi động..."
            systemctl start mysql 2>/dev/null || systemctl start mysqld
            systemctl enable mysql 2>/dev/null || systemctl enable mysqld
            print_success "Đã khởi động MySQL service"
        fi
    else
        print_warning "MySQL chưa được cài đặt"
        install_mysql
    fi
}

install_mysql() {
    print_info "Đang cài đặt MySQL..."
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        # Set MySQL root password non-interactively
        debconf-set-selections <<< "mysql-server mysql-server/root_password password temp_root_pass"
        debconf-set-selections <<< "mysql-server mysql-server/root_password_again password temp_root_pass"
        
        apt-get install -y mysql-server
        
        # Start and enable MySQL
        systemctl start mysql
        systemctl enable mysql
        
        print_success "Đã cài đặt MySQL"
        print_warning "⚠️  QUAN TRỌNG: Vui lòng đổi password root MySQL bằng lệnh:"
        print_info "   sudo mysql_secure_installation"
        print_info "   hoặc: sudo mysql -u root -p"
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        # CentOS/RHEL thường dùng MariaDB (tương thích MySQL)
        if command -v yum &> /dev/null; then
            yum install -y mariadb-server mariadb
        else
            dnf install -y mariadb-server mariadb
        fi
        
        # Start and enable MariaDB
        systemctl start mariadb
        systemctl enable mariadb
        
        print_success "Đã cài đặt MariaDB (tương thích MySQL)"
        print_warning "⚠️  QUAN TRỌNG: Vui lòng đổi password root MySQL bằng lệnh:"
        print_info "   sudo mysql_secure_installation"
        print_info "   hoặc: sudo mysql -u root -p"
    fi
}

# Check and install Nginx
check_install_nginx() {
    print_header "Kiểm tra Nginx"
    
    if command -v nginx &> /dev/null; then
        NGINX_VERSION=$(nginx -v 2>&1 | cut -d'/' -f2)
        print_success "Nginx đã được cài đặt: $NGINX_VERSION"
        
        # Check if Nginx service is running
        if systemctl is-active --quiet nginx; then
            print_success "Nginx service đang chạy"
        else
            print_warning "Nginx service chưa chạy, đang khởi động..."
            systemctl start nginx
            systemctl enable nginx
            print_success "Đã khởi động Nginx service"
        fi
    else
        print_warning "Nginx chưa được cài đặt"
        install_nginx
    fi
}

install_nginx() {
    print_info "Đang cài đặt Nginx..."
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt-get install -y nginx
        
        # Start and enable Nginx
        systemctl start nginx
        systemctl enable nginx
        
        print_success "Đã cài đặt Nginx"
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        if command -v yum &> /dev/null; then
            yum install -y nginx
        else
            dnf install -y nginx
        fi
        
        # Start and enable Nginx
        systemctl start nginx
        systemctl enable nginx
        
        print_success "Đã cài đặt Nginx"
    fi
}

# Check and install Certbot
check_install_certbot() {
    print_header "Kiểm tra Certbot"
    
    if command -v certbot &> /dev/null; then
        CERTBOT_VERSION=$(certbot --version | awk '{print $2}')
        print_success "Certbot đã được cài đặt: $CERTBOT_VERSION"
    else
        print_warning "Certbot chưa được cài đặt"
        install_certbot
    fi
}

install_certbot() {
    print_info "Đang cài đặt Certbot..."
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt-get install -y certbot python3-certbot-nginx
        print_success "Đã cài đặt Certbot"
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
        # Install EPEL first (if not already installed)
        if command -v yum &> /dev/null; then
            yum install -y epel-release
            yum install -y certbot python3-certbot-nginx
        else
            dnf install -y epel-release
            dnf install -y certbot python3-certbot-nginx
        fi
        print_success "Đã cài đặt Certbot"
    fi
}

# Summary
print_summary() {
    print_header "📋 Tóm tắt kiểm tra"
    
    echo ""
    echo -e "${BLUE}Các phần mềm đã được kiểm tra và cài đặt:${NC}"
    echo ""
    
    # PHP
    if command -v php &> /dev/null; then
        echo -e "${GREEN}✓${NC} PHP $(php -r 'echo PHP_VERSION;')"
    else
        echo -e "${RED}✗${NC} PHP"
    fi
    
    # Composer
    if command -v composer &> /dev/null; then
        echo -e "${GREEN}✓${NC} Composer $(composer --version | head -n1 | awk '{print $3}')"
    else
        echo -e "${RED}✗${NC} Composer"
    fi
    
    # Node.js
    if command -v node &> /dev/null; then
        echo -e "${GREEN}✓${NC} Node.js $(node -v)"
    else
        echo -e "${RED}✗${NC} Node.js"
    fi
    
    # npm
    if command -v npm &> /dev/null; then
        echo -e "${GREEN}✓${NC} npm $(npm -v)"
    else
        echo -e "${RED}✗${NC} npm"
    fi
    
    # MySQL
    if command -v mysql &> /dev/null; then
        echo -e "${GREEN}✓${NC} MySQL $(mysql --version | awk '{print $5}' | cut -d',' -f1)"
    else
        echo -e "${RED}✗${NC} MySQL"
    fi
    
    # Nginx
    if command -v nginx &> /dev/null; then
        echo -e "${GREEN}✓${NC} Nginx $(nginx -v 2>&1 | cut -d'/' -f2)"
    else
        echo -e "${RED}✗${NC} Nginx"
    fi
    
    # Certbot
    if command -v certbot &> /dev/null; then
        echo -e "${GREEN}✓${NC} Certbot $(certbot --version | awk '{print $2}')"
    else
        echo -e "${RED}✗${NC} Certbot"
    fi
    
    echo ""
    print_success "Tất cả phần mềm cần thiết đã sẵn sàng!"
    echo ""
    print_info "Bước tiếp theo: Chạy script deploy.sh để deploy ứng dụng"
    echo ""
}

# Main execution
main() {
    print_header "🔍 Kiểm tra và cài đặt phần mềm cần thiết"
    
    check_root
    detect_os
    update_packages
    
    check_install_php
    check_install_composer
    check_install_nodejs
    check_install_mysql
    check_install_nginx
    check_install_certbot
    
    print_summary
}

# Run main function
main

