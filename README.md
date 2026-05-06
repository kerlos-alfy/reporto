<div align="center">

# Reporto

### Construction Daily Reporting System

**A production-ready platform for daily site reporting, manpower tracking,  
and executive dashboards — built for the UAE construction industry.**

---

Developed by **[Kerlos Alfy](https://kodeaa.com)** · Founder, [Kodea Digital Creative Studio](https://kodeaa.com)

</div>

---

## Overview

**Reporto** is a full-stack web application that replaces paper-based and spreadsheet-driven daily reporting workflows on construction sites. Engineers submit structured daily reports from their phones; project managers and executives review live dashboards, manpower analytics, and exportable Excel reports — all from a single platform.

Built as a pilot for **Agile Prime General Contracting L.L.C.** (UAE), Reporto is designed to scale across multiple projects, multiple sites, and multiple user roles without friction.

---

## Key Features

### For Site Engineers
- Mobile-first report submission form — works on any phone browser
- Auto-filled engineer identity — no re-entry of personal details
- Per-item shift tracking (start time, end time, auto-calculated duration)
- Multi-source labor entry per work item (In-House, Supplier, Subcontractor)
- Progress tracking with last-recorded value pre-filled per activity
- Project-scoped element and level dropdowns — no global clutter

### For Project Managers
- Role-based access — viewers, admins, and superadmins with granular permission control
- Manpower Summary — per-site, per-day breakdown filterable by date, project, and source type
- Manpower Breakdown — per-project, per-trade, per-source analytics with Excel and PDF export
- Missing-report alert — surfaced at 08:00 Dubai time, lists every engineer who did not submit yesterday
- Project Timeline — visual Gantt-style progress view per site

### For Executives
- Executive Dashboard — KPI cards, Chart.js visualizations, and activity-grouped report views
- Advanced filtering — date range, project, engineer, activity, level, source type, and free-text search
- Excel export of all filtered data with professional formatting
- Workforce Log — full workforce history across all projects

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express.js 4 |
| Database | MongoDB 6+ via Mongoose 8 |
| Templating | EJS + Tailwind CSS (CDN) |
| Charts | Chart.js |
| Auth | express-session · connect-mongo · bcryptjs |
| Validation | express-validator |
| Export | ExcelJS (xlsx) · PDFKit |
| Security | Helmet · in-memory rate limiter |
| Architecture | MVC with service layer |

---

## Project Structure

```
reporto/
├── server.js                   # Entry point — starts HTTP server
├── app.js                      # Express app configuration
│
├── config/
│   ├── constants.js            # Shared enums: roles, themes, shift types
│   ├── permissions.js          # ⭐ Single source of truth for RBAC logic
│   ├── database.js             # MongoDB connection + graceful shutdown
│   └── session.js              # Session store configuration
│
├── models/
│   ├── AdminUser.js            # Users — roles, permissions, theme, linked engineer
│   ├── Engineer.js             # Site engineers linked to user accounts
│   ├── Project.js              # Projects with embedded levels and elements
│   ├── DailyReport.js          # Reports with embedded items and labor sources
│   ├── MasterData.js           # Lookup data: activities, elements, companies
│   ├── Counter.js              # Atomic per-day report ID sequence
│   ├── DailyAlert.js           # Missing-report alert persistence
│   └── index.js                # Barrel export
│
├── services/
│   ├── authService.js          # Credential verification + session payload
│   ├── reportService.js        # Report creation, update, last-progress lookup
│   ├── dashboardService.js     # KPI aggregation, chart data, workforce log
│   ├── manpowerSummaryService.js  # Per-site manpower rollup
│   ├── manpowerBreakdownExportService.js  # Excel + PDF export for breakdown
│   ├── masterDataService.js    # Form data, filter options, project lookups
│   ├── excelService.js         # Dashboard Excel export
│   ├── alertService.js         # On-demand missing-report check (Dubai timezone)
│   └── cronService.js          # Background job registry (extensible)
│
├── controllers/
│   ├── authController.js       # Login, logout, landing-page routing
│   ├── reportController.js     # Report form, CRUD, form API helpers
│   ├── dashboardController.js  # Dashboard page + data API endpoints
│   ├── manpowerSummaryController.js  # Manpower pages + export endpoints
│   ├── masterDataController.js # Master data CRUD
│   ├── timelineController.js   # Project list + Gantt timeline
│   └── userController.js       # Admin user management
│
├── routes/
│   ├── auth.js                 # /admin/login, /admin/logout
│   ├── reports.js              # /reports/new, POST /reports
│   ├── admin.js                # All /admin/* page routes
│   ├── api.js                  # All /api/* JSON routes
│   └── users.js                # /admin/users/* management
│
├── middlewares/
│   ├── auth.js                 # requireAuth, requirePermission, requireLinkedEngineer
│   ├── rateLimiter.js          # In-memory per-IP rate limiting
│   ├── errorHandler.js         # Global 404 + error handler
│   └── flash.js                # Session-based flash messages
│
├── validators/
│   └── index.js                # express-validator rule sets + result handler
│
├── utils/
│   ├── dateHelpers.js          # formatDate, formatDateTime, todayISO, formatTime12
│   ├── manpowerHelpers.js      # sumMp, emptyMp, addMp, fmtDuration
│   ├── queryBuilder.js         # MongoDB filter builder for dashboard queries
│   ├── reportIdGenerator.js    # DSR-YYYYMMDD-NNNN ID generation
│   └── logger.js               # Lightweight logger (drop-in for winston/pino)
│
├── views/                      # EJS templates
│   ├── admin/                  # Dashboard, reports, manpower, projects, users
│   ├── reports/new.ejs         # Mobile-first report submission form
│   ├── auth/login.ejs          # Login page
│   ├── master-data/index.ejs   # Master data management
│   ├── layouts/main.ejs        # Base layout
│   └── partials/navbar.ejs     # Navigation bar
│
├── public/
│   ├── css/app.css             # Custom styles
│   └── js/                     # dashboard.js, dashboard-manpower.js, theme.js
│
└── scripts/
    ├── seed.js                 # Database seeder with sample data
    └── migrate-elements-to-projects.js  # One-time data migration script
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB ≥ 6 (local instance or MongoDB Atlas)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/kerlos-alfy/reporto.git
cd reporto

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Open .env and set MONGODB_URI and SESSION_SECRET
```

### Environment Variables

```env
# Required
MONGODB_URI=mongodb://localhost:27017/reporto
SESSION_SECRET=your-random-64-char-secret-here

# Optional
PORT=3100
NODE_ENV=development
APP_NAME=Reporto
COMPANY_NAME=Your Company Name

# Rate limiting (optional — sensible defaults apply)
RATE_LIMIT_LOGIN_WINDOW_MS=900000
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_API_WINDOW_MS=900000
RATE_LIMIT_API_MAX=100
```

### Seed & Run

```bash
# Seed the database with sample projects, engineers, and an admin account
npm run seed:fresh

# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

### Default Credentials (after seed)

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `Admin@2026!` |

> Change the default password immediately after first login.

---

## Application Routes

### Public
| Method | Path | Description |
|---|---|---|
| GET | `/admin/login` | Login page |
| POST | `/admin/login` | Authenticate |
| POST | `/admin/logout` | End session |

### Engineer (requires `canSubmitReports`)
| Method | Path | Description |
|---|---|---|
| GET | `/reports/new` | Report submission form |
| POST | `/reports` | Submit daily report |

### Admin Dashboard
| Method | Path | Permission |
|---|---|---|
| GET | `/admin/dashboard` | `canViewDashboard` |
| GET | `/admin/projects` | `canViewDashboard` |
| GET | `/admin/projects/:id/timeline` | `canViewDashboard` |
| GET | `/admin/workforce` | `canViewDashboard` |
| GET | `/admin/manpower-summary` | `canViewManpowerSummary` |
| GET | `/admin/manpower-breakdown` | `canViewManpowerSummary` |
| GET | `/admin/reports` | `canViewReportsList` |
| GET | `/admin/master-data` | `canManageMasters` |

---

## Role & Permission System

Reporto uses a three-tier role hierarchy with granular per-user permission overrides.

### Roles

| Role | Description |
|---|---|
| `superadmin` | Full access to everything — no permission checks applied |
| `admin` | Inherits role defaults; individual flags can override |
| `viewer` | Only permissions explicitly granted — used for engineers and read-only accounts |

### Permissions

| Permission | Admin Default | Description |
|---|---|---|
| `canViewDashboard` | ✅ | Access dashboard, projects, timeline, workforce |
| `canViewReports` | ✅ | View individual report details |
| `canViewReportsList` | ❌ | Access the full paginated reports list |
| `canEditReports` | ❌ | Edit or delete submitted reports |
| `canManageMasters` | ✅ | Manage projects, engineers, and master data |
| `canManageUsers` | ❌ | Create, edit, or deactivate user accounts |
| `canExportData` | ✅ | Export to Excel / PDF |
| `canViewAlerts` | ❌ | Receive missing-report alerts |
| `canViewManpowerSummary` | ✅ | Access manpower summary and breakdown pages |
| `canSubmitReports` | ❌ | Submit daily reports (requires linked engineer for viewers) |

Permission resolution lives entirely in `config/permissions.js` — a single file with no logic duplicated across middlewares or models.

---

## Report ID Format

Every report receives a unique, human-readable ID on creation:

```
DSR-20260324-0001
 │    │        └─ Daily sequence (resets each day, atomic via MongoDB $inc)
 │    └────────── Date (YYYYMMDD)
 └─────────────── Prefix: Daily Site Report
```

---

## Daily Alert System

The missing-report alert runs on-demand — no cron job required. On every dashboard load after **08:00 Dubai time**, `alertService` checks whether every active, alert-enrolled engineer submitted a report for the previous day. Admins who have already dismissed the alert for a given date will not see it again.

Engineers can be excluded from the alert individually (e.g. during leave) via the `excludeFromAlerts` flag in master data without deactivating their account.

---

## Security

- Passwords hashed with **bcrypt** (12 salt rounds)
- Sessions stored server-side in MongoDB (never in the cookie)
- Cookies are `httpOnly`, `sameSite: lax`, and `secure` in production
- All routes protected by `requireAuth` and permission guards
- Helmet sets secure HTTP headers on every response
- In-memory rate limiter: 5 login attempts per 15 minutes, 100 API calls per 15 minutes
- Project scope enforcement — viewers with `allowedProjects` cannot submit to out-of-scope sites
- Engineer identity enforcement — linked engineer is always taken from the session, never from the request body

---

## About

**Reporto** was designed and developed by **Kerlos Alfy**, founder of [Kodea Digital Creative Studio](https://kodeaa.com) — a Dubai-based digital studio specialising in full-stack web development, UI/UX design, and custom software for the MENA construction and contracting sector.

| | |
|---|---|
| Developer | Kerlos Alfy |
| Studio | [Kodea Digital Creative Studio](https://kodeaa.com) |
| Website | [kodeaa.com](https://kodeaa.com) |
| Pilot Client | Agile Prime General Contracting L.L.C. |
| Location | Dubai, UAE |

---

<div align="center">

Built with precision in Dubai 🇦🇪 · [kodeaa.com](https://kodeaa.com)

</div>
