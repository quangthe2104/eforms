# Production Deployment Guide

Guide for deploying eForms to production server.

## Pre-Deployment Checklist

- [ ] Domain name configured
- [ ] SSL certificate ready
- [ ] Server meets requirements (PHP 8.2+, MySQL, Node.js)
- [ ] Backup strategy planned
- [ ] Environment variables configured

## Server Requirements

- **OS**: Linux (Ubuntu 20.04+ recommended)
- **Web Server**: Apache 2.4+ or Nginx 1.18+
- **PHP**: 8.2+ with required extensions
- **Database**: MySQL 8.0+ or MariaDB 10.6+
- **Node.js**: 18+ (for building frontend)
- **SSL**: Let's Encrypt or commercial certificate

## Deployment Steps

### 1. Server Setup

Update system:
```bash
sudo apt update && sudo apt upgrade -y
```

Install required packages:
```bash
sudo apt install -y php8.2 php8.2-fpm php8.2-mysql php8.2-xml php8.2-mbstring \
    php8.2-curl php8.2-zip php8.2-gd php8.2-bcmath \
    mysql-server nginx composer nodejs npm git
```

### 2. Clone Repository

```bash
cd /var/www
sudo git clone <repository-url> eforms
sudo chown -R www-data:www-data eforms
cd eforms
```

### 3. Backend Setup

```bash
cd backend
composer install --optimize-autoloader --no-dev
cp .env.example .env
```

Configure `.env` for production:
```env
APP_NAME=eForms
APP_ENV=production
APP_DEBUG=false
APP_URL=https://eforms.yourdomain.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=eforms_production
DB_USERNAME=eforms_user
DB_PASSWORD=strong_password_here

SESSION_DOMAIN=.yourdomain.com
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax

SANCTUM_STATEFUL_DOMAINS=eforms.yourdomain.com
FRONTEND_URL=https://eforms.yourdomain.com
```

Generate key and run migrations:
```bash
php artisan key:generate
php artisan migrate --force
php artisan storage:link
```

Optimize Laravel:
```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Set permissions:
```bash
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache
```

### 4. Frontend Setup

Build frontend:
```bash
cd ../frontend
npm install
npm run build
```

This creates `dist/` folder with production files.

### 5. Nginx Configuration

Create `/etc/nginx/sites-available/eforms`:

```nginx
server {
    listen 80;
    server_name eforms.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name eforms.yourdomain.com;
    root /var/www/eforms/frontend/dist;
    
    ssl_certificate /etc/letsencrypt/live/eforms.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/eforms.yourdomain.com/privkey.pem;
    
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

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/eforms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL Certificate (Let's Encrypt)

Install Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
```

Obtain certificate:
```bash
sudo certbot --nginx -d eforms.yourdomain.com
```

Auto-renewal is configured automatically.

### 7. Database Backup

Create backup script `/usr/local/bin/backup-eforms.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/eforms"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u eforms_user -p'password' eforms_production > $BACKUP_DIR/db_$DATE.sql

# Backup uploads
tar -czf $BACKUP_DIR/storage_$DATE.tar.gz /var/www/eforms/backend/storage/app

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete
```

Add to crontab:
```bash
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-eforms.sh
```

### 8. Monitoring

Install monitoring tools:
```bash
sudo apt install supervisor
```

Create supervisor config `/etc/supervisor/conf.d/eforms-queue.conf`:

```ini
[program:eforms-queue]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/eforms/backend/artisan queue:work --sleep=3 --tries=3
autostart=true
autorestart=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/eforms/backend/storage/logs/worker.log
```

Start supervisor:
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start eforms-queue:*
```

## Post-Deployment

### 1. Test Application

- Visit `https://eforms.yourdomain.com`
- Register test account
- Create test form
- Submit test response
- Export to Excel

### 2. Configure Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### 3. Setup Log Rotation

Create `/etc/logrotate.d/eforms`:

```
/var/www/eforms/backend/storage/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
```

## Maintenance

### Update Application

```bash
cd /var/www/eforms
sudo git pull
cd backend
composer install --optimize-autoloader --no-dev
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
cd ../frontend
npm install
npm run build
sudo systemctl reload nginx
```

### Clear Cache

```bash
cd /var/www/eforms/backend
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

### View Logs

```bash
tail -f /var/www/eforms/backend/storage/logs/laravel.log
tail -f /var/log/nginx/error.log
```

## Troubleshooting

### 502 Bad Gateway

Check PHP-FPM:
```bash
sudo systemctl status php8.2-fpm
sudo systemctl restart php8.2-fpm
```

### Permission Denied

Fix permissions:
```bash
sudo chown -R www-data:www-data /var/www/eforms
sudo chmod -R 775 /var/www/eforms/backend/storage
```

### Database Connection Failed

Check MySQL:
```bash
sudo systemctl status mysql
mysql -u eforms_user -p eforms_production
```

## Security Best Practices

1. **Keep software updated**: Regularly update OS, PHP, MySQL
2. **Strong passwords**: Use strong database and admin passwords
3. **Firewall**: Only allow necessary ports (80, 443, 22)
4. **Fail2ban**: Install to prevent brute force attacks
5. **Backups**: Test backup restoration regularly
6. **Monitoring**: Setup uptime monitoring
7. **SSL**: Keep certificates up to date
8. **Logs**: Review logs regularly for suspicious activity

## Performance Optimization

### Enable OPcache

Edit `/etc/php/8.2/fpm/php.ini`:

```ini
opcache.enable=1
opcache.memory_consumption=256
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=10000
opcache.revalidate_freq=2
```

### MySQL Optimization

Edit `/etc/mysql/mysql.conf.d/mysqld.cnf`:

```ini
innodb_buffer_pool_size=1G
innodb_log_file_size=256M
max_connections=200
```

### Nginx Caching

Add to server block:

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Support

For issues or questions:
- Check logs: `/var/www/eforms/backend/storage/logs/`
- Review documentation
- Contact support team

---

**Deployment Complete!** Your eForms application is now live in production.
