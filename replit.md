# نظام نقاط البيع (Shoe Retail POS)

Multi-tenant, Arabic-first (RTL) SaaS point-of-sale and ERP system for shoe retail stores. **All phases (1–7) are implemented and typecheck-clean.** Foundation: run-once store setup, JWT auth with lockout, RTL app shell, Users & Roles RBAC, immutable audit logs. Core inventory: master data (categories/brands/colors/sizes), products + variants with auto SKU/barcode, warehouses, cached per-warehouse stock, immutable movement log, manual adjustments, Arabic/substring search. Operations: sales/POS (invoices, payments, returns, suspended sales, history), purchases (invoices, payments, returns), customers/suppliers with statements + payments, treasury (accounts, sessions, transactions), double-entry accounting, finance (expenses, employees, salaries, advances, owner equity), dashboard KPIs + charts, reports hub, per-user notifications with bell, settings (store/tax/receipt + document number sequences), warehouse transfers, and stock-count sessions.

Full system reference: see `SYSTEM_DOCUMENTATION.md`.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- DB schema (source of truth): `lib/db/src/schema/` (stores, roles, users, sessions, audit_logs)
- Permissions catalog + default roles + Arabic labels: `lib/shared/src/`
- API contract (source of truth): `artifacts/api-spec/` OpenAPI → codegen into `lib/api-client-react/src/generated/`
- Backend routes: `artifacts/api-server/src/routes/` (auth, users, roles, audit), middleware in `.../middleware/auth.ts`
- Frontend (Arabic RTL SPA, slug `pos`, served at `/`): `artifacts/pos/src/` — pages in `src/pages/`, auth context in `src/lib/auth.tsx`

## Architecture decisions

- **Custom JWT auth, not Clerk.** Access token (15m) kept in memory; refresh token (7d) in an HttpOnly cookie, rotated on refresh. Signing keys derived from `SESSION_SECRET`.
- **Run-once setup → single store.** The setup wizard bootstraps exactly one store + admin and seeds system roles. Login queries by username (unambiguous while one store exists).
- **RBAC via permission catalog.** Granular keys (`users.create/edit/delete`, `roles.manage`, `audit.view`); wildcard `*` for admin. UI gating mirrors server `requirePermission(...)`.
- **Immutable audit log** — sensitive actions are recorded and never mutated.
- **Multi-tenant-ready schema** (`storeId` on tenant tables, composite unique `(storeId, username)`) even though Phase 1 runs single-store.

## Product

Phase 1 capabilities: first-run store setup wizard; admin/staff login with failed-attempt lockout; Arabic RTL dashboard shell; user management (CRUD, password reset, soft delete, self-protection); role management (system-role protection, permission groups); audit log viewer.

Phase 2 capabilities: master data CRUD (categories, brands, colors, sizes); products with variants and auto-generated SKU + EAN-13 barcode; warehouses CRUD; per-warehouse cached stock view; manual stock adjustments (ADJUSTMENT_IN/OUT) that write immutable movements with running balance and sync cached quantity in one transaction; immutable movement log viewer; Arabic/substring product search.

Phase 3–6 capabilities (operations + finance): sales/POS (invoices, line items, payments, returns, suspended sales, history) with each sale atomically writing inventory OUT movements, treasury IN, double-entry journal (sales revenue + COGS), and customer balance; purchases (invoices, payments, returns) atomically writing inventory IN, treasury OUT / supplier credit, and journal entries; customers & suppliers with running statements + payments; treasury (accounts auto-seeded, cash sessions open/close, transactions, balance sync); double-entry accounting (chart of accounts, journal entries, ledger); finance (expense categories + expenses, employees, salary records, advances, owner equity deposits/withdrawals) each posting treasury + accounting; dashboard KPIs + charts; reports hub (sales, purchases, inventory, P&L, treasury, customer/supplier statements, low stock).

Phase 7 capabilities: per-user notifications (LOW_STOCK / NEGATIVE_TREASURY / CUSTOMER_DEBT / SUPPLIER_DEBT) deduped by an active-key partial unique index, with a polling bell (unread count, mark read/all, refresh); settings (store profile, tax, receipt format, business rules) + editable document number sequences; warehouse transfers (paired TRANSFER_OUT on create → TRANSFER_IN on complete, reversible on cancel); and stock-count sessions (snapshot expected qty on open → STOCK_COUNT_CORRECTION movements on complete).

## User preferences

- Arabic-first, RTL UI throughout.
- Strict scope discipline: build only the approved phase, then stop for user testing. Do not start the next phase without approval.

## Gotchas

- Orval query keys are **path-prefixed** (`["/api/users"]`), not operationId-based. Invalidate by path prefix after mutations or lists won't refetch.
- Passing any `query` option to a generated hook requires `queryKey` — supply it via the matching `get…QueryKey(params)` getter.
- After run-once setup completes, invalidate `getGetSetupStatusQueryKey()` before navigating or the app stays stuck on the setup screen.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
