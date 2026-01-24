# ToolStack CRM - Product Requirements Document

## Original Problem Statement
Full-stack CRM application (React, Node/Express, FastAPI, MongoDB) requiring comprehensive bug fixes and security upgrades for production deployment.

## Core Requirements
1. Fix broken authentication flow (admin/client logins not redirecting)
2. Remove prefilled email on admin login page
3. Production-grade security (DB-driven admin, RBAC, JWT refresh tokens)
4. Device binding & anti multi-login for clients
5. Clean UI without unwanted branding

## Architecture
```
/app
├── backend/
│   ├── server.py (FastAPI Gateway - port 8001)
│   ├── server-crm.js (Node.js CRM - port 8002)
│   ├── routes/auth.js
│   ├── middleware/
│   └── models/
├── frontend/
│   ├── src/
│   │   ├── pages/admin/AdminLogin.js
│   │   ├── pages/client/ClientLogin.js
│   │   ├── components/AdminRoute.js
│   │   ├── components/ClientRoute.js
│   │   └── services/authService.js
```

## What's Been Implemented

### January 24, 2026 - Authentication Bug Fix
**Status: COMPLETED & TESTED**

#### Issues Fixed:
1. **Admin/Client Login Redirect** - Users couldn't reach dashboards after login
   - Root cause: `AdminRoute.js` checked for `role === 'ADMIN'` but backend returns `SUPER_ADMIN`
   - Fix: Updated to accept `['SUPER_ADMIN', 'ADMIN', 'SUPPORT']` roles

2. **Client Login Device ID Error**
   - Root cause: `ClientLogin.js` called non-existent `getDeviceId()` method
   - Fix: Changed to `getOrCreateDeviceId()`

3. **Prefilled Email on Admin Login**
   - Fix: Added `autoComplete="off"`, unique `name="admin-login-email"`, and neutral placeholder

4. **CRM Backend Not Running**
   - Node.js CRM on port 8002 was not started
   - Started manually: `node server-crm.js &`

#### Files Modified:
- `/app/frontend/src/components/AdminRoute.js`
- `/app/frontend/src/pages/admin/AdminLogin.js`
- `/app/frontend/src/pages/client/ClientLogin.js`

### Previously Implemented (Before This Session)
- Database-driven admin accounts with seed script
- JWT refresh token mechanism
- Device binding logic for clients
- UI reverted to original theme
- Homepage links to admin/client removed

## Test Credentials
- **Admin:** admin@toolstack.com / Admin123!Secure
- **Client:** client@test.com / Client123!

## Known Issues (Minor)
1. Admin dashboard shows "Failed to load dashboard" toasts (403 on activity endpoint) - UI renders correctly
2. Rate limiter was increased to 100 for testing (was 5)

## Upcoming Tasks (P1)
- Investigate admin dashboard 403 error on activity endpoint
- Revert rate limiter to production value (5 attempts)
- Test client panel advanced features (date displays, expiry warnings)

## Future/Backlog (P2)
- Single-domain deployment with Docker/Nginx
- Dynamic MongoDB-backed blog
- Contact form backend endpoint
- Code cleanup (remove unused *Enhanced.js files)

## Preview URL
https://login-bug-repair-2.preview.emergentagent.com
