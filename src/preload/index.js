const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.send('open-external', url),
  getConfig: () => ipcRenderer.invoke('get-config'),
})
