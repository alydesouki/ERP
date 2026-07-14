"use strict";

/**
 * SessionManager — generates and tracks unique Electron session partitions.
 *
 * Every BrowserWindow receives its own persistent partition string of the form:
 *   persist:erp-window-<uuid>
 *
 * This guarantees complete isolation of cookies, localStorage, IndexedDB,
 * cache, service workers, and any other per-session storage.
 *
 * Partitions are never reused within a running process. Previously-used
 * partitions can be restored on restart to preserve login state.
 */

const { session } = require("electron");
const crypto = require("crypto");

class SessionManager {
  constructor() {
    /** @type {Set<string>} All partitions created or restored in this process */
    this._activePartitions = new Set();
  }

  /**
   * Create a brand-new unique partition string.
   * @returns {string} e.g. "persist:erp-window-a1b2c3d4-..."
   */
  createPartition() {
    const id = crypto.randomUUID();
    const partition = `persist:erp-window-${id}`;
    this._activePartitions.add(partition);
    return partition;
  }

  /**
   * Re-use a previously persisted partition (for window restore on restart).
   * Validates the format and adds it to the active set.
   *
   * @param {string} partition
   * @returns {string} The same partition string
   * @throws {Error} If the partition format is invalid
   */
  reusePartition(partition) {
    if (!partition || !partition.startsWith("persist:erp-window-")) {
      throw new Error(`Invalid partition format: ${partition}`);
    }
    this._activePartitions.add(partition);
    return partition;
  }

  /**
   * Clear all storage data for a given partition.
   * Used when the user explicitly wants to wipe a session.
   *
   * @param {string} partition
   * @returns {Promise<void>}
   */
  async clearPartition(partition) {
    try {
      const ses = session.fromPartition(partition);
      await ses.clearStorageData();
    } catch {
      // Partition may already be gone — that's fine
    }
    this._activePartitions.delete(partition);
  }

  /**
   * Remove a partition from the active tracking set without clearing its data.
   * Used when a window is closed but we want to preserve the session for
   * "Reopen Closed Window".
   *
   * @param {string} partition
   */
  deactivatePartition(partition) {
    this._activePartitions.delete(partition);
  }

  /**
   * @returns {string[]} All currently active partition strings
   */
  getActivePartitions() {
    return Array.from(this._activePartitions);
  }
}

module.exports = { SessionManager };
