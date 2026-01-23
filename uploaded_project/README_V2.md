# ToolStack CRM - Professional Edition v2.0

**A production-ready, secure CRM platform for managing tools and client access**

## 🚀 What's New in v2.0

### 🔒 Security Enhancements
- ✅ **Removed hardcoded admin credentials** - Admin accounts now stored in database
- ✅ **Enforced JWT secrets** - Server fails to start without proper environment variables
- ✅ **Fixed encryption key bug** - COOKIES_ENCRYPTION_KEY must be set to prevent data loss
- ✅ **Refresh token flow** - Short-lived access tokens (15min) + long-lived refresh tokens (7 days)
- ✅ **Token version control** - Force logout capability for admins
- ✅ **Rate limiting** - Protection against brute force attacks
- ✅ **Input validation** - Joi schemas for all endpoints
- ✅ **Enhanced RBAC** - Support for SuperAdmin, Admin, Support, and Client roles

### 🎨 Professional UI/UX
- ✅ **Modern admin dashboard** with real-time statistics
- ✅ **Enhanced client portal** with intuitive navigation
- ✅ **Responsive design** - Mobile, tablet, and desktop optimized
- ✅ **Collapsible sidebar** - Better space utilization
- ✅ **Quick actions** - One-click access to common tasks
- ✅ **Activity timeline** - Visual activity logs
- ✅ **Professional color scheme** - Orange gradient branding

### 📊 Enhanced Features
- ✅ **Pagination** - All list endpoints support pagination
- ✅ **Advanced search** - Filter and search across resources
- ✅ **Device management** - View and control client device bindings
- ✅ **Force logout** - Admin can invalidate client sessions
- ✅ **Detailed audit logs** - Track who did what and when
- ✅ **Statistics dashboard** - Real-time metrics and insights

---

## 📋 Prerequisites

- **Node.js** v16+ and **Yarn** v1.22+
- **Python** 3.9+ (for FastAPI gateway)
- **MongoDB** 4.4+
- **Git**

---

## 🛠️ Installation & Setup

### 1. Clone or Extract Project

```bash
cd /path/to/project
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
yarn install

# Create .env from example
cp .env.example .env
```

### 3. Configure Environment Variables

**CRITICAL:** Edit `backend/.env` and set these required variables:

```bash
# Generate JWT secrets (run these commands):
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy output to JWT_SECRET

node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy output to JWT_REFRESH_SECRET

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output to COOKIES_ENCRYPTION_KEY (must be 64 hex chars!)
```

Update your `.env`:

```env
JWT_SECRET=<your-generated-secret-from-above>
JWT_REFRESH_SECRET=<your-generated-secret-from-above>
COOKIES_ENCRYPTION_KEY=<your-generated-64-char-hex-key>

# MongoDB
MONGO_URL=mongodb://localhost:27017
DB_NAME=toolstack_crm

# CORS
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000

# Server
CRM_PORT=8002
NODE_ENV=development
```

⚠️ **IMPORTANT:** If any required variable is missing, the server will fail to start with a clear error message.

### 4. Create Initial Admin Account

```bash
# Run the seed script
yarn seed:admin

# OR set in .env:
INITIAL_ADMIN_EMAIL=admin@toolstack.com
INITIAL_ADMIN_PASSWORD=YourSecurePassword123!
INITIAL_ADMIN_NAME=Super Admin

# Then run:
yarn seed:admin
```

### 5. Start Backend Services

```bash
# Terminal 1: Start CRM Backend (Node.js)
cd backend
yarn start
# OR for development with auto-reload:
yarn dev

# Terminal 2: Start API Gateway (FastAPI)
cd backend
pip install -r requirements.txt
python server.py
```

### 6. Frontend Setup

```bash
cd frontend

# Install dependencies
yarn install

# Start development server
yarn start
```

Frontend will run on `http://localhost:3000`

---

## 🧪 Testing

### Backend Testing

```bash
cd backend

# Test admin login
curl -X POST http://localhost:8002/api/crm/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    \"email\": \"admin@toolstack.com\",
    \"password\": \"YourSecurePassword123!\"
  }'

# Test health endpoint
curl http://localhost:8002/api/crm/health
```

### Frontend Testing

1. **Admin Login:** `http://localhost:3000/admin/login`
   - Use the credentials from your seed script

2. **Client Registration:** `http://localhost:3000/join`
   - Register a new client account

3. **Client Login:** `http://localhost:3000/client/login`
   - Login with registered client

---

## 🔑 Key Features & Usage

### Admin Portal (`/admin/*`)

1. **Dashboard** - Overview with stats, quick actions, and recent activity
2. **Tools Management** - Create, edit, delete tools with cookie storage
3. **Client Management** - Manage client accounts with device controls
4. **Assignments** - Assign tools to clients with expiry dates
5. **Activity Logs** - Audit trail of all system actions
6. **Force Logout** - Invalidate client sessions remotely
7. **Device Reset** - Unbind client devices

### Client Portal (`/client/*`)

1. **Dashboard** - View assigned tools and expiry warnings
2. **My Tools** - Browse and access assigned tools
3. **Tool Details** - Access tool URLs and encrypted cookies
4. **Profile** - Manage account settings
5. **Notifications** - Expiry alerts and system messages

---

## 🔐 Security Features

### Authentication & Authorization
- JWT-based authentication with access + refresh tokens
- Token version control for force logout
- Role-based access control (RBAC)
- Device binding for clients

### Rate Limiting
- **Auth routes:** 5 attempts per 15 minutes
- **Registration:** 3 attempts per hour
- **General API:** 100 requests per 15 minutes

### Data Protection
- AES-256-GCM encryption for stored cookies
- Bcrypt password hashing with salt
- HTTP-only secure cookies
- CORS protection

### Input Validation
- Joi schemas on all POST/PUT endpoints
- Email format validation
- Password strength requirements
- XSS and injection prevention

---

## 📁 Project Structure

```
/backend
├── middleware/
│   ├── authEnhanced.js       # JWT auth with refresh tokens
│   ├── rateLimiter.js         # Rate limiting configs
│   └── validation.js          # Joi validation schemas
├── models/
│   ├── User.js                # User model (with tokenVersion)
│   ├── RefreshToken.js        # Refresh token storage
│   ├── Tool.js                # Tool model
│   ├── ToolAssignment.js      # Assignment model
│   ├── DeviceBinding.js       # Device binding
│   └── ActivityLog.js         # Audit logs
├── routes/
│   ├── authEnhanced.js        # Enhanced auth routes
│   ├── admin/
│   │   ├── clientsEnhanced.js # Client management
│   │   ├── toolsEnhanced.js   # Tool management
│   │   ├── assignments.js     # Assignment management
│   │   └── activity.js        # Activity logs
│   └── client/
│       ├── tools.js           # Client tool access
│       ├── assignments.js     # Client assignments
│       └── notifications.js   # Notifications
├── scripts/
│   └── seed-admin.js          # Admin seed script
├── server-crm-enhanced.js     # Main CRM server
├── server.py                  # FastAPI gateway
└── .env.example               # Environment template

/frontend
├── src/
│   ├── components/
│   │   ├── AdminLayoutEnhanced.js    # Admin layout
│   │   ├── ClientLayoutEnhanced.js   # Client layout
│   │   └── ...
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── AdminDashboardEnhanced.js
│   │   │   └── ...
│   │   ├── client/
│   │   │   └── ...
│   │   └── ...
│   └── services/
│       ├── apiEnhanced.js            # API client with interceptors
│       └── authServiceEnhanced.js    # Auth service
└── package.json
```

---

## 🐛 Troubleshooting

### Server won't start

**Error:** "Missing required environment variables"
- **Solution:** Ensure JWT_SECRET, JWT_REFRESH_SECRET, and COOKIES_ENCRYPTION_KEY are set in `.env`

**Error:** "COOKIES_ENCRYPTION_KEY must be exactly 64 hexadecimal characters"
- **Solution:** Generate a new key with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Can't login as admin

- **Issue:** Hardcoded credentials removed
- **Solution:** Run `yarn seed:admin` to create admin account

### Clients can't login

- **Issue:** Device ID mismatch
- **Solution:** Admin can reset device binding from client detail page

### Cookies not decrypting

- **Issue:** COOKIES_ENCRYPTION_KEY changed after cookies were encrypted
- **Solution:** This is permanent data loss. Admin must re-upload tool cookies.

---

## 🚀 Production Deployment

### Environment Variables for Production

```env
NODE_ENV=production
MONGO_URL=mongodb://your-production-db:27017
DB_NAME=toolstack_crm_prod
JWT_SECRET=<strong-production-secret>
JWT_REFRESH_SECRET=<strong-production-secret>
COOKIES_ENCRYPTION_KEY=<64-char-hex-key>
FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com
```

### Security Checklist

- [ ] Strong JWT secrets (64+ characters)
- [ ] COOKIES_ENCRYPTION_KEY backed up securely
- [ ] HTTPS enabled
- [ ] MongoDB authentication enabled
- [ ] Firewall rules configured
- [ ] Rate limiting tested
- [ ] CORS origins restricted
- [ ] Admin password changed from default

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review activity logs in admin panel
3. Check browser console for frontend errors
4. Check backend logs for server errors

---

## 📝 Changelog

### v2.0.0 (Phase 1 Complete)
- Implemented all critical security fixes
- Enhanced admin and client UIs
- Added professional dashboard components
- Implemented refresh token flow
- Added force logout capability
- Enhanced validation and error handling
- Added rate limiting
- Improved device binding management

---

**Built with ❤️ for production-grade CRM management**
