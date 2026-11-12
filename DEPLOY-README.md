# 🚀 Hướng dẫn sử dụng Script Deploy Tự động

## File: `deploy.sh`

Script tự động deploy eForms lên server với đầy đủ các bước cần thiết.

> 💡 **Bạn đang dùng Hostinger?** Xem hướng dẫn chi tiết tại [HOSTINGER-DEPLOY.md](HOSTINGER-DEPLOY.md) để biết cách kết nối SSH và chạy script trên Hostinger VPS.

## ⚙️ Cấu hình trước khi chạy

Mở file `deploy.sh` và chỉnh sửa các thông tin sau ở đầu file:

```bash
DOMAIN="eforms.domain.com"      # Thay bằng domain của bạn
DB_NAME="eforms_production"      # Tên databaseà,
DB_USER="eforms_user"            # User database
DB_PASS=""                        # Để trống, sẽ hỏi khi chạy
PROJECT_DIR="/var/www/eforms"    # Đường dẫn project
PHP_VERSION="8.2"                # Phiên bản PHP
```

## 📋 Yêu cầu trước khi chạy

1. **Đã clone code lên server:**
   ```bash
   git clone https://github.com/quangthe2104/eforms.git /var/www/eforms
   ```

2. **Cài đặt các phần mềm cần thiết:**
   
   **Cách 1: Tự động kiểm tra và cài đặt (Khuyến nghị)**
   ```bash
   cd /var/www/eforms
   chmod +x check-and-install-requirements.sh
   sudo ./check-and-install-requirements.sh
   ```
   
   Script này sẽ tự động:
   - ✅ Kiểm tra và cài đặt PHP 8.2+ với tất cả extensions cần thiết
   - ✅ Kiểm tra và cài đặt Composer
   - ✅ Kiểm tra và cài đặt Node.js 18+ và npm
   - ✅ Kiểm tra và cài đặt MySQL
   - ✅ Kiểm tra và cài đặt Nginx
   - ✅ Kiểm tra và cài đặt Certbot (cho SSL)
   
   **Cách 2: Cài đặt thủ công**
   - PHP 8.2+ với các extensions (bcmath, ctype, curl, fileinfo, json, mbstring, openssl, pdo, pdo_mysql, tokenizer, xml, zip, gd, exif)
   - Composer
   - Node.js 18+ và npm
   - MySQL
   - Nginx
   - Certbot (cho SSL)

3. **Đã cấu hình DNS** trỏ domain về server

## 🎯 Cách sử dụng

### Bước 1: Cài đặt phần mềm cần thiết (Chạy lần đầu tiên)

```bash
# Cấp quyền thực thi
chmod +x check-and-install-requirements.sh

# Chạy script kiểm tra và cài đặt
sudo ./check-and-install-requirements.sh
```

**Lưu ý:** Bước này chỉ cần chạy **1 lần duy nhất** khi setup server lần đầu. Nếu đã cài đặt đầy đủ phần mềm rồi thì có thể bỏ qua.

### Bước 2: Cấu hình và chạy deploy

```bash
# 1. Mở file deploy.sh và chỉnh sửa thông tin (domain, database, v.v.)
nano deploy.sh

# 2. Cấp quyền thực thi
chmod +x deploy.sh

# 3. Chạy script deploy
sudo ./deploy.sh
```

Script sẽ:
- ✅ Tự động cài đặt dependencies (Composer, NPM)
- ✅ Tạo và cấu hình file `.env` cho backend và frontend
- ✅ Tạo database và user
- ✅ Chạy migrations
- ✅ Build frontend
- ✅ Set permissions
- ✅ Tạo cấu hình Nginx
- ✅ Hướng dẫn cài SSL certificate

### Bước 3: Nhập thông tin khi được hỏi

- **Database password:** Nhập password cho database user
- **Xác nhận deploy:** Nhập `y` để tiếp tục
- **Cài SSL:** Nhập `y` nếu muốn cài SSL ngay, `n` để cài sau

## 📝 Các bước script thực hiện

1. **Kiểm tra quyền root** - Đảm bảo chạy với sudo
2. **Kiểm tra thư mục project** - Xác nhận code đã được clone
3. **Cài đặt dependencies** - Composer và NPM packages
4. **Cấu hình Backend .env** - Tự động cập nhật với domain và database
5. **Cấu hình Frontend .env** - Tự động cập nhật API URL
6. **Tạo Database** - Tạo database và user MySQL
7. **Cấu hình Laravel** - Generate key, migrations, cache
8. **Build Frontend** - Build production files
9. **Set Permissions** - Set quyền cho storage và cache
10. **Tạo Nginx Config** - Tạo và enable Nginx configuration
11. **Cài SSL** - Hướng dẫn cài SSL certificate

## ⚠️ Lưu ý quan trọng

1. **File .env sẽ được tự động tạo và cập nhật**, nhưng bạn nên kiểm tra lại sau khi chạy:
   ```bash
   nano /var/www/eforms/backend/.env
   nano /var/www/eforms/frontend/.env
   ```

2. **Nếu chưa cài SSL**, chạy lệnh sau:
   ```bash
   certbot --nginx -d eforms.domain.com
   ```

3. **Nếu có lỗi**, kiểm tra logs:
   ```bash
   tail -f /var/www/eforms/backend/storage/logs/laravel.log
   tail -f /var/log/nginx/error.log
   ```

4. **Sau khi deploy**, nếu thay đổi code, chỉ cần:
   ```bash
   cd /var/www/eforms
   git pull
   cd backend && composer install && php artisan migrate --force && php artisan config:cache
   cd ../frontend && npm install && npm run build
   ```

## 🔧 Xử lý lỗi

### Lỗi: Permission denied
```bash
sudo chmod +x deploy.sh
sudo ./deploy.sh
```

### Lỗi: Composer not found
```bash
# Cài đặt Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
```

### Lỗi: npm not found
```bash
# Cài đặt Node.js và npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Lỗi: Database connection failed
- Kiểm tra MySQL đang chạy: `sudo systemctl status mysql`
- Kiểm tra thông tin database trong `.env`
- Đảm bảo user có quyền truy cập database

## ✅ Sau khi deploy thành công

1. Truy cập: `https://eforms.domain.com`
2. Đăng ký tài khoản mới
3. Tạo form test
4. Kiểm tra mọi chức năng hoạt động

## 📞 Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
- File `QUICK-DEPLOY.md` - Hướng dẫn deploy thủ công
- File `DEPLOY-GUIDE.md` - Hướng dẫn chi tiết đầy đủ
- Logs trong `/var/www/eforms/backend/storage/logs/`

