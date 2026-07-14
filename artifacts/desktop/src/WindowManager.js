"use strict";

/**
 * WindowManager — manages the lifecycle of all ERP BrowserWindow instances.
 *
 * Each window is created with its own Electron session partition, ensuring
 * complete isolation of cookies, localStorage, IndexedDB, cache, and auth.
 *
 * Responsibilities:
 *  • Create / destroy / track windows
 *  • Track the focused window
 *  • Persist and restore window state (bounds, maximized, fullscreen, partition)
 *  • Provide a "closed windows" stack for Reopen Closed Window
 *  • Cycle focus between windows (Ctrl+Tab)
 *  • Broadcast events across windows
 *  • Prevent memory leaks by cleaning up listeners
 */

const { BrowserWindow, shell } = require("electron");
const path = require("path");
const { log } = require("./logger");
const { API_BASE } = require("./constants");

// electron-store is a CommonJS module — require it at the top level.
// It is added as a dependency in package.json.
// In newer versions (e.g. 10+), requiring an ESM module in Node 22 returns the namespace object.
const _Store = require("electron-store");
const Store = _Store.default || _Store;

/**
 * @typedef {Object} WindowState
 * @property {string}  id
 * @property {string}  partition
 * @property {{x:number,y:number,width:number,height:number}} bounds
 * @property {boolean} isMaximized
 * @property {boolean} isFullscreen
 * @property {string}  lastUrl
 */

/**
 * @typedef {Object} TrackedWindow
 * @property {import("electron").BrowserWindow} win
 * @property {string}  id
 * @property {string}  partition
 * @property {string}  lastUrl
 */

class WindowManager {
  /**
   * @param {import("./SessionManager").SessionManager} sessionManager
   */
  constructor(sessionManager) {
    /** @type {import("./SessionManager").SessionManager} */
    this._sessionManager = sessionManager;

    /** @type {Map<string, TrackedWindow>} id → tracked window */
    this._windows = new Map();

    /** @type {WindowState[]} Stack of recently closed windows (for reopen) */
    this._closedStack = [];

    /** @type {string | null} id of the currently focused window */
    this._focusedId = null;

    /** Persists window state across restarts */
    this._store = new Store({
      name: "erp-window-states",
      defaults: { windows: /** @type {WindowState[]} */ ([]) },
    });

    /** Auto-incrementing counter for window title numbering */
    this._windowCounter = 0;
  }

  // -----------------------------------------------------------------------
  // Window creation
  // -----------------------------------------------------------------------

  /**
   * Create a new ERP window with an isolated session.
   *
   * @param {Object}  [options]
   * @param {string}  [options.partition]   Reuse an existing partition (for restore)
   * @param {{x:number,y:number,width:number,height:number}} [options.bounds]
   * @param {boolean} [options.isMaximized]
   * @param {boolean} [options.isFullscreen]
   * @param {string}  [options.lastUrl]     URL path to load
   * @param {string}  [options.id]          Reuse a specific window id (for restore)
   * @returns {string} The window id
   */
  createWindow(options = {}) {
    const id = options.id || `win-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const partition = options.partition
      ? this._sessionManager.reusePartition(options.partition)
      : this._sessionManager.createPartition();

    this._windowCounter++;
    const windowNumber = this._windowCounter;

    const bounds = options.bounds || { width: 1400, height: 900 };

    const win = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      minWidth: 1024,
      minHeight: 700,
      title: `نظام نقاط البيع — نافذة ${windowNumber}`,
      icon: path.join(__dirname, "..", "assets", "icon.png"),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, "..", "preload.js"),
        webSecurity: true,
        partition, // ← session isolation
      },
      backgroundColor: "#0f172a",
      show: false,
    });

    // Restore maximized / fullscreen state AFTER construction
    if (options.isMaximized) {
      win.maximize();
    }
    if (options.isFullscreen) {
      win.setFullScreen(true);
    }

    // Load the ERP frontend
    const loadUrl = options.lastUrl
      ? `${API_BASE}${options.lastUrl}`
      : API_BASE;
    win.loadURL(loadUrl);

    win.once("ready-to-show", () => {
      win.show();
      log("info", `Window ${id} displayed`, { partition, windowNumber });
    });

    // Open DevTools in development
    if (!require("electron").app.isPackaged) {
      win.webContents.openDevTools({ mode: "detach" });
    }

    // External links → system browser
    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });

    // Track focus
    win.on("focus", () => {
      this._focusedId = id;
    });

    // Track URL changes for state persistence
    win.webContents.on("did-navigate-in-page", (_event, url) => {
      const tracked = this._windows.get(id);
      if (tracked) {
        try {
          tracked.lastUrl = new URL(url).pathname;
        } catch {
          tracked.lastUrl = "/";
        }
      }
    });

    // Cleanup on close
    win.on("closed", () => {
      this._onWindowClosed(id);
    });

    /** @type {TrackedWindow} */
    const tracked = { win, id, partition, lastUrl: options.lastUrl || "/" };
    this._windows.set(id, tracked);

    if (this._focusedId === null) {
      this._focusedId = id;
    }

    return id;
  }

  // -----------------------------------------------------------------------
  // Window close handling
  // -----------------------------------------------------------------------

  /**
   * Internal handler called when a window emits 'closed'.
   * Captures state for the closed-windows stack, then removes from tracking.
   * @param {string} id
   */
  _onWindowClosed(id) {
    const tracked = this._windows.get(id);
    if (!tracked) return;

    // Save state for possible reopen
    const state = this._captureState(tracked);
    if (state) {
      this._closedStack.push(state);
      // Keep only the last 10 closed windows
      if (this._closedStack.length > 10) {
        this._closedStack.shift();
      }
    }

    // Deactivate partition tracking (but DON'T clear data — we want reopen to work)
    this._sessionManager.deactivatePartition(tracked.partition);

    this._windows.delete(id);

    if (this._focusedId === id) {
      // Move focus to the most recent remaining window
      const remaining = Array.from(this._windows.keys());
      this._focusedId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    }

    log("info", `Window ${id} closed`, { remaining: this._windows.size });

    // Persist surviving windows
    this._persistAllStates();
  }

  // -----------------------------------------------------------------------
  // Window queries
  // -----------------------------------------------------------------------

  /**
   * @param {string} id
   * @returns {import("electron").BrowserWindow | null}
   */
  getWindowById(id) {
    const tracked = this._windows.get(id);
    return tracked ? tracked.win : null;
  }

  /**
   * @returns {import("electron").BrowserWindow | null} The currently focused window
   */
  getFocusedWindow() {
    if (this._focusedId) {
      const tracked = this._windows.get(this._focusedId);
      if (tracked && !tracked.win.isDestroyed()) return tracked.win;
    }
    // Fallback: ask Electron
    return BrowserWindow.getFocusedWindow();
  }

  /**
   * Returns metadata for all open windows (safe to send to renderer).
   * @returns {Array<{id: string, partition: string, title: string}>}
   */
  getAllWindowInfo() {
    const result = [];
    for (const [id, tracked] of this._windows) {
      if (!tracked.win.isDestroyed()) {
        result.push({
          id,
          partition: tracked.partition,
          title: tracked.win.getTitle(),
        });
      }
    }
    return result;
  }

  /**
   * @returns {number} Number of open windows
   */
  count() {
    return this._windows.size;
  }

  // -----------------------------------------------------------------------
  // Window actions
  // -----------------------------------------------------------------------

  /**
   * Close a specific window.
   * @param {string} id
   */
  closeWindow(id) {
    const tracked = this._windows.get(id);
    if (tracked && !tracked.win.isDestroyed()) {
      tracked.win.close();
    }
  }

  /**
   * Close all windows.
   */
  closeAllWindows() {
    for (const [, tracked] of this._windows) {
      if (!tracked.win.isDestroyed()) {
        tracked.win.close();
      }
    }
  }

  /**
   * Focus a specific window by id.
   * @param {string} id
   */
  focusWindow(id) {
    const tracked = this._windows.get(id);
    if (tracked && !tracked.win.isDestroyed()) {
      if (tracked.win.isMinimized()) tracked.win.restore();
      tracked.win.focus();
    }
  }

  /**
   * Cycle focus to the next window in the list (for Ctrl+Tab).
   */
  focusNextWindow() {
    const ids = Array.from(this._windows.keys());
    if (ids.length <= 1) return;

    const currentIndex = this._focusedId ? ids.indexOf(this._focusedId) : -1;
    const nextIndex = (currentIndex + 1) % ids.length;
    this.focusWindow(ids[nextIndex]);
  }

  /**
   * Reopen the most recently closed window with its original partition
   * (preserving login state).
   * @returns {string | null} The reopened window id, or null if nothing to reopen
   */
  reopenLastClosed() {
    if (this._closedStack.length === 0) return null;

    const state = this._closedStack.pop();
    return this.createWindow({
      partition: state.partition,
      bounds: state.bounds,
      isMaximized: state.isMaximized,
      isFullscreen: state.isFullscreen,
      lastUrl: state.lastUrl,
    });
  }

  // -----------------------------------------------------------------------
  // State persistence
  // -----------------------------------------------------------------------

  /**
   * Capture the current state of a tracked window.
   * @param {TrackedWindow} tracked
   * @returns {WindowState | null}
   */
  _captureState(tracked) {
    if (tracked.win.isDestroyed()) return null;

    return {
      id: tracked.id,
      partition: tracked.partition,
      bounds: tracked.win.getNormalBounds(),
      isMaximized: tracked.win.isMaximized(),
      isFullscreen: tracked.win.isFullScreen(),
      lastUrl: tracked.lastUrl,
    };
  }

  /**
   * Persist the state of all open windows to electron-store.
   */
  _persistAllStates() {
    const states = [];
    for (const [, tracked] of this._windows) {
      const state = this._captureState(tracked);
      if (state) states.push(state);
    }
    this._store.set("windows", states);
  }

  /**
   * Restore all windows from the previous session.
   * Called once during startup.
   */
  restoreAll() {
    /** @type {WindowState[]} */
    const savedStates = this._store.get("windows", []);

    if (savedStates.length === 0) {
      log("info", "No windows to restore");
      return;
    }

    log("info", `Restoring ${savedStates.length} window(s) from previous session`);

    for (const state of savedStates) {
      try {
        this.createWindow({
          id: state.id,
          partition: state.partition,
          bounds: state.bounds,
          isMaximized: state.isMaximized,
          isFullscreen: state.isFullscreen,
          lastUrl: state.lastUrl,
        });
      } catch (err) {
        log("error", `Failed to restore window ${state.id}`, { message: err.message });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  /**
   * Persist all window states and prepare for app quit.
   * Does NOT close the windows — Electron does that during quit.
   */
  cleanupAll() {
    this._persistAllStates();
    log("info", "All window states persisted for restart");
  }

  /**
   * Get the BrowserWindow that sent a given IPC event.
   * Useful in ipcMain handlers to identify which window the call came from.
   *
   * @param {import("electron").IpcMainInvokeEvent} event
   * @returns {{id: string, tracked: TrackedWindow} | null}
   */
  getWindowForEvent(event) {
    const senderWc = event.sender;
    for (const [id, tracked] of this._windows) {
      if (!tracked.win.isDestroyed() && tracked.win.webContents === senderWc) {
        return { id, tracked };
      }
    }
    return null;
  }
}

module.exports = { WindowManager };
