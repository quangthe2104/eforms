# Hướng dẫn cấu hình file .env

## ⚠️ QUAN TRỌNG

**File `.env` KHÔNG BAO GIỜ được commit lên Git!**
- File `.env` đã được thêm vào `.gitignore`
- Mỗi lần pull code, file `.env` của bạn sẽ KHÔNG bị thay đổi
- Chỉ sử dụng `.env.example` làm mẫu

## Tạo file .env.example cho Backend

Tạo file `backend/.env.example` với nội dung sau:

```env
APP_NAME=eForms
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_TIMEZONE=UTC
APP_URL=http://localhost:8000
APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file
APP_MAINTENANCE_STORE=database

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=eforms
DB_USERNAME=root
DB_PASSWORD=

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null
SESSION_SECURE_COOKIE=false
SESSION_SAME_SITE=lax

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database

CACHE_STORE=database
CACHE_PREFIX=

MEMCACHED_HOST=127.0.0.1

REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=log
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="${APP_NAME}"

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

VITE_APP_NAME="${APP_NAME}"

# eForms Specific
FRONTEND_URL=http://localhost:5173
SANCTUM_STATEFUL_DOMAINS=localhost,localhost:3000,localhost:5173,127.0.0.1,127.0.0.1:8000,::1
```

## Tạo file .env.example cho Frontend

Tạo file `frontend/.env.example` với nội dung sau:

```env
# API Base URL
VITE_API_URL=http://localhost:8000/api

# Frontend URL (for CORS)
VITE_FRONTEND_URL=http://localhost:5173
```

## Cấu hình cho Production

### Backend `.env`:

```env
APP_NAME=eForms
APP_ENV=production
APP_DEBUG=false
APP_URL=https://eforms.domain.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=eforms_production
DB_USERNAME=eforms_user
DB_PASSWORD=your_strong_password_here

SESSION_DOMAIN=.domain.com
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax

SANCTUM_STATEFUL_DOMAINS=eforms.domain.com
FRONTEND_URL=https://eforms.domain.com
```

### Frontend `.env`:

```env
VITE_API_URL=https://eforms.domain.com/api
VITE_FRONTEND_URL=https://eforms.domain.com
```

## Cách sử dụng

1. **Lần đầu setup:**
   ```bash
   cd backend
   cp .env.example .env
   # Chỉnh sửa .env với thông tin production
   ```

2. **Mỗi lần pull code:**
   - File `.env` sẽ KHÔNG bị thay đổi
   - Nếu có biến môi trường mới, kiểm tra `.env.example` và thêm vào `.env` thủ công

3. **Kiểm tra file có bị commit không:**
   ```bash
   git status
   # File .env không nên xuất hiện trong danh sách
   ```

