"use strict";

/**
 * ShortcutManager — registers app-level keyboard shortcuts when the window is focused.
 */

const { globalShortcut, app } = require("electron");

class ShortcutManager {
  /**
   * @param {import("./WindowManager").WindowManager} windowManager
   */
  constructor(windowManager) {
    this._windowManager = windowManager;
  }

  registerShortcuts() {
    // Register shortcuts when the app gains focus
    app.on("browser-window-focus", () => {
      this._registerAll();
    });

    // Unregister when app loses focus to avoid stealing system-wide shortcuts
    app.on("browser-window-blur", () => {
      this._unregisterAll();
    });
  }

  _registerAll() {
    // Prevent double registration
    this._unregisterAll();

    globalShortcut.register("CommandOrControl+Shift+N", () => {
      this._windowManager.createWindow();
    });

    globalShortcut.register("CommandOrControl+Shift+W", () => {
      this._windowManager.closeAllWindows();
    });

    globalShortcut.register("CommandOrControl+Shift+T", () => {
      this._windowManager.reopenLastClosed();
    });

    // Cycle windows
    globalShortcut.register("CommandOrControl+Tab", () => {
      this._windowManager.focusNextWindow();
    });
  }

  _unregisterAll() {
    globalShortcut.unregisterAll();
  }
}

module.exports = { ShortcutManager };
