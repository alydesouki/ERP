# Folder Structure

> Every folder and file documented from direct inspection of the project.

---

## Root Workspace

```
Shoe-Store-Design/
├── artifacts/                  ← Deployable applications
│   ├── api-server/             ← Backend REST API (Express 5)
│   ├── pos/                    ← Frontend POS SPA (React + Vite)
│   └── mockup-sandbox/         ← UI mockup/design sandbox (not production)
├── lib/                        ← Shared internal packages
│   ├── db/                     ← Database schema + Drizzle client
│   ├── shared/                 ← Permissions catalog + default roles
│   ├── api-client-react/       ← Orval-generated React Query hooks
│   └── api-zod/                ← Zod schemas for API contracts
├── scripts/                    ← Build/maintenance scripts
├── node_modules/               ← Root workspace dependencies
├── package.json                ← Root workspace config + pnpm settings
├── pnpm-workspace.yaml         ← Workspace glob patterns + dependency catalog
├── pnpm-lock.yaml              ← Lockfile (224 KB)
├── tsconfig.base.json          ← Shared TypeScript compiler base config
├── tsconfig.json               ← Root references tsconfig
├── sqlite.db                   ← Root-level SQLite DB (development)
├── replit.md                   ← Project documentation + architecture notes
└── .npmrc                      ← pnpm hoisting configuration
```

---

## `artifacts/api-server/` — Backend API

```
artifacts/api-server/
├── src/
│   ├── index.ts                ← Entry point: loads DB, starts HTTP server on PORT
│   ├── app.ts                  ← Express app factory: middleware stack, router mount, error handler
│   ├── routes/                 ← One file per API domain (22 files)
│   │   ├── index.ts            ← Aggregates all routers under /api/*
│   │   ├── health.ts           ← GET /health (alive check)
│   │   ├── auth.ts             ← Setup wizard, login, refresh, logout, /me
│   │   ├── users.ts            ← User CRUD, password reset, soft delete
│   │   ├── roles.ts            ← Role CRUD, permission assignment
│   │   ├── permissions.ts      ← GET /permissions (catalog list)
│   │   ├── audit.ts            ← Audit log viewer (read-only)
│   │   ├── catalog.ts          ← Categories, brands, colors, sizes CRUD
│   │   ├── products.ts         ← Products + variants CRUD, barcode lookup
│   │   ├── warehouses.ts       ← Warehouse CRUD
│   │   ├── inventory.ts        ← Stock view, adjustments, movements log
│   │   ├── inventory-ops.ts    ← Transfers (create/complete/cancel), stock counts
│   │   ├── customers.ts        ← Customer CRUD, statements, payments
│   │   ├── suppliers.ts        ← Supplier CRUD, statements, payments
│   │   ├── sales.ts            ← Invoices (create/list/detail), returns, suspended orders
│   │   ├── purchases.ts        ← Purchase invoices (create/list/detail), returns, payments
│   │   ├── treasury.ts         ← Treasury accounts, sessions (open/close), transactions
│   │   ├── finance.ts          ← Expenses, employees, salaries, advances, equity
│   │   ├── dashboard.ts        ← KPI aggregates for dashboard cards + charts
│   │   ├── reports.ts          ← 8 report endpoints (sales, inventory, P&L, etc.)
│   │   ├── settings.ts         ← Store settings, document sequences
│   │   └── notifications.ts    ← Notifications CRUD, mark read, generate alerts
│   ├── middleware/
│   │   └── auth.ts             ← requireAuth + requirePermission + requireAnyPermission
│   ├── middlewares/            ← (duplicate folder — see Code Audit)
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
├── dist/                       ← Built output (esbuild bundle)
├── build.mjs                   ← esbuild build script
├── sqlite.db                   ← Local development SQLite database
├── package.json
├── tsconfig.json
├── typescript_errors.log       ← Logged typecheck errors (see Code Audit)
│
│ ── Debug/Test Scripts (see Code Audit) ──
├── audit-timestamps.cjs
├── debug-checkout.cjs
├── fix-reports-sql.cjs
├── patch-all.cjs
├── patch-reports.cjs
├── refactor-pl.cjs
├── repair-timestamps.cjs
├── test-auth-reports.cjs
├── test-checkout.cjs
├── test-for-update.cjs
├── test-queries.mjs
├── test-req.cjs
├── test-timestamp.cjs
├── unlock-admin.cjs
└── update-orm-mode.cjs
```

---

## `artifacts/pos/` — Frontend SPA

```
artifacts/pos/
├── src/
│   ├── main.tsx                ← React DOM render root; mounts <App />
│   ├── App.tsx                 ← Router + QueryClientProvider + AuthProvider + Gateway
│   ├── index.css               ← TailwindCSS base + custom RTL variables + animations
│   ├── pages/                  ← 25 page-level components (one per route)
│   │   ├── login.tsx           ← Login form
│   │   ├── setup.tsx           ← First-run setup wizard
│   │   ├── dashboard.tsx       ← KPI cards + charts
│   │   ├── pos.tsx             ← POS terminal (cart, barcode, checkout)
│   │   ├── products.tsx        ← Product + variant management (54 KB — largest page)
│   │   ├── master-data.tsx     ← Categories, brands, colors, sizes tabs
│   │   ├── warehouses.tsx      ← Warehouse CRUD
│   │   ├── stock.tsx           ← Per-warehouse stock view + adjustments
│   │   ├── movements.tsx       ← Inventory movement log
│   │   ├── transfers.tsx       ← Inter-warehouse transfer management
│   │   ├── stock-counts.tsx    ← Stock count sessions
│   │   ├── sales-history.tsx   ← Invoice list + detail drawer
│   │   ├── sales-returns.tsx   ← Sales return create + list
│   │   ├── purchase-returns.tsx← Purchase return create + list
│   │   ├── purchases.tsx       ← Purchase invoice create + list
│   │   ├── customers.tsx       ← Customer CRUD + statement + payments
│   │   ├── suppliers.tsx       ← Supplier CRUD + statement + payments
│   │   ├── treasury.tsx        ← Treasury accounts, sessions, transactions
│   │   ├── finance.tsx         ← Expenses, employees, salaries, advances, equity (47 KB)
│   │   ├── reports.tsx         ← Reports hub with 8 tabs
│   │   ├── users.tsx           ← User management (24 KB)
│   │   ├── roles.tsx           ← Role + permission editor
│   │   ├── audit.tsx           ← Audit log viewer
│   │   ├── settings.tsx        ← Store settings + document sequences
│   │   └── not-found.tsx       ← 404 page
│   ├── components/
│   │   ├── app-shell.tsx       ← Navigation sidebar + header + layout shell (10 KB)
│   │   ├── barcode-label-print-modal.tsx ← Print barcode labels for products (18 KB)
│   │   ├── modal.tsx           ← Generic modal wrapper
│   │   ├── notification-bell.tsx← Bell icon, unread count, dropdown (7 KB)
│   │   ├── page-header.tsx     ← Reusable page title + breadcrumb
│   │   ├── print-portal.tsx    ← React portal for print-only DOM injection
│   │   ├── thermal-receipt.tsx ← Thermal printer receipt template (14 KB)
│   │   └── ui/                 ← shadcn/ui components (generated primitives)
│   ├── hooks/                  ← Custom React hooks (likely useDebounce, etc.)
│   └── lib/
│       ├── auth.tsx            ← AuthContext + AuthProvider + useAuth hook
│       ├── query-client.ts     ← TanStack QueryClient + MutationCache invalidation
│       └── (other utilities)
├── public/                     ← Static assets (favicon, etc.)
├── index.html                  ← Vite HTML entry point
├── vite.config.ts              ← Vite config: React plugin, TailwindCSS, path aliases
├── components.json             ← shadcn/ui configuration
├── package.json
└── tsconfig.json
```

---

## `lib/db/` — Database Package

```
lib/db/
├── src/
│   ├── index.ts                ← Exports db client + all schema tables
│   └── schema/                 ← 20 schema files (one per domain)
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
│       ├── accounting.ts       ← accounting_accounts, accounting_transactions, accounting_transaction_lines
│       ├── finance.ts          ← expense_categories, expenses, employees, salary_records, employee_advances, equity_movements
│       ├── notifications.ts    ← notifications
│       ├── settings.ts         ← store_settings, number_sequences
│       └── index.ts            ← Re-exports all schemas
├── drizzle.config.ts           ← Drizzle Kit config for migrations
├── package.json
└── tsconfig.json
```

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

## `lib/api-client-react/` & `lib/api-zod/`

```
lib/api-client-react/          ← Orval-generated React Query hooks
lib/api-zod/                   ← Orval-generated Zod schemas for all endpoints
```
These are auto-generated from the OpenAPI spec in `artifacts/api-spec/`. Do not edit manually — regenerate with:
```bash
pnpm --filter @workspace/api-spec run codegen
```
