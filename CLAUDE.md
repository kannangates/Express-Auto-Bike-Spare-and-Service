# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Style

Use comments sparingly — only for complex or non-obvious logic. Self-explanatory code needs no comment.

---

## What This App Does

**Express Auto Bike Spare and Service** is a full-stack PWA for managing a bike spare parts shop and service centre:

- **Inventory** — stock items by barcode/SKU, category hierarchy, min/max stock thresholds, stock adjustment history
- **Orders** — creation through payment, shipping, and delivery; barcode-scan-to-order; quick counter-sale (single transaction)
- **Returns** — three-step approval-gated workflow; credit note issuance; inventory restock on processed returns
- **Barcode scanning** — camera-based scanner for item lookup, order item addition, stock adjustment
- **RBAC** — 5 roles (OWNER, OPERATIONS, CASHIER, DELIVERY, CUSTOMER); new users require explicit owner approval
- **Notifications** — in-app + email for low stock, order status, user approvals, return status
- **Reports** — PDF/Excel/CSV exports for sales, inventory, customers, and returns
- **Dashboard** — KPI aggregations (revenue, orders, stock health, return rates) with activity feed
- **Offline** — PWA service worker; GET responses cached in IndexedDB; reads work offline, writes blocked with clear messaging

---

## Development Commands

All root-level commands run from the project root via `npm run <command>`:

### Running the App

```bash
npm run docker:dev           # Start all services in Docker (recommended)
npm run docker:hybrid        # Backend in Docker, frontend runs locally
npm run dev                  # Run frontend + backend locally (no Docker)
npm run dev:frontend         # Next.js dev server on :3000
npm run dev:backend          # Django runserver on :8000
```

### Building

```bash
npm run build                # Build frontend + backend
npm run build:frontend       # Next.js production build
npm run build:backend        # Django collectstatic
```

### Testing

```bash
npm run test                 # All tests (frontend + backend)
npm run test:frontend        # Jest unit tests
npm run test:backend         # pytest
npm run test:property        # Property-based tests (hypothesis + fast-check)
# Frontend only:
cd frontend && npm run test:watch       # Jest watch mode
cd frontend && npm run test:coverage    # Coverage report
cd frontend && npm run test:e2e         # Playwright E2E tests
# Backend only (from backend/):
pytest                                  # All tests
pytest path/to/test_file.py::TestClass::test_method  # Single test
pytest --cov                            # With coverage
```

### Linting & Formatting

```bash
npm run lint                 # Lint frontend (ESLint) + backend (flake8)
npm run format               # Format frontend (Prettier) + backend (Black + isort)
npm run type-check           # TypeScript (tsc) + Python (mypy)
```

### Database

```bash
npm run makemigrations       # Generate Django migrations
npm run migrate              # Apply migrations
npm run createsuperuser      # Create Django admin user
npm run shell                # Django interactive shell
```

#### Fresh DB reset (development only)

```bash
docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS express_auto_bike;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE express_auto_bike;"
npm run migrate
```

### Celery (Background Tasks)

```bash
npm run celery:worker        # Start Celery task worker
npm run celery:beat          # Start Celery beat scheduler
```

### Deploy Script

```bash
./deploy.sh                  # Start (auto-detects mode from .env DEPLOYMENT_MODE)
./deploy.sh init             # Initialize DB and create owner accounts
./deploy.sh logs [service]   # View logs (backend, frontend, postgres)
./deploy.sh backup           # Manual database backup
./deploy.sh restore TIMESTAMP
```

---

## Architecture

### Tech Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + Radix UI + React Query
- **Backend**: Django 5.1 + Django REST Framework + PostgreSQL + Redis + Celery
- **Infrastructure**: Docker Compose (3 modes: development, tunnel, production)

### Backend Apps

- `authentication/` — JWT + Google OAuth, custom `CustomUser` model, RBAC with 5 roles, approval workflow
- `inventory/` — Stock items, categories, barcode/SKU tracking, stock transactions
- `orders/` — Customer orders, order items, payment status, order lifecycle
- `returns/` — Return requests, credit notes, refund processing, inventory restock
- `notifications/` — In-app + email notifications; Celery async tasks in `tasks.py`
- `reports/` — PDF/Excel/CSV export generation (ReportLab, openpyxl)
- `dashboard/` — KPI aggregations, analytics endpoints, business settings (Redis-backed)
- `express_auto_bike/` — Django project config; `settings.py` for production, `settings_hybrid.py` for hybrid mode

**API base path**: `/api/v1/`
**API docs**: `/api/schema/swagger-ui/` and `/api/schema/redoc/`

### Frontend Structure

```
frontend/
├── app/                    # Next.js App Router pages
├── components/             # Shared UI components
│   ├── auth/               # ProtectedRoute, login forms
│   ├── barcode/            # BarcodeScanner component
│   ├── dashboard/          # StatsCards, ActivityFeed
│   ├── inventory/          # InventoryTable, InventoryForm
│   ├── layout/             # Sidebar, Header, NetworkStatus
│   ├── notifications/      # NotificationList
│   ├── orders/             # OrderTable, OrderForm
│   ├── reports/            # SalesReport, InventoryReport, etc.
│   ├── returns/            # ReturnTable, ReturnForm
│   └── ui/                 # Radix UI primitives (Button, Alert, etc.)
├── contexts/
│   └── AuthContext.tsx     # Auth state provider — see below
├── hooks/
│   └── useBarcodeScanner.ts  # Camera scanner hook (used by BarcodeScanner, OrderForm, etc.)
├── lib/
│   └── utils.ts            # shadcn/ui helper (cn())
├── types/
│   └── index.ts            # Shared TypeScript types (User, UserRole, ReportFilters, AuthContextValue, etc.)
├── shared/
│   └── constants.ts        # App-wide constants
├── utils/
│   ├── api.ts              # Central API client — handles auth headers, offline fallback
│   ├── auth.ts             # Token read/write, getUserFromToken, isTokenExpired
│   ├── barcodeValidation.ts  # Barcode format validation
│   ├── exportUtils.ts      # Report download (PDF/Excel/CSV trigger)
│   ├── formatting.ts       # Currency and date formatters
│   └── offline-db.ts       # IndexedDB wrapper for offline GET caching
└── middleware.ts           # Next.js edge middleware — JWT decode + route guard
```

### AuthContext (`contexts/AuthContext.tsx`)

Wraps the entire app in `layout.tsx`. Provides:

| Export | Type | Description |
|--------|------|-------------|
| `user` | `User \| null` | Decoded JWT payload: `id`, `email`, `role`, `isApproved` |
| `loading` | `boolean` | True during initial token decode |
| `getAuthToken()` | `() => string \| null` | Returns the raw JWT from localStorage |
| `logout()` | `() => void` | Clears token, redirects to `/login` |
| `hasRole(role)` | `(role: UserRole) => boolean` | Role check helper |
| `hasPermission(perm)` | `(perm: string) => boolean` | Permission check helper |

On mount: reads JWT from `localStorage`, decodes it client-side, then silently verifies with `GET /api/v1/auth/profile/` in the background. If verification fails, the token-decoded user is kept (tolerates brief network blips).

### Frontend Middleware (`middleware.ts`)

Runs at the Next.js edge on every non-static request. Enforces:

1. **Unauthenticated** → redirect to `/login?redirect=<path>`
2. **Expired token** → delete cookie, redirect to `/login`
3. **Unapproved user** → redirect to `/approval-pending`
4. **Insufficient role** → redirect to `/unauthorized`

Role-based route access map:

| Route prefix | Allowed roles |
|---|---|
| `/inventory` | OWNER, OPERATIONS, CASHIER |
| `/orders` | OWNER, OPERATIONS, CASHIER, DELIVERY |
| `/returns` | OWNER, OPERATIONS, CASHIER |
| `/reports` | OWNER, OPERATIONS |
| `/users` | OWNER |
| `/settings` | OWNER |
| `/scan` | OWNER, OPERATIONS, CASHIER |
| `/admin` | OWNER |

Public routes (no auth required): `/`, `/login`, `/simple-login`, `/auth/callback`, `/approval-pending`, `/unauthorized`, `/offline`.

---

## API Reference

### System

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/v1/health/` | Public | Health check — DB + Redis status. Handled by `HealthCheckMiddleware`, not a view. |

### Authentication — `/api/v1/auth/`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `google/login/` | Public | Returns Google OAuth URL |
| GET/POST | `google/callback/` | Public | OAuth callback, issues JWT |
| POST | `register/` | Public | User registration |
| GET/PUT | `profile/` | Authenticated | Current user profile |
| POST | `token/refresh/` | Public | Refresh JWT |
| GET/POST | `token/verify/` | Public | Verify token validity |
| GET | `users/` | OWNER | List all users |
| GET | `users/pending/` | OWNER | List pending approvals |
| POST | `users/<id>/approve/` | OWNER | Approve user registration |
| POST | `users/<id>/reject/` | OWNER | Reject user registration |
| POST | `users/bulk-approve/` | OWNER | Approve multiple users |
| GET/PUT | `users/<id>/profile/` | OWNER | Manage user profile |
| POST | `users/sync-google/` | OWNER | Sync Google account info |

### Inventory — `/api/v1/inventory/`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET/POST | `categories/` | Authenticated | List/create categories |
| GET/PUT/DELETE | `categories/<id>/` | OWNER/OPERATIONS | Category detail |
| GET/POST | `items/` | Authenticated | List/create stock items |
| GET/PUT/DELETE | `items/<id>/` | OWNER/OPERATIONS | Item detail |
| GET | `items/<id>/low_stock/` | Authenticated | Check low stock status |
| POST | `items/<id>/adjust_stock/` | OPERATIONS | Adjust stock quantity |
| GET | `items/<id>/stock_history/` | Authenticated | Stock transaction history |
| GET | `transactions/` | Authenticated | All stock transactions (read-only) |
| POST | `barcode/validate/` | Authenticated | Validate barcode format |
| POST | `items/<pk>/adjust-stock/` | OPERATIONS | Adjust item stock level |
| GET | `low-stock-alerts/` | OPERATIONS | Items below min stock |
| POST | `bulk-operations/` | OPERATIONS | Bulk stock operations |
| POST | `scan/item/` | Authenticated | Scan barcode → return item info |
| POST | `scan/validate/` | Authenticated | Validate barcode format only |

### Orders — `/api/v1/orders/`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET/POST | `orders/` | Authenticated | List/create orders |
| GET/PUT/DELETE | `orders/<id>/` | Authenticated | Order detail |
| GET | `orders/<id>/receipt/` | Authenticated | Generate order receipt |
| POST | `orders/<id>/process/` | CASHIER/OPERATIONS | Process order (deducts inventory with SELECT FOR UPDATE) |
| POST | `orders/<id>/ship/` | OPERATIONS/DELIVERY | Mark as shipped |
| POST | `orders/<id>/deliver/` | DELIVERY | Mark as delivered |
| POST | `orders/<id>/cancel/` | OWNER/OPERATIONS | Cancel order (restores inventory) |
| POST | `orders/<id>/payment/` | CASHIER | Process payment |
| GET | `orders/<id>/credit-check/` | Authenticated | Check available credit for the order's customer |
| POST | `scan/add-item/` | Authenticated | Scan barcode to add item to order |
| POST | `quick-order/` | CASHIER | Counter-sale: create + confirm in one transaction (no separate process step needed) |

### Returns — `/api/v1/returns/`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET/POST | `returns/` | Authenticated | List/create returns |
| GET/PUT/DELETE | `returns/<id>/` | Authenticated | Return detail |
| POST | `returns/<id>/approve/` | OPERATIONS | Approve return request |
| POST | `returns/<id>/process/` | CASHIER | Process return (restores inventory, issues credit) |
| POST | `returns/<id>/reject/` | OPERATIONS | Reject return request |
| GET | `returns/<id>/credit-memo/` | Authenticated | Generate credit memo document |
| POST | `credit/<customer_id>/apply/` | CASHIER | Apply credit to customer account |
| POST | `credit/<customer_id>/use/` | CASHIER | Use credit for an order |
| GET | `credit/<customer_id>/balance/` | Authenticated | Get credit balance |
| GET | `credit/<customer_id>/summary/` | Authenticated | Credit usage summary |
| POST | `credit/bulk-apply/` | OPERATIONS | Bulk credit application |
| GET | `create-from-order/<order_id>/` | Authenticated | Fetch order info to pre-fill return form |

### Notifications — `/api/v1/notifications/`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET/POST | `notifications/` | Authenticated | List/create notifications |
| GET | `notifications/unread/` | Authenticated | Unread notifications |
| GET | `notifications/summary/` | Authenticated | Notification summary with counts |
| POST | `notifications/<id>/mark-read/` | Authenticated | Mark single notification read |
| POST | `notifications/mark-all-read/` | Authenticated | Mark all notifications read |
| GET | `notifications/unread-count/` | Authenticated | Unread count only |
| GET | `preferences/` | Authenticated | Get notification preferences |
| POST | `preferences/update/` | Authenticated | Update notification preferences |
| POST | `system/low-stock/` | OPERATIONS | Trigger low-stock alert notifications |
| POST | `system/pending-approvals/` | OWNER | Trigger pending-approval notifications |
| POST | `system/send-bulk/` | OWNER | Broadcast notification to roles/users |

### Reports — `/api/v1/reports/`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `sales/` | OWNER/OPERATIONS | Sales report (JSON/PDF/Excel/CSV) |
| GET | `inventory/` | OWNER/OPERATIONS | Inventory report |
| GET | `customers/` | OWNER/OPERATIONS | Customer report |
| GET | `returns/` | OWNER/OPERATIONS | Returns report |
| GET | `export/<report_type>/` | OWNER/OPERATIONS | Export in chosen format |
| POST | `export/bulk/` | OWNER | Bulk report export |
| GET | `export/progress/<export_id>/` | Authenticated | Async export job status |

### Dashboard — `/api/v1/dashboard/`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `stats/` | Authenticated | KPI aggregations (revenue, orders, stock, returns) |
| GET | `activity/` | Authenticated | Recent activity feed |
| GET/POST | `settings/` | OWNER | Business settings |

---

## Data Models

### Authentication

**`CustomUser`** (extends `AbstractBaseUser`)
- `email` — unique login identifier (no username)
- `role` — `OWNER | OPERATIONS | CASHIER | DELIVERY | CUSTOMER`
- `is_approved` — False until an OWNER approves; unapproved users cannot access the app
- `google_id`, `google_avatar` — Google OAuth fields
- `is_active`, `is_staff`, `is_superuser`

**`UserProfile`** (OneToOne → CustomUser)
- `first_name`, `last_name`, `phone`, `address`
- `avatar` — uploaded profile photo
- `notification_preferences` — JSONField (`default=dict`). Full default shape:
  ```json
  {
    "email_notifications": true,
    "low_stock_alerts": true,
    "order_updates": true,
    "return_updates": true,
    "user_approval_requests": true,
    "system_alerts": true
  }
  ```
  When adding a new preference key, update the default in both the model and `NotificationPreferencesView`.

### Inventory

**`InventoryCategory`**
- `name`, `description`, `slug`
- `parent` — self-FK for category hierarchy

**`InventoryItem`**
- `barcode` — unique, primary lookup key
- `sku` — unique internal SKU
- `name`, `description`, `category` (FK)
- `unit_price`, `cost_price`
- `stock_quantity` — current stock level
- `min_stock_level`, `max_stock_level` — alert thresholds
- `is_active`

**`StockTransaction`**
- `item` (FK → InventoryItem), `transaction_type` (`IN` / `OUT` / `ADJUSTMENT` / `RETURN`)
- `quantity`, `balance_before`, `balance_after`
- `reference_type`, `reference_id` — links to the causing order/return
- `created_by`

### Orders

**`CustomerOrder`**
- `order_number` — auto-generated `ORD-YYYYMMDD-NNNN` by a **PostgreSQL trigger** (never generate in Python)
- `customer` (FK → CustomUser), `created_by`
- `status` — `PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED | CANCELLED`
- `payment_status` — `UNPAID | PARTIAL | PAID | REFUNDED`
- `payment_method` — `CASH | CARD | CREDIT | MIXED`
- `subtotal`, `tax_amount`, `discount_amount`, `total_amount`
- `notes`, `shipping_address`

**`OrderItem`**
- `order` (FK), `item` (FK → InventoryItem via barcode)
- `item_name`, `barcode` — denormalised snapshot at time of order
- `quantity`, `unit_price`, `total_price`

### Returns

**`CustomerReturn`**
- `return_number` — auto-generated `RET-YYYYMMDD-NNNN` by a **PostgreSQL trigger** (never generate in Python)
- `order` (FK → CustomerOrder), `customer` (FK)
- `status` — `PENDING → APPROVED → PROCESSED | REJECTED`
- `return_reason`, `return_reason_details`, `notes`
- `total_amount`, `credit_amount`, `refund_amount`, `restocking_fee`
- `approved_by`, `approved_at`, `processed_by`, `processed_at`

**`ReturnItem`**
- `return_obj` (FK → CustomerReturn), `order_item` (FK)
- `barcode`, `item_name` — snapshot
- `quantity`, `unit_price`, `total_price`
- `condition` — `NEW | GOOD | DAMAGED | DEFECTIVE`
- `restockable` — boolean; only restockable items have inventory restored on processing

**`CustomerCredit`** (one per customer)
- `customer` (OneToOne), `balance`, `total_earned`, `total_used`

**`CreditTransaction`**
- `customer`, `transaction_type` (`CREDIT | DEBIT`)
- `amount`, `balance_before`, `balance_after`
- `reference_type`, `reference_id`, `description`

### Notifications

**`Notification`**
- `recipient`, `sender` (FK → CustomUser)
- `notification_type` — one of: `LOW_STOCK | ORDER_STATUS | USER_APPROVAL | USER_APPROVED | USER_REJECTED | RETURN_CREATED | RETURN_APPROVED | RETURN_PROCESSED | SYSTEM_ALERT | GENERAL`. Defined in `notifications/models.py:NOTIFICATION_TYPE_CHOICES`. When adding a new type, also add it to `template_map` in `notifications/tasks.py:send_notification_email` (or it falls back to `email_notification.html`).
- `title`, `message`
- `data` — JSONField for structured payload (item lists, counts, etc.)
- `is_read`, `read_at`

---

## Frontend Page Map

| Route | Purpose | Key Components |
|-------|---------|---------------|
| `/` | Public homepage | Marketing/landing content |
| `/login` | Login with Google OAuth or email | GoogleOAuthButton, LoginForm |
| `/simple-login` | Email/password fallback login | LoginForm |
| `/auth/callback` | Google OAuth redirect handler | Reads code param, exchanges for JWT |
| `/approval-pending` | Shown after registration; polls for approval | Status polling |
| `/dashboard` | KPI metrics + activity feed | StatsCards, ActivityFeed, charts |
| `/inventory` | Inventory list with search/filter | InventoryTable, BarcodeScanner |
| `/inventory/new` | Add new stock item | InventoryForm |
| `/orders` | Order list with status filter | OrderTable, OrderStatus badges |
| `/orders/new` | Create order with barcode scanning | OrderForm, BarcodeScanner |
| `/returns` | Returns list with status filter | ReturnTable |
| `/scan` | Standalone barcode scanner | BarcodeScanner, item lookup result |
| `/reports` | Report generation and download | SalesReport, InventoryReport, CustomerReport, ReturnReport |
| `/notifications` | Notification inbox | NotificationList, mark-read actions |
| `/notifications/preferences` | Toggle notification preferences | PreferencesForm |
| `/users` | User management (OWNER only) | UserTable, approve/reject actions |
| `/settings` | Business settings (OWNER only) | SettingsForm (Redis-backed) |
| `/unauthorized` | Shown when role lacks permission | Static message |
| `/offline` | Shown by SW when fully offline | Cached data availability check |
| `/logout` | Clears JWT, redirects to login | — |

---

## Key Architecture Patterns

### Authentication Flow

1. User registers → `is_approved=False`, redirected to `/approval-pending`
2. OWNER approves via `POST /api/v1/auth/users/<id>/approve/`
3. JWT issued on login (access + refresh tokens)
4. JWT stored in cookie (`auth-token`) and `localStorage` (`auth_token`); cookie is the authoritative source in `middleware.ts`, localStorage is used in-browser by `utils/auth.ts`
5. `frontend/middleware.ts` decodes JWT client-side at the edge for routing (signature verified at the API level only)
6. `contexts/AuthContext` provides `user`, `role`, `getAuthToken()` to all components
7. Google OAuth: `google/login/` → Google → `google/callback/` → JWT issued

### Order Lifecycle

```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
                                           ↘ CANCELLED (inventory restored)
```

- Creating an order does **not** deduct inventory
- `POST orders/<id>/process/` deducts stock using `SELECT FOR UPDATE` on `InventoryItem` rows to prevent race conditions when concurrent orders touch the same item
- `POST orders/<id>/cancel/` restores stock via a `StockTransaction` (type `IN`)
- Payment is separate from fulfilment status — an order can be `DELIVERED` but `UNPAID`
- **Quick order** (`POST quick-order/`): counter-sale shortcut for CASHIER — creates, adds items, confirms, and checks stock in a single atomic transaction. Skips the separate `process/` step.

### Returns Workflow

Returns are **never** auto-approved. Three explicit steps:

1. `POST /api/v1/returns/` — creates in `PENDING`
2. `POST /api/v1/returns/<id>/approve/` — OPERATIONS sets `APPROVED`
3. `POST /api/v1/returns/<id>/process/` — CASHIER sets `PROCESSED`, restores inventory for `restockable` items only, issues `CustomerCredit`

### RBAC Permissions

Enforced via `authentication/permissions.py`. Key classes:
- `OwnerOnlyPermission` — OWNER role only
- `OperationsPermission` — OWNER + OPERATIONS
- `CashierPermission` — OWNER + OPERATIONS + CASHIER
- `IsApprovedUser` — any approved user

Role hierarchy (highest to lowest): `OWNER > OPERATIONS > CASHIER > DELIVERY > CUSTOMER`

### Offline / PWA

- `next-pwa` generates a service worker at build time; SW URL pattern matches `/api/v1/`
- SW caches static assets; API GETs are cached in IndexedDB via `frontend/utils/offline-db.ts`
- `frontend/utils/api.ts` — on network failure for GETs, falls back to IndexedDB cache
- Mutation requests (POST/PUT/DELETE) fail immediately with a clear error message — no silent background queue (intentional: inventory/order accuracy requires real-time writes)
- `NetworkStatus.tsx` shows a non-blocking amber banner when offline; green banner on reconnect

---

## Background Tasks (Celery)

Celery app: `express_auto_bike/celery.py` (instance name `express_auto_bike`). Auto-loaded via `express_auto_bike/__init__.py` which imports `celery_app`. Auto-discovers tasks in installed apps.

Run worker and beat together — `celery-beat` is required for the scheduled tasks below to fire. Both services are wired in `docker-compose.yml`, `docker-compose.prod.yml`, and `docker-compose.tunnel.yml`.

Tasks defined in `notifications/tasks.py`:

| Task | Trigger | Description |
|------|---------|-------------|
| `notifications.tasks.send_notification_email` | Called from views/models when a notification is created | Renders the type-specific HTML template + plain-text fallback and sends via `EmailMultiAlternatives`. Retries 3× with 60s delay. |
| `notifications.tasks.send_bulk_notifications` | Manual trigger (admin/system bulk) | Calls `send_notification_email.delay(id)` for each notification id in the list. |
| `notifications.tasks.send_low_stock_alerts` | Beat — every 1 hour | Queries `InventoryItem` rows below `min_stock_level`, creates `LOW_STOCK` notifications for OWNER/OPERATIONS users. |
| `notifications.tasks.cleanup_expired_notifications` | Beat — daily | Purges expired notifications past `expires_at`. |
| `notifications.tasks.send_user_approval_notifications` | Beat — every 2 hours | Reminds OWNERs about pending user approvals (only sends when there are pending users). |

Beat schedule keys are configured in `settings.py` under `CELERY_BEAT_SCHEDULE`:
- `send-low-stock-alerts` (3600s)
- `send-user-approval-notifications` (7200s)
- `cleanup-expired-notifications` (86400s)

Celery uses Redis as both broker and result backend (`CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` from `.env`).

### Email Templates

`send_notification_email` renders one of these templates based on `notification.notification_type` (mapped in `tasks.py:template_map`); unmapped types fall back to `notifications/email_notification.html`:

| Type | Template (under `notifications/templates/notifications/`) |
|---|---|
| `USER_APPROVAL` | `user_approval_request.html` |
| `USER_APPROVED` | `user_approved.html` |
| `USER_REJECTED` | `user_rejected.html` |
| `LOW_STOCK` | `low_stock_alert.html` |
| `ORDER_STATUS` | `order_status_update.html` |
| `RETURN_PROCESSED` | `return_processed.html` |
| `SYSTEM_ALERT` | `system_alert.html` |
| _default_ | `email_notification.html` |

`_whatsapp_button.html` is a partial included by other templates for click-to-chat.

---

## Database Setup

Migrations are intentionally minimal — one clean file per app:

| File | Purpose |
|------|---------|
| `*/migrations/0001_initial.py` | Auto-generated model schema (one per app) |
| `inventory/migrations/0002_db_setup.py` | All custom SQL: pg extensions, stored functions, triggers, indexes, reporting views, seed data |

`0002_db_setup.py` installs:
- `uuid-ossp` and `pg_trgm` PostgreSQL extensions
- Stored functions for order number (`ORD-YYYYMMDD-NNNN`) and return number (`RET-YYYYMMDD-NNNN`) generation
- Triggers to auto-call these functions on `INSERT` — the fields are populated by the DB, not Python
- GIN trigram indexes on item name/barcode for fast fuzzy search
- Reporting views (`inventory_summary_view`, `sales_summary_view`, `returns_summary_view`)
- Seed data: default categories and a sample inventory item

To regenerate after model changes: `npm run makemigrations && npm run migrate`

---

## Redis Usage

Redis serves two roles:

1. **Celery broker + result backend** — all async task queuing goes through Redis (`REDIS_URL`)
2. **Django cache backend** (`django_redis`) — business settings stored at key `business_settings` with `timeout=None` (persistent, never expires). Read/written via `GET/POST /api/v1/dashboard/settings/`

---

## Configuration

Single `.env` file at project root controls all services. Key variables:

```bash
DEPLOYMENT_MODE=development|tunnel|production
NEXT_PUBLIC_API_URL=http://localhost:8000
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/express_auto_bike
REDIS_URL=redis://redis:6379/0
SECRET_KEY=<50-char string>
DEBUG=1
POSTGRES_PORT=5433          # avoids conflict with local postgres on 5432

# Google OAuth (required for /login Google button)
GOOGLE_OAUTH_CLIENT_ID=<from Google Cloud Console>
GOOGLE_OAUTH_CLIENT_SECRET=<from Google Cloud Console>

# Email notifications (defaults to console backend if omitted)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=<SMTP API key>
```

Copy `.env.example` to `.env` to get started.

---

## Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Base: postgres, redis, backend, frontend, **celery-worker**, **celery-beat** |
| `docker-compose.override.yml` | Local dev overrides (auto-loaded with base) |
| `docker-compose.prod.yml` | Production: Traefik SSL, custom domains, celery-worker, celery-beat |
| `docker-compose.tunnel.yml` | Cloudflare Tunnel for free public access; includes celery-worker and celery-beat |

NPM script shortcuts (defined in root `package.json`):

| Script | Equivalent |
|---|---|
| `npm run docker:dev` | `docker-compose up -d` |
| `npm run docker:prod` | `docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d` |
| `npm run docker:tunnel` | `docker-compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d` |
| `npm run docker:hybrid` | `docker-compose up -d postgres redis backend` (frontend runs locally) |
| `npm run docker:down` | `docker-compose down` |
| `npm run docker:logs` | `docker-compose logs -f` |

---

## Logs

Django logs write to `backend/logs/django.log`. Tail it with:
```bash
tail -f backend/logs/django.log
# or via Docker:
npm run docker:logs -- -f backend
```

---

## Common Gotchas

### JWT Token Generation

Always use `timezone.now()` from `django.utils`, never `datetime.utcnow()` (deprecated in Python 3.12, incompatible with Django's `USE_TZ=True`):

```python
from django.utils import timezone
payload = {
    'exp': timezone.now() + timedelta(hours=1),
    'iat': timezone.now(),
}
```

### Order/Return Number Generation

`order_number` and `return_number` are populated by **PostgreSQL triggers** installed in `0002_db_setup.py`. Never set them in Python — just call `CustomerOrder.objects.create(...)` without the field and the trigger fills it.

### Inventory Race Conditions

`process_order()` uses `SELECT FOR UPDATE` on the `InventoryItem` rows involved:

```python
locked_items = InventoryItem.objects.select_for_update().filter(id__in=item_ids)
```

Any code path that deducts stock must also use `select_for_update()` inside an atomic transaction, or concurrent requests will produce negative stock counts.

### JSONField Defaults

Django cannot serialize `lambda` functions into migration files. Always use `default=dict` (not `default=lambda: {}`):

```python
# Wrong — breaks makemigrations:
data = models.JSONField(default=lambda: {})

# Correct:
data = models.JSONField(default=dict)
```

### Circular Imports

`orders` and `inventory` are mutually dependent. Import `InventoryItem` inside method bodies, not at module top:

```python
def process_order(self):
    from inventory.models import InventoryItem  # avoids circular import
    ...
```

### Offline Writes

Mutation requests (POST/PUT/DELETE) must **never** be silently queued for later. Inventory and order data requires real-time accuracy — a queued order placed while offline could reference stock that no longer exists when it eventually syncs. Show a clear error instead.

### Notification Types Must Stay In Sync

Three places define the notification type taxonomy and must agree:

1. `notifications/models.py:NOTIFICATION_TYPE_CHOICES` — the source of truth (model field choices)
2. `notifications/migrations/0001_initial.py` — the same choices are inlined into the migration's `models.CharField(choices=[...])`. Update both when adding a type.
3. `notifications/tasks.py:send_notification_email:template_map` — maps the type to an email template. Unmapped types fall back to `email_notification.html` (still works, but loses the type-specific layout).

Also confirm a corresponding template file exists under `notifications/templates/notifications/`.

### Frontend API Calls

Use the `api` helper in `utils/api.ts` (`api.get`, `api.post`, etc.) — never raw `fetch()`. The helper handles:
- JWT auth header + token refresh on 401
- SSR vs browser base URL (browser uses Next.js rewrite proxy, SSR uses `NEXT_PUBLIC_API_URL`)
- Offline IndexedDB cache fallback for GETs
- Standardized `ApiException` with status + data

Raw `fetch()` is acceptable only for blob downloads (e.g. report file export), where the helper's JSON-decoding path doesn't fit.

### `react-hooks/exhaustive-deps` Warnings

When a `useEffect` deliberately depends on a subset of state (e.g. fetch-on-filter-change pattern that resets pagination), use a targeted `// eslint-disable-next-line react-hooks/exhaustive-deps` *immediately above the deps array line* — not above the `useEffect(` line. Suppressing on the `useEffect(` line does not silence the warning.
