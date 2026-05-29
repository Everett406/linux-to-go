const { exec } = require('child_process');
const drivelist = require('drivelist');

/**
 * USB 设备管理模块
 * 负责检测、分区和格式化 USB 设备
 */

class USBManager {
  /**
   * 获取所有 USB/可移动设备
   */
  async listUSBDevices() {
    const drives = await drivelist.list();
    return drives.filter(d => d.isUSB || d.isRemovable).map(d => ({
      device: d.device,
      description: d.description,
      size: d.size,
      sizeFormatted: this.formatBytes(d.size),
      mountpoints: d.mountpoints,
      isUSB: d.isUSB,
      isRemovable: d.isRemovable,
      isSystem: d.isSystem
    }));
  }

  /**
   * 获取设备详细信息（Windows 使用 wmic/diskpart）
   */
  async getDeviceDetails(device) {
    return new Promise((resolve, reject) => {
      // 使用 wmic 获取磁盘信息
      const cmd = `wmic diskdrive where "DeviceID='${device.replace(/\\/g, '\\\\\\\\')}'" get DeviceID,Model,Size,MediaType,Status /format:csv`;

      exec(cmd, { encoding: 'utf8' }, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });
  }

  /**
   * 使用 diskpart 创建分区（需要管理员权限）
   * @param {number} diskNumber - 磁盘编号
   * @param {string} fsType - 文件系统类型: fat32, ntfs, exfat
   * @param {string} label - 卷标
   */
  async createPartition(diskNumber, fsType = 'fat32', label = 'LINUX-TO-GO') {
    const script = [
      'select disk ' + diskNumber,
      'clean',
      'create partition primary',
      `format fs=${fsType} label="${label}" quick`,
      'assign',
      'exit'
    ].join('\n');

    return this.runDiskpart(script);
  }

  /**
   * 创建持久化分区
   * @param {number} diskNumber - 磁盘编号
   * @param {number} sizeGB - 分区大小（GB）
   * @param {string} fsType - 文件系统
   */
  async createPersistencePartition(diskNumber, sizeGB, fsType = 'ext4') {
    const script = [
      'select disk ' + diskNumber,
      'create partition primary size=' + (sizeGB * 1024),
      `format fs=${fsType} label="casper-rw" quick`,
      'assign',
      'exit'
    ].join('\n');

    return this.runDiskpart(script);
  }

  /**
   * 运行 diskpart 脚本
   */
  runDiskpart(script) {
    return new Promise((resolve, reject) => {
      const child = exec('diskpart', (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`diskpart 失败: ${stderr || error.message}`));
          return;
        }
        resolve({ stdout, stderr });
      });

      child.stdin.write(script + '\n');
      child.stdin.end();
    });
  }

  /**
   * 弹出/安全移除设备
   */
  async eject(driveLetter) {
    return new Promise((resolve, reject) => {
      const cmd = `powershell -Command "(New-Object -comObject Shell.Application).Namespace(17).ParseName('${driveLetter}:').InvokeVerb('Eject')"`;
      exec(cmd, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });
  }

  /**
   * 格式化字节
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 验证设备是否足够大
   */
  hasEnoughSpace(deviceSize, isoSize, persistSizeGB = 0) {
    const minSize = isoSize + (persistSizeGB * 1024 * 1024 * 1024) + (512 * 1024 * 1024); // ISO + 持久化 + 512MB 缓冲
    return deviceSize >= minSize;
  }

  /**
   * 获取 Ventoy 兼容的磁盘编号
   * 从设备路径如 \\.\PhysicalDrive1 提取编号
   */
  getDiskNumber(devicePath) {
    const match = devicePath.match(/PhysicalDrive(\d+)/);
    return match ? parseInt(match[1]) : null;
  }
}

module.exports = { USBManager };
