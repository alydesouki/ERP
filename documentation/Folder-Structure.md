# Folder Structure

> Every folder and file documented from direct inspection of the project.

---

## Root Workspace

```
ERP/
├── artifacts/                  ← Deployable applications
│   ├── api-server/             ← Backend REST API (Express 5)
│   ├── pos/                    ← Frontend POS SPA (React + Vite)
│   └── desktop/                ← Electron desktop wrapper (PRODUCTION)
├── lib/                        ← Shared internal packages
│   ├── db/                     ← Database schema + Drizzle client + migration scripts
│   ├── shared/                 ← Permissions catalog + default roles
│   ├── api-client-react/       ← Orval-generated React Query hooks
│   └── api-zod/                ← Zod schemas for API contracts
├── documentation/              ← Project documentation (this folder)
├── node_modules/               ← Root workspace dependencies
├── package.json                ← Root workspace config + pnpm settings
├── pnpm-workspace.yaml         ← Workspace glob patterns + dependency catalog
├── pnpm-lock.yaml              ← Lockfile
├── tsconfig.base.json          ← Shared TypeScript compiler base config
├── tsconfig.json               ← Root references tsconfig
└── .npmrc                      ← pnpm hoisting configuration
```

---

## `artifacts/api-server/` — Backend API

```
artifacts/api-server/
├── src/
│   ├── index.ts                ← Entry point: loads DB, runs migrations, starts HTTP server on PORT
│   ├── app.ts                  ← Express app factory: middleware stack, mounts router at /api, error handler
│   │                              When SERVE_STATIC=true, also serves built SPA from dist/pos/
│   ├── routes/                 ← One file per API domain
│   │   ├── index.ts            ← Aggregates all routers under /api/*
│   │   ├── health.ts           ← GET /healthz + /health (alive check for Electron polling)
│   │   ├── auth.ts             ← Setup wizard, login, refresh, logout, /me
│   │   ├── users.ts            ← User CRUD, password reset, soft delete
│   │   ├── roles.ts            ← Role CRUD, permission assignment
│   │   ├── permissions.ts      ← GET /permissions (catalog list)
│   │   ├── audit.ts            ← Audit log viewer (read-only)
│   │   ├── catalog.ts          ← Categories, brands, colors, sizes CRUD
│   │   ├── products.ts         ← Products + variants CRUD, barcode lookup, full-text search
│   │   ├── warehouses.ts       ← Warehouse CRUD
│   │   ├── inventory.ts        ← Stock view, adjustments, movements log
│   │   ├── inventory-ops.ts    ← Transfers (create/complete/cancel), stock counts
│   │   ├── customers.ts        ← Customer CRUD, statements, payments
│   │   ├── suppliers.ts        ← Supplier CRUD, statements (with invoice numbers), payments
│   │   ├── sales.ts            ← Invoices (create/list/detail), returns, suspended orders
│   │   ├── purchases.ts        ← Purchase invoices (create/list/detail), returns, payments
│   │   │                          Always creates supplier_transactions for all invoice types
│   │   ├── treasury.ts         ← Treasury accounts, sessions (open/close), transactions
│   │   │                          Also: POST /treasury/transfers, POST /treasury/adjustments
│   │   ├── finance.ts          ← Expenses, employees, salaries (with pay_period_type), advances, equity
│   │   ├── dashboard.ts        ← KPI aggregates for dashboard cards + charts
│   │   ├── reports.ts          ← 8 report endpoints (sales, inventory, P&L, etc.)
│   │   ├── settings.ts         ← Store settings, document sequences
│   │   └── notifications.ts    ← Notifications CRUD, mark read, generate alerts
│   ├── middleware/
│   │   └── auth.ts             ← requireAuth + requirePermission + requireAnyPermission
│   └── lib/
│       ├── config.ts           ← JWT secrets, TTLs, cookie config from env
│       ├── logger.ts           ← Pino logger instance
│       ├── jwt.ts              ← signAccessToken, signRefreshToken, verify functions
│       ├── password.ts         ← hashPassword, verifyPassword (bcryptjs)
│       ├── tokens.ts           ← hashToken (SHA-256 of refresh token for DB storage)
│       ├── audit.ts            ← writeAuditLog helper
│       ├── seed.ts             ← ensureStoreFinancials (seeds treasury accounts + CoA)
│       ├── treasury.ts         ← postTreasuryTransaction (updates balance + inserts tx)
│       ├── accounting.ts       ← postJournalEntry (inserts balanced debit/credit lines)
│       ├── inventory.ts        ← postInventoryMovement (updates cached qty + inserts movement)
│       ├── sequences.ts        ← nextDocumentNumber (atomic increment for invoice numbers)
│       ├── money.ts            ← cents(), money(), toNum() — decimal string helpers
│       └── analytics-service.ts← Aggregation helpers for P&L report
├── dist/                       ← Built output (esbuild bundle — index.mjs)
│   └── pos/                    ← Built React SPA (copied here by build-all.mjs for Desktop mode)
├── build.mjs                   ← esbuild build script
├── sqlite.db                   ← Local development SQLite database
├── package.json
└── tsconfig.json
```

---

## `artifacts/pos/` — Frontend SPA

```
artifacts/pos/
├── src/
│   ├── main.tsx                ← React DOM render root; mounts <App />
│   ├── App.tsx                 ← Router + QueryClientProvider + AuthProvider + Gateway
│   ├── index.css               ← TailwindCSS base + custom RTL variables + animations
│   ├── pages/                  ← Page-level components (one per route)
│   │   ├── login.tsx           ← Login form
│   │   ├── setup.tsx           ← First-run setup wizard
│   │   ├── dashboard.tsx       ← KPI cards + charts
│   │   ├── pos.tsx             ← POS terminal (cart, barcode+Arabic scanner, checkout)
│   │   ├── products.tsx        ← Product + variant management
│   │   ├── master-data.tsx     ← Categories, brands, colors, sizes tabs
│   │   ├── warehouses.tsx      ← Warehouse CRUD
│   │   ├── stock.tsx           ← Per-warehouse stock view + adjustments
│   │   ├── movements.tsx       ← Inventory movement log
│   │   ├── transfers.tsx       ← Inter-warehouse transfer management
│   │   ├── stock-counts.tsx    ← Stock count sessions
│   │   ├── sales-history.tsx   ← Invoice list + detail drawer
│   │   ├── sales-returns.tsx   ← Sales return create + list
│   │   ├── purchase-returns.tsx← Purchase return create + list
│   │   ├── purchases.tsx       ← Purchase invoice create + list (uses QuickProductModal)
│   │   ├── customers.tsx       ← Customer CRUD + statement + payments
│   │   ├── suppliers.tsx       ← Supplier CRUD + statement (with invoice numbers) + payments
│   │   ├── treasury.tsx        ← Treasury accounts, sessions, transactions,
│   │   │                          transfers (TransferModal), adjustments (AdjustmentModal)
│   │   ├── finance.tsx         ← Expenses, employees, salaries (pay period), advances, equity
│   │   ├── reports.tsx         ← Reports hub with 8 tabs
│   │   ├── users.tsx           ← User management
│   │   ├── roles.tsx           ← Role + permission editor
│   │   ├── audit.tsx           ← Audit log viewer
│   │   ├── settings.tsx        ← Store settings + document sequences
│   │   └── not-found.tsx       ← 404 page
│   ├── components/
│   │   ├── app-shell.tsx       ← Navigation sidebar + header + layout shell
│   │   ├── barcode-label-print-modal.tsx ← Print barcode labels for products
│   │   ├── modal.tsx           ← Generic modal wrapper
│   │   ├── notification-bell.tsx← Bell icon, unread count, dropdown
│   │   ├── page-header.tsx     ← Reusable page title + breadcrumb
│   │   ├── print-portal.tsx    ← React portal for print-only DOM injection
│   │   ├── quick-product-modal.tsx ← Fast product creation during purchase invoicing
│   │   │                              Uses customFetch("/api/products", ...) [POST]
│   │   ├── thermal-receipt.tsx ← Thermal printer receipt template
│   │   └── ui/                 ← shadcn/ui components (generated primitives)
│   ├── hooks/                  ← Custom React hooks
│   └── lib/
│       ├── auth.tsx            ← AuthContext + AuthProvider + useAuth hook
│       ├── barcode-input.ts    ← useBarcodeInput: timing-based scanner vs human typing discrimination
│       │                          normalizeBarcodeInput: Arabic keyboard layout → English for barcodes
│       ├── format.ts           ← Shared number/date formatting
│       ├── print-document-styles.ts ← CSS for printed receipt documents
│       ├── printer-settings.ts ← Printer settings persistence (localStorage + Electron IPC)
│       ├── query-client.ts     ← TanStack QueryClient + MutationCache invalidation
│       └── utils.ts            ← General utilities
├── public/                     ← Static assets (favicon, etc.)
├── index.html                  ← Vite HTML entry point
├── vite.config.ts              ← Vite config: React plugin, proxy /api → :5001
├── components.json             ← shadcn/ui configuration
├── package.json
└── tsconfig.json               ← Uses project references → lib/api-client-react
```

---

## `artifacts/desktop/` — Electron Desktop Wrapper

```
artifacts/desktop/
├── main.js                     ← Electron main process (Node.js)
│                                  - Generates/loads SESSION_SECRET
│                                  - Spawns API server child process
│                                  - Polls /api/healthz for readiness
│                                  - Creates BrowserWindow → loads localhost:5001
│                                  - Handles IPC: print-html, get-printers
│                                  - Auto-updater (packaged builds only)
├── preload.js                  ← contextBridge: exposes window.electronAPI to renderer
│                                  - printHtml(html, options) → IPC to main
│                                  - getPrinters() → IPC to main
├── electron-builder.yml        ← Packaging config: NSIS installer, auto-update
├── build-all.mjs               ← Orchestrates full build pipeline
├── assets/
│   ├── icon.png                ← App window icon
│   └── seed.db                 ← Packaged empty SQLite DB (copied on first launch)
├── package.json
└── tsconfig.json
```

---

## `lib/db/` — Database Package

```
lib/db/
├── src/
│   ├── index.ts                ← Exports db client + all schema tables
│   └── schema/                 ← Drizzle schema files (one per domain)
│       ├── stores.ts           ← stores table (tenant root)
│       ├── roles.ts            ← roles table (RBAC)
│       ├── users.ts            ← users table (authentication)
│       ├── sessions.ts         ← sessions table (refresh token sessions)
│       ├── audit-logs.ts       ← audit_logs table (immutable)
│       ├── catalog.ts          ← categories, brands, colors, sizes
│       ├── products.ts         ← products, product_variants
│       ├── warehouses.ts       ← warehouses
│       ├── inventory.ts        ← inventory_items (cached), inventory_movements (ledger)
│       ├── inventory-extended.ts← warehouse_transfers, stock_counts + items
│       ├── customers.ts        ← customers, customer_transactions
│       ├── suppliers.ts        ← suppliers, supplier_transactions
│       ├── sales.ts            ← invoices, invoice_items, invoice_payments, sales_returns, suspended_orders
│       ├── purchases.ts        ← purchase_invoices, purchase_items, purchase_payments, purchase_returns
│       ├── treasury.ts         ← treasury_accounts, treasury_sessions, treasury_transactions
│       │                          treasury_transfers, treasury_adjustments
│       ├── accounting.ts       ← accounting_accounts, accounting_transactions, accounting_transaction_lines
│       ├── finance.ts          ← expense_categories, expenses, employees, salary_records, employee_advances, equity_movements
│       ├── notifications.ts    ← notifications
│       ├── settings.ts         ← store_settings, number_sequences
│       └── index.ts            ← Re-exports all schemas
├── migrate-store-db.cjs        ← Manual supplemental migration script
│                                  Run: node lib/db/migrate-store-db.cjs
│                                  Creates treasury_transfers, treasury_adjustments;
│                                  Adds salary_records columns: pay_period_type, advance_deduction, other_deductions
├── drizzle.config.ts           ← Drizzle Kit config for migrations
├── package.json
└── tsconfig.json
```

---

## `lib/api-client-react/` — Generated React Query Client

```
lib/api-client-react/
├── src/
│   ├── index.ts                ← Re-exports everything from generated/ and custom-fetch
│   ├── custom-fetch.ts         ← Base fetch with auth header injection + error handling
│   │                              setBaseUrl(), setAuthTokenGetter(), ApiError class
│   └── generated/
│       ├── api.ts              ← All React Query hooks (useListX, useCreateX, etc.)
│       │                          All query keys use /api/* prefix (e.g. ["/api/treasury/accounts"])
│       └── api.schemas.ts      ← TypeScript interfaces for all API request/response types
│                                  Including SupplierTransaction (with invoiceNumber field)
├── dist/                       ← Pre-built .d.ts declaration files (used by project references)
│   └── generated/
│       ├── api.d.ts
│       └── api.schemas.d.ts    ← Must be rebuilt after schema changes: pnpm --filter @workspace/api-client-react exec tsc --build
├── package.json                ← exports: "./src/index.ts" (source-first, consumed via project references)
└── tsconfig.json               ← composite: true, emitDeclarationOnly, outDir: dist
```

> **Important:** When editing `api.schemas.ts` or `api.ts`, you must rebuild the `dist/` `.d.ts` files for consuming packages (like `pos`) to pick up the changes. Run:
> ```bash
> pnpm --filter @workspace/api-client-react exec tsc --build
> ```

---

## `lib/shared/` — Shared Utilities

```
lib/shared/
├── src/
│   ├── index.ts                ← Re-exports
│   ├── permissions.ts          ← PERMISSION_GROUPS catalog, hasPermission(), ALL_PERMISSIONS
│   └── roles.ts                ← DEFAULT_ROLES array, ADMIN_ROLE_KEY constant
├── package.json
└── tsconfig.json
```

---

## `lib/api-zod/` — Zod Validation Schemas

```
lib/api-zod/
└── src/
    └── index.ts                ← Zod schemas for all API request bodies
                                   Used by the API server routes for input validation
```
