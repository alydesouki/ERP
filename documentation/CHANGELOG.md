# Changelog

All notable changes to this project are documented here.

---

## [Unreleased] — 2026-07-15

### ✨ New Module: Association Accounts (حسابات الجمعيات)

A complete new module for managing company participation in savings associations (ROSCA / rotating savings groups). Money withdrawn from the cash register to participate in an association is treated as a **receivable** (amount due back to the company), not an expense. This keeps P&L reports accurate and avoids false cash shortages.

#### New Database Tables
- **`associations`** — Master table. One row per savings association with name, status, date range, and optional contribution schedule. Name is unique per store. Balance columns are NOT stored here (see Design Decisions below).
- **`association_transactions`** — Immutable financial ledger. Records every WITHDRAWAL and RETURN. Financial records are never deleted; mistakes are corrected via Reverse Transaction entries.

#### New API Routes (`/api/associations`)
| Method | Path | Description |
|---|---|---|
| GET | `/associations` | List all associations with computed balance summaries |
| POST | `/associations` | Create a new association |
| GET | `/associations/:id` | Get single association with balance summary |
| PUT | `/associations/:id` | Update association details or status |
| GET | `/associations/:id/transactions` | Paginated ledger with running balance |
| POST | `/associations/:id/transactions` | Record a WITHDRAWAL or RETURN |
| POST | `/associations/:id/transactions/:txId/reverse` | Reverse (cancel) a transaction without deleting it |
| GET | `/associations/summary` | Aggregate KPIs for dashboard |

#### New Frontend Page (`/associations`)
A four-tab page at route `/associations`:
- **الجمعيات** — Association list with status badges, computed totals per row, and Create/Edit modals.
- **المعاملات** — Transaction log per association with WITHDRAWAL/RETURN entry modal and Reverse modal.
- **التقرير** — Aggregate report across all associations; filterable by status and date; printable.
- **كشف الحساب** — Per-association statement with date-range filter and running balance column.

#### Dashboard Integration
Four new KPI fields added to `GET /api/dashboard/kpis`:
- `activeAssociationsCount` — Count of ACTIVE associations
- `totalAssociationsWithdrawn` — Total amount withdrawn across all associations
- `totalAssociationsReturned` — Total amount returned
- `totalAssociationsBalance` — Net outstanding balance (Withdrawn − Returned)

Four new KPI cards added to the dashboard UI to display the above values.

#### New Permissions
| Permission Key | Description |
|---|---|
| `associations.view` | View associations and their balances |
| `associations.create` | Create new associations |
| `associations.edit` | Update existing association details |
| `associations.transactions` | Record withdrawals, returns, and reversals |
| `associations.report` | View aggregate report and dashboard KPIs |

#### Key Design Decisions
1. **No stored balance** — `balance`, `totalWithdrawals`, and `totalReturns` are always computed via SQL aggregates from `association_transactions`. Storing derived values risks inconsistency when transactions are reversed.
2. **No deletions** — Financial records are immutable. The reverse endpoint posts an opposite-direction transaction and marks the original with `is_reversed=true`. Both rows are preserved for the audit trail.
3. **Treasury integration** — Every WITHDRAWAL posts a `treasury_transactions` row (direction: OUT). Every RETURN posts a row (direction: IN). The treasury balance is updated atomically in the same database transaction.
4. **Not an expense** — Association transactions are NOT posted to `accounting_transactions`. They do not affect P&L, the Chart of Accounts, or expense reports.
5. **Audit logging** — Every create, update, and transaction event writes a row to `audit_logs` via `writeAuditLog`.

#### Files Changed
| File | Change |
|---|---|
| `lib/db/src/schema/associations.ts` | **[NEW]** Drizzle schema for `associations` and `association_transactions` tables |
| `lib/db/src/schema/index.ts` | Added `export * from "./associations"` |
| `artifacts/api-server/src/routes/associations.ts` | **[NEW]** Full REST API (8 endpoints) |
| `artifacts/api-server/src/routes/index.ts` | Registered associations router |
| `artifacts/api-server/src/routes/dashboard.ts` | Added 4 association KPI fields to `GET /dashboard/kpis` |
| `artifacts/pos/src/pages/associations.tsx` | **[NEW]** Full 4-tab frontend page |
| `artifacts/pos/src/components/app-shell.tsx` | Added "حسابات الجمعيات" nav link under the المالية group |
| `artifacts/pos/src/App.tsx` | Added `/associations` route |
| `artifacts/pos/src/pages/dashboard.tsx` | Added 4 new association KPI cards |
| `documentation/Modules.md` | Added Module 15 documentation |
| `documentation/APIs.md` | Added Association Accounts API section |
| `documentation/Database.md` | Added `associations` and `association_transactions` table docs; updated ER diagram and table index |
| `documentation/Project-Overview.md` | Added Module 15 to module list |
| `documentation/README.md` | Updated stats; added schema push rule for Desktop DB |
| `documentation/CHANGELOG.md` | **[NEW]** This file |

---

### 🐛 Bug Fixes

#### Inventory Evaluation Report (تقييم المخزون)
- **Added Profit column** to the report table: `Profit = Total Sales Value − Total Purchase Cost` per product row.
- **Added Total Profit summary card** at the top of the report.
- The summary Total Profit always equals the sum of all per-row profits after any active filter.

#### `zod` Dependency Resolution
- Added `zod` as an explicit direct dependency in `@workspace/api-server/package.json`.
- Previously it was only a transitive dependency via `@workspace/api-zod`, which is insufficient for esbuild's bundling mode. This caused a `Could not resolve "zod"` build error when the associations route was first compiled.

#### Modal `open` Prop
- Fixed the `associations.tsx` frontend page: all three modal components (`AssociationFormModal`, `TransactionFormModal`, `ReverseModal`) were missing the required `open={true}` prop when rendering. The `Modal` component returns `null` when `open` is falsy, so clicking "New Association" appeared to do nothing even though the React state was correctly updating.

#### Error Handler — Real Error Details
- Updated the Express global error handler in `app.ts` to include `err.message` in the response body under the `details` key. Previously all 500 errors returned only the generic Arabic string "حدث خطأ غير متوقع", making server-side failures invisible in the UI and difficult to debug.
- Updated the frontend `apiErr()` helper in `associations.tsx` to extract and display the `details` field when present.

#### Audit Log Field Name
- Fixed all four `writeAuditLog` calls in `associations.ts` that were using the non-existent `entity` field. The correct field name per the `AuditEntry` TypeScript interface is `entityType`.

#### `writeAuditLog` Signature
- Fixed all `writeAuditLog` calls in `associations.ts` that were incorrectly passing `db` as the first argument. The function signature is `writeAuditLog(entry: AuditEntry)` — it internally imports `db` from `@workspace/db`. Passing `db` as the first argument caused a runtime TypeError that crashed POST requests after the database insert succeeded, resulting in false 500 responses to the client.

#### `req.params` Type Safety
- Fixed TypeScript errors in `associations.ts` where `const { id } = req.params` and `const { id, txId } = req.params` produced `Type 'string | string[]' is not assignable to type 'string'` errors. Replaced with `String(req.params["id"])` and `String(req.params["txId"])` to satisfy the TypeScript strict type system.

---

### 🏗️ Infrastructure Notes

#### Desktop DB Schema Push Workflow
When adding new Drizzle schema tables, `drizzle-kit push` must be explicitly pointed at the Desktop application's database file. Running without the environment variable targets a dev fallback and silently skips the production database.

**Correct command (PowerShell):**
```powershell
$env:DATABASE_URL = "C:\Users\<username>\AppData\Roaming\ShoeStorePOS\store.db"
pnpm --filter @workspace/db run push
```

This was identified during the association module rollout when the `associations` table existed in the Drizzle schema and was compiled correctly into the API server, but did not exist in the running database, causing every API call to fail with `SQLITE_ERROR: no such table: associations`.

---

*Previous versions were not tracked in a changelog. This document begins from the 2026-07-15 development session.*
