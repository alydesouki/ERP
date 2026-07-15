# Project Overview

## Purpose

This is a **full-featured Point-of-Sale (POS) and ERP system** built specifically for **Arabic-speaking shoe retail stores**. It covers the complete business lifecycle of a shoe shop: from receiving stock from suppliers, through daily cashier sales, to financial reporting and payroll.

**Primary goal:** Replace paper-based and fragmented spreadsheet operations with a unified, Arabic-first, real-time digital system that enforces accounting correctness, tracks every stock unit, and provides actionable business intelligence.

**Deployment modes:** The system runs in two modes — as a standard web application (Localhost mode) and as a packaged Windows desktop application (Desktop/Electron mode). Both modes use an identical backend and frontend; only the startup and serving mechanism differs.

---

## Business Domain

| Domain | Specifics |
|---|---|
| **Industry** | Shoe retail (footwear) |
| **Business Model** | Single physical store / single-tenant ERP |
| **Geography** | Arabic-speaking markets (Egypt — default currency EGP) |
| **Scale** | Small-to-medium retail (1–50 employees) |
| **Language** | Arabic UI (RTL layout), English codebase |

---

## Main Modules

| # | Module | Arabic Name | Summary |
|---|---|---|---|
| 1 | **POS / Sales** | نقطة البيع | Cashier terminal: scan → cart → checkout |
| 2 | **Sales History** | سجل المبيعات | Browse/search invoices, view details |
| 3 | **Sales Returns** | مرتجعات المبيعات | Accept returned goods, refund to treasury |
| 4 | **Purchases** | المشتريات | Receive stock from suppliers, pay invoices |
| 5 | **Purchase Returns** | مرتجعات المشتريات | Return defective goods back to suppliers |
| 6 | **Products & Catalog** | المنتجات | Products, variants (size+color), SKU/barcode |
| 7 | **Inventory** | المخزون | Per-warehouse stock, movements, transfers, counts |
| 8 | **Customers** | العملاء | Customer ledger, credit sales, debt collection |
| 9 | **Suppliers** | الموردون | Supplier ledger, payables, payments, statements |
| 10 | **Treasury** | الخزينة | Cash/Card/InstaPay/Wallet drawers, sessions, transfers, adjustments |
| 11 | **Finance** | المالية | Expenses, employees, salaries (daily/weekly/monthly), advances, equity |
| 12 | **Accounting** | المحاسبة | Double-entry journal, chart of accounts |
| 13 | **Reports** | التقارير | Sales, P&L, inventory, treasury, top products |
| 14 | **Admin** | الإدارة | Users, roles, permissions, audit log, settings |
| 15 | **Association Accounts** | حسابات الجمعيات | ROSCA savings group management; withdrawals tracked as receivables, not expenses |

---

## Target Users

| Role | Arabic | Access Level |
|---|---|---|
| **Admin (Owner)** | مدير النظام | Full system access (`*` wildcard) |
| **Manager** | مدير | All ops except user/role management |
| **Cashier** | كاشير | POS terminal only, expense entry |
| **Inventory Staff** | موظف مخزون | Products, purchases, inventory |
| **Accountant** | محاسب | Finance, treasury, reports (no sales create) |

> Roles are defined in [`lib/shared/src/roles.ts`](file:///d:/Erp/ERP/lib/shared/src/roles.ts) and seeded at setup.

---

## Application Workflow

```mermaid
flowchart TD
    A[First Launch] --> B{Setup Wizard}
    B --> C[Create Store + Admin]
    C --> D[Seed Roles]
    D --> E[Login Screen]
    
    E --> F{Role?}
    F -->|Admin/Manager| G[Full Dashboard]
    F -->|Cashier| H[POS Terminal]
    F -->|Accountant| I[Finance & Reports]
    
    G --> J[Products → Add SKU/Barcode]
    J --> K[Purchase → Receive Stock]
    K --> L[Inventory Updated]
    
    H --> M[Scan Barcode → Cart]
    M --> N[Checkout: Cash/Card/Credit]
    N --> O[Invoice Created]
    O --> P[Stock Decremented]
    O --> Q[Treasury Updated]
    O --> R[Journal Entry Posted]
    O --> S[Customer Balance Updated if Credit]
    
    G --> T[Reports: P&L, Low Stock, Top Products]
```

---

## Overall Architecture

The system supports **two deployment modes** using the same codebase:

### Localhost Mode (Development / Web)

```
Browser → Vite Dev Server (port 5173) → [/api/* proxy] → Express API (port 5001) → SQLite
```

The Vite dev server (`artifacts/pos/vite.config.ts`) proxies all `/api/*` requests to the Express API running at `http://localhost:5001`.

### Desktop Mode (Electron / Production)

```
Electron BrowserWindow → Express API (port 5001, child process) → SQLite (AppData)
                                  ↑
                         Also serves the built SPA as static files
```

Electron's main process (`artifacts/desktop/main.js`) spawns the Express API as a child process, then loads the POS UI from `http://localhost:5001`. The API serves both the REST endpoints (at `/api/*`) and the built SPA static files (at `/`).

**Critical constraint:** All API calls from the frontend must use the `/api` prefix — the Express router is mounted at `app.use("/api", router)`. Calls without this prefix return 404 in Desktop mode and hit the Vite dev server in Localhost mode.

---

## High-Level System Design

The system follows a classic **3-tier architecture**:

| Tier | Technology | Responsibility |
|---|---|---|
| **Presentation** | React 18 + Vite + TailwindCSS | RTL UI, routing, state, API calls |
| **Application** | Express 5 + TypeScript | Business logic, auth, validation |
| **Data** | SQLite via libsql/Drizzle ORM | Persistent storage, transactions |

**Key design decisions:**
- **Single SQLite file** — simple deployment, zero external DB server needed for single-store
- **Double-entry accounting** — every financial event auto-generates balanced journal entries
- **Immutable ledgers** — `inventory_movements` and `treasury_transactions` are append-only, never updated
- **Transactional consistency** — each sale/purchase writes inventory + treasury + accounting in one `db.transaction()`
- **Multi-tenant-ready** — every table has `storeId` FK for future SaaS expansion
- **`/api` prefix convention** — all REST routes live under `/api`. Frontend `customFetch` calls and React Query cache keys must always use this prefix.
