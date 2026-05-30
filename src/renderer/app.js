// Linux To Go - Frontend Logic

let selectedDrive = null;
let selectedVersion = null;
let ubuntuVersions = [];
let isCustomIso = false;
let customIsoInfo = null;
let isRunning = false;

// DOM Elements
const el = {
  refreshDrives: document.getElementById('btn-refresh-drives'),
  driveList: document.getElementById('drive-list'),
  driveWarning: document.getElementById('drive-warning'),
  versionList: document.getElementById('version-list'),
  useCustomIso: document.getElementById('use-custom-iso'),
  customIsoSection: document.getElementById('custom-iso-section'),
  btnSelectIso: document.getElementById('btn-select-iso'),
  isoInfo: document.getElementById('iso-info'),
  enablePersistence: document.getElementById('enable-persistence'),
  persistSizeSection: document.getElementById('persist-size-section'),
  persistSlider: document.getElementById('persist-slider'),
  persistValue: document.getElementById('persist-value'),
  summary: document.getElementById('summary'),
  summaryList: document.getElementById('summary-list'),
  startBtn: document.getElementById('btn-start'),
  progressSection: document.getElementById('progress-section'),
  progressBar: document.getElementById('progress-bar'),
  statusText: document.getElementById('status-text'),
  progressDetail: document.getElementById('progress-detail'),
  logOutput: document.getElementById('log-output'),
  successSection: document.getElementById('success-section'),
  doneBtn: document.getElementById('btn-done')
};

// Initialize
async function init() {
  try {
    ubuntuVersions = await window.electronAPI.getUbuntuVersions();
  } catch (err) {
    console.error('Failed to load versions:', err);
    ubuntuVersions = [
      { name: '24.04.2 LTS', url: 'https://releases.ubuntu.com/24.04/ubuntu-24.04.2-desktop-amd64.iso', size: 6360000000 },
      { name: '24.10', url: 'https://releases.ubuntu.com/24.10/ubuntu-24.10-desktop-amd64.iso', size: 5200000000 },
      { name: '22.04.5 LTS', url: 'https://releases.ubuntu.com/22.04/ubuntu-22.04.5-desktop-amd64.iso', size: 4900000000 }
    ];
  }
  renderVersions();
  setupEventListeners();
}

function setupEventListeners() {
  el.refreshDrives.addEventListener('click', refreshDrives);
  el.useCustomIso.addEventListener('change', toggleCustomIso);
  if (el.btnSelectIso) el.btnSelectIso.addEventListener('click', selectLocalIso);
  el.enablePersistence.addEventListener('change', togglePersistence);
  el.persistSlider.addEventListener('input', updatePersistValue);
  el.startBtn.addEventListener('click', startCreation);
  el.doneBtn.addEventListener('click', () => location.reload());

  // 监听主进程事件
  window.electronAPI.onDownloadProgress((data) => {
    if (data.id === 'iso') {
      updateProgress(data.progress, `下载 Ubuntu ISO: ${data.progress}% (${formatBytes(data.downloaded)} / ${formatBytes(data.total)})`);
    } else if (data.id === 'ventoy') {
      updateProgress(data.progress, `下载 Ventoy: ${data.progress}% (${formatBytes(data.downloaded)} / ${formatBytes(data.total)})`);
    }
  });

  window.electronAPI.onCopyProgress((data) => {
    updateProgress(data.progress, `复制文件到 U 盘: ${data.progress}%`);
  });

  window.electronAPI.onExecOutput((data) => {
    appendLog(data.data);
  });
}

// ===== 设备管理 =====
async function refreshDrives() {
  el.refreshDrives.disabled = true;
  el.refreshDrives.innerHTML = '<span class="btn-icon">⏳</span> 检测中...';
  el.driveList.innerHTML = '<p class="placeholder">正在检测 USB 设备...</p>';

  try {
    const drives = await window.electronAPI.listDrives();
    if (drives.error) {
      el.driveList.innerHTML = `<p class="placeholder" style="color:#e53e3e">检测失败: ${drives.error}<br>请确保以管理员权限运行程序</p>`;
      return;
    }
    if (drives.length === 0) {
      el.driveList.innerHTML = '<p class="placeholder">未检测到 USB 设备，请插入 U 盘/移动硬盘后重试</p>';
      return;
    }
    renderDrives(drives);
  } catch (err) {
    el.driveList.innerHTML = `<p class="placeholder" style="color:#e53e3e">检测出错: ${err.message}</p>`;
  } finally {
    el.refreshDrives.disabled = false;
    el.refreshDrives.innerHTML = '<span class="btn-icon">🔄</span> 刷新设备列表';
  }
}

function renderDrives(drives) {
  el.driveList.innerHTML = '';
  drives.forEach(drive => {
    const item = document.createElement('div');
    item.className = 'drive-item';
    item.dataset.device = drive.device;
    const mountInfo = drive.mountpoints?.map(m => m.path).join(', ') || '未挂载';
    item.innerHTML = `
      <span class="drive-icon">💾</span>
      <div class="drive-info">
        <div class="drive-name">${drive.description || 'USB 设备'}</div>
        <div class="drive-detail">${mountInfo} · 磁盘号: ${drive.diskNumber !== undefined ? drive.diskNumber : 'N/A'}</div>
      </div>
      <span class="drive-size">${drive.sizeFormatted}</span>
    `;
    item.addEventListener('click', () => selectDrive(drive, item));
    el.driveList.appendChild(item);
  });
}

function selectDrive(drive, element) {
  document.querySelectorAll('.drive-item').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  selectedDrive = drive;
  el.driveWarning.classList.add('show');
  updateSummary();
}

// ===== 版本管理 =====
function renderVersions() {
  el.versionList.innerHTML = '';
  ubuntuVersions.forEach((version, index) => {
    const item = document.createElement('div');
    item.className = 'version-item' + (index === 0 ? ' selected' : '');
    item.dataset.version = version.name;
    const sizeGB = (version.size / 1024 / 1024 / 1024).toFixed(1);
    item.innerHTML = `
      <span class="version-radio"></span>
      <div class="version-info">
        <div class="version-name">Ubuntu ${version.name}</div>
        <div class="version-size">约 ${sizeGB} GB · ${version.url ? '需下载' : '本地'}</div>
      </div>
    `;
    item.addEventListener('click', () => selectVersion(version, item));
    el.versionList.appendChild(item);
  });
  if (ubuntuVersions.length > 0) selectedVersion = ubuntuVersions[0];
  updateSummary();
}

function selectVersion(version, element) {
  document.querySelectorAll('.version-item').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  selectedVersion = version;
  updateSummary();
}

// ===== 自定义 ISO =====
function toggleCustomIso() {
  isCustomIso = el.useCustomIso.checked;
  el.customIsoSection.style.display = isCustomIso ? 'block' : 'none';
  if (isCustomIso) {
    document.querySelectorAll('.version-item').forEach(el => el.classList.remove('selected'));
    selectedVersion = null;
  } else {
    customIsoInfo = null;
    if (el.isoInfo) el.isoInfo.innerHTML = '';
    const first = document.querySelector('.version-item');
    if (first) {
      first.classList.add('selected');
      selectedVersion = ubuntuVersions[0];
    }
  }
  updateSummary();
}

async function selectLocalIso() {
  try {
    const result = await window.electronAPI.selectIsoFile();
    if (result) {
      customIsoInfo = result;
      if (el.isoInfo) {
        el.isoInfo.innerHTML = `<div class="iso-selected">
          <strong>${result.name}</strong>
          <span>${result.sizeFormatted}</span>
        </div>`;
      }
      updateSummary();
    }
  } catch (err) {
    alert('选择文件失败: ' + err.message);
  }
}

// ===== 持久化 =====
function togglePersistence() {
  el.persistSizeSection.style.display = el.enablePersistence.checked ? 'block' : 'none';
  updateSummary();
}

function updatePersistValue() {
  el.persistValue.textContent = el.persistSlider.value + ' GB';
  updateSummary();
}

// ===== 摘要 =====
function updateSummary() {
  if (!selectedDrive) {
    el.summary.style.display = 'none';
    el.startBtn.disabled = true;
    return;
  }
  const items = [];
  items.push(`目标设备: ${selectedDrive.description} (${selectedDrive.sizeFormatted})`);

  if (isCustomIso && customIsoInfo) {
    items.push(`ISO: ${customIsoInfo.name} (${customIsoInfo.sizeFormatted})`);
  } else if (selectedVersion) {
    const sizeGB = (selectedVersion.size / 1024 / 1024 / 1024).toFixed(1);
    items.push(`Ubuntu: ${selectedVersion.name} (约 ${sizeGB} GB)`);
  }

  if (el.enablePersistence.checked) {
    items.push(`持久化: ${el.persistSlider.value} GB`);
  } else {
    items.push('持久化: 不启用（Live 模式）');
  }

  el.summaryList.innerHTML = items.map(i => `<li>${i}</li>`).join('');
  el.summary.style.display = 'block';

  const canStart = selectedDrive && (selectedVersion || (isCustomIso && customIsoInfo));
  el.startBtn.disabled = !canStart || isRunning;
}

// ===== 进度显示 =====
function updateProgress(percent, detail) {
  const p = Math.min(Math.max(percent, 0), 100);
  el.progressBar.style.width = p + '%';
  if (detail) el.progressDetail.textContent = detail;
}

function appendLog(text) {
  el.logOutput.textContent += text;
  el.logOutput.scrollTop = el.logOutput.scrollHeight;
}

function setStatus(text) {
  el.statusText.textContent = text;
}

function logStep(stepNum, title) {
  appendLog(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  appendLog(`  步骤 ${stepNum}: ${title}\n`);
  appendLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

// ===== 核心制作流程 =====
async function startCreation() {
  if (!selectedDrive) { alert('请先选择目标设备'); return; }

  const isoName = isCustomIso ? customIsoInfo.name : selectedVersion.name;
  const confirmed = confirm(
    `⚠️ 警告\n\n` +
    `即将格式化设备: ${selectedDrive.description}\n` +
    `容量: ${selectedDrive.sizeFormatted}\n` +
    `ISO: ${isoName}\n\n` +
    `此操作将清除设备上的所有数据！\n\n` +
    `请确认已备份重要文件。`
  );
  if (!confirmed) return;

  isRunning = true;
  el.startBtn.disabled = true;
  document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
  el.progressSection.style.display = 'block';
  el.logOutput.textContent = '';

  try {
    await runFullCreationFlow();
  } catch (err) {
    setStatus('制作失败 ❌');
    appendLog(`\n❌ 错误: ${err.message}\n`);
    console.error(err);
    el.startBtn.textContent = '重试';
    el.startBtn.disabled = false;
    isRunning = false;
  }
}

async function runFullCreationFlow() {
  const appDataPath = await window.electronAPI.getAppDataPath();
  const workDir = pathJoin(appDataPath, 'linux-to-go-work');
  await window.electronAPI.mkdir(workDir);

  // === 步骤 1: 准备 Ventoy ===
  logStep(1, '准备 Ventoy 启动工具');
  setStatus('准备 Ventoy');
  updateProgress(5, '获取 Ventoy 信息...');

  let ventoyInfo;
  try {
    ventoyInfo = await window.electronAPI.getVentoyLatest();
    appendLog(`✓ Ventoy 最新版本: ${ventoyInfo.version}\n`);
    appendLog(`  下载地址: ${ventoyInfo.url}\n`);
  } catch (err) {
    appendLog(`⚠ 获取版本失败，使用备用地址\n`);
    ventoyInfo = {
      version: 'v1.0.99',
      url: 'https://github.com/ventoy/Ventoy/releases/download/v1.0.99/ventoy-1.0.99-windows.zip',
      name: 'ventoy-1.0.99-windows.zip'
    };
  }

  const ventoyZip = pathJoin(workDir, ventoyInfo.name || 'ventoy.zip');
  const ventoyDir = pathJoin(workDir, 'ventoy');
  let ventoyExePath = null;

  // 检查是否已下载
  ventoyExePath = await window.electronAPI.findVentoyExe(ventoyDir);
  if (ventoyExePath) {
    appendLog(`✓ Ventoy 已存在于: ${ventoyExePath}\n`);
  } else if (await window.electronAPI.fileExists(ventoyZip)) {
    appendLog('✓ 发现 Ventoy 压缩包，正在解压...\n');
    const extractResult = await window.electronAPI.extractZip({ zipPath: ventoyZip, destDir: ventoyDir });
    if (extractResult.error) throw new Error(`解压失败: ${extractResult.error}`);
    ventoyExePath = await window.electronAPI.findVentoyExe(ventoyDir);
  }

  if (!ventoyExePath) {
    updateProgress(10, '下载 Ventoy...');
    appendLog(`开始下载 Ventoy ${ventoyInfo.version}...\n`);
    try {
      await window.electronAPI.downloadWithProgress({
        url: ventoyInfo.url,
        destPath: ventoyZip,
        id: 'ventoy'
      });
      appendLog('✓ Ventoy 下载完成，正在解压...\n');
      const extractResult = await window.electronAPI.extractZip({ zipPath: ventoyZip, destDir: ventoyDir });
      if (extractResult.error) throw new Error(`解压失败: ${extractResult.error}`);
      ventoyExePath = await window.electronAPI.findVentoyExe(ventoyDir);
      if (!ventoyExePath) throw new Error('解压后未找到 Ventoy2Disk.exe');
      appendLog(`✓ Ventoy 就绪: ${ventoyExePath}\n`);
    } catch (err) {
      throw new Error(`Ventoy 准备失败: ${err.message}\n\n请手动下载 Ventoy 并放置到:\n${ventoyDir}`);
    }
  }

  // === 步骤 2: 准备 ISO ===
  logStep(2, '准备 Ubuntu ISO');
  setStatus('准备 ISO');
  updateProgress(25, '准备 ISO 文件...');

  let isoPath;
  if (isCustomIso && customIsoInfo) {
    isoPath = customIsoInfo.path;
    appendLog(`✓ 使用本地 ISO: ${customIsoInfo.name}\n`);
    appendLog(`  路径: ${isoPath}\n`);
    appendLog(`  大小: ${customIsoInfo.sizeFormatted}\n`);
  } else if (selectedVersion && selectedVersion.url) {
    isoPath = pathJoin(workDir, selectedVersion.name + '.iso');

    if (await window.electronAPI.fileExists(isoPath)) {
      appendLog(`✓ ISO 已存在于: ${isoPath}\n`);
    } else {
      updateProgress(30, '下载 Ubuntu ISO...');
      appendLog(`开始下载 Ubuntu ${selectedVersion.name}...\n`);
      appendLog(`  URL: ${selectedVersion.url}\n`);
      appendLog(`  预计大小: ${formatBytes(selectedVersion.size)}\n\n`);
      appendLog('  (下载可能需要几分钟，请耐心等待...)\n\n');

      try {
        await window.electronAPI.downloadWithProgress({
          url: selectedVersion.url,
          destPath: isoPath,
          id: 'iso'
        });
        appendLog('\n✓ ISO 下载完成\n');
      } catch (err) {
        throw new Error(`ISO 下载失败: ${err.message}\n\n请尝试:\n1. 检查网络连接\n2. 使用本地 ISO 文件\n3. 稍后重试`);
      }
    }
  } else {
    throw new Error('未选择有效的 Ubuntu 版本或 ISO 文件');
  }

  // === 步骤 3: 安装 Ventoy 到 U 盘 ===
  logStep(3, '安装 Ventoy 到 U 盘');
  setStatus('安装 Ventoy');
  updateProgress(50, '正在安装 Ventoy...');

  appendLog(`目标设备: ${selectedDrive.device}\n`);
  appendLog(`磁盘编号: ${selectedDrive.diskNumber !== undefined ? selectedDrive.diskNumber : 'N/A'}\n`);
  appendLog(`Ventoy 路径: ${ventoyExePath}\n\n`);
  appendLog('⚠️ 注意: Ventoy 安装需要管理员权限\n');
  appendLog('  如果弹出权限提示，请点击"是"允许\n\n');

  try {
    await window.electronAPI.installVentoy({
      ventoyExePath: ventoyExePath,
      devicePath: selectedDrive.device,
      useGPT: true  // GPT 分区，支持 UEFI
    });
    appendLog('\n✓ Ventoy 安装成功\n');
  } catch (err) {
    appendLog(`\n⚠️ Ventoy 安装可能出现问题: ${err.message}\n`);
    appendLog('\n请尝试以下方法:\n');
    appendLog('1. 以管理员权限重新运行本程序\n');
    appendLog('2. 手动运行: ' + ventoyExePath + '\n');
    appendLog('3. 选择设备 ' + selectedDrive.device + ' 后点击"安装"\n');
    throw new Error('Ventoy 安装失败，请按照上方提示手动操作');
  }

  // 等待 Windows 重新识别 U 盘
  appendLog('\n等待系统重新识别设备...\n');
  await sleep(3000);

  // === 步骤 4: 复制 ISO 到 U 盘 ===
  logStep(4, '复制系统文件到 U 盘');
  setStatus('复制系统文件');
  updateProgress(70, '复制 ISO 到 U 盘...');

  // 重新获取设备列表以找到新的盘符
  const refreshedDrives = await window.electronAPI.listDrives();
  const targetDrive = refreshedDrives.find(d => d.device === selectedDrive.device);

  if (!targetDrive || !targetDrive.mountpoints || targetDrive.mountpoints.length === 0) {
    appendLog('\n⚠️ 未找到 U 盘盘符，请手动复制 ISO 文件\n');
    appendLog(`从: ${isoPath}\n`);
    appendLog('到: U 盘根目录 (如 E:\\)\n');
  } else {
    const destDrive = targetDrive.mountpoints[0].path;
    const destPath = destDrive + '\\' + (isCustomIso ? customIsoInfo.name : selectedVersion.name + '.iso');

    appendLog(`目标盘符: ${destDrive}\n`);
    appendLog(`源文件: ${isoPath}\n`);
    appendLog(`目标路径: ${destPath}\n\n`);
    appendLog('开始复制，请耐心等待...\n\n');

    try {
      await window.electronAPI.copyFile({ source: isoPath, dest: destPath });
      appendLog('\n✓ ISO 复制完成\n');
    } catch (err) {
      appendLog(`\n⚠️ 复制失败: ${err.message}\n`);
      appendLog('请手动复制 ISO 文件到 U 盘根目录\n');
    }
  }

  // === 步骤 5: 持久化配置 ===
  if (el.enablePersistence.checked) {
    logStep(5, '配置持久化存储');
    setStatus('配置持久化');
    updateProgress(90, '配置持久化...');

    const persistSize = parseInt(el.persistSlider.value);
    appendLog(`持久化大小: ${persistSize} GB\n`);

    // 尝试创建 ventoy.json 配置文件
    try {
      const refreshedDrives2 = await window.electronAPI.listDrives();
      const targetDrive2 = refreshedDrives2.find(d => d.device === selectedDrive.device);

      if (targetDrive2 && targetDrive2.mountpoints && targetDrive2.mountpoints.length > 0) {
        const driveLetter = targetDrive2.mountpoints[0].path;
        const ventoyDir = driveLetter + '\\ventoy';
        const isoFileName = isCustomIso ? customIsoInfo.name : (selectedVersion.name + '.iso');

        // 创建 ventoy.json 配置文件
        const ventoyConfig = {
          control: [
            { VTOY_DEFAULT_SEARCH_ROOT: '/' }
          ],
          theme: {
            file: '/ventoy/theme/theme.txt',
            gfxmode: '1920x1080'
          },
          auto_install: [],
          persistence: [
            {
              image: '/' + isoFileName,
              backend: [{
                backend_type: 'partition',
                'label': 'persistence'
              }]
            }
          ]
        };

        await window.electronAPI.mkdir(ventoyDir);
        await window.electronAPI.writeFile({
          filePath: ventoyDir + '\\ventoy.json',
          content: JSON.stringify(ventoyConfig, null, 2)
        });
        appendLog(`✓ 已创建持久化配置文件: ${ventoyDir}\\ventoy.json\n`);
      } else {
        appendLog('⚠️ 未找到 U 盘盘符，持久化配置需手动设置\n');
      }
    } catch (err) {
      appendLog(`⚠️ 持久化配置创建失败: ${err.message}\n`);
      appendLog('可手动在 Ventoy 启动菜单中配置持久化。\n');
    }

    appendLog('\n使用说明:\n');
    appendLog('1. 启动后进入 Ventoy 菜单\n');
    appendLog('2. 选择 Ubuntu ISO\n');
    appendLog('3. 选择带有 persistence 的启动选项\n');
    appendLog('4. 首次启动时会自动创建持久化分区\n');
  }

  // === 完成 ===
  updateProgress(100, '完成！');
  setStatus('制作完成 ✅');
  appendLog('\n\n🎉 Linux To Go 制作完成！\n');
  appendLog('\n设备: ' + selectedDrive.description + '\n');
  appendLog('现在可以在任何电脑 BIOS/UEFI 中从此 U 盘启动 Ubuntu。\n');

  setTimeout(() => {
    el.progressSection.style.display = 'none';
    el.successSection.style.display = 'block';
  }, 3000);
}

// ===== 工具函数 =====
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function pathJoin(...parts) {
  // 简单的路径拼接
  return parts.join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 启动
init();
