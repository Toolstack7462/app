# ToolStack CRM - Product Requirements Document

## Original Problem Statement
Build a production-grade CRM system for ToolStack, a SaaS platform offering digital tools subscriptions. The system requires:
1. Full system overview and bug analysis
2. Production-grade security (DB-driven admin, RBAC, JWT refresh tokens)
3. Device binding & anti multi-login feature
4. Website & deployment improvements
5. UI/styling matching original project

## Architecture

### Tech Stack
- **Frontend:** React, Tailwind CSS, React Router
- **Backend:** FastAPI (Python) gateway + Node.js/Express CRM service
- **Database:** MongoDB
- **Authentication:** JWT with Access/Refresh Tokens + Device Binding

### Service Configuration
- FastAPI Gateway: Port 8001 (via supervisor)
- Node.js CRM Backend: Port 8002 (manual start: `node server-crm.js &`)
- Frontend: Port 3000 (via supervisor)

### Key Files
```
/app
├── backend/
│   ├── server.py (FastAPI Gateway)
│   ├── server-crm.js (Node.js CRM)
│   ├── routes/
│   │   ├── auth.js, authEnhanced.js
│   │   ├── admin/ (tools, clients, assignments, activity)
│   │   └── client/ (tools, assignments, notifications)
│   └── middleware/
│       ├── auth.js, authEnhanced.js
│       └── rateLimiter.js
├── frontend/
│   └── src/
│       ├── pages/admin/, pages/client/
│       ├── services/api.js, authService.js
│       └── components/AdminRoute.js, ClientRoute.js
```

## What's Been Implemented

### ✅ Completed (Jan 24, 2026)
- [x] Database-driven admin accounts (seeded via script)
- [x] JWT refresh token mechanism
- [x] Device binding security (restricts clients to max devices)
- [x] Admin login redirect fix (accepts SUPER_ADMIN, ADMIN, SUPPORT roles)
- [x] Client login fix (correct `getOrCreateDeviceId()` method)
- [x] Prefilled email fix (autoComplete="off")
- [x] Admin dashboard 403 fix (activity/assignments routes accept all admin roles)
- [x] API rate limiter removed (was blocking dashboard)
- [x] Homepage links cleanup (no Admin Portal/Client Login links)

### Database Schema
- **User:** `{ email, password, role, forceLogoutVersion, devicePolicy, deviceBindings }`
- **Client:** Same as User with `role: 'CLIENT'`
- **RefreshToken:** `{ token, user, expiryDate }`
- **DeviceBinding:** `{ userId, deviceId, createdAt }`

## Test Credentials
- **Admin:** `admin@toolstack.com` / `Admin123!Secure`
- **Client:** `client@test.com` / `Client123!`

## Prioritized Backlog

### P0 (Critical) - COMPLETED
- ~~Admin/Client login redirect~~
- ~~Admin dashboard loading~~

### P1 (High)
- Test Client Panel advanced features (date display, expiry warnings)

### P2 (Medium)
- Code cleanup: Remove unused `*Enhanced.js` files
- Docker/Nginx single-domain deployment
- Dynamic blog with admin CRUD
- Contact form backend

### P3 (Low/Future)
- Full VPS deployment guide with SSL
- Additional RBAC roles implementation
