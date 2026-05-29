const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * Ventoy 管理模块
 * 负责下载、安装和管理 Ventoy 启动工具
 */

const VENTOY_VERSION = '1.0.99';
const VENTOY_RELEASE_URL = `https://github.com/ventoy/Ventoy/releases/download/v${VENTOY_VERSION}/ventoy-${VENTOY_VERSION}-windows.zip`;
const VENTOY_API_LATEST = 'https://api.github.com/repos/ventoy/Ventoy/releases/latest';

class VentoyManager {
  constructor(workDir) {
    this.workDir = workDir;
    this.ventoyDir = path.join(workDir, 'ventoy');
    this.ventoyExe = path.join(this.ventoyDir, 'Ventoy2Disk.exe');
  }

  /**
   * 获取最新 Ventoy 版本信息
   */
  async getLatestVersion() {
    return new Promise((resolve, reject) => {
      const req = https.get(VENTOY_API_LATEST, {
        headers: {
          'User-Agent': 'linux-to-go'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            const windowsAsset = release.assets.find(a =>
              a.name.includes('windows') && a.name.endsWith('.zip')
            );
            resolve({
              version: release.tag_name,
              url: windowsAsset?.browser_download_url || VENTOY_RELEASE_URL,
              publishedAt: release.published_at
            });
          } catch (err) {
            reject(err);
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * 检查本地是否已下载 Ventoy
   */
  isDownloaded() {
    return fs.existsSync(this.ventoyExe);
  }

  /**
   * 获取 Ventoy 可执行文件路径
   */
  getExePath() {
    return this.ventoyExe;
  }

  /**
   * 安装 Ventoy 到指定设备（需要管理员权限）
   * @param {string} device - 设备路径，如 \\.\PhysicalDrive1
   */
  async install(device) {
    if (!this.isDownloaded()) {
      throw new Error('Ventoy 未下载，请先执行 download()');
    }

    // Ventoy2Disk.exe 支持命令行参数:
    // -i 安装
    // -u 升级
    // -l 列出设备
    // -I 强制安装
    return new Promise((resolve, reject) => {
      const cmd = `"${this.ventoyExe}" -I -g "${device}"`;
      // -I = 强制安装（不管是否已有 Ventoy）
      // -g = GPT 分区表（推荐）

      const child = exec(cmd, { cwd: this.ventoyDir }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Ventoy 安装失败: ${stderr || error.message}`));
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  /**
   * 检查设备是否已安装 Ventoy
   */
  async isInstalled(device) {
    if (!this.isDownloaded()) return false;

    return new Promise((resolve) => {
      const cmd = `"${this.ventoyExe}" -l`;
      exec(cmd, { cwd: this.ventoyDir }, (error, stdout) => {
        if (error) {
          resolve(false);
          return;
        }
        resolve(stdout.includes(device));
      });
    });
  }

  /**
   * 创建 Ventoy 持久化配置文件
   * @param {string} driveLetter - U 盘盘符，如 E:
   * @param {number} sizeGB - 持久化分区大小（GB）
   */
  async createPersistence(driveLetter, sizeGB) {
    const ventoyDir = path.join(driveLetter, 'ventoy');
    if (!fs.existsSync(ventoyDir)) {
      fs.mkdirSync(ventoyDir, { recursive: true });
    }

    const persistJson = {
      persistence: [
        {
          image: '/ubuntu-*.iso',
          backend: {
            type: 'partition',
            size: `${sizeGB}GB`
          }
        }
      ]
    };

    const configPath = path.join(ventoyDir, 'ventoy.json');
    fs.writeFileSync(configPath, JSON.stringify(persistJson, null, 2));

    return configPath;
  }
}

module.exports = { VentoyManager };
