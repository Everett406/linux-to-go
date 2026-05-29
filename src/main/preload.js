const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getUbuntuVersions: () => ipcRenderer.invoke('get-ubuntu-versions'),
  listDrives: () => ipcRenderer.invoke('list-drives'),
  downloadFile: (options) => ipcRenderer.invoke('download-file', options),
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  execCommand: (options) => ipcRenderer.invoke('exec-command', options),
  fileExists: (path) => ipcRenderer.invoke('file-exists', path),
  mkdir: (path) => ipcRenderer.invoke('mkdir', path),

  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (e, data) => callback(data)),
  onExecOutput: (callback) => ipcRenderer.on('exec-output', (e, data) => callback(data)),

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
