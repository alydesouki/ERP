# نظام نقاط البيع — System Documentation

A multi-tenant, Arabic-first (RTL) SaaS point-of-sale and ERP system for shoe retail
stores. This document describes the complete system as built across all phases (W1–W8):
inventory, sales/POS, purchases, customers/suppliers, treasury, double-entry accounting,
finance, dashboard, reporting, notifications, settings, and inventory operations
(transfers + stock counts).

---

## 1. Overview

The system is a single deployable monorepo (pnpm workspaces) with a contract-first
backend and an Arabic RTL single-page frontend.

- **Backend** (`@workspace/api-server`): Express 5 REST API, port-bound via `PORT`,
  served under `/api`.
- **Frontend** (`@workspace/pos`): React + Vite SPA served at `/`, fully RTL/Arabic.
- **Database** (`@workspace/db`): PostgreSQL accessed through Drizzle ORM.
- **Contract** (`@workspace/api-spec`): a single OpenAPI document is the source of truth
  for the API. React Query hooks and Zod schemas are generated from it (Orval).
- **Shared** (`@workspace/shared`): the permission catalog, default roles, and Arabic
  labels shared between server and client.

Design principles enforced everywhere:

1. **Contract-first**: schema → OpenAPI → codegen → routes → frontend.
2. **RBAC** on every protected route, mirrored by UI permission gating.
3. **Immutable audit log** for sensitive actions.
4. **Zod validation** of all request inputs and response outputs.
5. **Double-entry accounting + treasury** for every money movement.
6. **Typecheck clean** before any module is considered done.

---

## 2. Architecture

### 2.1 Request flow

```
Browser (React SPA, RTL)
   │  fetch via generated React Query hooks (access token in memory)
   ▼
Shared reverse proxy  (path-based routing; /api → API server, / → SPA)
   ▼
Express API server
   │  middleware: requireAuth → requirePermission → Zod validate
   ▼
Route handler  →  helper libs (accounting, treasury, inventory, sequences, audit)
   ▼
PostgreSQL (Drizzle ORM, transactional)
```

### 2.2 Monorepo layout

```
artifacts/
  api-server/        Express API
    src/routes/      one file per domain (see §4)
    src/lib/         transactional helpers (see §2.4)
    src/middleware/  auth.ts (requireAuth, requirePermission)
  pos/               React RTL SPA
    src/pages/       one page per domain
    src/components/  app-shell, modal, page-header, notification-bell
    src/lib/         auth.tsx (auth context)
  api-spec/          OpenAPI document (source of truth) + Orval config
lib/
  db/                Drizzle schema (source of truth for tables) + migrations
  shared/            permissions catalog, default roles, Arabic labels
  api-client-react/  generated React Query hooks + TS types
  api-zod/           generated Zod schemas (request/response validation)
```

### 2.3 Authentication & sessions

- **Custom JWT auth** (not Clerk). Access token (15 min) is held in memory on the
  client; refresh token (7 days) is stored in an HttpOnly cookie and **rotated** on
  every refresh. Signing keys are derived from `SESSION_SECRET`.
- **Run-once setup**: a first-run wizard bootstraps exactly one store + admin user and
  seeds the system roles. While a single store exists, login is by username.
- **Failed-attempt lockout** protects the login endpoint.

### 2.4 Transactional helper libraries

All money- and stock-moving operations are composed from small, single-responsibility
helpers so every write path is consistent and atomic:

- `lib/sequences.ts` — `nextDocumentNumber(tx, storeId, kind)` issues gapless,
  prefixed, zero-padded document numbers (kinds: `SALE`, `SALES_RETURN`, `PURCHASE`,
  `PURCHASE_RETURN`, `TRANSFER`, `STOCK_COUNT`).
- `lib/inventory.ts` — upserts the cached per-warehouse `inventory_items` quantity and
  writes an **immutable** `inventory_movements` row with a running balance. Negative
  stock is rejected unless explicitly allowed.
- `lib/treasury.ts` — posts a treasury transaction and syncs the account balance in the
  same transaction. Negative treasury is rejected unless explicitly allowed.
- `lib/accounting.ts` — posts balanced **double-entry** journal entries (debits =
  credits) for every financial event.
- `lib/audit.ts` — appends to the immutable audit log.
- Support helpers: `jwt.ts`, `tokens.ts`, `password.ts`, `codes.ts` (SKU/EAN-13),
  `money.ts` (decimal-safe math), `seed.ts`, `config.ts`, `logger.ts`.

**Atomicity rule:** an operation that touches inventory + treasury + accounting +
party balances does all of it inside **one** database transaction. If any step fails,
nothing is written.

---

## 3. Data model

Source of truth: `lib/db/src/schema/`. Tables carry `storeId` for multi-tenancy.

| Domain | Tables (schema file) |
| --- | --- |
| Tenancy & access | `stores`, `users`, `roles`, `sessions`, `audit-logs` |
| Catalog | `catalog` (categories, brands, colors, sizes), `products` (products + variants) |
| Inventory | `warehouses`, `inventory` (cached stock + immutable movements) |
| Inventory ops | `inventory-extended` (transfers + items, stock counts + items) |
| Parties | `customers`, `suppliers` |
| Sales | `sales` (invoices, items, payments, returns, suspended sales) |
| Purchases | `purchases` (invoices, items, payments, returns) |
| Money | `treasury` (accounts, sessions, transactions), `accounting` (chart of accounts, journal entries + lines) |
| Finance | `finance` (expense categories, expenses, employees, salaries, advances, owner equity movements) |
| System | `notifications`, `settings` (store settings + number sequences) |

Key conventions:

- Composite uniqueness like `(storeId, username)` and `(storeId, sku)` keeps tenants
  isolated and identifiers unambiguous.
- Product variants auto-generate a **SKU** and an **EAN-13 barcode**.
- Inventory quantity is a **cache**; the movement log is the immutable ledger of truth.
- Journal entries are immutable; corrections are posted as new balancing entries.

---

## 4. API surface

The OpenAPI document (`lib/api-spec`) defines **135 operations**. Regenerate hooks and
Zod schemas after any change:

```
pnpm --filter @workspace/api-spec run codegen
```

Routes (`artifacts/api-server/src/routes/`), each guarded by `requireAuth` and the
relevant `requirePermission(...)`:

| File | Responsibility |
| --- | --- |
| `auth.ts` | setup status, run-once setup, login, refresh (rotating), logout |
| `users.ts`, `roles.ts`, `permissions.ts` | user CRUD, role management, permission catalog |
| `audit.ts` | immutable audit log viewer |
| `catalog.ts`, `products.ts` | master data + products/variants + Arabic search |
| `warehouses.ts`, `inventory.ts` | warehouses, cached stock, movement log, manual adjustments |
| `inventory-ops.ts` | warehouse transfers + stock-count sessions |
| `customers.ts`, `suppliers.ts` | party CRUD, statements, payments |
| `treasury.ts` | accounts (auto-seeded), open/close sessions, balances, transactions |
| `sales.ts` | POS invoices, payments, returns, suspended sales, history |
| `purchases.ts` | purchase invoices, payments, returns |
| `finance.ts` | expenses + categories, employees, salaries, advances, owner equity |
| `dashboard.ts` | KPI + chart endpoints |
| `reports.ts` | sales, purchases, inventory, P&L, treasury, statements, low stock |
| `notifications.ts` | per-user list, unread count, refresh, mark read/all |
| `settings.ts` | store settings + document number sequences |
| `health.ts` | liveness |

---

## 5. Money: treasury + double-entry accounting

Every event that moves money writes **both** a treasury transaction (cash reality) and
a balanced journal entry (accounting truth), inside one transaction:

| Event | Inventory | Treasury | Accounting (Dr / Cr) | Party |
| --- | --- | --- | --- | --- |
| Cash sale | OUT | IN | Dr Cash / Cr Sales; Dr COGS / Cr Inventory | — |
| Credit sale | OUT | — | Dr A/R / Cr Sales; Dr COGS / Cr Inventory | +customer balance |
| Sale return | IN (reverse) | OUT | reverse sale + COGS | adjust customer |
| Cash purchase | IN | OUT | Dr Inventory / Cr Cash | — |
| Credit purchase | IN | — | Dr Inventory / Cr A/P | +supplier balance |
| Purchase return | OUT (reverse) | IN | reverse purchase | adjust supplier |
| Expense | — | OUT | Dr Expense / Cr Cash | — |
| Salary / advance | — | OUT | Dr Salary expense / Cr Cash | employee |
| Owner deposit / withdrawal | — | IN / OUT | Dr/Cr Owner equity | — |
| Customer/supplier payment | — | IN / OUT | settle A/R or A/P | adjust balance |

Transfers and stock counts move **inventory only** — no money or accounting:

- **Transfer**: create → `PENDING` + `TRANSFER_OUT` from source; complete → `COMPLETED`
  + `TRANSFER_IN` to destination; cancel → reverses the out-movement back to source.
- **Stock count**: create → `OPEN`, snapshots expected quantities; enter counted
  quantities; complete → books `STOCK_COUNT_CORRECTION` movements for the differences
  (gated by `inventory.manage` as the approval permission); cancel → no inventory change.

---

## 6. RBAC & audit

- The permission catalog (`lib/shared`) defines **40 granular keys** grouped by domain
  (e.g. `sales.create`, `inventory.manage`, `treasury.session`, `settings.manage`,
  `roles.manage`, `audit.view`). The wildcard `*` grants everything (admin).
- The server enforces permissions with `requirePermission(key)`; the UI mirrors the same
  keys via the `PermissionGate` route wrapper and conditional rendering so users never
  see actions they cannot perform.
- System roles are protected from deletion/edit; users cannot delete or de-privilege
  themselves into lockout (self-protection).
- Sensitive actions append to the **immutable** audit log, surfaced in the audit viewer.

---

## 7. Notifications & settings

- **Notifications** are per-user and gated by `requireAuth` only (no extra permission).
  The bell in the app shell polls the unread count and offers a dropdown with mark-read,
  mark-all, and a manual refresh. Refresh recomputes `LOW_STOCK`, `NEGATIVE_TREASURY`,
  `CUSTOMER_DEBT` (over credit limit), and `SUPPLIER_DEBT`, deduplicated via a
  `dedupeKey` so existing unread alerts are not duplicated.
- **Settings** cover store/currency/tax/receipt configuration, operating rules
  (allow negative stock / below-cost discount / negative treasury / require session for
  cash), the numeral format, and per-document **number sequences** (prefix + padding,
  with a live preview of the next number). Editing requires `settings.manage`.

---

## 8. Frontend

- Arabic-first, RTL throughout. The app shell provides the sidebar nav (permission
  filtered), the user menu, and the notification bell header.
- Pages live in `artifacts/pos/src/pages/` (one per domain). Shared UI primitives:
  `PageHeader`, `Modal`, and `NotificationBell`.
- Data access is exclusively through the generated React Query hooks. Mutations call
  `mutateAsync({ data })` and then invalidate the affected list by its path-prefixed
  query key.

### Frontend gotchas (important)

- **Query keys are path-prefixed**, not operationId-based. Invalidate by the exact path,
  e.g. transfers live at `["/api/inventory/transfers"]` and stock counts at
  `["/api/inventory/stock-counts"]` — **not** `/api/transfers`. Use the generated
  `getXxxQueryKey(params)` getters to stay correct.
- Passing any `query` option to a generated hook also requires `queryKey` — supply it
  via the matching `getXxxQueryKey(params)` getter.
- After run-once setup completes, invalidate `getGetSetupStatusQueryKey()` before
  navigating, or the app stays on the setup screen.

### Codegen gotcha (important)

- Do **not** name a request-body component schema `<CapitalizedOperationId>Body` — it
  collides with Orval's auto-generated operation body type. Use an `...Input` suffix for
  component schemas (e.g. `CreateTransferInput`); the generated TS input types are then
  `UpdateStoreSettingsInput`, `CreateTransferInput`, `CreateStockCountInput`,
  `UpdateStockCountItemsInput`, etc.
- Express path params are typed `string | string[]`; read them as `String(req.params["id"])`.

---

## 9. Build, run & operate

```
pnpm --filter @workspace/api-server run dev     # API server (binds PORT, served at /api)
pnpm --filter @workspace/pos run dev            # React SPA (binds PORT, served at /)
pnpm run typecheck                              # full typecheck across all packages
pnpm run typecheck:libs                         # composite libs only (run after lib edits)
pnpm run build                                  # typecheck + build all packages
pnpm --filter @workspace/api-spec run codegen   # regenerate hooks + Zod from OpenAPI
pnpm --filter @workspace/db run push            # push schema changes (dev only)
```

Required environment: `DATABASE_URL` (Postgres), `SESSION_SECRET` (JWT signing).

Apps run via Replit **workflows**, not root `pnpm dev`. Verify a package with its
`typecheck` script; `build` needs workflow-provided env (`PORT`, `BASE_PATH`).

---

## 10. Status

Phases 1–7 are implemented and typecheck-clean: foundation/auth, core inventory,
sales/POS, purchases, customers/suppliers with statements, treasury sessions,
double-entry accounting, finance, dashboard, reports, notifications, settings, and the
deferred inventory operations (warehouse transfers + stock-count workflow). `SALE`/
`PURCHASE` and all movement types are live; the movement-type enum already reserves
every value used across the system.
