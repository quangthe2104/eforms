# Quick Start Guide

Get eForms up and running in 5 minutes!

## Prerequisites

- PHP 8.2+, Composer, Node.js 18+, MySQL
- WAMP/XAMPP or Apache/Nginx

## Quick Setup

### 1. Database

```sql
CREATE DATABASE eforms_db;
```

### 2. Backend

```bash
cd backend
composer install
cp .env.example .env
# Edit .env - set database credentials
php artisan key:generate
php artisan migrate
php artisan storage:link
```

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_API_URL=http://eforms.test/api
```

Create `frontend/vite.config.js`:
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

### 4. Hosts File

Add to `C:\Windows\System32\drivers\etc\hosts`:
```
127.0.0.1    eforms.test
```

### 5. Apache VirtualHost

Add to `httpd-vhost.conf`:
```apache
<VirtualHost *:80>
    ServerName eforms.test
    DocumentRoot "D:/wamp64/www/eforms/backend/public"
    <Directory "D:/wamp64/www/eforms/backend/public">
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

Restart Apache.

### 6. Start Frontend

```bash
cd frontend
npm run dev
```

### 7. Access

Open: `http://eforms.test:5173`

## Done! 🎉

Register an account and start creating forms!

## Need Help?

- Full guide: [INSTALLATION.md](INSTALLATION.md)
- User manual: [USER_GUIDE.md](USER_GUIDE.md)
- Deployment: [DEPLOY-GUIDE.md](DEPLOY-GUIDE.md)
