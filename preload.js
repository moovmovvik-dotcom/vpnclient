// Preload script — runs in renderer context with access to Node APIs if needed.
// Keep empty or add secure bridges here via contextBridge.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
});
