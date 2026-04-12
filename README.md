# 🌸 Coyote Live

> B站直播 × 郊狼 DG-LAB 3.0 联动控制器
> 礼物、舰长、SC → 自动触发脉冲波形 ⚡

![UI Preview](docs/preview.png)

---

## ✨ 功能特性

- 🎥 **B站直播间实时监听** — 礼物、上舰（舰长/提督/总督）、醒目留言（SC）、弹幕
- ⚡ **郊狼 DG-LAB 3.0 控制** — 基于官方 Socket V2 WebSocket 协议
- 🌸 **可视化规则引擎** — 事件触发 → 强度设置 + 波形预设，可自由配置
- 📱 **二维码配对** — 扫码即连，无需手动填写地址
- 🎛️ **手动控制面板** — 滑块调强度，6 种波形一键发送
- 📋 **实时事件日志** — 所有触发事件与执行动作可追溯
- 🖥️ **Electron 桌面应用** — 单窗口，跨平台（Windows / macOS / Linux）

---

## 🚀 快速开始

### 环境要求

| 工具 | 版本要求 |
|------|---------|
| Node.js | ≥ 18.0 |
| npm | ≥ 9.0 |
| Git | 任意版本 |

### 1. 克隆项目

```bash
git clone https://github.com/你的用户名/coyote-live.git
cd coyote-live
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量（可选）

```bash
cp .env.example .env
# 根据需要修改端口等配置
```

### 4. 启动开发环境（单条命令）

```bash
npm start
# 或
npm run dev
```

> 此命令会同时启动：
> - **Node 后端服务**（端口 9998 API + 9999 WebSocket）
> - **Electron 前端窗口**（等待服务就绪后自动打开）

---

## 📁 项目结构

```
coyote-live/
├── .vscode/
│   ├── launch.json          # VSCode 调试配置（F5 一键启动）
│   ├── settings.json        # 编辑器设置
│   └── extensions.json      # 推荐插件
│
├── server/                  # Node.js 后端
│   ├── index.js             # 服务入口（启动 HTTP API + WS 服务）
│   ├── api.js               # HTTP REST API 路由
│   ├── bilibili/
│   │   ├── connector.js     # B站直播间 WebSocket 连接
│   │   └── ruleEngine.js    # 事件→动作规则引擎
│   ├── dglab/
│   │   ├── wsServer.js      # DG-LAB WebSocket 服务器
│   │   ├── connectionManager.js  # 连接与配对管理
│   │   ├── messageHandler.js     # 消息处理与协议转换
│   │   ├── controller.js         # 向APP发送指令的控制器
│   │   └── wavePresets.js        # 波形预设库
│   └── utils/
│       └── logger.js        # Winston 日志
│
├── src/
│   ├── main/
│   │   └── index.js         # Electron 主进程
│   ├── preload/
│   │   └── index.js         # Electron preload 桥接
│   └── renderer/
│       ├── index.html       # 主界面 HTML
│       ├── style.css        # 蓝粉白可爱风格 CSS
│       └── app.js           # 前端交互逻辑
│
├── .env.example             # 环境变量模板
├── package.json             # 依赖与脚本配置
└── README.md
```

---

## 🎮 使用方法

### 第一步：连接 B站直播间

1. 切换到「**连接**」页
2. 在「B站直播间」卡片中输入房间号
3. 点击「**连接**」

### 第二步：连接郊狼 APP

1. 确认「服务地址」填写正确（同局域网用 `localhost`，外网用公网 IP）
2. 点击「**📱 生成配对二维码**」
3. 打开郊狼 APP → SOCKET 功能 → 扫描二维码
4. 配对成功后顶部状态栏显示「郊狼 已连接 💕」

### 第三步：配置规则

1. 切换到「**规则**」页
2. 默认已预设舰长、SC、礼物等常见规则
3. 可通过开关单独启用/禁用每条规则
4. 修改后点击「**💾 保存**」

### 第四步：开始直播！

事件触发时，「**日志**」页会实时显示，郊狼会自动响应。

---

## 🛠️ VSCode 调试

打开项目后按 `F5`，在弹出的调试配置中选择：

| 配置名 | 说明 |
|--------|------|
| 🌸 启动完整应用 | 同时启动 Server + Electron（推荐） |
| 🔌 仅启动 Node 服务端 | 单独调试后端，支持断点 |
| ⚡ 仅启动 Electron | 单独启动前端窗口 |

---

## 📦 构建打包

```bash
# 构建当前平台安装包
npm run build

# 输出目录：dist/
# Windows → dist/*.exe (NSIS 安装器)
# macOS   → dist/*.dmg
# Linux   → dist/*.AppImage
```

---

## ⚙️ 环境变量说明

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DGLAB_WS_PORT` | `9999` | 郊狼 WebSocket 服务端口 |
| `APP_API_PORT` | `9998` | HTTP API 服务端口（供 Electron 调用） |
| `HEARTBEAT_INTERVAL` | `60000` | 心跳间隔（毫秒） |
| `DEFAULT_PUNISHMENT_TIME` | `1` | 波形发送频率（次/秒） |
| `DEFAULT_PUNISHMENT_DURATION` | `5` | 波形默认持续时长（秒） |
| `LOG_LEVEL` | `info` | 日志级别（debug/info/warn/error） |

---

## 🌸 波形预设说明

| 预设名 | 特征 | 适合场景 |
|--------|------|---------|
| `light` 💤 | 低频低强度，轻柔 | 弹幕、小额礼物 |
| `rhythm` 🎵 | 中频节律，有节奏感 | 普通礼物、舰长 |
| `wave` 🌊 | 渐强渐弱波浪 | SC |
| `pulse` 💥 | 间歇脉冲 | 提督 |
| `intense` ⚡ | 高强度连续 | 总督 |
| `extreme` 🔥 | 极高强度 | 特殊事件 |

---

## ⚠️ 安全说明

- 强度值范围 `0~200`，**请从低值（≤ 20）开始测试**
- 程序异常时会尝试将强度归零，但建议在 APP 内也设置上限
- 本项目仅供成年人个人娱乐使用
- 遵守 [DG-LAB 开源协议](https://github.com/DG-LAB-OPENSOURCE/DG-LAB-OPENSOURCE) 相关条款，**禁止商业用途**

---

## 🔧 常见问题

**Q: 二维码扫描后提示无法连接？**
> A: 确认手机和电脑在同一局域网，或将服务地址填写为电脑的局域网 IP（如 `192.168.1.x`）而非 `localhost`

**Q: B站连接后没有事件？**
> A: 确认直播间号正确，且直播间正在直播中；测试时可在直播间发一条弹幕验证

**Q: Electron 窗口打开但界面空白？**
> A: 通常是后端服务未启动。检查终端中 SERVER 日志是否有报错，确认 9998/9999 端口未被占用

**Q: 强度设置后郊狼没有反应？**
> A: 检查「连接」页顶部状态，确认「郊狼 APP」显示已配对；同时确认 APP 内强度上限不为 0

---

## 📮 技术支持

- DG-LAB 开源协议技术咨询 QQ：3849540080
- B站弹幕库：[bilibili-live-ws](https://github.com/simon300000/bilibili-live-ws)
- DG-LAB 开源仓库：[DG-LAB-OPENSOURCE](https://github.com/DG-LAB-OPENSOURCE/DG-LAB-OPENSOURCE)
