"use strict";

/**
 * Electron Main Process — Shoe Store POS Desktop Application
 *
 * This is the entry point. The monolithic logic has been refactored into
 * modular managers inside `src/`.
 */

const { app } = require("electron");
const path = require("path");
const { ApplicationManager } = require("./src/ApplicationManager");

// Override userData path early before any lock requests to avoid Windows path
// issues caused by the pnpm workspace package name containing a slash (@workspace/desktop).
app.setPath("userData", path.join(app.getPath("appData"), "ShoeStorePOS"));

const manager = new ApplicationManager();
manager.init();
