# Code Audit Report

> Analysis of unused, duplicate, debug, and test code based on source code inspection.

---

## Summary

| Category | Count | Risk |
|---|---|---|
| Debug/Test scripts | 14 | Low — isolated in api-server root |
| Duplicate middleware folder | 1 | Low — appears empty |
| Error log file | 1 | Low — committed log |
| `mockup-sandbox` artifact | 1 | Review needed |
| Production code | Clean | No dead code found in core modules |

---

## Phase 2 — Detailed Code Audit

### 🗑️ SAFE TO DELETE — Test & Debug Scripts

These are all located in `artifacts/api-server/` (root of the API server package). They are **`.cjs` / `.mjs` scripts** run manually for debugging or one-time patches. They are **not imported anywhere** in production code, not referenced in `package.json` scripts, and not part of the build output.

| File | Purpose | Evidence it's test/debug |
|---|---|---|
| [`audit-timestamps.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/audit-timestamps.cjs) | Audits timestamp fields in DB | Name + `.cjs` extension |
| [`debug-checkout.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/debug-checkout.cjs) | Debug checkout flow | `debug-` prefix |
| [`fix-reports-sql.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/fix-reports-sql.cjs) | One-time SQL fix | `fix-` prefix |
| [`patch-all.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/patch-all.cjs) | Bulk DB patch | `patch-` prefix |
| [`patch-reports.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/patch-reports.cjs) | Report-specific patch | `patch-` prefix |
| [`refactor-pl.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/refactor-pl.cjs) | P&L refactor helper | `refactor-` prefix |
| [`repair-timestamps.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/repair-timestamps.cjs) | Timestamp repair | `repair-` prefix |
| [`test-auth-reports.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/test-auth-reports.cjs) | Auth + reports test | `test-` prefix |
| [`test-checkout.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/test-checkout.cjs) | Checkout test | `test-` prefix |
| [`test-for-update.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/test-for-update.cjs) | Update test | `test-` prefix |
| [`test-queries.mjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/test-queries.mjs) | DB query tests | `test-` prefix |
| [`test-req.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/test-req.cjs) | HTTP request test | `test-` prefix |
| [`test-timestamp.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/test-timestamp.cjs) | Timestamp test | `test-` prefix |
| [`unlock-admin.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/unlock-admin.cjs) | Unlock locked admin account | One-time utility |
| [`update-orm-mode.cjs`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/update-orm-mode.cjs) | ORM mode migration | One-time utility |

> **Recommendation:** Move to a `/scripts/` folder at the root level if you want to preserve them for operational use. If they were one-time migration scripts, they can be safely deleted.

---

### ⚠️ NEEDS REVIEW — Duplicate Middleware Folder

**Issue:** Two middleware folders exist in `artifacts/api-server/src/`:
- `middleware/auth.ts` — the real, used auth middleware
- `middlewares/` — a second folder

**Status:** The `middlewares/` folder needs inspection. If it's empty or contains duplicates of `middleware/auth.ts`, it can be deleted.

**Risk:** If any route imports from `middlewares/` instead of `middleware/`, removing it would break the build. Run a search:
```bash
grep -r "from.*middlewares" artifacts/api-server/src/
```

---

### ⚠️ NEEDS REVIEW — Error Log File

**File:** [`artifacts/api-server/typescript_errors.log`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/typescript_errors.log) (2.4 KB)

**Issue:** A committed error log. This should be in `.gitignore`.

**Content:** TypeScript errors captured from a build run (historical). Should not be committed to version control.

**Recommendation:** Add `*.log` to `.gitignore` and delete the file.

---

### ⚠️ NEEDS REVIEW — mockup-sandbox

**Folder:** `artifacts/mockup-sandbox/`

**Status:** Not inspected in detail. Likely a UI design/prototyping sandbox used during development.

**Recommendation:** If it's not a deployed artifact and doesn't share production code, it can be excluded from production builds. Check if it has its own `package.json` and what it exports.

---

### ✅ KEEP — All Core Production Files

The following have been verified as used in production:

| What | Why Keep |
|---|---|
| All `artifacts/api-server/src/**` TypeScript files | Imported in `routes/index.ts` or `app.ts` |
| All `lib/db/src/schema/**` files | Exported via `lib/db/src/index.ts` |
| All `artifacts/pos/src/**` files | Imported in `App.tsx` routing |
| All `lib/shared/src/**` files | Imported by both API server and POS |
| `artifacts/api-server/build.mjs` | Used in `npm run build` script |
| `artifacts/api-server/sqlite.db` | Dev database (do not delete) |
| Root `sqlite.db` | Dev database (do not delete) |

---

## Commented Code Analysis

No significant blocks of commented-out production code were found in the reviewed files. Code quality appears clean with proper documentation comments in schema files.

---

## Duplicate Code Analysis

### Identified Pattern: Money String Helpers

The pattern `toNum()`, `money()`, `cents()` is consistently used from `lib/money.ts` across all route files. This is correctly centralized — **not a duplication issue**.

### Identified Pattern: `clientIp(req)` Helper

This small function appears in multiple route files:
```typescript
function clientIp(req: Request): string | null {
  return req.ip ?? null;
}
```

This is duplicated in: `auth.ts`, `sales.ts`, and possibly others.

**Recommendation:** Extract to `lib/request.ts` as a shared utility. Low priority — 3-line function.

### Identified Pattern: `loadInvoiceDetail()` vs similar loaders

Each domain has a private `loadXxxDetail()` function. This is appropriate for domain separation, not a duplication concern.

---

## Technical Debt Summary

| Issue | Severity | Effort to Fix |
|---|---|---|
| 14 debug/test scripts in api-server root | Low | Delete or move to /scripts |
| `typescript_errors.log` committed | Low | Add to .gitignore + delete |
| `clientIp()` duplicated in 2+ files | Low | Extract to shared lib |
| `middlewares/` folder (needs inspection) | Medium | Verify + delete if empty |
| `mockup-sandbox` (needs scoping) | Low | Exclude from production |
| No formal test suite (unit/integration) | High | Add Vitest or Jest |
