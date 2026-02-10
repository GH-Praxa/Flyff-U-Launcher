const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('gtIpc', {
  invoke: (channel, ...args) => ipcRenderer.invoke(`killfeed:${channel}`, ...args),
  on: (channel, cb) => {
    const listener = (_e, ...args) => cb(...args);
    ipcRenderer.on(`killfeed:${channel}`, listener);
    return () => ipcRenderer.removeListener(`killfeed:${channel}`, listener);
  }
});
contextBridge.exposeInMainWorld('themeIpc', {
  onUpdate: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('theme:update', listener);
    return () => ipcRenderer.removeListener('theme:update', listener);
  },
  getCurrent: () => ipcRenderer.invoke('theme:current')
});
