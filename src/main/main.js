const { app, BrowserWindow, ipcMain, dialog, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const https = require('https');
const { http } = require('follow-redirects');
const AdmZip = require('adm-zip');

let mainWindow;
let currentProcess = null;

// ===== 国内镜像源配置 =====
const MIRRORS = {
  // Ubuntu ISO 国内镜像（按优先级排列）
  ubuntu: [
    { name: '官方源', urlPrefix: 'https://releases.ubuntu.com' },
    { name: '阿里云', urlPrefix: 'https://mirrors.aliyun.com/ubuntu-releases' },
    { name: '清华大学', urlPrefix: 'https://mirrors.tuna.tsinghua.edu.cn/ubuntu-releases' },
    { name: '中科大', urlPrefix: 'https://mirrors.ustc.edu.cn/ubuntu-releases' },
    { name: '腾讯云', urlPrefix: 'https://mirrors.cloud.tencent.com/ubuntu-releases' },
    { name: '华为云', urlPrefix: 'https://repo.huaweicloud.com/ubuntu-releases' }
  ],
  // Ventoy 下载代理
  ventoy: [
    { name: 'GitHub 官方', urlPrefix: 'https://github.com' },
    { name: 'GhProxy', urlPrefix: 'https://ghproxy.com/https://github.com' },
    { name: 'GhFast', urlPrefix: 'https://ghfast.top/https://github.com' },
    { name: 'Moeyy', urlPrefix: 'https://github.moeyy.xyz/https://github.com' }
  ]
};

// ===== Ubuntu 版本配置 =====
const UBUNTU_VERSIONS = {
  '24.04.2 LTS': {
    url: 'ubuntu-24.04.2-desktop-amd64.iso',
    path: '24.04',
    size: 6360000000,
    name: 'ubuntu-24.04.2-desktop-amd64.iso'
  },
  '24.10': {
    url: 'ubuntu-24.10-desktop-amd64.iso',
    path: '24.10',
    size: 5200000000,
    name: 'ubuntu-24.10-desktop-amd64.iso'
  },
  '22.04.5 LTS': {
    url: 'ubuntu-22.04.5-desktop-amd64.iso',
    path: '22.04',
    size: 4900000000,
    name: 'ubuntu-22.04.5-desktop-amd64.iso'
  }
};

// ===== Electron 窗口 =====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 860,
    minHeight: 620,
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
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ===== IPC Handlers =====

// 构建完整下载 URL
function buildUbuntuUrl(mirror, versionKey) {
  const v = UBUNTU_VERSIONS[versionKey];
  return `${mirror.urlPrefix}/${v.path}/${v.url}`;
}

function buildVentoyUrl(mirror, assetPath) {
  return `${mirror.urlPrefix}/${assetPath}`;
}

// 测速：尝试 HEAD 请求获取响应时间
async function testMirrorSpeed(mirror, testUrl) {
  return new Promise((resolve) => {
    const url = testUrl || mirror.urlPrefix;
    const protocol = url.startsWith('https') ? https : http;
    const start = Date.now();
    const timeout = 5000;

    try {
      const req = protocol.request(url, { method: 'HEAD', timeout, rejectUnauthorized: false }, (res) => {
        const elapsed = Date.now() - start;
        resolve({ mirror, elapsed, status: res.statusCode });
      });
      req.on('error', () => resolve({ mirror, elapsed: Infinity, status: 0 }));
      req.on('timeout', () => { req.destroy(); resolve({ mirror, elapsed: Infinity, status: 0 }); });
      req.end();
    } catch {
      resolve({ mirror, elapsed: Infinity, status: 0 });
    }
  });
}

ipcMain.handle('get-ubuntu-versions', () => {
  return Object.keys(UBUNTU_VERSIONS).map(key => ({
    name: key,
    ...UBUNTU_VERSIONS[key],
    url: buildUbuntuUrl(MIRRORS.ubuntu[0], key)
  }));
});

// 获取镜像列表
ipcMain.handle('get-mirrors', () => {
  return {
    ubuntu: MIRRORS.ubuntu.map(m => m.name),
    ventoy: MIRRORS.ventoy.map(m => m.name)
  };
});

// 选择镜像源后获取下载 URL
ipcMain.handle('get-download-url', (event, { type, versionKey, mirrorName }) => {
  if (type === 'ubuntu') {
    const mirror = MIRRORS.ubuntu.find(m => m.name === mirrorName) || MIRRORS.ubuntu[0];
    return buildUbuntuUrl(mirror, versionKey);
  }
  if (type === 'ventoy') {
    const mirror = MIRRORS.ventoy.find(m => m.name === mirrorName) || MIRRORS.ventoy[0];
    return buildVentoyUrl(mirror, versionKey);
  }
  return null;
});

// 自动测速选择最快镜像
ipcMain.handle('test-mirrors', async () => {
  const results = { ubuntu: [], ventoy: [] };

  // 测试 Ubuntu 镜像
  const ubuntuTests = MIRRORS.ubuntu.map(m =>
    testMirrorSpeed(m, m.urlPrefix)
  );
  const ubuntuResults = await Promise.all(ubuntuTests);
  results.ubuntu = ubuntuResults
    .filter(r => r.status >= 200 && r.status < 400 && r.elapsed < 10000)
    .sort((a, b) => a.elapsed - b.elapsed)
    .map(r => ({ name: r.mirror.name, elapsed: r.elapsed, urlPrefix: r.mirror.urlPrefix }));

  // 测试 Ventoy 镜像
  const ventoyTests = MIRRORS.ventoy.map(m =>
    testMirrorSpeed(m, m.urlPrefix)
  );
  const ventoyResults = await Promise.all(ventoyTests);
  results.ventoy = ventoyResults
    .filter(r => r.status >= 200 && r.status < 400 && r.elapsed < 10000)
    .sort((a, b) => a.elapsed - b.elapsed)
    .map(r => ({ name: r.mirror.name, elapsed: r.elapsed, urlPrefix: r.mirror.urlPrefix }));

  return results;
});

ipcMain.handle('list-drives', async () => {
  try {
    // 使用 PowerShell 获取 USB 设备信息（比 drivelist 更可靠）
    const drives = await listDrivesViaPowerShell();
    return drives;
  } catch (err) {
    console.error('Drive listing error:', err);
    // 降级：尝试使用 drivelist
    try {
      const drivelist = require('drivelist');
      const drives = await drivelist.list();
      return drives.filter(d => d.isUSB || d.isRemovable).map(d => ({
        device: d.device,
        description: d.description,
        size: d.size,
        sizeFormatted: formatBytes(d.size),
        mountpoints: d.mountpoints,
        isUSB: d.isUSB,
        isRemovable: d.isRemovable,
        diskNumber: getDiskNumber(d.device)
      }));
    } catch (drivelistErr) {
      return { error: `USB检测失败: ${err.message}` };
    }
  }
});

ipcMain.handle('get-app-data-path', () => app.getPath('userData'));

ipcMain.handle('file-exists', (event, filePath) => fs.existsSync(filePath));

ipcMain.handle('mkdir', (event, dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('select-iso-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'ISO 文件', extensions: ['iso'] }],
    title: '选择 Ubuntu ISO 文件'
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size,
      sizeFormatted: formatBytes(stats.size)
    };
  }
  return null;
});

// 取消当前操作
ipcMain.handle('cancel-operation', () => {
  if (currentProcess) {
    try { currentProcess.kill(); } catch(e) {}
    currentProcess = null;
  }
  return true;
});

// ===== 核心制作流程 IPC =====

ipcMain.handle('download-with-progress', async (event, { url, destPath, id }) => {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = fs.createWriteStream(destPath);
    let downloaded = 0;
    let total = 0;

    const request = net.request({
      url: url,
      redirect: 'follow'
    });

    request.setHeader('User-Agent', 'linux-to-go/1.0.0');
    request.setHeader('Accept', '*/*');

    request.on('response', (response) => {
      const statusCode = response.statusCode;

      if (statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        reject(new Error(`HTTP ${statusCode}`));
        return;
      }

      total = parseInt(response.headers['content-length'] || '0', 10);

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);
        if (total > 0) {
          const progress = Math.round((downloaded / total) * 100);
          event.sender.send('download-progress', { id, progress, downloaded, total, speed: 0 });
        }
      });

      response.on('end', () => {
        file.end();
        event.sender.send('download-progress', { id, progress: 100, downloaded, total });
        resolve({ success: true, path: destPath, size: downloaded });
      });

      response.on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });

    request.on('error', (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });

    // 60秒超时
    const timeout = setTimeout(() => {
      request.abort();
      file.close();
      fs.unlink(destPath, () => {});
      reject(new Error('下载超时'));
    }, 60000);

    request.on('close', () => {
      clearTimeout(timeout);
    });

    request.end();
  });
});

// 解压 ZIP
ipcMain.handle('extract-zip', (event, { zipPath, destDir }) => {
  try {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(destDir, true);
    return { success: true, destDir };
  } catch (err) {
    return { error: err.message };
  }
});

// 列出目录内容
ipcMain.handle('list-dir', (event, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      isDir: e.isDirectory(),
      isFile: e.isFile()
    }));
  } catch (err) {
    return { error: err.message };
  }
});

// 复制文件（支持大文件）
ipcMain.handle('copy-file', async (event, { source, dest }) => {
  return new Promise((resolve, reject) => {
    try {
      const srcSize = fs.statSync(source).size;
      const readStream = fs.createReadStream(source);
      const writeStream = fs.createWriteStream(dest);
      let copied = 0;

      readStream.on('data', (chunk) => {
        copied += chunk.length;
        const progress = Math.round((copied / srcSize) * 100);
        event.sender.send('copy-progress', { progress, copied, total: srcSize });
      });

      writeStream.on('finish', () => {
        resolve({ success: true, path: dest, size: copied });
      });

      writeStream.on('error', reject);
      readStream.on('error', reject);
      readStream.pipe(writeStream);
    } catch (err) {
      reject(err);
    }
  });
});

// 获取 Ventoy 最新版本
ipcMain.handle('get-ventoy-latest', async () => {
  return new Promise((resolve, reject) => {
    https.get('https://api.github.com/repos/ventoy/Ventoy/releases/latest', {
      headers: {
        'User-Agent': 'linux-to-go/1.0.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const asset = release.assets.find(a =>
            a.name.includes('windows') && a.name.endsWith('.zip')
          );
          resolve({
            version: release.tag_name,
            url: asset ? asset.browser_download_url : null,
            name: asset ? asset.name : null
          });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
});

// 查找 Ventoy2Disk.exe
ipcMain.handle('find-ventoy-exe', (event, ventoyDir) => {
  try {
    const possiblePaths = [
      path.join(ventoyDir, 'Ventoy2Disk.exe'),
      path.join(ventoyDir, 'ventoy', 'Ventoy2Disk.exe'),
    ];

    // 递归查找
    function findExe(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = findExe(fullPath);
          if (found) return found;
        } else if (entry.name === 'Ventoy2Disk.exe') {
          return fullPath;
        }
      }
      return null;
    }

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) return p;
    }

    // 递归搜索
    if (fs.existsSync(ventoyDir)) {
      const found = findExe(ventoyDir);
      if (found) return found;
    }

    return null;
  } catch (err) {
    return null;
  }
});

// 安装 Ventoy（调用 Ventoy2Disk）
ipcMain.handle('install-ventoy', async (event, { ventoyExePath, devicePath, useGPT }) => {
  return new Promise((resolve, reject) => {
    // Ventoy2Disk 命令行参数：
    // -I 强制安装（不提示确认）
    // -g GPT 分区（推荐，支持 UEFI）
    // -M MBR 分区（兼容旧 BIOS）
    const args = ['-I'];
    if (useGPT) args.push('-g');
    args.push(devicePath);

    const child = spawn(ventoyExePath, args, {
      cwd: path.dirname(ventoyExePath),
      windowsHide: false // 显示窗口让用户看到确认提示
    });

    currentProcess = child;

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      event.sender.send('exec-output', { data: data.toString(), stream: 'stdout' });
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      event.sender.send('exec-output', { data: data.toString(), stream: 'stderr' });
    });

    child.on('close', (code) => {
      currentProcess = null;
      if (code !== 0) {
        reject(new Error(`Ventoy 安装退出码: ${code}\n${stderr || stdout}`));
      } else {
        resolve({ code, stdout, stderr });
      }
    });

    child.on('error', (err) => {
      currentProcess = null;
      reject(err);
    });
  });
});

// 写入文件
ipcMain.handle('write-file', (event, { filePath, content }) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

// 读取文件
ipcMain.handle('read-file', (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return { error: '文件不存在' };
    return { content: fs.readFileSync(filePath, 'utf8') };
  } catch (err) {
    return { error: err.message };
  }
});

// 删除文件
ipcMain.handle('delete-file', (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

// 获取文件大小
ipcMain.handle('get-file-size', (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return { size: 0 };
    const stats = fs.statSync(filePath);
    return { size: stats.size, sizeFormatted: formatBytes(stats.size) };
  } catch (err) {
    return { error: err.message };
  }
});

// 使用 PowerShell 获取 U 盘列表
async function listDrivesViaPowerShell() {
  return new Promise((resolve, reject) => {
    const psScript = `
      Get-Disk | Where-Object { $_.BusType -eq 'USB' -or ($_.FriendlyName -match 'USB|Flash|Removable') } | ForEach-Object {
        $disk = $_
        $partitions = Get-Partition -DiskNumber $disk.Number -ErrorAction SilentlyContinue
        $size = $disk.Size
        $mountPoints = @()
        foreach ($part in $partitions) {
          $vol = Get-Volume -Partition $part -ErrorAction SilentlyContinue
          if ($vol) {
            $mountPoints += @{ path = $vol.DriveLetter + ':'; filesystem = $vol.FileSystem; label = $vol.FileSystemLabel }
          }
        }
        [PSCustomObject]@{
          device = '\\\\.\\PhysicalDrive' + $disk.Number
          description = $disk.FriendlyName
          size = [long]$size
          isUSB = $true
          isRemovable = $true
          diskNumber = [int]$disk.Number
          mountpoints = $mountPoints
        }
      } | ConvertTo-Json -Depth 4
    `;

    const child = spawn('powershell', ['-Command', psScript], { encoding: 'utf8' });
    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => { output += data.toString(); });
    child.stderr.on('data', (data) => { errorOutput += data.toString(); });

    child.on('close', (code) => {
      if (code !== 0 && !output) {
        reject(new Error(`PowerShell error: ${errorOutput}`));
        return;
      }
      try {
        const result = JSON.parse(output || '[]');
        const drives = Array.isArray(result) ? result : [result];
        resolve(drives.map(d => ({
          device: d.device,
          description: d.description,
          size: d.size,
          sizeFormatted: formatBytes(d.size),
          mountpoints: d.mountpoints || [],
          isUSB: d.isUSB,
          isRemovable: d.isRemovable,
          diskNumber: d.diskNumber
        })));
      } catch (e) {
        reject(new Error(`Parse error: ${e.message}\nOutput: ${output}`));
      }
    });
  });
}

// ===== 工具函数 =====

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDiskNumber(devicePath) {
  const match = devicePath.match(/PhysicalDrive(\d+)/);
  return match ? parseInt(match[1]) : null;
}
