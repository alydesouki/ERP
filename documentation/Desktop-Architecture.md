# Desktop Application Architecture

> This document describes the **implemented** Electron desktop application. It supersedes the earlier `Desktop-Migration-Plan.md`, which was a planning document written before implementation.

---

## Status: Implemented

The Electron desktop application is fully built and operational. The key files are:

| File | Purpose |
|---|---|
| [`artifacts/desktop/main.js`](file:///d:/Erp/ERP/artifacts/desktop/main.js) | Electron main process — the entire desktop runtime |
| [`artifacts/desktop/preload.js`](file:///d:/Erp/ERP/artifacts/desktop/preload.js) | Renderer process bridge (contextBridge IPC) |
| [`artifacts/desktop/electron-builder.yml`](file:///d:/Erp/ERP/artifacts/desktop/electron-builder.yml) | Packaging & distribution config |
| [`artifacts/desktop/build-all.mjs`](file:///d:/Erp/ERP/artifacts/desktop/build-all.mjs) | Build script: builds API server + POS SPA + packages Electron |

---

## Runtime Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Electron Application                     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │        Main Process (Node.js / main.js)          │   │
│  │                                                  │   │
│  │  1. Load/generate SESSION_SECRET (AppData)       │   │
│  │  2. Copy seed DB if first launch                 │   │
│  │  3. spawn("node", ["api-server/dist/index.mjs"]) │   │
│  │     env: DATABASE_URL, SESSION_SECRET,           │   │
│  │          PORT=5001, SERVE_STATIC=true            │   │
│  │  4. Poll GET /api/healthz until 200              │   │
│  │  5. new BrowserWindow → loadURL("localhost:5001")│   │
│  │  6. Handle IPC: print-html, get-printers         │   │
│  │  7. Auto-updater (packaged builds only)          │   │
│  └────────────────────┬─────────────────────────────┘   │
│                       │ spawn child process              │
│  ┌────────────────────▼─────────────────────────────┐   │
│  │     API Server Child Process (api-server)         │   │
│  │                                                   │   │
│  │  Express 5 on port 5001                           │   │
│  │  ├── GET /api/healthz → { ok: true }              │   │
│  │  ├── POST /api/* → all REST routes                │   │
│  │  └── GET /* → serve built React SPA (static)     │   │
│  │                                                   │   │
│  │  SQLite DB: %APPDATA%/ShoeStorePOS/store.db       │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │       Renderer Process (Chromium / preload.js)   │   │
│  │                                                  │   │
│  │  React POS SPA loaded from http://localhost:5001 │   │
│  │  API calls: fetch("/api/...")                    │   │
│  │  Print: window.electronAPI.printHtml(html)       │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Startup Sequence

1. **Electron launches** → `app.setPath("userData", "%APPDATA%/ShoeStorePOS")`
2. **`ensureAppDataDir()`** — creates `%APPDATA%/ShoeStorePOS/` if it doesn't exist
3. **`getOrCreateSecret()`** — reads `secret.key` from AppData, or generates a new 256-bit random key and writes it (chmod 0600)
4. **`initDatabase()`** — if `store.db` doesn't exist, copies `assets/seed.db` from the packaged app resources
5. **`startApiServer(sessionSecret)`** — spawns `node [path-to-api-server/dist/index.mjs]` with env:
   - `DATABASE_URL` = full path to `store.db`
   - `SESSION_SECRET` = the persistent secret from step 3
   - `PORT` = `5001`
   - `SERVE_STATIC` = `"true"` (tells the API to serve the built React SPA from its `dist/pos/` directory)
6. **`waitForApi(30000)`** — polls `GET /api/healthz` every 500ms, times out after 30s
7. **`createWindow()`** — creates `BrowserWindow`, clears session storage, loads `http://localhost:5001`
8. **`setupAutoUpdater()`** — only in packaged builds; checks for updates via `electron-updater`

---

## API Server in Desktop Mode

In Desktop mode, the Express API server runs with `SERVE_STATIC=true`. This causes the API server to serve the pre-built React SPA static files from its `dist/pos/` directory using `express.static`. This means:

- `GET /` → returns `index.html` (the React SPA)
- `GET /assets/*` → returns JS/CSS bundles
- `GET /api/*` → handled by the Express router (all REST endpoints)

This is how a single HTTP server on port 5001 serves both the API and the UI.

---

## IPC Communication

The preload script (`preload.js`) exposes `window.electronAPI` to the renderer via `contextBridge`. This provides the following IPC channels:

| IPC Method | Purpose |
|---|---|
| `window.electronAPI.printHtml(html, options)` | Silent thermal printing via a hidden BrowserWindow |
| `window.electronAPI.getPrinters()` | Lists installed printers |

### Silent Print Architecture

Calling `webContents.print()` on the main SPA window fails on Windows due to layout metric issues (Chromium bug #46921). The implemented fix:

1. Write HTML to a temp file
2. Create a **hidden** `BrowserWindow` and load the temp file
3. Call `printWindow.webContents.print({ silent: true, ... })` on this dedicated window
4. Destroy the print window after completion

---

## File Locations (Desktop Mode)

| Resource | Path |
|---|---|
| SQLite database | `%APPDATA%\ShoeStorePOS\store.db` |
| Session secret | `%APPDATA%\ShoeStorePOS\secret.key` |
| Application log | `%APPDATA%\ShoeStorePOS\app.log` |
| Printer settings | `%APPDATA%\ShoeStorePOS\printer-settings.json` |

---

## Development vs Production Entry Points

| Mode | API Server Source | SPA Source |
|---|---|---|
| **Development** (`pnpm run desktop:dev`) | `../api-server/dist/index.mjs` (relative path) | Loaded from `http://localhost:5001` (static served by API) |
| **Packaged** (installed .exe) | `process.resourcesPath/api-server/dist/index.mjs` | Loaded from `http://localhost:5001` (same) |

---

## Build Pipeline

The `build-all.mjs` script orchestrates the full build:

1. Build the API server: `pnpm --filter @workspace/api-server build`
2. Build the POS SPA: `pnpm --filter @workspace/pos build`
3. Copy the built SPA into the API server's `dist/pos/` directory
4. Run `electron-builder` to package into a Windows NSIS installer

---

## Security

| Concern | Implementation |
|---|---|
| `SESSION_SECRET` | 256-bit random hex stored in `%APPDATA%/ShoeStorePOS/secret.key` (user-only file) |
| `nodeIntegration` | `false` in renderer (no direct Node.js access) |
| `contextIsolation` | `true` — renderer and main process isolated |
| Database access | OS file permissions — AppData is user-only on Windows |
| Update integrity | `electron-updater` verifies SHA-512 of downloaded update packages |

---

## Localhost Mode (Development)

To run in Localhost mode (web browser), use:

```bash
# Terminal 1: Start API server
pnpm --filter @workspace/api-server dev

# Terminal 2: Start Vite dev server (proxies /api to port 5001)
pnpm --filter @workspace/pos dev
```

To run in Desktop/Electron mode:

```bash
pnpm run desktop:dev
```

This starts the API server, builds the SPA, and launches Electron pointing to `localhost:5001`.

---

## Key Architectural Constraint: `/api` Prefix

> This is the most critical constraint for frontend development.

The Express API server mounts all routes under `/api`:
```ts
// artifacts/api-server/src/app.ts
app.use("/api", router);
```

**All frontend API calls must use the `/api` prefix.** This applies to:
- The auto-generated hooks in `lib/api-client-react/src/generated/api.ts` (already correct — generated with `/api/*` paths)
- Any **manual** `customFetch` calls in page/component files (must explicitly include `/api/...`)
- React Query cache invalidation keys (must match the generated hooks' query key format, which uses `/api/*`)

Failure to include `/api` results in:
- **Localhost mode**: Request hits Vite dev server, which serves `index.html` (HTML body parsed as JSON → parse error)
- **Desktop mode**: Request hits Express at `/path` instead of `/api/path` → 404 response

### Known Fixed Issues

The following bugs were found and fixed (missing `/api` prefix in manual `customFetch` calls):

| File | Old Path | Fixed Path |
|---|---|---|
| `artifacts/pos/src/pages/treasury.tsx:472` | `/treasury/transfers` | `/api/treasury/transfers` |
| `artifacts/pos/src/pages/treasury.tsx:578` | `/treasury/adjustments` | `/api/treasury/adjustments` |
| `artifacts/pos/src/components/quick-product-modal.tsx:93` | `/products` | `/api/products` |
