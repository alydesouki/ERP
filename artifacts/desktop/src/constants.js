"use strict";

/**
 * Shared constants used across all Electron main-process modules.
 *
 * Centralised here so that path construction and port config live in one place.
 * Every manager imports from this file instead of computing paths independently.
 */

const { app } = require("electron");
const path = require("path");

// ---------------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------------

const API_PORT = 5001;
const API_BASE = `http://localhost:${API_PORT}`;
const HEALTH_URL = `${API_BASE}/api/healthz`;

// ---------------------------------------------------------------------------
// File-system paths (all under %APPDATA%/ShoeStorePOS)
// ---------------------------------------------------------------------------

const APP_DATA_DIR = app.getPath("userData");
const DB_PATH = path.join(APP_DATA_DIR, "store.db");
const SECRET_PATH = path.join(APP_DATA_DIR, "secret.key");
const LOG_PATH = path.join(APP_DATA_DIR, "app.log");
const PRINTER_SETTINGS_PATH = path.join(APP_DATA_DIR, "printer-settings.json");

module.exports = {
  API_PORT,
  API_BASE,
  HEALTH_URL,
  APP_DATA_DIR,
  DB_PATH,
  SECRET_PATH,
  LOG_PATH,
  PRINTER_SETTINGS_PATH,
};
