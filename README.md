# Linux To Go

将 Ubuntu 装入 U 盘/移动硬盘，即插即用！类似 Windows To Go 的 Linux 便携系统制作工具。

## 功能特性

- 一键制作 Linux To Go 启动盘
- 基于 [Ventoy](https://github.com/ventoy/Ventoy) 开源多系统启动方案
- 支持 Ubuntu 多个版本自选（默认 24.04 LTS）
- 支持持久化存储（保留文件、设置和安装的软件）
- 支持使用本地 ISO 文件
- 中文图形界面，操作简单
- 自动检测 USB 设备
- 跨平台（Windows/macOS/Linux）

## 使用方法

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式运行

```bash
npm run dev
```

### 3. 打包构建

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux

# 全部平台
npm run build
```

## 制作流程

1. **选择目标设备** — 插入 U 盘/移动硬盘，点击刷新检测
2. **选择 Ubuntu 版本** — 在线下载或选择本地 ISO
3. **配置持久化** — 设置持久化分区大小（可选）
4. **开始制作** — 自动完成 Ventoy 安装和 ISO 复制

## 系统要求

- Windows 10/11（管理员权限）
- U 盘/移动硬盘（建议 16GB 以上）
- 网络连接（下载 ISO 时需要）

## 启动方法

1. 将制作好的 U 盘插入目标电脑
2. 开机时按 **F12**（或 F2/DEL/Esc，因主板而异）进入启动菜单
3. 选择从 U 盘启动
4. 在 Ventoy 菜单中选择 Ubuntu 启动

## 技术架构

```
Electron + Node.js
├── src/main/      # 主进程（Electron 主窗口、系统调用）
├── src/renderer/  # 渲染进程（UI 界面）
├── src/core/      # 核心逻辑
│   ├── ventoy.js  # Ventoy 管理
│   ├── usb.js     # USB 设备管理
│   └── download.js # 下载管理
└── assets/        # 资源文件
```

## 持久化说明

启用持久化后，以下数据会被保留：
- 用户文件和文档
- 安装的软件和包
- 系统设置和配置
- 浏览器书签和密码
- WiFi 密码（可选）

## 常见问题

**Q: 为什么需要管理员权限？**
A: 写入启动扇区和格式化磁盘需要系统管理员权限。

**Q: 支持哪些 Ubuntu 版本？**
A: 支持 Ubuntu 22.04 LTS、24.04 LTS、24.10 等，也可以自选本地 ISO。

**Q: 可以在 Mac 上使用吗？**
A: 可以制作启动盘，但 Ventoy 对 Mac 硬件支持有限。

**Q: 持久化分区最大支持多大？**
A: FAT32 格式最大支持 4GB 的持久化文件，exFAT 无此限制。

## 许可证

MIT License

## 致谢

- [Ventoy](https://github.com/ventoy/Ventoy) — 开源多系统启动工具
- [Ubuntu](https://ubuntu.com/) — 优秀的 Linux 发行版
