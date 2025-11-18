# Installation Guide

Complete installation guide for eForms application.

## Prerequisites

Before installation, ensure you have:

- **PHP 8.2+** with extensions:
  - OpenSSL
  - PDO
  - Mbstring
  - Tokenizer
  - XML
  - Ctype
  - JSON
  - BCMath
  - Fileinfo
  - GD

- **Composer** - PHP dependency manager
- **Node.js 18+** and **npm**
- **MySQL 5.7+** or **MariaDB 10.3+**
- **Apache** or **Nginx** web server

## Step-by-Step Installation

### 1. Database Setup

Create a new database:

```sql
CREATE DATABASE eforms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'eforms_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON eforms_db.* TO 'eforms_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Backend Installation

```bash
cd backend
composer install
```

Copy environment file:

```bash
cp .env.example .env
```

Configure `.env`:

```env
APP_NAME=eForms
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://eforms.test

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=eforms_db
DB_USERNAME=eforms_user
DB_PASSWORD=your_password

SANCTUM_STATEFUL_DOMAINS=eforms.test:5173,eforms.test
SESSION_DOMAIN=.eforms.test
SESSION_SECURE_COOKIE=false
SESSION_SAME_SITE=lax

FRONTEND_URL=http://eforms.test:5173
```

Generate application key:

```bash
php artisan key:generate
```

Run migrations:

```bash
php artisan migrate
```

Create storage link:

```bash
php artisan storage:link
```

### 3. Frontend Installation

```bash
cd frontend
npm install
```

Create `.env`:

```env
VITE_API_URL=http://eforms.test/api
```

Create `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'eforms.test',
    port: 5173,
  }
})
```

### 4. Virtual Host Configuration

#### Windows

Edit hosts file (`C:\Windows\System32\drivers\etc\hosts`):

```
127.0.0.1    eforms.test
```

#### Apache Configuration

Edit `httpd-vhost.conf`:

```apache
<VirtualHost *:80>
    ServerName eforms.test
    DocumentRoot "D:/wamp64/www/eforms/backend/public"
    
    <Directory "D:/wamp64/www/eforms/backend/public">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog "logs/eforms-error.log"
    CustomLog "logs/eforms-access.log" common
</VirtualHost>
```

Restart Apache.

#### Nginx Configuration (Alternative)

```nginx
server {
    listen 80;
    server_name eforms.test;
    root /var/www/eforms/backend/public;
    
    index index.php index.html;
    
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
    
    location ~ /\.ht {
        deny all;
    }
}
```

### 5. Start Development Servers

**Backend** (Apache should be running):
```bash
# Backend runs at http://eforms.test
```

**Frontend**:
```bash
cd frontend
npm run dev
# Frontend runs at http://eforms.test:5173
```

### 6. Verify Installation

Open browser: `http://eforms.test:5173`

You should see the eForms login page.

## Common Issues

### Issue: CSRF Token Mismatch

**Solution:**
1. Clear browser cookies
2. Run: `php artisan config:clear`
3. Verify `SANCTUM_STATEFUL_DOMAINS` includes `eforms.test:5173`

### Issue: Database Connection Failed

**Solution:**
1. Check MySQL is running
2. Verify credentials in `.env`
3. Ensure database exists
4. Run: `php artisan config:clear`

### Issue: 404 Not Found on API Routes

**Solution:**
1. Check Apache `mod_rewrite` is enabled
2. Verify `.htaccess` exists in `backend/public`
3. Ensure `AllowOverride All` in VirtualHost

### Issue: Frontend Cannot Connect to Backend

**Solution:**
1. Check `VITE_API_URL` in `frontend/.env`
2. Verify CORS settings in `backend/config/cors.php`
3. Clear cache: `php artisan config:clear`

## Next Steps

After installation:

1. Create an account at `http://eforms.test:5173/register`
2. Login and create your first form
3. Read [User Guide](USER_GUIDE.md) for detailed usage instructions

## Production Deployment

See [Deployment Guide](DEPLOY-GUIDE.md) for production setup instructions.
