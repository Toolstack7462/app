# ToolStack CRM - Product Requirements Document

## Project Overview
Full-stack CRM application for managing tools, clients, and assignments with role-based access control.

## Tech Stack
- **Frontend:** React, Tailwind CSS, React Router, Axios
- **Backend:** FastAPI (Python gateway) + Node.js/Express (CRM service)
- **Database:** MongoDB
- **Authentication:** JWT with Access/Refresh tokens

## Architecture
```
Frontend (React) :3000
    ↓
FastAPI Gateway :8001 → /api/crm/*
    ↓
Node.js CRM Service :8002
    ↓
MongoDB
```

## Credentials
- **Admin:** `admin@toolstack.com` / `Admin123!Secure`
- **Client:** `client@test.com` / `Client123!`

---

## ✅ Completed Features (Jan 2026)

### Authentication System
- [x] Admin login with SUPER_ADMIN/ADMIN/SUPPORT role support
- [x] Client login with device binding security
- [x] JWT access + refresh token flow
- [x] Protected routes (AdminRoute, ClientRoute)
- [x] Logout functionality

### Admin Dashboard
- [x] Stats display (tools, clients, assignments)
- [x] Recent activity feed
- [x] Quick actions (Create Tool, Add Client, Bulk Assign)
- [x] Navigation menu (Dashboard, Tools, Clients, Activity)

### Client Management
- [x] Device binding feature (restricts login to specific devices)
- [x] Client dashboard access

### Security
- [x] Database-driven admin accounts (seed script)
- [x] Device fingerprinting for clients
- [x] Role-based access control

---

## 🔴 Critical Bugs Fixed (This Session)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Admin login stuck | AdminRoute checked `role === 'ADMIN'` but backend returns `SUPER_ADMIN` | Accept `['SUPER_ADMIN', 'ADMIN', 'SUPPORT']` |
| Client login stuck | Called non-existent `getDeviceId()` | Changed to `getOrCreateDeviceId()` |
| Prefilled email | Browser autofill | Added `autoComplete="off"`, unique name |
| Dashboard 403 | API rate limiting + role mismatch | Removed apiLimiter, fixed role checks |

---

## 🟡 Backlog (P2)

1. **Code Cleanup**
   - Remove unused `*Enhanced.js` files
   - Consolidate duplicate code

2. **Docker/Nginx Deployment**
   - Test docker-compose.yml
   - Configure nginx.conf for single-domain
   - SSL setup guide

3. **Dynamic Blog**
   - MongoDB-backed blog posts
   - Admin CRUD for blog management

4. **Contact Form**
   - Backend endpoint for contact submissions
   - Email notifications

---

## Key Files
- `/app/frontend/src/pages/admin/AdminLogin.js`
- `/app/frontend/src/pages/client/ClientLogin.js`
- `/app/frontend/src/components/AdminRoute.js`
- `/app/frontend/src/components/ClientRoute.js`
- `/app/frontend/src/services/authService.js`
- `/app/backend/server-crm.js`
- `/app/backend/routes/auth.js`
