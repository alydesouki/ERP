"use strict";

/**
 * ApplicationManager — central bootstrapper.
 *
 * Orchestrates initialization, dependency injection, and lifecycle events.
 */

const { app, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const { log } = require("./logger");
const { APP_DATA_DIR, SECRET_PATH, DB_PATH } = require("./constants");
const { SessionManager } = require("./SessionManager");
const { WindowManager } = require("./WindowManager");
const { MenuManager } = require("./MenuManager");
const { ShortcutManager } = require("./ShortcutManager");
const { IPCManager } = require("./IPCManager");
const { ApiServerManager } = require("./ApiServerManager");
const { AutoUpdateManager } = require("./AutoUpdateManager");
const { PrintManager } = require("./PrintManager");

class ApplicationManager {
  constructor() {
    this.sessionManager = new SessionManager();
    this.windowManager = new WindowManager(this.sessionManager);
    this.menuManager = new MenuManager(this.windowManager);
    this.shortcutManager = new ShortcutManager(this.windowManager);
    this.printManager = new PrintManager();
    this.ipcManager = new IPCManager(
      this.windowManager,
      this.sessionManager,
      this.printManager
    );
    this.apiServerManager = new ApiServerManager();
    this.autoUpdateManager = new AutoUpdateManager(this.windowManager);

    this._isQuitting = false;
  }

  async init() {
    // 1. Single Instance Lock
    // ---------------------------------------------------------------------
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
      log("warn", "Another instance is already running — quitting");
      app.quit();
      return;
    }

    app.on("second-instance", () => {
      // Create a new window inside the existing process
      this.windowManager.createWindow();
    });

    // 2. Wait for Electron Ready
    // ---------------------------------------------------------------------
    await app.whenReady();

    try {
      this._ensureAppDataDir();
      log("info", "Electron app ready", { version: app.getVersion() });

      const sessionSecret = this._getOrCreateSecret();
      this._initDatabase();

      // 3. Register Subsystems
      // ---------------------------------------------------------------------
      this.ipcManager.registerHandlers();
      this.menuManager.registerMenu();
      this.shortcutManager.registerShortcuts();

      // 4. Start API Server
      // ---------------------------------------------------------------------
      await this.apiServerManager.start(sessionSecret);
      log("info", "Waiting for API server to be ready...");
      await this.apiServerManager.waitUntilReady(45000);

      // 5. Restore or Create Windows
      // ---------------------------------------------------------------------
      this.windowManager.restoreAll();
      if (this.windowManager.count() === 0) {
        this.windowManager.createWindow();
      }

      // 6. Setup Auto Update
      // ---------------------------------------------------------------------
      this.autoUpdateManager.setup();

    } catch (err) {
      log("error", "Fatal startup error", { message: err.message, stack: err.stack });
      dialog.showErrorBox(
        "خطأ في بدء التشغيل",
        `فشل تشغيل التطبيق:\n${err.message}\n\nتحقق من ملف السجل.`
      );
      app.quit();
    }

    // 7. Lifecycle Hooks
    // ---------------------------------------------------------------------
    app.on("activate", () => {
      if (this.windowManager.count() === 0) {
        this.windowManager.createWindow();
      }
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    app.on("before-quit", async (event) => {
      if (this._isQuitting) return;

      event.preventDefault();
      this._isQuitting = true;
      log("info", "App quitting...");

      this.windowManager.cleanupAll();

      if (this.apiServerManager.isReady) {
        await this.apiServerManager.stop();
      }

      app.quit();
    });
  }

  // -----------------------------------------------------------------------
  // Bootstrapping Helpers
  // -----------------------------------------------------------------------

  _ensureAppDataDir() {
    if (!fs.existsSync(APP_DATA_DIR)) {
      fs.mkdirSync(APP_DATA_DIR, { recursive: true });
      log("info", "Created AppData directory", { path: APP_DATA_DIR });
    }
  }

  _getOrCreateSecret() {
    if (fs.existsSync(SECRET_PATH)) {
      const secret = fs.readFileSync(SECRET_PATH, "utf8").trim();
      if (secret.length >= 32) return secret;
    }
    const secret = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(SECRET_PATH, secret, { mode: 0o600 });
    return secret;
  }

  _initDatabase() {
    const exists = fs.existsSync(DB_PATH);
    if (!exists) {
      log("info", "Database not found, copying seed database...");
      // In packaged, __dirname is .../app.asar/src
      const seedPath = path.join(__dirname, "..", "assets", "seed.db");
      if (fs.existsSync(seedPath)) {
        fs.copyFileSync(seedPath, DB_PATH);
        log("info", "Seed database copied successfully");
      } else {
        log("error", "Seed database not found at " + seedPath);
      }
    }
  }
}

module.exports = { ApplicationManager };
