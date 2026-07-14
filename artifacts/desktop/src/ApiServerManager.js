"use strict";

/**
 * ApiServerManager — manages the Express API child process.
 *
 * Extracted from the original main.js lines 114-263.
 * Responsible for:
 *   • Resolving the API entry-point (dev vs. packaged)
 *   • Spawning the child process with correct env vars
 *   • Polling /api/healthz until the server is ready
 *   • Graceful shutdown (SIGTERM → SIGKILL timeout)
 */

const { app, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { log } = require("./logger");
const { API_PORT, HEALTH_URL, DB_PATH, LOG_PATH } = require("./constants");

class ApiServerManager {
  constructor() {
    /** @type {import("child_process").ChildProcess | null} */
    this._process = null;
    this._ready = false;
    this._failed = false;
    /** @type {Error | null} */
    this._failedError = null;
  }

  /** Whether the API server has responded to at least one health check. */
  get isReady() {
    return this._ready;
  }

  // -----------------------------------------------------------------------
  // Entry-point resolution
  // -----------------------------------------------------------------------

  /** @returns {string} Absolute path to the API server bundle */
  _getEntryPoint() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "api-server", "dist", "index.mjs");
    }
    return path.resolve(__dirname, "..", "..", "api-server", "dist", "index.mjs");
  }

  // -----------------------------------------------------------------------
  // Start
  // -----------------------------------------------------------------------

  /**
   * Spawn the Express API server as a child process.
   * Resolves as soon as the process is spawned (NOT when it's ready).
   * Call `waitForApi()` afterwards.
   *
   * @param {string} sessionSecret — the SESSION_SECRET env var
   * @returns {Promise<void>}
   */
  start(sessionSecret) {
    return new Promise((resolve, reject) => {
      const entryPoint = this._getEntryPoint();

      if (!fs.existsSync(entryPoint)) {
        const err = new Error(
          `API server bundle not found: ${entryPoint}\nRun "pnpm build" first.`
        );
        log("error", err.message);
        reject(err);
        return;
      }

      log("info", "Starting API server", { entryPoint });

      this._process = spawn("node", ["--enable-source-maps", entryPoint], {
        env: {
          ...process.env,
          NODE_ENV: "production",
          PORT: String(API_PORT),
          DATABASE_URL: DB_PATH,
          SESSION_SECRET: sessionSecret,
          SERVE_STATIC: "true",
          PINO_LOG_FILE: LOG_PATH,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      this._process.stdout.on("data", (data) => {
        const text = data.toString().trim();
        if (text) log("api", text);
        if (text.includes('"Server listening"') || text.includes("Server listening")) {
          this._ready = true;
        }
      });

      this._process.stderr.on("data", (data) => {
        const text = data.toString().trim();
        if (text) log("api:err", text);
      });

      this._process.on("error", (err) => {
        log("error", "API server process error", { message: err.message });
        reject(err);
      });

      this._process.on("exit", (code, signal) => {
        log("warn", "API server exited", { code, signal });
        this._ready = false;
        this._failed = true;
        this._failedError = new Error(
          `توقف خادم API بشكل غير متوقع (رمز الخروج: ${code})`
        );
        this._process = null;
      });

      // Process spawned — resolve immediately.
      resolve();
    });
  }

  // -----------------------------------------------------------------------
  // Health check
  // -----------------------------------------------------------------------

  /**
   * Poll the health endpoint until the API responds 200 or timeout.
   * @param {number} [timeoutMs=45000]
   * @returns {Promise<void>}
   */
  waitUntilReady(timeoutMs = 45000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      let attempts = 0;

      const check = () => {
        if (this._failed) {
          reject(this._failedError || new Error("API server process exited prematurely"));
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

  // -----------------------------------------------------------------------
  // Stop
  // -----------------------------------------------------------------------

  /**
   * Gracefully stop the API server child process.
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise((resolve) => {
      if (!this._process) {
        resolve();
        return;
      }
      log("info", "Stopping API server...");
      const p = this._process;
      this._process = null;

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

  /**
   * Show a fatal error dialog to the user.
   * @param {import("electron").BrowserWindow | null} parentWindow
   * @param {number | null} exitCode
   */
  showCrashDialog(parentWindow, exitCode) {
    const options = {
      type: "error",
      title: "خطأ في الخادم",
      message: `توقف خادم API بشكل غير متوقع (رمز الخروج: ${exitCode}).\nأعد تشغيل التطبيق.`,
    };
    if (parentWindow && !parentWindow.isDestroyed()) {
      dialog.showMessageBox(parentWindow, options);
    } else {
      dialog.showErrorBox(options.title, options.message);
    }
  }
}

module.exports = { ApiServerManager };
