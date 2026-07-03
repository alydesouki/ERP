/// <reference types="vite/client" />

/**
 * Type declarations for the Electron contextBridge API.
 *
 * These types are only available when the app runs inside Electron.
 * In a regular browser, `window.electronAPI` is undefined.
 *
 * Usage:
 *   if (window.electronAPI?.platform === 'electron') {
 *     // desktop-only code
 *   }
 */

interface ElectronPrinter {
  /** Printer device name */
  name: string;
  /** Human-readable description */
  description: string;
  /** Printer status code (0 = idle) */
  status: number;
  /** Whether this is the system default printer */
  isDefault: boolean;
}

interface ElectronPrintOptions {
  /** Whether to skip the print dialog. Defaults to true. */
  silent?: boolean;
  /** Printer device name. Empty string = system default printer. */
  deviceName?: string;
  /**
   * Page size in microns (1mm = 1000 microns).
   * For 80mm thermal: { width: 80000, height: 0 }
   */
  pageSize?: { width: number; height: number };
  /** Number of copies to print. Defaults to 1. */
  copies?: number;
}

interface ElectronPrintResult {
  success: boolean;
  error?: string;
}

interface ElectronAPI {
  /**
   * Identifies that the app is running inside Electron.
   * Always "electron" — use this to detect the desktop environment.
   */
  readonly platform: "electron";

  /**
   * Print the current page silently (no dialog) to the specified printer.
   * Uses Electron's webContents.print() under the hood.
   */
  print(options?: ElectronPrintOptions): Promise<ElectronPrintResult>;

  /**
   * Get the list of installed printers from the OS.
   */
  getPrinters(): Promise<ElectronPrinter[]>;

  /**
   * Get the current app version string (e.g. "1.0.0").
   */
  getVersion(): Promise<string>;

  /**
   * Open the AppData folder (%APPDATA%/ShoeStorePOS) in Windows Explorer.
   * Useful for taking manual backups of the SQLite database.
   */
  openDataFolder(): Promise<void>;
}

declare global {
  interface Window {
    /**
     * Electron IPC bridge exposed via contextBridge in preload.js.
     * `undefined` when running in a regular browser.
     */
    electronAPI?: ElectronAPI;
  }
}
