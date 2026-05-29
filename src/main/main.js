const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const drivelist = require('drivelist');
const { spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');

let mainWindow;

const UBUNTU_VERSIONS = {
  '24.04.2 LTS': {
    url: 'https://releases.ubuntu.com/24.04/ubuntu-24.04.2-desktop-amd64.iso',
    size: 6360000000,
    name: 'ubuntu-24.04.2-desktop-amd64.iso'
  },
  '24.10': {
    url: 'https://releases.ubuntu.com/24.10/ubuntu-24.10-desktop-amd64.iso',
    size: 5200000000,
    name: 'ubuntu-24.10-desktop-amd64.iso'
  },
  '22.04.5 LTS': {
    url: 'https://releases.ubuntu.com/22.04/ubuntu-22.04.5-desktop-amd64.iso',
    size: 4900000000,
    name: 'ubuntu-22.04.5-desktop-amd64.iso'
  },
  '23.10 (旧版)': {
    url: 'https://old-releases.ubuntu.com/releases/23.10/ubuntu-23.10-desktop-amd64.iso',
    size: 4900000000,
    name: 'ubuntu-23.10-desktop-amd64.iso'
  }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'Linux To Go',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC handlers
ipcMain.handle('get-ubuntu-versions', () => {
  return Object.keys(UBUNTU_VERSIONS).map(key => ({
    name: key,
    ...UBUNTU_VERSIONS[key]
  }));
});

ipcMain.handle('list-drives', async () => {
  try {
    const drives = await drivelist.list();
    return drives.filter(d => d.isUSB || d.isRemovable).map(d => ({
      device: d.device,
      description: d.description,
      size: d.size,
      sizeFormatted: formatBytes(d.size),
      mountpoints: d.mountpoints,
      isUSB: d.isUSB,
      isRemovable: d.isRemovable
    }));
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('download-file', async (event, { url, destPath, id }) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, { followRedirect: true }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        ipcMain.emit('download-file', event, { url: response.headers.location, destPath, id });
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const total = parseInt(response.headers['content-length'], 10) || 0;
      let downloaded = 0;

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const progress = Math.round((downloaded / total) * 100);
          event.sender.send('download-progress', { id, progress, downloaded, total });
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve({ success: true, path: destPath });
      });

      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
});

ipcMain.handle('get-app-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('show-save-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'linux-to-go-backup.iso',
    filters: [{ name: 'ISO Files', extensions: ['iso'] }]
  });
  return result;
});

ipcMain.handle('exec-command', async (event, { command, args, cwd }) => {
  return new Promise((resolve) => {
    const child = spawn(command, args || [], {
      cwd: cwd || process.cwd(),
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      event.sender.send('exec-output', { pid: child.pid, data: data.toString(), stream: 'stdout' });
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      event.sender.send('exec-output', { pid: child.pid, data: data.toString(), stream: 'stderr' });
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
});

ipcMain.handle('file-exists', (event, filePath) => {
  return fs.existsSync(filePath);
});

ipcMain.handle('mkdir', (event, dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
