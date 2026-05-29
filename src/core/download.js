const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);

/**
 * 下载管理器
 * 支持断点续传、进度回调、重试机制
 */

class DownloadManager {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 30000;
    this.chunkSize = options.chunkSize || 8192;
  }

  /**
   * 下载文件
   * @param {string} url - 下载地址
   * @param {string} destPath - 目标路径
   * @param {Object} options - 选项
   * @param {Function} options.onProgress - 进度回调 (downloaded, total, percent)
   * @param {Function} options.onSpeed - 速度回调 (bytesPerSecond)
   * @param {number} options.retryCount - 当前重试次数
   */
  async download(url, destPath, options = {}) {
    const { onProgress, retryCount = 0 } = options;

    // 确保目录存在
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 检查是否支持断点续传
    let startByte = 0;
    const partialPath = `${destPath}.partial`;

    if (fs.existsSync(partialPath)) {
      startByte = fs.statSync(partialPath).size;
    }

    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const requestOptions = {
        headers: {
          'User-Agent': 'linux-to-go/1.0.0',
          ...(startByte > 0 ? { 'Range': `bytes=${startByte}-` } : {})
        },
        timeout: this.timeout
      };

      const req = protocol.get(url, requestOptions, async (response) => {
        // 处理重定向
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          resolve(await this.download(response.headers.location, destPath, options));
          return;
        }

        if (response.statusCode !== 200 && response.statusCode !== 206) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const total = parseInt(response.headers['content-length'], 10) || 0;
        const totalSize = startByte + total;

        // 如果文件已完整下载
        if (total === 0 && startByte > 0) {
          fs.renameSync(partialPath, destPath);
          resolve({ path: destPath, size: startByte });
          return;
        }

        const flags = startByte > 0 ? 'a' : 'w';
        const fileStream = fs.createWriteStream(partialPath, { flags });

        let downloaded = startByte;
        let lastReported = downloaded;
        let speedStart = Date.now();

        response.on('data', (chunk) => {
          downloaded += chunk.length;

          // 每 500KB 报告一次进度
          if (downloaded - lastReported > 512 * 1024) {
            const now = Date.now();
            const elapsed = (now - speedStart) / 1000;
            const speed = elapsed > 0 ? (downloaded - lastReported) / elapsed : 0;

            if (onProgress) {
              const percent = totalSize > 0 ? Math.round((downloaded / totalSize) * 100) : 0;
              onProgress(downloaded, totalSize, percent, speed);
            }

            lastReported = downloaded;
            speedStart = now;
          }
        });

        try {
          await pipelineAsync(response, fileStream);

          // 下载完成，重命名文件
          fs.renameSync(partialPath, destPath);

          if (onProgress) {
            onProgress(downloaded, totalSize, 100, 0);
          }

          resolve({ path: destPath, size: downloaded });
        } catch (err) {
          reject(err);
        }
      });

      req.on('error', async (err) => {
        if (retryCount < this.maxRetries) {
          console.log(`下载失败，${retryCount + 1}/${this.maxRetries} 次重试...`);
          await this.delay(1000 * (retryCount + 1));
          try {
            resolve(await this.download(url, destPath, { ...options, retryCount: retryCount + 1 }));
          } catch (retryErr) {
            reject(retryErr);
          }
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('下载超时'));
      });
    });
  }

  /**
   * 从 GitHub Release 下载资源
   */
  async downloadFromGitHub(owner, repo, assetName, destPath, options = {}) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

    return new Promise((resolve, reject) => {
      https.get(apiUrl, {
        headers: {
          'User-Agent': 'linux-to-go/1.0.0',
          'Accept': 'application/vnd.github.v3+json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
          try {
            const release = JSON.parse(data);
            const asset = release.assets.find(a => a.name === assetName || a.name.includes(assetName));

            if (!asset) {
              reject(new Error(`未找到资源: ${assetName}`));
              return;
            }

            const result = await this.download(asset.browser_download_url, destPath, options);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        });
      }).on('error', reject);
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { DownloadManager };
