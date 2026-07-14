"use strict";

/**
 * PrintManager — silent thermal/document printing via a hidden BrowserWindow.
 *
 * Extracted from the original main.js lines 380-497.
 *
 * Root cause fix: calling webContents.print() on the main SPA window fails on
 * Windows with "Invalid printer settings" because Chromium validates printer
 * settings against the loaded document's layout metrics. Loading the print
 * document alone in a hidden BrowserWindow gives Chromium valid dimensions and
 * silent printing works reliably.
 */

const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { log } = require("./logger");

class PrintManager {
  /**
   * Print an HTML string to a physical printer.
   *
   * @param {string} html   Full HTML document
   * @param {Object} [options]
   * @param {boolean} [options.silent]     Skip print dialog (default: true)
   * @param {string}  [options.deviceName] Printer device name (omit = default)
   * @param {string|{width:number,height:number}} [options.pageSize]
   * @param {number}  [options.copies]     Number of copies (default: 1)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async print(html, options = {}) {
    if (!html || !String(html).trim()) {
      return { success: false, error: "No print content" };
    }

    const tempPath = path.join(
      app.getPath("temp"),
      `pos-print-${Date.now()}-${Math.random().toString(36).slice(2)}.html`
    );

    let printWindow = null;

    try {
      fs.writeFileSync(tempPath, html, "utf8");

      printWindow = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      await printWindow.loadFile(tempPath);

      // Allow fonts, images, SVG barcodes, and layout to settle before printing.
      await printWindow.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
          const waitImages = () => {
            const images = Array.from(document.images);
            if (images.length === 0) return Promise.resolve();
            return Promise.all(
              images.map(
                (img) =>
                  new Promise((res) => {
                    if (img.complete) {
                      res(undefined);
                      return;
                    }
                    img.addEventListener("load", () => res(undefined), { once: true });
                    img.addEventListener("error", () => res(undefined), { once: true });
                  }),
              ),
            );
          };
          const fontsReady =
            document.fonts && document.fonts.ready
              ? document.fonts.ready.catch(() => undefined)
              : Promise.resolve();
          Promise.all([fontsReady, waitImages()]).then(done).catch(done);
        })
      `);

      const printOptions = {
        silent: options.silent !== false,
        printBackground: true,
        copies: options.copies || 1,
      };

      const deviceName = options.deviceName && String(options.deviceName).trim();
      if (deviceName) {
        printOptions.deviceName = deviceName;
      }

      if (options.pageSize) {
        const ps = options.pageSize;
        if (typeof ps === "object" && ps.width && ps.height) {
          printOptions.pageSize = ps;
        } else if (typeof ps === "string") {
          printOptions.pageSize = ps;
        } else {
          printOptions.usePrinterDefaultPageSize = true;
        }
      } else {
        printOptions.usePrinterDefaultPageSize = true;
      }

      return await new Promise((resolve) => {
        printWindow.webContents.print(printOptions, (success, failureReason) => {
          if (success) {
            log("info", "Print job sent", {
              deviceName: printOptions.deviceName || "(system default)",
            });
            resolve({ success: true });
          } else {
            log("warn", "Print job failed", {
              failureReason,
              deviceName: printOptions.deviceName,
            });
            resolve({ success: false, error: failureReason || "Print failed" });
          }
        });
      });
    } finally {
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.close();
      }
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // temp file may already be gone
      }
    }
  }
}

module.exports = { PrintManager };
