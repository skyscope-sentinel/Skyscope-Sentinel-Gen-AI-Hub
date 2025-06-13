// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronIPC', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  // We can also expose ipcRenderer.on/send if needed for continuous streams,
  // but invoke is good for request/response.
});
