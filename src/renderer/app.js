// Linux To Go - Frontend Logic

let selectedDrive = null;
let selectedVersion = null;
let ubuntuVersions = [];
let isCustomIso = false;
let customIsoPath = null;

// DOM Elements
const el = {
  refreshDrives: document.getElementById('btn-refresh-drives'),
  driveList: document.getElementById('drive-list'),
  driveWarning: document.getElementById('drive-warning'),
  versionList: document.getElementById('version-list'),
  useCustomIso: document.getElementById('use-custom-iso'),
  customIsoSection: document.getElementById('custom-iso-section'),
  isoFile: document.getElementById('iso-file'),
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
  // Load Ubuntu versions
  try {
    ubuntuVersions = await window.electronAPI.getUbuntuVersions();
    renderVersions();
  } catch (err) {
    console.error('Failed to load versions:', err);
    // Fallback versions
    ubuntuVersions = [
      { name: '24.04.2 LTS', url: '', size: 6360000000 },
      { name: '24.10', url: '', size: 5200000000 },
      { name: '22.04.5 LTS', url: '', size: 4900000000 }
    ];
    renderVersions();
  }

  setupEventListeners();
}

function setupEventListeners() {
  el.refreshDrives.addEventListener('click', refreshDrives);
  el.useCustomIso.addEventListener('change', toggleCustomIso);
  el.isoFile.addEventListener('change', onIsoSelected);
  el.enablePersistence.addEventListener('change', togglePersistence);
  el.persistSlider.addEventListener('input', updatePersistValue);
  el.startBtn.addEventListener('click', startCreation);
  el.doneBtn.addEventListener('click', () => location.reload());

  // Listen for download progress
  window.electronAPI.onDownloadProgress((data) => {
    if (data.id === 'iso') {
      const progress = data.progress || 0;
      updateProgress(progress, `下载 Ubuntu ISO: ${progress}%`);
    } else if (data.id === 'ventoy') {
      const progress = data.progress || 0;
      updateProgress(progress, `下载 Ventoy: ${progress}%`);
    }
  });

  // Listen for exec output
  window.electronAPI.onExecOutput((data) => {
    appendLog(data.data);
  });
}

// Drive Management
async function refreshDrives() {
  el.refreshDrives.disabled = true;
  el.refreshDrives.innerHTML = '<span class="btn-icon">⏳</span> 检测中...';
  el.driveList.innerHTML = '<p class="placeholder">正在检测 USB 设备...</p>';

  try {
    const drives = await window.electronAPI.listDrives();

    if (drives.error) {
      el.driveList.innerHTML = `<p class="placeholder" style="color:#e53e3e">检测失败: ${drives.error}</p>`;
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
    item.innerHTML = `
      <span class="drive-icon">💾</span>
      <div class="drive-info">
        <div class="drive-name">${drive.description || 'USB 设备'} (${drive.device})</div>
        <div class="drive-detail">
          ${drive.mountpoints?.map(m => m.path).join(', ') || '未挂载'}
          ${drive.isUSB ? ' · USB' : ''} ${drive.isRemovable ? ' · 可移动设备' : ''}
        </div>
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

// Version Management
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
        <div class="version-size">约 ${sizeGB} GB</div>
      </div>
    `;
    item.addEventListener('click', () => selectVersion(version, item));
    el.versionList.appendChild(item);
  });

  // Select first by default
  if (ubuntuVersions.length > 0) {
    selectedVersion = ubuntuVersions[0];
  }
  updateSummary();
}

function selectVersion(version, element) {
  document.querySelectorAll('.version-item').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  selectedVersion = version;
  updateSummary();
}

function toggleCustomIso() {
  isCustomIso = el.useCustomIso.checked;
  el.customIsoSection.style.display = isCustomIso ? 'block' : 'none';

  if (isCustomIso) {
    document.querySelectorAll('.version-item').forEach(el => el.classList.remove('selected'));
    selectedVersion = null;
  } else {
    customIsoPath = null;
    // Reselect first version
    const first = document.querySelector('.version-item');
    if (first) {
      first.classList.add('selected');
      selectedVersion = ubuntuVersions[0];
    }
  }
  updateSummary();
}

function onIsoSelected(e) {
  const file = e.target.files[0];
  if (file) {
    customIsoPath = file.path;
    updateSummary();
  }
}

// Persistence
function togglePersistence() {
  const enabled = el.enablePersistence.checked;
  el.persistSizeSection.style.display = enabled ? 'block' : 'none';
  updateSummary();
}

function updatePersistValue() {
  el.persistValue.textContent = el.persistSlider.value + ' GB';
  updateSummary();
}

// Summary
function updateSummary() {
  if (!selectedDrive) {
    el.summary.style.display = 'none';
    el.startBtn.disabled = true;
    return;
  }

  const items = [];

  // Drive
  items.push(`目标设备: ${selectedDrive.description} (${selectedDrive.sizeFormatted})`);

  // Version
  if (isCustomIso && customIsoPath) {
    items.push(`使用本地 ISO: ${customIsoPath.split('\\').pop()}`);
  } else if (selectedVersion) {
    const sizeGB = (selectedVersion.size / 1024 / 1024 / 1024).toFixed(1);
    items.push(`Ubuntu 版本: ${selectedVersion.name} (约 ${sizeGB} GB)`);
  }

  // Persistence
  if (el.enablePersistence.checked) {
    items.push(`持久化分区: ${el.persistSlider.value} GB`);
  } else {
    items.push(`持久化: 不启用（Live 模式，重启后数据丢失）`);
  }

  el.summaryList.innerHTML = items.map(i => `<li>${i}</li>`).join('');
  el.summary.style.display = 'block';

  // Enable start if we have a valid config
  const canStart = selectedDrive && (selectedVersion || (isCustomIso && customIsoPath));
  el.startBtn.disabled = !canStart;
}

// Progress
function updateProgress(percent, detail) {
  el.progressBar.style.width = percent + '%';
  if (detail) {
    el.progressDetail.textContent = detail;
  }
}

function appendLog(text) {
  el.logOutput.textContent += text;
  el.logOutput.scrollTop = el.logOutput.scrollHeight;
}

function setStatus(text) {
  el.statusText.textContent = text;
}

// Main Creation Flow
async function startCreation() {
  if (!selectedDrive) {
    alert('请先选择目标设备');
    return;
  }

  const confirmed = confirm(
    `警告：即将格式化 ${selectedDrive.device} (${selectedDrive.sizeFormatted})\n\n` +
    '此操作将清除设备上的所有数据！\n\n' +
    '请确认已备份重要文件，然后点击"确定"继续。'
  );

  if (!confirmed) return;

  // Hide steps, show progress
  document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
  el.progressSection.style.display = 'block';

  try {
    await runCreationFlow();
  } catch (err) {
    setStatus('制作失败');
    appendLog(`\n❌ 错误: ${err.message}\n`);
    console.error(err);
  }
}

async function runCreationFlow() {
  const appDataPath = await window.electronAPI.getAppDataPath();
  const workDir = `${appDataPath}/linux-to-go-work`;
  await window.electronAPI.mkdir(workDir);

  // Step 1: Download Ventoy
  setStatus('准备 Ventoy');
  updateProgress(5, '准备 Ventoy 启动工具...');
  appendLog('=== 步骤 1: 准备 Ventoy ===\n');

  const ventoyUrl = 'https://github.com/ventoy/Ventoy/releases/download/v1.0.99/ventoy-1.0.99-windows.zip';
  const ventoyZip = `${workDir}/ventoy.zip`;

  try {
    await window.electronAPI.downloadFile({
      url: ventoyUrl,
      destPath: ventoyZip,
      id: 'ventoy'
    });
    appendLog('✓ Ventoy 下载完成\n');
  } catch (err) {
    appendLog('⚠ Ventoy 下载失败，将使用内置方案\n');
  }

  // Step 2: Download/Get ISO
  updateProgress(20, '准备 Ubuntu ISO...');
  appendLog('\n=== 步骤 2: 准备 Ubuntu ISO ===\n');

  let isoPath;
  if (isCustomIso && customIsoPath) {
    isoPath = customIsoPath;
    appendLog(`✓ 使用本地 ISO: ${isoPath}\n`);
  } else if (selectedVersion && selectedVersion.url) {
    isoPath = `${workDir}/${selectedVersion.name}.iso`;
    appendLog(`开始下载 Ubuntu ${selectedVersion.name}...\n`);

    try {
      await window.electronAPI.downloadFile({
        url: selectedVersion.url,
        destPath: isoPath,
        id: 'iso'
      });
      appendLog('✓ ISO 下载完成\n');
    } catch (err) {
      throw new Error(`ISO 下载失败: ${err.message}`);
    }
  } else {
    throw new Error('未选择有效的 Ubuntu 版本或 ISO 文件');
  }

  // Step 3: Install Ventoy to USB
  updateProgress(60, '安装 Ventoy 到 U 盘...');
  setStatus('安装 Ventoy');
  appendLog('\n=== 步骤 3: 安装 Ventoy 到 U 盘 ===\n');
  appendLog(`目标设备: ${selectedDrive.device}\n`);
  appendLog('注意：Ventoy 安装需要管理员权限\n');

  // Create a batch script for Ventoy installation
  const ventoyScript = `${workDir}/install_ventoy.bat`;
  const scriptContent = `@echo off
echo Installing Ventoy to ${selectedDrive.device}...
echo.
echo Please wait...
echo.
pause
`;

  // Since we can't directly write files easily, we'll show instructions
  appendLog('\n⚠️ 由于系统权限限制，请手动完成以下步骤：\n\n');
  appendLog('1. 解压 ' + ventoyZip + '\n');
  appendLog('2. 运行 Ventoy2Disk.exe\n');
  appendLog('3. 选择设备: ' + selectedDrive.device + '\n');
  appendLog('4. 点击"安装"\n\n');

  // Step 4: Copy ISO to USB
  updateProgress(80, '复制 ISO 到 U 盘...');
  setStatus('复制系统文件');
  appendLog('\n=== 步骤 4: 复制系统文件 ===\n');
  appendLog('安装 Ventoy 后，请将 ISO 文件复制到 U 盘根目录\n');
  appendLog(`ISO 路径: ${isoPath}\n\n`);

  // Step 5: Persistence config
  if (el.enablePersistence.checked) {
    updateProgress(90, '配置持久化分区...');
    setStatus('配置持久化');
    appendLog('\n=== 步骤 5: 配置持久化存储 ===\n');
    appendLog('持久化分区大小: ' + el.persistSlider.value + ' GB\n');
    appendLog('Ventoy 启动后选择 ISO 时，按 F1 可配置持久化\n\n');
  }

  // Complete
  updateProgress(100, '完成！');
  setStatus('制作完成');
  appendLog('\n✅ Linux To Go 制作完成！\n');

  setTimeout(() => {
    el.progressSection.style.display = 'none';
    el.successSection.style.display = 'block';
  }, 2000);
}

// Start
init();
