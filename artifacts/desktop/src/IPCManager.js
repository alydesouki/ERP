"use strict";

/**
 * IPCManager — registers all ipcMain handlers.
 *
 * Exposes safe APIs to the renderer via preload.js.
 * Handles existing functionality (printing, versions) and new
 * multi-window commands (create, close, focus).
 */

const { ipcMain, app, shell } = require("electron");
const fs = require("fs");
const { log } = require("./logger");
const { APP_DATA_DIR, PRINTER_SETTINGS_PATH } = require("./constants");

class IPCManager {
  /**
   * @param {import("./WindowManager").WindowManager} windowManager
   * @param {import("./SessionManager").SessionManager} sessionManager
   * @param {import("./PrintManager").PrintManager} printManager
   */
  constructor(windowManager, sessionManager, printManager) {
    this._windowManager = windowManager;
    this._sessionManager = sessionManager;
    this._printManager = printManager;
  }

  registerHandlers() {
    // ---------------------------------------------------------------------
    // Existing Handlers
    // ---------------------------------------------------------------------

    ipcMain.handle("print", async (_event, options) => {
      try {
        return await this._printManager.print(options?.html, options);
      } catch (error) {
        log("error", "Print handler failed", { error: error.message });
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("get-printers", async (event) => {
      try {
        return await event.sender.getPrintersAsync();
      } catch {
        return [];
      }
    });

    ipcMain.handle("get-version", () => app.getVersion());

    ipcMain.handle("open-data-folder", () => {
      shell.openPath(APP_DATA_DIR);
    });

    ipcMain.handle("get-printer-settings", () => {
      try {
        if (fs.existsSync(PRINTER_SETTINGS_PATH)) {
          return JSON.parse(fs.readFileSync(PRINTER_SETTINGS_PATH, "utf8"));
        }
      } catch (e) {
        log("error", "Failed to read printer settings", { error: e.message });
      }
      return {};
    });

    ipcMain.handle("save-printer-settings", (_event, settings) => {
      try {
        fs.writeFileSync(PRINTER_SETTINGS_PATH, JSON.stringify(settings, null, 2));
        return { success: true };
      } catch (e) {
        log("error", "Failed to save printer settings", { error: e.message });
        return { success: false, error: e.message };
      }
    });

    // ---------------------------------------------------------------------
    // New Multi-Window Handlers
    // ---------------------------------------------------------------------

    ipcMain.handle("erp:create-window", () => {
      const id = this._windowManager.createWindow();
      return { id };
    });

    ipcMain.handle("erp:close-window", (event) => {
      const info = this._windowManager.getWindowForEvent(event);
      if (info) {
        this._windowManager.closeWindow(info.id);
        return true;
      }
      return false;
    });

    ipcMain.handle("erp:list-windows", () => {
      return this._windowManager.getAllWindowInfo();
    });

    ipcMain.handle("erp:focus-window", (_event, id) => {
      this._windowManager.focusWindow(id);
      return true;
    });

    ipcMain.handle("erp:get-current-window", (event) => {
      const info = this._windowManager.getWindowForEvent(event);
      return info ? { id: info.id, partition: info.tracked.partition } : null;
    });
  }
}

module.exports = { IPCManager };
