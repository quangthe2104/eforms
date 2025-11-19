# Hướng dẫn Deploy eForms lên Server Online

Hướng dẫn nhanh để chạy eForms sau khi đã đẩy code lên server.

## 📋 Checklist trước khi bắt đầu

- [ ] Server đã cài đặt: PHP 8.2+, MySQL, Node.js 18+, Composer, Nginx/Apache
- [ ] Domain đã trỏ về server (DNS đã cấu hình)
- [ ] Đã SSH vào server
- [ ] Đã clone/pull code từ Git repository

## 🚀 Các bước thực hiện

### Bước 1: Kiểm tra và cài đặt dependencies

```bash
# Di chuyển vào thư mục project
cd /var/www/eforms  # hoặc đường dẫn bạn đã clone code

# Kiểm tra code đã có chưa
ls -la
```

### Bước 2: Cấu hình Backend

```bash
cd backend

# Cài đặt PHP dependencies
composer install --optimize-autoloader --no-dev

# Tạo file .env từ .env.example (nếu chưa có)
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Đã tạo file .env. Vui lòng chỉnh sửa với thông tin production!"
fi
```

**Chỉnh sửa file `.env`:**

```bash
nano .env  # hoặc vi, vim
```

Cập nhật các thông tin sau:
```env
APP_NAME=eForms
APP_ENV=production
APP_DEBUG=false
APP_URL=https://eforms.domain.com  # Thay bằng domain của bạn

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=eforms_production  # Tên database
DB_USERNAME=eforms_user        # User database
DB_PASSWORD=your_password      # Password database

SESSION_DOMAIN=.domain.com     # Thay bằng domain của bạn (có dấu chấm đầu)
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax

SANCTUM_STATEFUL_DOMAINS=eforms.domain.com  # Thay bằng domain của bạn
FRONTEND_URL=https://eforms.domain.com     # Thay bằng domain của bạn
```

**Generate key và chạy migrations:**

```bash
# Generate application key
php artisan key:generate

# Tạo database (nếu chưa có)
mysql -u root -p
# Trong MySQL:
CREATE DATABASE eforms_production CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'eforms_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON eforms_production.* TO 'eforms_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Chạy migrations
php artisan migrate --force

# Tạo storage link
php artisan storage:link

# Tạo thư mục thumbnails nếu chưa có
mkdir -p ../storage/thumbnails
chmod -R 775 ../storage/thumbnails
```

**Optimize Laravel:**

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

**Set permissions:**

```bash
sudo chown -R www-data:www-data storage bootstrap/cache ../storage
sudo chmod -R 775 storage bootstrap/cache ../storage
```

### Bước 3: Cấu hình Frontend

```bash
cd ../frontend

# Cài đặt Node.js dependencies
npm install

# Tạo file .env (nếu chưa có)
if [ ! -f .env ]; then
    cat > .env << EOF
VITE_API_URL=https://eforms.domain.com/api
VITE_FRONTEND_URL=https://eforms.domain.com
EOF
    echo "⚠️  Đã tạo file .env. Vui lòng chỉnh sửa với domain của bạn!"
fi
```

**Chỉnh sửa file `frontend/.env`:**

```bash
nano .env
```

Cập nhật:
```env
VITE_API_URL=https://eforms.domain.com/api  # Thay bằng domain của bạn
VITE_FRONTEND_URL=https://eforms.domain.com  # Thay bằng domain của bạn
```

**Build frontend:**

```bash
npm run build
```

Sau khi build, thư mục `dist/` sẽ được tạo chứa các file production.

### Bước 4: Cấu hình Nginx

Tạo file cấu hình Nginx:

```bash
sudo nano /etc/nginx/sites-available/eforms
```

Nội dung file (thay `eforms.domain.com` bằng domain của bạn):

```nginx
server {
    listen 80;
    server_name eforms.domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name eforms.domain.com;
    root /var/www/eforms/frontend/dist;
    
    ssl_certificate /etc/letsencrypt/live/eforms.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/eforms.domain.com/privkey.pem;
    
    index index.html;
    
    # Frontend - serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api {
        alias /var/www/eforms/backend/public;
        try_files $uri $uri/ @api;
        
        location ~ \.php$ {
            include fastcgi_params;
            fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
            fastcgi_param SCRIPT_FILENAME /var/www/eforms/backend/public/index.php;
        }
    }
    
    location @api {
        rewrite /api/(.*)$ /api/index.php?/$1 last;
    }
    
    # Sanctum CSRF cookie
    location /sanctum/csrf-cookie {
        alias /var/www/eforms/backend/public;
        try_files $uri @sanctum;
        
        location ~ \.php$ {
            include fastcgi_params;
            fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
            fastcgi_param SCRIPT_FILENAME /var/www/eforms/backend/public/index.php;
        }
    }
    
    location @sanctum {
        rewrite ^(.*)$ /index.php?/$1 last;
    }
    
    # Storage files (thumbnails, uploads)
    location /storage {
        alias /var/www/eforms/storage;
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
```

**Enable site và test:**

```bash
# Tạo symbolic link
sudo ln -s /etc/nginx/sites-available/eforms /etc/nginx/sites-enabled/

# Test cấu hình Nginx
sudo nginx -t

# Nếu test thành công, reload Nginx
sudo systemctl reload nginx
```

### Bước 5: Cài đặt SSL Certificate (Let's Encrypt)

```bash
# Cài đặt Certbot (nếu chưa có)
sudo apt install certbot python3-certbot-nginx

# Lấy SSL certificate (thay domain của bạn)
sudo certbot --nginx -d eforms.domain.com

# Certbot sẽ tự động cấu hình Nginx và renew certificate
```

### Bước 6: Kiểm tra và test

```bash
# Kiểm tra Nginx status
sudo systemctl status nginx

# Kiểm tra PHP-FPM status
sudo systemctl status php8.2-fpm

# Kiểm tra MySQL status
sudo systemctl status mysql

# Xem logs nếu có lỗi
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/www/eforms/backend/storage/logs/laravel.log
```

**Test trên trình duyệt:**

1. Truy cập: `https://eforms.domain.com`
2. Đăng ký tài khoản mới
3. Tạo form test
4. Submit response
5. Kiểm tra export Excel

## 🔧 Xử lý lỗi thường gặp

### Lỗi 502 Bad Gateway

```bash
# Kiểm tra PHP-FPM
sudo systemctl restart php8.2-fpm
sudo systemctl status php8.2-fpm

# Kiểm tra socket path trong Nginx config
# Đảm bảo đúng: unix:/var/run/php/php8.2-fpm.sock
```

### Lỗi Permission Denied

```bash
# Fix permissions
sudo chown -R www-data:www-data /var/www/eforms
sudo chmod -R 775 /var/www/eforms/backend/storage
sudo chmod -R 775 /var/www/eforms/storage
```

### Lỗi Database Connection

```bash
# Kiểm tra MySQL
sudo systemctl status mysql
mysql -u eforms_user -p eforms_production

# Kiểm tra .env file
cat /var/www/eforms/backend/.env | grep DB_
```

### Frontend không load được API

```bash
# Kiểm tra file frontend/.env
cat /var/www/eforms/frontend/.env

# Rebuild frontend sau khi sửa .env
cd /var/www/eforms/frontend
npm run build
```

### Clear cache nếu cần

```bash
cd /var/www/eforms/backend
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Sau đó cache lại
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## 📝 Lưu ý quan trọng

1. **File .env không được commit:** File `.env` đã được ignore, mỗi lần pull code sẽ không bị thay đổi
2. **Rebuild frontend:** Mỗi khi thay đổi code frontend, cần chạy `npm run build`
3. **Clear cache:** Sau khi thay đổi config, cần clear và cache lại
4. **Backup:** Nên backup database và file uploads thường xuyên
5. **Logs:** Kiểm tra logs thường xuyên để phát hiện lỗi sớm

## 🎉 Hoàn thành!

Sau khi hoàn thành tất cả các bước, eForms sẽ chạy tại: `https://eforms.domain.com`

