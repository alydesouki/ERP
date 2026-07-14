"use strict";

/**
 * Simple file + stdout logger for the Electron main process.
 *
 * Writes log entries to both stdout and a persistent log file.
 * This runs before pino or any fancy logger is available.
 */

const fs = require("fs");
const { LOG_PATH } = require("./constants");

/**
 * @param {"info"|"warn"|"error"|"api"|"api:err"} level
 * @param {string} message
 * @param {Record<string, unknown>} [meta]
 */
function log(level, message, meta) {
  const entry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${meta ? " " + JSON.stringify(meta) : ""}\n`;
  process.stdout.write(entry);
  try {
    fs.appendFileSync(LOG_PATH, entry);
  } catch {
    // Ignore log write errors
  }
}

module.exports = { log };
