# ⚡ DG-BiLive
## 全称 DG-LAB BiliLive
**B站直播间 × 郊狼 DG-LAB 联动控制器**
**Version : 0.0.1v-test**

让观众的礼物、上舰、SC 直接驱动郊狼设备，打造全新的直播互动体验。

![Electron](https://img.shields.io/badge/Electron-29+-blue?logo=electron)
![Node](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

---

## ✨ 功能特性

- 🔌 **B站直播间无密钥连接** — 只需直播间房间号，即可监听礼物、上舰、SC、弹幕事件
- ⚡ **郊狼 DG-LAB 3.0 联动** — 通过 WebSocket 与郊狼 APP 配对，支持强度控制和波形发送
- 🎮 **多模式切换** — 内置温柔、标准、极端、弹幕互动、双通道五大预设模式，一键应用
- ✏️ **自定义模式** — 自由配置每个触发事件的强度、波形、持续时间，可另存为专属预设
- ⚙️ **灵活规则引擎** — 支持按礼物金额、上舰等级、SC 价格、弹幕关键词灵活配置触发规则
- 📺 **OBS 网页捕获支持** — 内置 OBS 覆盖层页面，实时展示通道强度和直播事件，4 套主题可选
- 🎛️ **手动控制面板** — 实时调整 A/B 双通道强度，支持 6 种波形预设手动触发
- 📋 **事件日志** — 实时记录直播间事件及设备动作，便于调试和回溯

---

## 🖥️ 截图预览

> 应用使用蓝粉紫可爱风格 UI，支持 Windows 自定义标题栏（含关闭/最小化/最大化按钮）

---

## 📦 安装与运行

### 环境要求

- Node.js 18+
- 郊狼 DG-LAB APP（iOS / Android）
- B站直播间（任意公开房间）

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/wuxinTLH/DG-LAB-biliLive.git
cd DG-LAB-biliLive

# 安装依赖
npm install

# 测试启动
npm run start

# 开发模式启动
npm run dev
```

### 打包构建

```bash
# 构建为可执行文件（Windows: .exe, macOS: .dmg, Linux: .AppImage）
npm run build
```

---

## 🚀 使用说明

### 1. 连接 B站直播间

1. 在「连接」页面输入直播间数字房间号（如 `1945098`）
2. 点击「连接」按钮
3. 可选填写 `SESSDATA` Cookie 以显示弹幕用户真实名称

### 2. 配对郊狼设备

1. 填写本机 IP 地址（外网需填公网 IP 或内网穿透地址）
2. 点击「生成配对二维码」
3. 打开郊狼 APP，扫描二维码完成配对

### 3. 选择触发模式

前往「模式」页，选择预设模式或自定义：

| 模式       | 说明                                 |
| ---------- | ------------------------------------ |
| 💕 温柔模式 | 低强度轻柔反馈，适合新手或长时间直播 |
| ⚡ 标准模式 | 中等强度节奏感反馈，适合日常互动直播 |
| 🔥 极端模式 | 高强度激烈反馈，适合勇于挑战的主播   |
| 💬 弹幕互动 | 以弹幕关键词触发为主，让观众直接控制 |
| 🎛️ 双通道   | A/B 双通道分别响应不同事件           |
| ✏️ 自定义   | 完全自由配置，支持保存为专属预设     |

### 4. 配置 OBS 覆盖层

1. 前往「OBS」页面，复制浏览器源 URL
2. 在 OBS 中：来源 → `+` → 浏览器 → 粘贴 URL
3. 推荐尺寸：宽 `400px`，高 `220px`，勾选透明背景
4. 在 OBS 页可选择 4 种主题：默认粉、暗黑、霓虹、极简

---

## ⚙️ 高级配置

### 环境变量

在项目根目录创建 `.env` 文件：

```env
# 郊狼 WebSocket 端口（默认 9999）
DGLAB_WS_PORT=9999

# HTTP API 端口（默认 9998）
APP_API_PORT=9998

# 可选(建议填写)：B站 SESSDATA（也可在 UI 中动态填写）
BILI_SESSDATA=your_sessdata_here
如果没有填写SESSDATA，则无法显示弹幕或礼物的用户真实名称
温馨提醒：SESSDATA 是 B站用户登录凭证，请勿泄露给他人
```

### API 接口

应用内置 HTTP API（默认 `http://localhost:9998/api`）：

| 方法   | 路径               | 说明                                                      |
| ------ | ------------------ | --------------------------------------------------------- |
| `GET`  | `/status`          | 获取全局状态                                              |
| `POST` | `/bili/connect`    | 连接直播间                                                |
| `POST` | `/bili/disconnect` | 断开直播间                                                |
| `GET`  | `/rules`           | 获取规则列表                                              |
| `PUT`  | `/rules`           | 更新规则列表                                              |
| `POST` | `/dglab/strength`  | 设置通道强度                                              |
| `POST` | `/dglab/pulse`     | 发送波形预设                                              |
| `GET`  | `/events`          | 获取事件日志                                              |
| `GET`  | `/obs`             | OBS 覆盖层页面（支持 `?theme=default/dark/neon/minimal`） |

---

## 🌊 波形预设

| 预设   | 说明                     |
| ------ | ------------------------ |
| 💤 轻柔 | 低频低强度，适合入门     |
| 🎵 节奏 | 中频节律感，适合礼物触发 |
| 🌊 波浪 | 渐强渐弱，平滑过渡       |
| 💥 脉冲 | 间歇式强烈刺激           |
| ⚡ 强烈 | 高强度节律               |
| 🔥 极端 | 最高强度，慎用           |

---

## 📂 项目结构

```
DG-LAB-biliLive/
├── src/
│   ├── main/          # Electron 主进程
│   ├── preload/       # 预加载脚本（IPC 桥接）
│   └── renderer/      # 前端 UI（HTML + CSS + JS）
├── server/
│   ├── api.js         # HTTP API 路由（含 OBS 覆盖层）
│   ├── bilibili/      # B站直播连接 & 规则引擎
│   ├── dglab/         # 郊狼控制器 & 波形预设
│   └── utils/         # 日志工具
└── package.json
```

---

## 🔧 技术栈

- **前端**：原生 HTML / CSS / JavaScript（无框架）
- **桌面**：Electron 29
- **服务端**：Node.js + Express
- **B站连接**：[bilibili-live-ws](https://github.com/simon300000/bilibili-live-ws)
- **WebSocket**：ws
- **二维码**：qrcode

---

## ⚠️ 注意事项

1. 郊狼设备强度请从低档开始，逐步调整，注意人身安全
2. 极端模式强度较高，建议熟悉设备后再使用
3. SESSDATA 仅存于本机内存，不会上传至任何服务器
4. 使用外网连接时，请确保 WebSocket 端口已正确映射或使用内网穿透工具

---

## 📄 许可证

MIT License

二次开发或转载标注原作者信息(或仓库)即可

---

> 💕 如有问题或建议，欢迎提 Issue