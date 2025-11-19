# Changelog

All notable changes to eForms project will be documented in this file.

## [1.1.0] - 2025-11-18

### Added - eForms UI (with Brand Colors)
- **New Form Builder Interface**: Complete redesign with modern UI/UX
- **EditableTitle Component**: Click-to-edit title and description with smooth transitions
- **FormQuestion Component**: Card-based questions with inline editing
- **FormSidebar Component**: Fixed sidebar with icon buttons for adding fields
- **Duplicate Field**: Added ability to duplicate questions quickly
- **Active/Edit Mode**: Click questions to edit, click outside to deactivate
- **Type Selector**: Dropdown to change question type on the fly
- **Inline Options Editor**: Edit options directly in question card
- **Grid Editor**: Full support for editing grid rows and columns
- **Toggle Switch**: Modern toggle for required field setting
- **Blue Theme**: Brand color scheme with primary blue (#0284c7) and gray background
- **Smooth Animations**: 200ms transitions on all interactions
- **Responsive Sidebar**: Fixed right on desktop, bottom-right on mobile

### Changed
- Replaced old FormBuilder with new FormBuilder
- Updated routing to use new builder component
- Enhanced form store with duplicateField function
- Improved drag & drop with better activation constraints

### UI/UX Improvements
- Click-to-edit title/description (no always-visible input fields)
- Card-based question layout
- Inline editing instead of separate sidebar panel
- Icon-based field type selector
- Hover effects and focus states throughout
- Professional animations and transitions
- Better visual hierarchy
- Improved mobile experience

### Technical
- Added 40+ new CSS classes for eForms UI
- Optimized re-renders with proper state management
- Click-outside detection for better UX
- Lazy rendering for performance
- Event delegation for efficiency

## [1.0.0] - 2025-01-17

### Added
- Initial release of eForms application
- User authentication (register, login, logout)
- Form builder with drag-and-drop interface
- Multiple field types support:
  - Text input
  - Textarea
  - Number
  - Email
  - Date
  - Select dropdown
  - Checkbox
  - Radio buttons
  - File upload
- Form management (create, edit, duplicate, delete)
- Public form sharing via unique URLs
- Response collection and management
- Excel export functionality
- Form statistics and analytics
- User profile management
- Password change functionality

### Technical Stack
- Frontend: React 18, Vite, TailwindCSS, React Router, Axios
- Backend: Laravel 12, MySQL, Laravel Sanctum, Laravel Excel
- Development: WAMP/Apache, Node.js, Composer

### Configuration
- CSRF protection with Laravel Sanctum
- CORS configuration for cross-origin requests
- Session management with cookie driver
- File upload with validation
- Virtual host setup for local development

### Documentation
- README.md - Project overview
- INSTALLATION.md - Complete installation guide
- QUICKSTART.md - Quick start guide
- USER_GUIDE.md - User manual
- DEPLOY-GUIDE.md - Production deployment guide
- CHANGELOG.md - Version history

### Security
- CSRF token validation
- XSS protection
- SQL injection prevention
- Secure file upload
- Password hashing
- Token-based authentication

---

## Version History

### [1.0.0] - 2025-01-17
- Initial stable release
- All core features implemented
- Documentation completed
- Production-ready

---

## Future Roadmap

### Planned Features
- Form templates
- Conditional logic
- Email notifications
- Form analytics dashboard
- Team collaboration
- Form versioning
- API webhooks
- Custom branding
- Multi-language support
- Dark mode

### Under Consideration
- Form scheduling
- Payment integration
- Advanced validation rules
- Form branching
- Response editing
- Bulk operations
- Mobile app

---

## Contributing

See [README.md](README.md) for contribution guidelines.

## License

MIT License - See LICENSE file for details.
