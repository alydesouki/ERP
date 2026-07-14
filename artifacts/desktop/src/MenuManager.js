"use strict";

/**
 * MenuManager — builds and registers the application menu.
 *
 * Provides:
 *  File → New Window (Ctrl+Shift+N)
 *  File → Close Window (Ctrl+W)
 *  File → Reopen Closed Window (Ctrl+Shift+T)
 *  File → Quit (Ctrl+Q)
 *  Edit (role)
 *  View (role)
 *  Window → dynamic list of open windows + Switch Window
 *  Help (role)
 */

const { Menu, app } = require("electron");

class MenuManager {
  /**
   * @param {import("./WindowManager").WindowManager} windowManager
   */
  constructor(windowManager) {
    this._windowManager = windowManager;
  }

  /**
   * Build and set the application menu.
   * Should be called once during startup and again whenever the window list changes.
   */
  registerMenu() {
    const template = this._buildTemplate();
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  /**
   * Rebuild the menu (call when window list changes to update the Window submenu).
   */
  refresh() {
    this.registerMenu();
  }

  /**
   * @returns {import("electron").MenuItemConstructorOptions[]}
   */
  _buildTemplate() {
    return [
      this._fileMenu(),
      { role: "editMenu" },
      this._viewMenu(),
      this._windowMenu(),
      { role: "help" },
    ];
  }

  _fileMenu() {
    return {
      label: "File",
      submenu: [
        {
          label: "نافذة جديدة",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => this._windowManager.createWindow(),
        },
        {
          label: "إغلاق النافذة",
          accelerator: "CmdOrCtrl+W",
          click: () => {
            const win = this._windowManager.getFocusedWindow();
            if (win && !win.isDestroyed()) {
              win.close();
            }
          },
        },
        {
          label: "إعادة فتح النافذة المغلقة",
          accelerator: "CmdOrCtrl+Shift+T",
          click: () => this._windowManager.reopenLastClosed(),
        },
        { type: "separator" },
        {
          label: "إنهاء",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit(),
        },
      ],
    };
  }

  _viewMenu() {
    return {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    };
  }

  _windowMenu() {
    const windowList = this._windowManager.getAllWindowInfo();

    /** @type {import("electron").MenuItemConstructorOptions[]} */
    const submenu = [
      {
        label: "تبديل النوافذ",
        accelerator: "CmdOrCtrl+Tab",
        click: () => this._windowManager.focusNextWindow(),
      },
      {
        label: "إغلاق جميع النوافذ",
        accelerator: "CmdOrCtrl+Shift+W",
        click: () => this._windowManager.closeAllWindows(),
      },
    ];

    if (windowList.length > 0) {
      submenu.push({ type: "separator" });
      for (const info of windowList) {
        submenu.push({
          label: info.title || `Window ${info.id}`,
          click: () => this._windowManager.focusWindow(info.id),
        });
      }
    }

    return {
      label: "Window",
      submenu,
    };
  }
}

module.exports = { MenuManager };
