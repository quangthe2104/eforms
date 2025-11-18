# eForms Frontend

React + Vite frontend cho eForms.

## 🚀 Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 📁 Cấu trúc thư mục

```
src/
├── components/       # Reusable components
│   ├── FieldEditor.jsx
│   ├── FieldList.jsx
│   ├── FormPreview.jsx
│   ├── FormSettings.jsx
│   └── SortableField.jsx
├── layouts/          # Layout components
│   ├── AuthLayout.jsx
│   └── MainLayout.jsx
├── pages/            # Page components
│   ├── auth/
│   │   ├── Login.jsx
│   │   └── Register.jsx
│   ├── forms/
│   │   ├── FormBuilder.jsx
│   │   ├── FormList.jsx
│   │   └── FormResponses.jsx
│   ├── Dashboard.jsx
│   ├── NotFound.jsx
│   └── PublicForm.jsx
├── services/         # API services
│   └── api.js
├── store/            # State management (Zustand)
│   ├── authStore.js
│   └── formStore.js
├── App.jsx           # Main app component
├── main.jsx          # Entry point
└── index.css         # Global styles
```

## 🎨 Components

### Form Builder Components

**FieldList**
- Hiển thị danh sách fields
- Drag & drop để sắp xếp
- Add new fields

**FieldEditor**
- Edit field properties
- Add/remove options
- Toggle required

**SortableField**
- Individual field component
- Sortable with DnD Kit
- Preview field

**FormPreview**
- Preview form trước khi publish
- Modal component

**FormSettings**
- Form configuration
- Public/private settings
- Response limits

### Layout Components

**MainLayout**
- Header with navigation
- User menu
- Mobile responsive

**AuthLayout**
- Centered auth forms
- Logo and branding

## 🔧 State Management

### Auth Store (Zustand)

```javascript
import { useAuthStore } from './store/authStore'

const { user, login, logout, register } = useAuthStore()
```

### Form Store (Zustand)

```javascript
import { useFormStore } from './store/formStore'

const { fields, addField, updateField, removeField } = useFormStore()
```

## 🌐 API Services

```javascript
import { formAPI, authAPI, responseAPI, exportAPI } from './services/api'

// Auth
await authAPI.login({ email, password })
await authAPI.register({ name, email, password })

// Forms
await formAPI.getAll()
await formAPI.create({ title, description })
await formAPI.update(id, data)

// Responses
await responseAPI.getAll(formId)
await responseAPI.submitForm(slug, { answers })

// Export
await exportAPI.exportResponses(formId)
```

## 🎯 Routing

```
/                       → Redirect to /dashboard
/login                  → Login page
/register               → Register page
/dashboard              → Dashboard (protected)
/forms                  → Form list (protected)
/forms/create           → Form builder (protected)
/forms/:id/edit         → Edit form (protected)
/forms/:id/responses    → View responses (protected)
/f/:slug                → Public form (no auth)
```

## 🎨 Styling

### TailwindCSS Classes

Custom classes trong `index.css`:

```css
.btn                    /* Base button */
.btn-primary            /* Primary button */
.btn-secondary          /* Secondary button */
.btn-danger             /* Danger button */
.input                  /* Input field */
.card                   /* Card container */
.form-label             /* Form label */
.spinner                /* Loading spinner */
```

### Colors

Primary color: `primary-600` (blue)

## 📦 Dependencies

### Core
- `react` - UI library
- `react-dom` - React DOM
- `react-router-dom` - Routing

### State & Data
- `zustand` - State management
- `axios` - HTTP client

### UI & Forms
- `react-hook-form` - Form validation
- `@dnd-kit/*` - Drag & drop
- `lucide-react` - Icons
- `react-hot-toast` - Notifications

### Utilities
- `date-fns` - Date formatting
- `xlsx` - Excel export

## 🔨 Build

```bash
# Development build
npm run dev

# Production build
npm run build

# Output: dist/
```

### Build Output

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── ...
```

## 🚀 Deploy

### Static Hosting (Netlify, Vercel)

```bash
npm run build
# Upload dist/ folder
```

### cPanel/DirectAdmin

```bash
npm run build
# Upload dist/ contents to public_html
```

### Environment Variables

Create `.env` file:

```env
VITE_API_URL=http://localhost:8000/api
```

Production:

```env
VITE_API_URL=https://yourdomain.com/api
```

## 🐛 Troubleshooting

### API Connection Issues

Check `src/services/api.js`:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
```

### CORS Issues

Backend `config/cors.php` phải include frontend URL:
```php
'allowed_origins' => [
    'http://localhost:5173',
    env('FRONTEND_URL'),
],
```

### Build Issues

```bash
# Clear cache
rm -rf node_modules
rm package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
```

## 📝 License

MIT

