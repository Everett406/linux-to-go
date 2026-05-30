# Linux To Go 🐧

将 Ubuntu 装入 U 盘/移动硬盘，即插即用！类似 Windows To Go 的 Linux 便携系统制作工具。

[![GitHub stars](https://img.shields.io/github/stars/Everett406/linux-to-go?style=flat-square)](https://github.com/Everett406/linux-to-go)
[![License](https://img.shields.io/github/license/Everett406/linux-to-go?style=flat-square)](LICENSE)

## 功能特性

- ✨ **一键制作** — 全自动下载、安装、配置，无需手动操作
- 🐧 **基于 Ventoy** — 使用 [Ventoy](https://github.com/ventoy/Ventoy) 开源多系统启动方案，兼容性极佳
- 📦 **多版本支持** — Ubuntu 22.04/24.04/24.10，默认 24.04 LTS
- 💾 **持久化存储** — 保留文件、设置和安装的软件，重启后数据不丢失
- 📁 **本地 ISO** — 支持使用已下载的 ISO 文件，无需重复下载
- 🌐 **中文界面** — 全中文图形界面，操作简单直观
- 🔍 **自动检测** — 自动识别 USB 设备，显示容量和盘符信息

## 快速开始

### 下载预编译版本

从 [Releases](https://github.com/Everett406/linux-to-go/releases) 页面下载最新版本的安装程序。

### 从源码运行

```bash
# 1. 克隆仓库
git clone https://github.com/Everett406/linux-to-go.git
cd linux-to-go

# 2. 安装依赖
npm install

# 3. 开发模式运行
npm run dev

# 4. 打包构建
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## 使用说明

### 制作 Linux To Go

1. **插入 U 盘/移动硬盘** — 建议容量 16GB 以上
2. **点击"刷新设备列表"** — 程序自动检测 USB 设备
3. **选择目标设备** — 确认容量足够（建议大于 ISO 大小 + 持久化大小 + 1GB）
4. **选择 Ubuntu 版本** — 在线下载最新版本，或使用本地 ISO 文件
5. **配置持久化**（可选）— 设置持久化分区大小，保留数据和设置
6. **点击"开始制作"** — 自动完成所有步骤

### 启动 Linux To Go

1. 将制作好的 U 盘插入目标电脑
2. 开机时按 **F12**（或 **F2/DEL/Esc**，因主板而异）进入启动菜单
3. 选择从 U 盘启动
4. 在 Ventoy 菜单中选择 Ubuntu 启动

## 系统要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 10/11 |
| 权限 | 管理员权限（Ventoy 安装需要）|
| U 盘容量 | 建议 16GB 以上 |
| 网络 | 下载 ISO 和 Ventoy 时需要 |

## 技术架构

```
Electron + Node.js
├── src/main/        # 主进程（Electron 主窗口、系统调用）
│   ├── main.js      # 主入口，IPC 通信
│   └── preload.js   # 安全桥接 API
├── src/renderer/    # 渲染进程（UI 界面）
│   ├── index.html   # 主页面
│   ├── app.js       # 前端逻辑
│   └── style.css    # 样式
├── src/core/        # 核心逻辑
│   ├── ventoy.js    # Ventoy 管理
│   ├── usb.js       # USB 设备管理
│   └── download.js  # 下载管理
└── assets/          # 资源文件
```

## 持久化说明

启用持久化后，以下数据会被保留：
- 📄 用户文件和文档
- 📦 安装的软件和包（通过 `apt install`）
- ⚙️ 系统设置和配置
- 🔖 浏览器书签和密码
- 📶 WiFi 密码（可选）

## 常见问题

**Q: 为什么需要管理员权限？**
> A: 写入启动扇区和格式化磁盘需要系统管理员权限。

**Q: 支持哪些 Ubuntu 版本？**
> A: 支持 Ubuntu 22.04 LTS、24.04 LTS、24.10 等，也可以自选本地 ISO。

**Q: 可以在 Mac 上使用吗？**
> A: 可以制作启动盘，但 Ventoy 对 Mac 硬件支持有限。

**Q: 持久化分区最大支持多大？**
> A: Ventoy 使用 FAT32/exFAT 格式，持久化文件无 4GB 限制。

**Q: 制作过程中可以取消吗？**
> A: 可以，点击取消按钮会终止当前操作。

**Q: 同一个 U 盘可以装多个系统吗？**
> A: 可以！Ventoy 支持多 ISO，你可以复制多个 Linux 发行版的 ISO 到 U 盘。

## 项目结构

```
linux-to-go/
├── src/
│   ├── main/
│   │   ├── main.js        # Electron 主进程
│   │   └── preload.js     # 安全 API 桥接
│   ├── renderer/
│   │   ├── index.html     # UI 页面
│   │   ├── app.js         # 前端逻辑
│   │   └── style.css      # 样式表
│   └── core/
│       ├── ventoy.js      # Ventoy 管理
│       ├── usb.js         # USB 设备检测
│       └── download.js    # 下载管理器
├── scripts/
│   └── push-to-github.js  # GitHub 推送脚本
├── assets/                # 图标资源
├── package.json
├── README.md
└── .gitignore
```

## 开发指南

### 添加新的 Ubuntu 版本

在 `src/main/main.js` 中编辑 `UBUNTU_VERSIONS`：

```javascript
const UBUNTU_VERSIONS = {
  '25.04': {
    url: 'https://releases.ubuntu.com/25.04/ubuntu-25.04-desktop-amd64.iso',
    size: 5500000000,
    name: 'ubuntu-25.04-desktop-amd64.iso'
  },
  // ...
};
```

### 自定义界面主题

编辑 `src/renderer/style.css` 中的 CSS 变量：

```css
:root {
  --primary: #e95420;      /* Ubuntu 橙色 */
  --secondary: #772953;    /* Ubuntu 紫色 */
  --bg: #f7f7f7;
  --card-bg: #fff;
  --text: #333;
}
```

## 待办事项

- [ ] 添加更多 Linux 发行版支持（Debian、Fedora 等）
- [ ] 支持创建持久化分区（而非配置文件方式）
- [ ] 添加 ISO 校验和验证
- [ ] 支持断点续传下载
- [ ] 添加多国语言支持
- [ ] 创建 GitHub Actions 自动构建

## 许可证

[MIT License](LICENSE)

## 致谢

- [Ventoy](https://github.com/ventoy/Ventoy) — 开源多系统启动工具
- [Ubuntu](https://ubuntu.com/) — 优秀的 Linux 发行版
- [Electron](https://www.electronjs.org/) — 跨平台桌面应用框架
