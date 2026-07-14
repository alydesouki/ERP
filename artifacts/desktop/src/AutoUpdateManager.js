"use strict";

/**
 * AutoUpdateManager — electron-updater integration.
 *
 * Extracted from main.js lines 336-373.
 * Shows Arabic dialog messages for update-available / update-downloaded.
 * Updated to show dialogs relative to the *focused* window (multi-window aware).
 */

const { app, dialog } = require("electron");
const { log } = require("./logger");

class AutoUpdateManager {
  /**
   * @param {import("./WindowManager").WindowManager} windowManager
   */
  constructor(windowManager) {
    this._windowManager = windowManager;
  }

  /**
   * Initialise auto-update checks. No-op in unpackaged (dev) builds.
   */
  setup() {
    if (!app.isPackaged) return;

    // Lazy-require so the module is not loaded in dev where it's unnecessary
    const { autoUpdater } = require("electron-updater");

    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on("update-available", (info) => {
      log("info", "Update available", { version: info.version });
      const parent = this._windowManager.getFocusedWindow();
      const options = {
        type: "info",
        title: "تحديث متاح",
        message: `إصدار جديد (${info.version}) متاح. سيتم تنزيله في الخلفية.`,
        buttons: ["حسناً"],
      };
      if (parent) {
        dialog.showMessageBox(parent, options);
      } else {
        dialog.showMessageBox(options);
      }
    });

    autoUpdater.on("update-downloaded", (info) => {
      log("info", "Update downloaded", { version: info.version });
      const parent = this._windowManager.getFocusedWindow();
      const options = {
        type: "info",
        title: "تحديث جاهز للتثبيت",
        message: `تم تنزيل الإصدار ${info.version}. سيتم التثبيت عند إغلاق التطبيق.`,
        buttons: ["تثبيت الآن", "لاحقاً"],
        defaultId: 0,
        cancelId: 1,
      };

      const showAndMaybeInstall = (result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      };

      if (parent) {
        dialog.showMessageBox(parent, options).then(showAndMaybeInstall);
      } else {
        dialog.showMessageBox(options).then(showAndMaybeInstall);
      }
    });

    autoUpdater.on("error", (err) => {
      log("error", "Auto-updater error", { message: err.message });
    });
  }
}

module.exports = { AutoUpdateManager };
