# eForms Backend API

Laravel REST API cho hệ thống eForms.

## Yêu cầu hệ thống

- PHP >= 8.1
- Composer
- MySQL >= 8.0 hoặc MariaDB >= 10.3
- Extensions: OpenSSL, PDO, Mbstring, Tokenizer, XML, Ctype, JSON, BCMath

## Cài đặt

### 1. Cài đặt dependencies

```bash
composer install
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=eforms
DB_USERNAME=root
DB_PASSWORD=your_password

FRONTEND_URL=http://localhost:5173
```

### 3. Generate application key

```bash
php artisan key:generate
```

### 4. Chạy migrations

```bash
php artisan migrate
```

### 5. Seed database (optional)

```bash
php artisan db:seed
```

Tài khoản mặc định:
- Admin: `admin@eforms.test` / `password`
- User: `user@eforms.test` / `password`

### 6. Tạo storage link

```bash
php artisan storage:link
```

### 7. Khởi động server

```bash
php artisan serve
```

API sẽ chạy tại: `http://localhost:8000`

## API Endpoints

### Authentication

- `POST /api/register` - Đăng ký tài khoản mới
- `POST /api/login` - Đăng nhập
- `POST /api/logout` - Đăng xuất (auth required)
- `GET /api/me` - Lấy thông tin user hiện tại (auth required)
- `PUT /api/profile` - Cập nhật profile (auth required)
- `POST /api/change-password` - Đổi mật khẩu (auth required)

### Forms (Auth Required)

- `GET /api/forms` - Danh sách forms
- `POST /api/forms` - Tạo form mới
- `GET /api/forms/{form}` - Chi tiết form
- `PUT /api/forms/{form}` - Cập nhật form
- `DELETE /api/forms/{form}` - Xóa form
- `POST /api/forms/{form}/duplicate` - Nhân bản form
- `GET /api/forms/{form}/statistics` - Thống kê form

### Form Fields (Auth Required)

- `POST /api/forms/{form}/fields` - Thêm field
- `PUT /api/forms/{form}/fields/{field}` - Cập nhật field
- `DELETE /api/forms/{form}/fields/{field}` - Xóa field
- `POST /api/forms/{form}/fields/reorder` - Sắp xếp lại fields
- `POST /api/forms/{form}/fields/bulk-update` - Cập nhật nhiều fields

### Form Responses

- `GET /api/forms/public/{slug}` - Xem form public (no auth)
- `POST /api/forms/public/{slug}/submit` - Submit form (no auth)
- `GET /api/forms/{form}/responses` - Danh sách responses (auth required)
- `GET /api/forms/{form}/responses/{response}` - Chi tiết response (auth required)
- `DELETE /api/forms/{form}/responses/{response}` - Xóa response (auth required)

### Export (Auth Required)

- `GET /api/forms/{form}/export` - Export tất cả responses ra Excel
- `GET /api/forms/{form}/responses/{response}/export` - Export 1 response ra Excel

## Database Schema

### users
- id, name, email, password, role, timestamps

### forms
- id, user_id, title, description, slug, settings, status, is_public, accept_responses, timestamps

### form_fields
- id, form_id, type, label, placeholder, help_text, options, validation_rules, is_required, order, timestamps

### form_responses
- id, form_id, user_id, ip_address, user_agent, submitted_at, timestamps

### response_answers
- id, response_id, field_id, value, file_path, timestamps

## Field Types

- `short_text` - Text ngắn
- `long_text` - Text dài (textarea)
- `email` - Email
- `number` - Số
- `phone` - Số điện thoại
- `url` - URL
- `date` - Ngày
- `time` - Giờ
- `datetime` - Ngày giờ
- `dropdown` - Dropdown select
- `radio` - Multiple choice (radio)
- `checkbox` - Checkboxes
- `file_upload` - Upload file
- `rating` - Đánh giá sao
- `scale` - Linear scale
- `section` - Section header

## Deploy lên Production

### cPanel/DirectAdmin

1. Upload toàn bộ thư mục backend lên server
2. Point document root vào thư mục `public`
3. Tạo database MySQL và import migrations
4. Cấu hình file `.env` với thông tin database
5. Chạy: `php artisan migrate`
6. Chạy: `php artisan storage:link`
7. Set quyền: `chmod -R 755 storage bootstrap/cache`

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    root /path/to/backend/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

## Bảo mật

- Sử dụng HTTPS/SSL trong production
- Đổi `APP_KEY` và `APP_DEBUG=false` trong production
- Cấu hình CORS đúng trong `config/cors.php`
- Rate limiting được bật mặc định
- Validation đầy đủ cho tất cả inputs
- File upload được validate type và size

## License

MIT

