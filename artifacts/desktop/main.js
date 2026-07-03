"use strict";

/**
 * Electron Main Process — Shoe Store POS Desktop Application
 *
 * Responsibilities:
 * 1. Generate/load a persistent SESSION_SECRET (stored securely in AppData)
 * 2. Spawn the Express API server as a child process (port 5001)
 * 3. Poll /api/health until the server is ready
 * 4. Create a BrowserWindow and load the POS frontend
 * 5. Handle auto-updates with Arabic dialog messages
 * 6. Handle IPC for silent thermal printing
 * 7. Clean up child processes on quit
 */

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_PORT = 5001;
const API_BASE = `http://localhost:${API_PORT}`;
const HEALTH_URL = `${API_BASE}/api/healthz`;
const APP_DATA_DIR = path.join(app.getPath("userData"), "ShoeStorePOS");
const DB_PATH = path.join(APP_DATA_DIR, "store.db");
const SECRET_PATH = path.join(APP_DATA_DIR, "secret.key");
const LOG_PATH = path.join(APP_DATA_DIR, "app.log");

// ---------------------------------------------------------------------------
// Simple file logger (before pino is available)
// ---------------------------------------------------------------------------

function log(level, message, meta) {
  const entry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${meta ? " " + JSON.stringify(meta) : ""}\n`;
  process.stdout.write(entry);
  try {
    fs.appendFileSync(LOG_PATH, entry);
  } catch {
    // Ignore log write errors
  }
}

// ---------------------------------------------------------------------------
// App data directory setup
// ---------------------------------------------------------------------------

function ensureAppDataDir() {
  if (!fs.existsSync(APP_DATA_DIR)) {
    fs.mkdirSync(APP_DATA_DIR, { recursive: true });
    log("info", "Created AppData directory", { path: APP_DATA_DIR });
  }
}

// ---------------------------------------------------------------------------
// Secret key management
// Generates a 256-bit random key on first launch, persists it in AppData.
// AppData is user-only on Windows (no admin required, not accessible by other users).
// ---------------------------------------------------------------------------

function getOrCreateSecret() {
  if (fs.existsSync(SECRET_PATH)) {
    const secret = fs.readFileSync(SECRET_PATH, "utf8").trim();
    if (secret.length >= 32) {
      log("info", "Loaded existing SESSION_SECRET");
      return secret;
    }
  }

  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(SECRET_PATH, secret, { mode: 0o600 }); // owner read/write only
  log("info", "Generated new SESSION_SECRET");
  return secret;
}

// ---------------------------------------------------------------------------
// Database bootstrap
// On first launch, the DB doesn't exist yet — the API server and Drizzle ORM
// will create it automatically when the API starts up.
// ---------------------------------------------------------------------------

function initDatabase() {
  const exists = fs.existsSync(DB_PATH);
  if (!exists) {
    log("info", "Database not found, copying seed database...");
    // electron-builder packages assets into app.asar. __dirname resolves correctly.
    const seedPath = path.join(__dirname, "assets", "seed.db");
    
    if (fs.existsSync(seedPath)) {
      fs.copyFileSync(seedPath, DB_PATH);
      log("info", "Seed database copied successfully");
    } else {
      log("error", "Seed database not found at " + seedPath);
    }
  } else {
    log("info", `Database path: ${DB_PATH}`, { exists });
  }
}

// ---------------------------------------------------------------------------
// API Server management
// ---------------------------------------------------------------------------

let apiProcess = null;
let apiReady = false;
let apiFailed = false;
let apiFailedError = null;

function getApiEntryPoint() {
  // In packaged app, resources are in process.resourcesPath
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "api-server", "dist", "index.mjs");
  }
  // In development, find relative to this file
  return path.resolve(__dirname, "..", "api-server", "dist", "index.mjs");
}

function startApiServer(sessionSecret) {
  return new Promise((resolve, reject) => {
    const entryPoint = getApiEntryPoint();

    if (!fs.existsSync(entryPoint)) {
      const err = new Error(`API server bundle not found: ${entryPoint}\nRun "pnpm build" first.`);
      log("error", err.message);
      reject(err);
      return;
    }

    log("info", "Starting API server", { entryPoint });

    apiProcess = spawn("node", ["--enable-source-maps", entryPoint], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(API_PORT),
        DATABASE_URL: DB_PATH,
        SESSION_SECRET: sessionSecret,
        SERVE_STATIC: "true",
        // Tell pino to write logs to our log file
        PINO_LOG_FILE: LOG_PATH,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    apiProcess.stdout.on("data", (data) => {
      const text = data.toString().trim();
      if (text) log("api", text);
      // Detect when server is ready from its own log output
      if (text.includes('"Server listening"') || text.includes("Server listening")) {
        apiReady = true;
      }
    });

    apiProcess.stderr.on("data", (data) => {
      const text = data.toString().trim();
      if (text) log("api:err", text);
    });

    apiProcess.on("error", (err) => {
      log("error", "API server process error", { message: err.message });
      reject(err);
    });

    apiProcess.on("exit", (code, signal) => {
      log("warn", "API server exited", { code, signal });
      apiReady = false;
      apiFailed = true;
      apiFailedError = new Error(`توقف خادم API بشكل غير متوقع (رمز الخروج: ${code})`);
      apiProcess = null;
      // If the main window exists and API died unexpectedly, show an error
      if (mainWindow && !isQuitting) {
        dialog.showErrorBox(
          "خطأ في الخادم",
          `توقف خادم API بشكل غير متوقع (رمز الخروج: ${code}).\nأعد تشغيل التطبيق.`
        );
      }
    });

    // The process started successfully — resolve immediately.
    // We'll wait for the health endpoint separately.
    resolve(apiProcess);
  });
}

function stopApiServer() {
  return new Promise((resolve) => {
    if (!apiProcess) {
      resolve();
      return;
    }
    log("info", "Stopping API server...");
    const p = apiProcess;
    apiProcess = null;

    const timeout = setTimeout(() => {
      log("warn", "API server did not exit gracefully, killing it");
      p.kill("SIGKILL");
      resolve();
    }, 5000);

    p.on("exit", () => {
      clearTimeout(timeout);
      log("info", "API server stopped");
      resolve();
    });

    p.kill("SIGTERM");
  });
}

// ---------------------------------------------------------------------------
// Health check — polls until API responds or times out
// ---------------------------------------------------------------------------

function waitForApi(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let attempts = 0;

    function check() {
      if (apiFailed) {
        reject(apiFailedError || new Error("API server process exited prematurely"));
        return;
      }
      attempts++;
      const req = http.get(HEALTH_URL, (res) => {
        if (res.statusCode === 200) {
          log("info", `API ready after ${attempts} attempt(s)`);
          resolve();
        } else {
          scheduleRetry();
        }
        res.resume(); // drain body
      });
      req.on("error", scheduleRetry);
      req.setTimeout(1000, () => {
        req.destroy();
        scheduleRetry();
      });
    }

    function scheduleRetry() {
      if (Date.now() - start >= timeoutMs) {
        reject(new Error(`API server did not become ready within ${timeoutMs}ms`));
        return;
      }
      setTimeout(check, 500);
    }

    check();
  });
}

// ---------------------------------------------------------------------------
// BrowserWindow
// ---------------------------------------------------------------------------

let mainWindow = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "نظام نقاط البيع",
    // Custom icon (placed in artifacts/desktop/assets/)
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      // Security: keep Node integration off in the renderer
      nodeIntegration: false,
      contextIsolation: true,
      // Expose safe IPC bridge via preload
      preload: path.join(__dirname, "preload.js"),
      // Allow loading local resources
      webSecurity: true,
    },
    // Start without native frame for a more app-like feel on Windows
    // (uncomment if you want a frameless window with custom titlebar)
    // frame: false,
    backgroundColor: "#0f172a", // Match the dark slate background of the SPA
    show: false, // Don't show until ready-to-show fires (avoids white flash)
  });

  // Remove the default Electron menu bar
  Menu.setApplicationMenu(null);

  // Load the POS frontend (served by the Express static middleware)
  mainWindow.loadURL(`${API_BASE}`);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    log("info", "Main window displayed");
  });

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  // Handle external links — open in system browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// Auto-updater
// ---------------------------------------------------------------------------

function setupAutoUpdater() {
  // Only run in packaged builds
  if (!app.isPackaged) return;

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("update-available", (info) => {
    log("info", "Update available", { version: info.version });
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "تحديث متاح",
      message: `إصدار جديد (${info.version}) متاح. سيتم تنزيله في الخلفية.`,
      buttons: ["حسناً"],
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    log("info", "Update downloaded", { version: info.version });
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "تحديث جاهز للتثبيت",
        message: `تم تنزيل الإصدار ${info.version}. سيتم التثبيت عند إغلاق التطبيق.`,
        buttons: ["تثبيت الآن", "لاحقاً"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          isQuitting = true;
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on("error", (err) => {
    log("error", "Auto-updater error", { message: err.message });
  });
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

function setupIpcHandlers() {
  // Silent thermal printing
  ipcMain.handle("print", async (_event, options) => {
    if (!mainWindow) return { success: false, error: "No window" };

    return new Promise((resolve) => {
      const printOptions = {
        silent: options?.silent !== false, // default: true (no dialog)
        printBackground: true,
        deviceName: options?.deviceName || "",
        pageSize: options?.pageSize || { width: 80000, height: 0 }, // 80mm thermal
        margins: { marginType: "none" },
        copies: options?.copies || 1,
      };

      mainWindow.webContents.print(printOptions, (success, failureReason) => {
        if (success) {
          resolve({ success: true });
        } else {
          log("warn", "Print failed", { failureReason });
          resolve({ success: false, error: failureReason });
        }
      });
    });
  });

  // Get available printers
  ipcMain.handle("get-printers", async () => {
    if (!mainWindow) return [];
    try {
      return await mainWindow.webContents.getPrintersAsync();
    } catch {
      return [];
    }
  });

  // App version
  ipcMain.handle("get-version", () => app.getVersion());

  // Open the AppData folder in Explorer (for backup/support)
  ipcMain.handle("open-data-folder", () => {
    shell.openPath(APP_DATA_DIR);
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  try {
    // 1. Ensure app data directory exists FIRST so logging works
    ensureAppDataDir();
    log("info", "Electron app ready", { version: app.getVersion() });

    // 2. Get or generate the session secret
    const sessionSecret = getOrCreateSecret();

    // 3. Initialize Database (copy seed if not exists)
    initDatabase();

    // 4. Register IPC handlers before creating window
    setupIpcHandlers();

    // 5. Start the API server child process
    await startApiServer(sessionSecret);

    // 6. Wait for the API to become healthy
    log("info", "Waiting for API server to be ready...");
    await waitForApi(45000);

    // 7. Create the main window
    createWindow();

    // 8. Setup auto-updater (no-op in dev mode)
    setupAutoUpdater();
  } catch (err) {
    log("error", "Fatal startup error", { message: err.message, stack: err.stack });
    dialog.showErrorBox(
      "خطأ في بدء التشغيل",
      `فشل تشغيل التطبيق:\n${err.message}\n\nتحقق من ملف السجل:\n${LOG_PATH}`
    );
    app.quit();
  }
});

// macOS: re-create window when dock icon is clicked and no windows are open
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  // On Windows/Linux, quit when all windows are closed
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  if (apiProcess && !isQuitting) {
    event.preventDefault();
    isQuitting = true;
    log("info", "App quitting — stopping API server...");
    await stopApiServer();
    app.quit();
  }
});

// Handle second-instance (single instance lock)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log("warn", "Another instance is already running — quitting");
  app.quit();
} else {
  app.on("second-instance", () => {
    // Focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
