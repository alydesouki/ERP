# نظام نقاط البيع (Shoe Retail POS)

Multi-tenant, Arabic-first (RTL) SaaS point-of-sale system for shoe retail stores. **Phase 1 (Foundation)** and **Phase 2 (Core Inventory)** are implemented. Phase 1: run-once store setup, JWT auth with lockout, RTL app shell, Users & Roles RBAC, immutable audit logs. Phase 2: master data (categories/brands/colors/sizes), products + variants with auto SKU/barcode, warehouses, cached per-warehouse stock, immutable inventory movement log, manual stock adjustments (ADJUSTMENT_IN/OUT), and Arabic/substring product search.

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

**Deferred to a Phase 2 follow-up (not built, awaiting approval):** warehouse transfers (paired TRANSFER_OUT/TRANSFER_IN movements) and the full stock-count session workflow (§9.7). SALE/PURCHASE movements arrive in later phases. The movement-type enum already includes all these values.

## User preferences

- Arabic-first, RTL UI throughout.
- Strict scope discipline: build only the approved phase, then stop for user testing. Do not start the next phase without approval.

## Gotchas

- Orval query keys are **path-prefixed** (`["/api/users"]`), not operationId-based. Invalidate by path prefix after mutations or lists won't refetch.
- Passing any `query` option to a generated hook requires `queryKey` — supply it via the matching `get…QueryKey(params)` getter.
- After run-once setup completes, invalidate `getGetSetupStatusQueryKey()` before navigating or the app stays stuck on the setup screen.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
