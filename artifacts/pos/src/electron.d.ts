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
  /** Full HTML document to print (required in Electron). */
  html?: string;
  /** Printer device name. Omit to use the system default printer. */
  deviceName?: string;
  /**
   * Page size: named paper (e.g. "A4") or { width, height } in microns.
   * Omit for thermal roll printers — the driver default is used.
   */
  pageSize?: string | { width: number; height: number };
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
   * Print an HTML document silently (no dialog) to the specified printer.
   * Loads the HTML in a hidden window and sends it to the printer.
   */
  print(options: ElectronPrintOptions): Promise<ElectronPrintResult>;

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

  /**
   * Get configured printer settings.
   */
  getPrinterSettings(): Promise<PrinterSettings>;

  /**
   * Save configured printer settings.
   */
  savePrinterSettings(settings: PrinterSettings): Promise<{ success: boolean; error?: string }>;
}

interface PrinterSettings {
  receiptPrinter?: string;
  barcodePrinter?: string;
  invoicePrinter?: string;
}

interface Window {
  /**
   * Electron IPC bridge exposed via contextBridge in preload.js.
   * `undefined` when running in a regular browser.
   */
  electronAPI?: ElectronAPI;
}
