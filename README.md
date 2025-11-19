# eForms - Form Builder Application

A modern form builder application built with React, Laravel, and MySQL. All data is stored in your private database with Excel export capabilities.

## 🚀 Features

- **Form Builder**: Drag-and-drop interface to create custom forms
- **Multiple Field Types**: Text, textarea, number, email, date, select, checkbox, radio, file upload
- **Form Management**: Create, edit, duplicate, and delete forms
- **Response Collection**: Collect and manage form submissions
- **Excel Export**: Export responses to Excel format
- **User Authentication**: Secure login and registration
- **Public Forms**: Share forms via unique URLs
- **Form Statistics**: View response analytics

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **React Router** - Routing
- **TailwindCSS** - Styling
- **Axios** - HTTP client
- **DnD Kit** - Drag and drop
- **Zustand** - State management
- **React Hook Form** - Form validation

### Backend
- **Laravel 12** - PHP framework
- **MySQL/MariaDB** - Database
- **Laravel Sanctum** - API authentication
- **Laravel Excel** - Excel export

## 📋 Requirements

- **PHP**: 8.2 or higher
- **Composer**: Latest version
- **Node.js**: 18 or higher
- **npm**: Latest version
- **MySQL/MariaDB**: 5.7 or higher
- **Apache/Nginx**: Web server

## 🔧 Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd eforms
```

### 2. Setup Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan storage:link
```

**Configure `.env`:**
```env
DB_DATABASE=eforms_db
DB_USERNAME=your_username
DB_PASSWORD=your_password

APP_URL=http://eforms.test
FRONTEND_URL=http://eforms.test:5173

SANCTUM_STATEFUL_DOMAINS=eforms.test:5173,eforms.test
SESSION_DOMAIN=.eforms.test
SESSION_SECURE_COOKIE=false
SESSION_SAME_SITE=lax
```

### 3. Setup Frontend

```bash
cd frontend
npm install
```

**Create `.env`:**
```env
VITE_API_URL=http://eforms.test/api
```

**Create `vite.config.js`:**
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

### 4. Configure Virtual Host

**Windows Hosts** (`C:\Windows\System32\drivers\etc\hosts`):
```
127.0.0.1    eforms.test
```

**Apache VirtualHost** (`httpd-vhost.conf`):
```apache
<VirtualHost *:80>
    ServerName eforms.test
    DocumentRoot "D:/wamp64/www/eforms/backend/public"
    
    <Directory "D:/wamp64/www/eforms/backend/public">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

Restart Apache.

### 5. Start Development

**Terminal 1 - Backend (Apache already running)**
```bash
# Backend runs on Apache at http://eforms.test
```

**Terminal 2 - Frontend**
```bash
cd frontend
npm run dev
# Frontend runs at http://eforms.test:5173
```

### 6. Access Application

Open browser: `http://eforms.test:5173`

## 📚 Usage

### Create a Form

1. Login/Register
2. Click "Create Form"
3. Add form fields using drag-and-drop
4. Configure field properties
5. Save and publish

### Share a Form

1. Open form
2. Click "Share"
3. Copy public URL
4. Share with respondents

### View Responses

1. Open form
2. Click "Responses" tab
3. View submissions
4. Export to Excel

## 🔒 Security

- **CSRF Protection**: Laravel Sanctum with CSRF tokens
- **XSS Protection**: Input sanitization
- **SQL Injection**: Eloquent ORM with prepared statements
- **Authentication**: Sanctum token-based auth
- **File Upload**: Validated and stored securely

## 📦 Production Deployment

### Build Frontend

```bash
cd frontend
npm run build
```

### Configure Production

**Backend `.env`:**
```env
APP_ENV=production
APP_DEBUG=false
SESSION_SECURE_COOKIE=true
```

**Apache VirtualHost:**
```apache
<VirtualHost *:80>
    ServerName eforms.yourdomain.com
    DocumentRoot "/var/www/eforms/backend/public"
    
    <Directory "/var/www/eforms/backend/public">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### Optimize Laravel

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## 🐛 Troubleshooting

### CSRF Token Mismatch

- Clear browser cookies
- Clear Laravel cache: `php artisan config:clear`
- Check `SANCTUM_STATEFUL_DOMAINS` in `.env`
- Verify `SESSION_DOMAIN` is set correctly

### CORS Errors

- Check `config/cors.php` includes frontend URL
- Verify `FRONTEND_URL` in `.env`
- Clear config cache

### Database Connection Failed

- Check MySQL is running
- Verify database credentials in `.env`
- Ensure database exists

## 📝 Scripts

### Backend

```bash
# Run migrations
php artisan migrate

# Seed database
php artisan db:seed

# Clear cache
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Run tests
php artisan test
```

### Frontend

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Authors

- Your Name - Initial work

## 🙏 Acknowledgments

- Modern form builder interface
- Built with Laravel and React
- Icons from Heroicons
