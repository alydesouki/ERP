"use strict";

/**
 * ApplicationManager — Top-Level Orchestrator
 *
 * Coordinates all managers: WindowManager, SessionManager, MenuManager,
 * ShortcutManager. Owns the app lifecycle, IPC registration, and
 * API server management.
 *
 * This is the single entry point called from main.js.
 */

const { app, ipcMain, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");

const { WindowManager } = require("./window-manager");
const { SessionManager } = require("./session-manager");
const { MenuManager } = require("./menu-manager");
const { ShortcutManager } = require("./shortcut-manager");

// [LICENSING] ── License guard (must be required after Electron is ready)
const { LicenseGuard } = require("../licensing/LicenseGuard");

const API_PORT = 5001;
const API_BASE = `http://localhost:${API_PORT}`;
const HEALTH_URL = `${API_BASE}/api/healthz`;

class ApplicationManager {
  /**
   * @param {object} opts
   * @param {string} opts.appDataDir      e.g. %APPDATA%/ShoeStorePOS
   * @param {string} opts.dbPath
   * @param {string} opts.secretPath
   * @param {string} opts.logPath
   * @param {string} opts.printerSettingsPath
   * @param {string} opts.iconPath
   * @param {string} opts.preloadPath
   * @param {string} opts.assetsDir
   * @param {Function} opts.log           log(level, msg, meta?)
   */
  constructor(opts) {
    this._appDataDir = opts.appDataDir;
    this._dbPath = opts.dbPath;
    this._secretPath = opts.secretPath;
    this._logPath = opts.logPath;
    this._printerSettingsPath = opts.printerSettingsPath;
    this._iconPath = opts.iconPath;
    this._preloadPath = opts.preloadPath;
    this._assetsDir = opts.assetsDir;
    this._log = opts.log;

    this._apiProcess = null;
    this._apiReady = false;
    this._apiFailed = false;
    this._apiFailedError = null;
    this._isQuitting = false;

    this._sessionManager = null;
    this._windowManager = null;
    this._menuManager = null;
    this._shortcutManager = null;
  }

  // =========================================================================
  // Public entry point
  // =========================================================================

  /**
   * Initialize the entire application.
   * Called from main.js inside app.whenReady().
   */
  async initialize() {
    this._log("info", "ApplicationManager initializing...");

    // [LICENSING] ── Run hardware & license check before anything else.
    // If this call returns, the license is valid and the ERP may proceed.
    // On any failure it shows an error dialog and calls app.quit() internally.
    const licenseGuard = new LicenseGuard({
      appDataDir: this._appDataDir,
      iconPath:   this._iconPath,
      log:        this._log,
    });
    await licenseGuard.check();
    // [/LICENSING]

    // 1. Get or generate session secret
    const sessionSecret = this._getOrCreateSecret();

    // 2. Bootstrap database
    this._initDatabase();

    // 3. Create managers
    this._sessionManager = new SessionManager();

    const windowStateFile = path.join(this._appDataDir, "windows.json");

    this._windowManager = new WindowManager({
      apiBase: API_BASE,
      preloadPath: this._preloadPath,
      iconPath: this._iconPath,
      stateFilePath: windowStateFile,
      appTitle: "نظام نقاط البيع — ERP",
      sessionManager: this._sessionManager,
      log: this._log,
      isDev: !app.isPackaged,
    });

    this._menuManager = new MenuManager({
      onNewWindow: () => this._createNewWindow(),
      onCloseWindow: () => this._windowManager.closeWindow(),
      onReopenClosedWindow: () => this._reopenClosedWindow(),
      onFocusWindow: (id) => this._windowManager.focusWindow(id),
      onCloseAllWindows: () => this._windowManager.closeAllWindows(),
      getWindowList: () => this._windowManager.listWindows(),
    });

    this._shortcutManager = new ShortcutManager({
      onNewWindow: () => this._createNewWindow(),
      onReopenClosedWindow: () => this._reopenClosedWindow(),
      onCloseWindow: () => this._windowManager.closeWindow(),
      onCloseAllWindows: () => this._windowManager.closeAllWindows(),
      onSwitchWindow: () => this._windowManager.focusNextWindow(),
    });

    // 4. Register IPC handlers
    this._registerIpc();

    // 5. Start API server
    await this._startApiServer(sessionSecret);

    // 6. Wait for API to be healthy
    this._log("info", "Waiting for API server...");
    await this._waitForApi(45000);
    this._log("info", "API server is ready");

    // 7. Register shortcuts
    this._shortcutManager.register();

    // 8. Restore windows (or create first window)
    const restored = this._windowManager.restorePersistedWindows();
    if (!restored) {
      this._createNewWindow();
    }

    // Rebuild menu after windows are open
    this._rebuildMenu();

    // 9. Auto-updater
    this._setupAutoUpdater();

    // 10. Lifecycle events
    this._setupLifecycleEvents();

    this._log("info", "ApplicationManager ready");
  }

  // =========================================================================
  // Window management helpers
  // =========================================================================

  _createNewWindow() {
    const win = this._windowManager.createWindow();
    this._rebuildMenu();
    return win;
  }

  _reopenClosedWindow() {
    const win = this._windowManager.restoreClosedWindow();
    if (win) this._rebuildMenu();
    return win;
  }

  _rebuildMenu() {
    this._menuManager.rebuild();
  }

  // =========================================================================
  // API Server management
  // =========================================================================

  _getApiEntryPoint() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "api-server", "dist", "index.mjs");
    }
    return path.resolve(this._preloadPath, "..", "..", "api-server", "dist", "index.mjs");
  }

  async _startApiServer(sessionSecret) {
    const entryPoint = this._getApiEntryPoint();

    if (!fs.existsSync(entryPoint)) {
      throw new Error(
        `API server bundle not found: ${entryPoint}\nRun "pnpm build" first.`
      );
    }

    this._log("info", "Starting API server", { entryPoint });

    return new Promise((resolve, reject) => {
      this._apiProcess = spawn("node", ["--enable-source-maps", entryPoint], {
        env: {
          ...process.env,
          NODE_ENV: "production",
          PORT: String(API_PORT),
          DATABASE_URL: this._dbPath,
          SESSION_SECRET: sessionSecret,
          SERVE_STATIC: "true",
          PINO_LOG_FILE: this._logPath,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      this._apiProcess.stdout.on("data", (data) => {
        const text = data.toString().trim();
        if (text) this._log("api", text);
        if (text.includes('"Server listening"') || text.includes("Server listening")) {
          this._apiReady = true;
        }
      });

      this._apiProcess.stderr.on("data", (data) => {
        const text = data.toString().trim();
        if (text) this._log("api:err", text);
      });

      this._apiProcess.on("error", (err) => {
        this._log("error", "API server process error", { message: err.message });
        reject(err);
      });

      this._apiProcess.on("exit", (code, signal) => {
        this._log("warn", "API server exited", { code, signal });
        this._apiReady = false;
        this._apiFailed = true;
        this._apiFailedError = new Error(
          `توقف خادم API بشكل غير متوقع (رمز الخروج: ${code})`
        );
        this._apiProcess = null;

        if (this._windowManager && !this._isQuitting) {
          const wins = this._windowManager.listWindows();
          if (wins.length > 0) {
            dialog.showErrorBox(
              "خطأ في الخادم",
              `توقف خادم API بشكل غير متوقع (رمز الخروج: ${code}).\nأعد تشغيل التطبيق.`
            );
          }
        }
      });

      resolve(this._apiProcess);
    });
  }

  async _stopApiServer() {
    return new Promise((resolve) => {
      if (!this._apiProcess) {
        resolve();
        return;
      }
      this._log("info", "Stopping API server...");
      const p = this._apiProcess;
      this._apiProcess = null;

      const timeout = setTimeout(() => {
        this._log("warn", "API server did not exit gracefully, killing");
        p.kill("SIGKILL");
        resolve();
      }, 5000);

      p.on("exit", () => {
        clearTimeout(timeout);
        this._log("info", "API server stopped");
        resolve();
      });

      p.kill("SIGTERM");
    });
  }

  _waitForApi(timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      let attempts = 0;

      const check = () => {
        if (this._apiFailed) {
          reject(this._apiFailedError || new Error("API server process exited prematurely"));
          return;
        }
        attempts++;
        const req = http.get(HEALTH_URL, (res) => {
          if (res.statusCode === 200) {
            this._log("info", `API ready after ${attempts} attempt(s)`);
            resolve();
          } else {
            scheduleRetry();
          }
          res.resume();
        });
        req.on("error", scheduleRetry);
        req.setTimeout(1000, () => {
          req.destroy();
          scheduleRetry();
        });
      };

      const scheduleRetry = () => {
        if (Date.now() - start >= timeoutMs) {
          reject(new Error(`API server did not become ready within ${timeoutMs}ms`));
          return;
        }
        setTimeout(check, 500);
      };

      check();
    });
  }

  // =========================================================================
  // Printing helpers (preserved from original)
  // =========================================================================

  async _printHtml(html, options = {}) {
    if (!html || !String(html).trim()) {
      return { success: false, error: "No print content" };
    }

    const { BrowserWindow: BW } = require("electron");
    const tempPath = path.join(
      app.getPath("temp"),
      `erp-print-${Date.now()}-${Math.random().toString(36).slice(2)}.html`
    );

    let printWindow = null;

    try {
      fs.writeFileSync(tempPath, html, "utf8");

      printWindow = new BW({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      await printWindow.loadFile(tempPath);

      await printWindow.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
          const waitImages = () => {
            const images = Array.from(document.images);
            if (images.length === 0) return Promise.resolve();
            return Promise.all(
              images.map(
                (img) =>
                  new Promise((res) => {
                    if (img.complete) { res(undefined); return; }
                    img.addEventListener("load", () => res(undefined), { once: true });
                    img.addEventListener("error", () => res(undefined), { once: true });
                  }),
              ),
            );
          };
          const fontsReady =
            document.fonts && document.fonts.ready
              ? document.fonts.ready.catch(() => undefined)
              : Promise.resolve();
          Promise.all([fontsReady, waitImages()]).then(done).catch(done);
        })
      `);

      const printOptions = {
        silent: options.silent !== false,
        printBackground: true,
        copies: options.copies || 1,
      };

      const deviceName = options.deviceName && String(options.deviceName).trim();
      if (deviceName) printOptions.deviceName = deviceName;

      if (options.pageSize) {
        const ps = options.pageSize;
        if (typeof ps === "object" && ps.width && ps.height) {
          printOptions.pageSize = ps;
        } else if (typeof ps === "string") {
          printOptions.pageSize = ps;
        } else {
          printOptions.usePrinterDefaultPageSize = true;
        }
      } else {
        printOptions.usePrinterDefaultPageSize = true;
      }

      return await new Promise((resolve) => {
        printWindow.webContents.print(printOptions, (success, failureReason) => {
          if (success) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: failureReason || "Print failed" });
          }
        });
      });
    } finally {
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.close();
      }
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // temp file may already be gone
      }
    }
  }

  // =========================================================================
  // IPC handlers
  // =========================================================================

  _registerIpc() {
    // ── Existing IPC (preserved) ──────────────────────────────────────────

    ipcMain.handle("print", async (_event, options) => {
      try {
        return await this._printHtml(options?.html, options);
      } catch (error) {
        this._log("error", "Print handler failed", { error: error.message });
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("get-printers", async (event) => {
      const win = this._windowManager?.getWindowInfoByContents(event.sender);
      const { BrowserWindow: BW } = require("electron");
      const bw = win
        ? BW.fromWebContents(event.sender)
        : BW.getAllWindows()[0];
      if (!bw) return [];
      try {
        return await bw.webContents.getPrintersAsync();
      } catch {
        return [];
      }
    });

    ipcMain.handle("get-version", () => app.getVersion());

    ipcMain.handle("open-data-folder", () => {
      shell.openPath(this._appDataDir);
    });

    ipcMain.handle("get-printer-settings", () => {
      try {
        if (fs.existsSync(this._printerSettingsPath)) {
          return JSON.parse(fs.readFileSync(this._printerSettingsPath, "utf8"));
        }
      } catch (e) {
        this._log("error", "Failed to read printer settings", { error: e.message });
      }
      return {};
    });

    ipcMain.handle("save-printer-settings", (_event, settings) => {
      try {
        fs.writeFileSync(this._printerSettingsPath, JSON.stringify(settings, null, 2));
        return { success: true };
      } catch (e) {
        this._log("error", "Failed to save printer settings", { error: e.message });
        return { success: false, error: e.message };
      }
    });

    // ── Multi-window IPC (new) ────────────────────────────────────────────

    ipcMain.handle("erp:create-window", () => {
      this._createNewWindow();
    });

    ipcMain.handle("erp:close-window", (event) => {
      const info = this._windowManager.getWindowInfoByContents(event.sender);
      if (info) this._windowManager.closeWindow(info.id);
    });

    ipcMain.handle("erp:list-windows", () => {
      return this._windowManager.listWindows();
    });

    ipcMain.handle("erp:focus-window", (_event, windowId) => {
      this._windowManager.focusWindow(windowId);
    });

    ipcMain.handle("erp:get-current-window", (event) => {
      return this._windowManager.getWindowInfoByContents(event.sender) || null;
    });

    // Renderer tells us when the route changes so we can persist it
    ipcMain.on("erp:route-changed", (event, route) => {
      const info = this._windowManager.getWindowInfoByContents(event.sender);
      if (info) {
        this._windowManager.setLastRoute(info.id, route);
      }
    });
  }

  // =========================================================================
  // Auto-updater
  // =========================================================================

  _setupAutoUpdater() {
    if (!app.isPackaged) return;

    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on("update-available", (info) => {
      this._log("info", "Update available", { version: info.version });
      const wins = this._windowManager.listWindows();
      if (wins.length > 0) {
        const { BrowserWindow: BW } = require("electron");
        const bw = BW.getAllWindows()[0];
        dialog.showMessageBox(bw, {
          type: "info",
          title: "تحديث متاح",
          message: `إصدار جديد (${info.version}) متاح. سيتم تنزيله في الخلفية.`,
          buttons: ["حسناً"],
        });
      }
    });

    autoUpdater.on("update-downloaded", (info) => {
      this._log("info", "Update downloaded", { version: info.version });
      const { BrowserWindow: BW } = require("electron");
      const bw = BW.getAllWindows()[0];
      dialog
        .showMessageBox(bw, {
          type: "info",
          title: "تحديث جاهز للتثبيت",
          message: `تم تنزيل الإصدار ${info.version}. سيتم التثبيت عند إغلاق التطبيق.`,
          buttons: ["تثبيت الآن", "لاحقاً"],
          defaultId: 0,
          cancelId: 1,
        })
        .then((result) => {
          if (result.response === 0) {
            this._isQuitting = true;
            autoUpdater.quitAndInstall();
          }
        });
    });

    autoUpdater.on("error", (err) => {
      this._log("error", "Auto-updater error", { message: err.message });
    });
  }

  // =========================================================================
  // App lifecycle
  // =========================================================================

  _setupLifecycleEvents() {
    // macOS: re-create a window when dock icon is clicked
    app.on("activate", () => {
      if (this._windowManager.getWindowCount() === 0) {
        this._createNewWindow();
      }
    });

    // Windows / Linux: quit when all windows are closed
    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    app.on("before-quit", async (event) => {
      if (this._apiProcess && !this._isQuitting) {
        event.preventDefault();
        this._isQuitting = true;
        this._shortcutManager.unregister();
        this._log("info", "App quitting — stopping API server...");
        await this._stopApiServer();
        app.quit();
      }
    });
  }

  // =========================================================================
  // Secret & DB helpers (preserved from original main.js)
  // =========================================================================

  _getOrCreateSecret() {
    if (fs.existsSync(this._secretPath)) {
      const secret = fs.readFileSync(this._secretPath, "utf8").trim();
      if (secret.length >= 32) {
        this._log("info", "Loaded existing SESSION_SECRET");
        return secret;
      }
    }
    const secret = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(this._secretPath, secret, { mode: 0o600 });
    this._log("info", "Generated new SESSION_SECRET");
    return secret;
  }

  _initDatabase() {
    const exists = fs.existsSync(this._dbPath);
    if (!exists) {
      this._log("info", "Database not found, copying seed database...");
      const seedPath = path.join(this._assetsDir, "seed.db");
      if (fs.existsSync(seedPath)) {
        fs.copyFileSync(seedPath, this._dbPath);
        this._log("info", "Seed database copied successfully");
      } else {
        this._log("error", "Seed database not found at " + seedPath);
      }
    } else {
      this._log("info", `Database path: ${this._dbPath}`, { exists });
    }
  }

  /**
   * Handle a second-instance launch event.
   * Instead of focusing the existing window (old behavior),
   * we open a NEW window in the existing process.
   */
  handleSecondInstance() {
    this._log("info", "Second instance detected — opening new window");
    this._createNewWindow();
  }
}

module.exports = { ApplicationManager };
