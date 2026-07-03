# Technology Stack

> All technologies identified directly from source code: `package.json`, `pnpm-workspace.yaml`, schema files, config files, and imports.

---

## Package Manager & Workspace

| Technology | Version | Why |
|---|---|---|
| **pnpm** | Latest | Monorepo workspace management; faster installs via symlinked node_modules |
| **pnpm workspaces** | via `pnpm-workspace.yaml` | Manages 6 packages: `lib/db`, `lib/shared`, `lib/api-client-react`, `lib/api-zod`, `artifacts/api-server`, `artifacts/pos` |

---

## Runtime & Language

| Technology | Version | Why |
|---|---|---|
| **Node.js** | 24 | Latest LTS; required for native crypto, ESM support |
| **TypeScript** | ~5.9.3 | Strict static typing across all packages; shared types between frontend and backend eliminate entire classes of bugs |

---

## Backend (API Server)

**Package:** `@workspace/api-server` → [`artifacts/api-server/`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/src/app.ts)

| Technology | Version | Why |
|---|---|---|
| **Express** | ^5.2.1 | Mature, minimal HTTP framework; v5 fixes async error propagation |
| **cors** | ^2.8.6 | Allows the Vite dev server (port 5000) to call the API server (port 5001) |
| **cookie-parser** | ^1.4.7 | Parses the `HttpOnly` refresh token cookie for JWT rotation |
| **jsonwebtoken** | ^9.0.3 | Signs/verifies access tokens (15min) and refresh tokens (7 days) |
| **bcryptjs** | ^3.0.3 | Password hashing; pure JS (no native bindings) for simpler cross-platform build |
| **pino** | ^9.14.0 | Structured JSON logging (production-grade performance) |
| **pino-http** | ^10.5.0 | Express middleware that logs every request/response via pino |
| **esbuild** | 0.27.3 | Bundles the TypeScript API server to a single `dist/index.mjs` for deployment |

---

## Database

| Technology | Version | Why |
|---|---|---|
| **SQLite** | via libsql | File-based relational DB; zero-config deployment; single store needs no separate DB server |
| **@libsql/win32-x64-msvc** | ^0.5.29 | Windows-native libsql driver (turso/libsql fork of SQLite with WAL improvements) |
| **better-sqlite3** | (approved build) | Synchronous SQLite adapter for Node.js used in tests/scripts |
| **Drizzle ORM** | catalog (shared version) | Type-safe query builder that generates TypeScript types from the schema; used in both API server and DB lib |
| **drizzle-zod** | (implied) | Generates Zod schemas from Drizzle table definitions |

**Schema Source of Truth:** [`lib/db/src/schema/`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/lib/db/src/schema/)

---

## Frontend (POS SPA)

**Package:** `@workspace/pos` → [`artifacts/pos/`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/App.tsx)

| Technology | Version | Why |
|---|---|---|
| **React** | 18 (catalog) | Component model, hooks, context for auth state |
| **Vite** | catalog | Instant HMR dev server; ESBuild-powered production builds |
| **@vitejs/plugin-react** | catalog | Babel-based JSX/TSX transform for React |
| **TailwindCSS** | catalog (v4) | Utility-first CSS; `@tailwindcss/vite` plugin for v4 integration |
| **@tailwindcss/typography** | ^0.5.15 | Prose styles for receipt/report content |
| **Wouter** | ^3.3.5 | Lightweight client-side router (replaces React Router); supports `base` path for sub-path deployment |
| **@tanstack/react-query** | catalog | Server-state management, caching, cache invalidation on mutations |
| **Framer Motion** | catalog | UI animations (modal transitions, micro-interactions) |

### UI Component Library (shadcn/ui pattern)

| Technology | Why |
|---|---|
| **Radix UI** (full suite) | Accessible, unstyled headless components: Dialog, Select, Tabs, Toast, etc. |
| **class-variance-authority** | Variant-based component styling |
| **clsx + tailwind-merge** | Conditional class merging |
| **cmdk** | Command palette / combobox (used in product search) |
| **sonner** | Toast notifications |
| **vaul** | Drawer component (mobile-style modals) |

### Form Management

| Technology | Why |
|---|---|
| **react-hook-form** | ^7.55.0 | Performant forms with minimal re-renders |
| **@hookform/resolvers** | ^3.10.0 | Integrates Zod schemas as form validators |
| **zod** | catalog | Runtime input validation; shared with API layer |

### Data & Charts

| Technology | Why |
|---|---|
| **recharts** | ^2.15.2 | Dashboard KPI charts (line, bar, pie) |
| **date-fns** | ^3.6.0 | Date manipulation for filters and display |
| **react-day-picker** | ^9.11.1 | Date range picker in report filters |

### Barcode & Printing

| Technology | Why |
|---|---|
| **jsbarcode** | ^3.12.3 | Generates EAN-13 barcodes for product labels |
| **qrcode** | ^1.5.4 | Generates QR codes for invoice/product references |
| **lucide-react** | catalog | Icon set (1000+ SVG icons) |
| **react-icons** | ^5.4.0 | Additional icon sets (FontAwesome, etc.) |
| **embla-carousel-react** | ^8.6.0 | Carousel used in barcode label print modal |

---

## Shared Libraries (Internal)

| Package | Path | Purpose |
|---|---|---|
| **@workspace/db** | `lib/db/` | Drizzle schema + `db` client export; used by API server |
| **@workspace/shared** | `lib/shared/` | Permission catalog, `hasPermission()`, default roles; used by both frontend and backend |
| **@workspace/api-client-react** | `lib/api-client-react/` | Orval-generated React Query hooks from OpenAPI spec |
| **@workspace/api-zod** | `lib/api-zod/` | Zod validation schemas for all API request/response bodies |

---

## Validation

| Technology | Version | Why |
|---|---|---|
| **Zod** | catalog (`zod/v4`) | Used at both API boundary (request validation) and frontend form validation; single source of truth for data shapes |

---

## Authentication & Authorization

| Technology | Why |
|---|---|
| **JSON Web Tokens (JWT)** | Access token (15min in-memory) + Refresh token (7d HttpOnly cookie) |
| **bcryptjs** | bcrypt password hashing with cost factor 12 |
| **crypto.randomUUID()** | Node built-in; generates all IDs and session tokens |
| **Custom RBAC** | `lib/shared/src/permissions.ts` — 40+ granular permission keys; wildcard `*` for admin |

---

## Build Tools

| Tool | Why |
|---|---|
| **esbuild** | 0.27.3 — bundles API server to single ESM file; esbuild-plugin-pino handles pino's worker thread |
| **Vite** | Bundles POS frontend to static HTML+JS+CSS |
| **tsc** | TypeScript compiler (type-checking only, no emit) via `tsconfig.base.json` |
| **@rollup/rollup-win32-x64-msvc** | Windows-native Rollup binaries (Vite dependency) |

---

## Logging

| Technology | Why |
|---|---|
| **pino** | Structured JSON logs; near-zero overhead via async transport |
| **pino-http** | Auto-logs each HTTP request with method, URL, status code |
| **pino-pretty** | Human-readable logs in development |

---

## Development Tools

| Tool | Why |
|---|---|
| **prettier** | ^3.8.4 — code formatting |
| **cross-env** | Platform-agnostic environment variable setting in npm scripts |
| **thread-stream** | pino's async logging transport (worker thread) |

---

## What Is NOT Used (Notably Absent)

| Missing | Reason |
|---|---|
| Redis | No caching layer needed for single-store SQLite |
| Docker | Not containerized in current setup |
| Next.js / SSR | Pure SPA (SEO not needed for an internal tool) |
| GraphQL | REST is sufficient and simpler for this domain |
| WebSockets | Notification bell polls; real-time is out of scope |
| Prisma | Drizzle ORM is lighter and more type-safe for SQLite |
| Passport.js | Custom JWT auth is intentionally minimal |
