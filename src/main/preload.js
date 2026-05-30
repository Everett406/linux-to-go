const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 版本和驱动
  getUbuntuVersions: () => ipcRenderer.invoke('get-ubuntu-versions'),
  listDrives: () => ipcRenderer.invoke('list-drives'),
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),

  // 文件操作
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  mkdir: (dirPath) => ipcRenderer.invoke('mkdir', dirPath),
  writeFile: (options) => ipcRenderer.invoke('write-file', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  getFileSize: (filePath) => ipcRenderer.invoke('get-file-size', filePath),
  selectIsoFile: () => ipcRenderer.invoke('select-iso-file'),

  // Ventoy 相关
  getVentoyLatest: () => ipcRenderer.invoke('get-ventoy-latest'),
  findVentoyExe: (ventoyDir) => ipcRenderer.invoke('find-ventoy-exe', ventoyDir),
  installVentoy: (options) => ipcRenderer.invoke('install-ventoy', options),

  // 下载和复制
  downloadWithProgress: (options) => ipcRenderer.invoke('download-with-progress', options),
  extractZip: (options) => ipcRenderer.invoke('extract-zip', options),
  listDir: (dirPath) => ipcRenderer.invoke('list-dir', dirPath),
  copyFile: (options) => ipcRenderer.invoke('copy-file', options),

  // 操作控制
  cancelOperation: () => ipcRenderer.invoke('cancel-operation'),

  // 事件监听
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (e, data) => callback(data)),
  onCopyProgress: (callback) => ipcRenderer.on('copy-progress', (e, data) => callback(data)),
  onExecOutput: (callback) => ipcRenderer.on('exec-output', (e, data) => callback(data)),

  // 移除监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
