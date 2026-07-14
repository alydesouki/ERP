import { useCallback } from "react";

/**
 * Hook to interact with the multi-window ERP architecture from the renderer.
 * 
 * Provides methods to open new independent windows, close current windows,
 * and list or focus other active windows.
 */
export function useErpWindow() {
  const isElectron = Boolean(window.electronAPI?.platform === "electron");

  const createWindow = useCallback(async () => {
    if (window.electronAPI) {
      return await window.electronAPI.createWindow();
    }
    // Fallback for browser testing
    const w = window.open(window.location.origin, "_blank");
    return { id: w ? "browser-window" : "failed" };
  }, []);

  const closeWindow = useCallback(async (id?: string) => {
    if (window.electronAPI) {
      return await window.electronAPI.closeWindow(id);
    }
    window.close();
    return true;
  }, []);

  const listWindows = useCallback(async () => {
    if (window.electronAPI) {
      return await window.electronAPI.listWindows();
    }
    return [];
  }, []);

  const focusWindow = useCallback(async (id: string) => {
    if (window.electronAPI) {
      return await window.electronAPI.focusWindow(id);
    }
    return false;
  }, []);

  const getCurrentWindow = useCallback(async () => {
    if (window.electronAPI) {
      return await window.electronAPI.getCurrentWindow();
    }
    return null;
  }, []);

  return {
    isElectron,
    createWindow,
    closeWindow,
    listWindows,
    focusWindow,
    getCurrentWindow,
  };
}
