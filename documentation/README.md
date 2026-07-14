# نظام نقاط البيع ERP — Shoe Retail POS
## Complete Technical Documentation

> **Current Status:** Electron desktop application fully implemented and operational.
> **Language:** Arabic-first (RTL) UI, TypeScript codebase
> **Domain:** Shoe Retail Store Management (Single-tenant ERP/POS)
> **Deployment:** Web (Localhost) + Windows Desktop (Electron)

---

## 📚 Documentation Index

| Document | Description | Status |
|---|---|---|
| [Project-Overview.md](./Project-Overview.md) | Purpose, domain, modules, users, dual-mode architecture | ✅ Current |
| [Desktop-Architecture.md](./Desktop-Architecture.md) | Electron implementation: startup, IPC, build, /api constraint | ✅ Current |
| [Desktop-Migration-Plan.md](./Desktop-Migration-Plan.md) | Original planning doc (historical — superseded by Desktop-Architecture.md) | 📜 Historical |
| [Folder-Structure.md](./Folder-Structure.md) | Every folder and its responsibility including desktop/ | ✅ Current |
| [Database.md](./Database.md) | Full schema, ER diagram, all tables, migration strategy | ✅ Current |
| [APIs.md](./APIs.md) | Every API endpoint documented including treasury transfers/adjustments | ✅ Current |
| [Code-Flow.md](./Code-Flow.md) | Request-to-response flows including new treasury + salary flows | ✅ Current |
| [Authentication.md](./Authentication.md) | JWT flow, sessions, RBAC, security | ✅ Current |
| [Business-Logic.md](./Business-Logic.md) | Why each business rule exists | ✅ Current |
| [Technology-Stack.md](./Technology-Stack.md) | Every technology used and why | ✅ Current |
| [Modules.md](./Modules.md) | Every module: purpose, features, flows | ✅ Current |
| [Performance-Review.md](./Performance-Review.md) | Bottlenecks, queries, recommendations | ✅ Current |
| [Code-Audit.md](./Code-Audit.md) | Unused/duplicate/dead code analysis | ✅ Current |

---

## Quick Start

### Localhost Mode (Web)

```bash
# Install dependencies
pnpm install

# Terminal 1: Run API server (port 5001)
pnpm --filter @workspace/api-server run dev

# Terminal 2: Run POS frontend with Vite (port 5173, proxies /api to 5001)
pnpm --filter @workspace/pos run dev
```

### Desktop Mode (Electron)

```bash
# Build API + SPA, then launch Electron
pnpm run desktop:dev
```

### Database Migrations

```bash
# Apply Drizzle schema (development)
pnpm --filter @workspace/db run push

# Apply supplemental migrations to production DB (run once per machine)
node lib/db/migrate-store-db.cjs
```

### After Editing API Types

When you modify `lib/api-client-react/src/generated/api.schemas.ts` or `api.ts`, rebuild the declaration files:

```bash
pnpm --filter @workspace/api-client-react exec tsc --build
```

---

## System at a Glance

```
┌─────────────────────────────────────────────────────────┐
│           Shoe Retail POS / ERP System                   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Electron (Desktop Mode)                          │  │
│  │  main.js → spawns Express → serves SPA + API     │  │
│  └──────────────────────────────────────────────────┘  │
│                         OR                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Browser (Localhost Mode)                         │  │
│  │  Vite :5173 → proxies /api → Express :5001       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  Arabic-First RTL SPA (React 18 + Vite + TailwindCSS)  │
│  REST API at /api/* (Express 5 + JWT auth)              │
│  Drizzle ORM → SQLite (libsql)                          │
│  DB: %APPDATA%/ShoeStorePOS/store.db (Desktop)          │
└─────────────────────────────────────────────────────────┘
```

**14 functional modules** | **25 UI pages** | **22 API route files** | **50 DB tables** | **2 deployment modes**

---

## Critical Development Rules

1. **All API calls must use `/api` prefix** — `customFetch("/api/...")` not `customFetch("/...")`
2. **React Query cache keys must match generated hooks** — use `/api/...` prefix in `invalidateQueries`
3. **After editing `api.schemas.ts`** — rebuild `lib/api-client-react` dist before running TypeScript checks
4. **New DB columns** — add to Drizzle schema AND update `lib/db/migrate-store-db.cjs` for production
5. **Session secret** — auto-generated on first launch, persisted in `%APPDATA%/ShoeStorePOS/secret.key`

---

*Documentation updated to reflect the fully-implemented Electron desktop application and all feature fixes.*
