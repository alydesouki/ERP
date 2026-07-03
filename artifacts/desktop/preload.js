"use strict";

/**
 * Electron Preload Script — contextBridge IPC exposure
 *
 * This script runs in an isolated context with access to Node.js APIs,
 * and safely exposes a limited set of capabilities to the renderer process
 * (the React SPA) via window.electronAPI.
 *
 * Security:
 * - contextIsolation: true  →  renderer JS cannot access Node.js or Electron APIs
 * - nodeIntegration: false  →  renderer cannot use require()
 * - contextBridge          →  only explicitly exposed APIs are accessible
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  /**
   * Identifies that the app is running inside Electron (not a browser).
   * The React SPA checks this to conditionally show desktop-only features.
   */
  platform: "electron",

  /**
   * Silent thermal receipt printing.
   *
   * @param {Object} options
   * @param {boolean} [options.silent=true]      - Skip print dialog
   * @param {string}  [options.deviceName]       - Printer device name (empty = default printer)
   * @param {Object}  [options.pageSize]         - Page dimensions in microns
   * @param {number}  [options.copies=1]         - Number of copies
   * @returns {Promise<{success: boolean, error?: string}>}
   *
   * Usage from React:
   *   const result = await window.electronAPI.print({ silent: true, deviceName: 'EPSON TM-T20' });
   */
  print: (options) => ipcRenderer.invoke("print", options),

  /**
   * Get list of installed printers.
   * @returns {Promise<Array<{name: string, description: string, status: number, isDefault: boolean}>>}
   */
  getPrinters: () => ipcRenderer.invoke("get-printers"),

  /**
   * Get the current application version (from package.json).
   * @returns {Promise<string>}  e.g. "1.0.0"
   */
  getVersion: () => ipcRenderer.invoke("get-version"),

  /**
   * Open the application data folder in Windows Explorer.
   * Useful for IT support / backups.
   */
  openDataFolder: () => ipcRenderer.invoke("open-data-folder"),
});
