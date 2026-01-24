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
- **Client:** `we2@gmail.com` (see database for password)

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
- [x] Recent activity feed with user emails
- [x] Quick actions (Create Tool, Add Client, Bulk Assign)
- [x] Navigation menu (Dashboard, Tools, Clients, Activity)

### Tool Management
- [x] Tool CRUD operations
- [x] Category support (AI, Academic, SEO, Productivity, etc.)
- [x] Status toggle (active/inactive)
- [x] Cookie encryption for sensitive data

### Client Management
- [x] Client CRUD operations
- [x] Device binding feature (restricts login to specific devices)
- [x] Device reset functionality
- [x] Client dashboard access

### Assignment System
- [x] Individual tool assignment to clients
- [x] Bulk tool assignment to multiple clients
- [x] Duration presets (1 Week, 1 Month, 3 Months, 1 Year)
- [x] Start/End date configuration

### Activity Log
- [x] Comprehensive activity tracking
- [x] User email display in activity descriptions
- [x] Auto-deletion of entries older than 24 hours (TTL index)
- [x] Role and action filtering
- [x] CSV export

### Security
- [x] Database-driven admin accounts (seed script)
- [x] Device fingerprinting for clients
- [x] Role-based access control
- [x] Dynamic CORS for preview URLs

---

## ✅ Bugs Fixed (This Session - Jan 24, 2026)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Tool creation validation error | Frontend form had correct fields | Verified working - no change needed |
| Filter dropdowns visual glitch | Missing bg-toolstack-bg and option styling | Applied consistent styling across all pages |
| Bulk assignment error | `/bulk` route matched after `/:clientId` | Moved `/bulk` route BEFORE `/:clientId` in assignments.js |
| Activity log email display | Already implemented | Verified working |

---

## Key Files

### Frontend
- `/app/frontend/src/pages/admin/AdminLogin.js` - Admin login form
- `/app/frontend/src/pages/admin/AdminToolForm.js` - Tool creation/edit form
- `/app/frontend/src/pages/admin/AdminTools.js` - Tools list with filters
- `/app/frontend/src/pages/admin/AdminClients.js` - Clients list with filters
- `/app/frontend/src/pages/admin/AdminActivity.js` - Activity log with filters
- `/app/frontend/src/pages/admin/AdminBulkAssign.js` - Bulk assignment page

### Backend
- `/app/backend/server.py` - FastAPI gateway (port 8001)
- `/app/backend/server-crm.js` - Node.js CRM service (port 8002)
- `/app/backend/routes/admin/tools.js` - Tool CRUD API
- `/app/backend/routes/admin/assignments.js` - Assignment API with bulk support
- `/app/backend/routes/admin/activity.js` - Activity log API

---

## Testing

### Test Files
- `/app/backend/tests/test_crm_api.py` - Backend API tests
- `/app/test_reports/iteration_1.json` - Latest test report

### Test Results (Latest)
- Backend: 100% (16/16 tests passed)
- Frontend: 100% (6/6 UI tests passed)

---

## Backlog (P2)

1. **Client-side routing 404 fix** - Verify SPA catch-all route works on page refresh
2. **Code Cleanup** - Remove unused `*Enhanced.js` files
3. **Docker/Nginx Deployment** - Configure for production
4. **Dynamic Blog** - MongoDB-backed blog posts with admin CRUD
5. **Contact Form Notifications** - Email notifications for contact submissions
