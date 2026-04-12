/**
 * B站直播连接器
 *
 * 完整流程（无需开放平台密钥）：
 *
 *   Step 1  身份码 → 真实 room_id
 *           GET https://api.live.bilibili.com/room/v1/Room/room_init?id={code}
 *           （身份码本质是直播间号的别名，该接口同时接受短号/身份码/真实房间号）
 *
 *   Step 2  room_id → WSS 地址 + token
 *           GET https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo?id={room_id}
 *           两个接口均无需登录鉴权，无需任何密钥
 *
 *   Step 3  用 bilibili-live-ws 的 KeepLiveWS 建立长连接
 *           传入 key（即 token）、uid=0（游客）、buvid（可选）
 *           KeepLiveWS 内部会自动处理心跳和断线重连
 *
 * 优点：
 *   - 不依赖开放平台 AccessKey/Secret
 *   - 用户只需提供主播身份码（或直播间号）
 *   - 与咩播、blivechat 等主流弹幕姬方案一致
 */

const { EventEmitter } = require("events");
const { KeepLiveWS } = require("bilibili-live-ws");
const https = require("https");
const logger = require("../utils/logger");

class BilibiliConnector extends EventEmitter {
  constructor() {
    super();
    this._live = null;
    this._roomId = null;
    this._running = false;
  }

  // ══════════════════════════════════════
  //  公开接口
  // ══════════════════════════════════════

  /**
   * 使用主播身份码（或直播间号）连接
   * @param {string|number} code  身份码 / 直播间短号 / 真实房间号，均可
   */
  async connect(code) {
    if (this._running) this.disconnect();

    logger.info(`[BILI] 开始连接，输入：${code}`);

    // ── Step 1：解析真实 room_id ──
    let roomId;
    try {
      // roomId = await this._getRoomId(code);
      roomId = await this._getRoomId(code);
    } catch (e) {
      const msg = `解析房间号失败：${e.message}`;
      logger.error("[BILI] " + msg);
      this.emit("error", { message: msg });
      return;
    }
    this._roomId = roomId;
    logger.info(`[BILI] 真实 room_id = ${roomId}`);

    // ── Step 2：获取 WSS 地址和 token ──
    let danmuInfo;
    try {
      danmuInfo = await this._getDanmuInfo(roomId);
    } catch (e) {
      const msg = `获取弹幕服务器信息失败：${e.message}`;
      logger.error("[BILI] " + msg);
      this.emit("error", { message: msg });
      return;
    }

    const { token, host, wssPort } = danmuInfo;
    const address = `wss://${host}:${wssPort}/sub`;
    logger.info(`[BILI] 弹幕服务器：${address}`);

    // ── Step 3：建立 WebSocket 长连接 ──
    this._running = true;
    try {
      // bilibili-live-ws v6 支持传入 key、uid、address 覆盖默认行为
      this._live = new KeepLiveWS(roomId, {
        key: token,
        uid: 0, // 0 = 游客，可收到弹幕（用户名可能打码）
        // address 可选；不传则由库自己查，传则直接连
        // 这里不传 address，让库走自己的逻辑保证稳定性
        // 如需强制指定服务器可取消注释：
        // address,
      });
    } catch (e) {
      logger.error("[BILI] KeepLiveWS 创建失败：", e.message);
      this.emit("error", { message: e.message });
      this._running = false;
      return;
    }

    this._bindEvents();
  }

  disconnect() {
    if (this._live) {
      try {
        this._live.close();
      } catch {}
      this._live = null;
    }
    this._running = false;
    this._roomId = null;
    logger.info("[BILI] 已断开");
  }

  isConnected() {
    return this._running && this._live !== null;
  }
  getRoomId() {
    return this._roomId;
  }

  // ══════════════════════════════════════
  //  事件绑定
  // ══════════════════════════════════════

  _bindEvents() {
    const live = this._live;

    live.on("open", () => {
      logger.info(`[BILI] 已连接直播间 ${this._roomId}`);
      this.emit("connected");
    });

    live.on("close", () => {
      // KeepLiveWS 会自动重连，close 事件表示本次连接断开，不代表永久断开
      logger.warn(`[BILI] 直播间连接断开（自动重连中）`);
      this.emit("disconnected");
    });

    live.on("error", (e) => {
      logger.error("[BILI] WS 错误：", e?.message);
      this.emit("error", { message: e?.message || "未知错误" });
    });

    // 弹幕
    live.on("DANMU_MSG", (data) => {
      try {
        const info = data.info;
        this.emit("danmaku", { uname: info[2][1], message: info[1] });
      } catch {}
    });

    // 礼物
    live.on("SEND_GIFT", (data) => {
      try {
        const d = data.data;
        this.emit("gift", {
          uname: d.uname,
          giftName: d.giftName,
          giftId: d.giftId,
          num: d.num,
          coinType: d.coin_type, // 'gold' | 'silver'
          totalCoin: d.total_coin,
        });
        logger.info(`[BILI] 礼物: ${d.uname} → ${d.giftName} ×${d.num}`);
      } catch {}
    });

    // 上舰/提督/总督
    live.on("GUARD_BUY", (data) => {
      try {
        const d = data.data;
        const names = { 1: "总督", 2: "提督", 3: "舰长" };
        this.emit("guard", {
          uname: d.username,
          guardLevel: d.guard_level,
          num: d.num,
          price: d.price,
        });
        logger.info(
          `[BILI] 上舰: ${d.username} → ${names[d.guard_level]} ×${d.num}`,
        );
      } catch {}
    });

    // 醒目留言 SC
    live.on("SUPER_CHAT_MESSAGE", (data) => {
      try {
        const d = data.data;
        this.emit("superchat", {
          uname: d.user_info?.uname,
          message: d.message,
          price: d.price,
        });
        logger.info(
          `[BILI] SC: ${d.user_info?.uname} ¥${d.price}: ${d.message}`,
        );
      } catch {}
    });

    // 在线人数
    live.on("ONLINE_RANK_COUNT", (data) => {
      this.emit("online", { count: data?.data?.count || 0 });
    });

    live.on("LIVE", () => this.emit("liveStart"));
    live.on("PREPARING", () => this.emit("liveEnd"));
  }

  // ══════════════════════════════════════
  //  B站公开 API（无需鉴权）
  // ══════════════════════════════════════

  /**
   * 通过房间号/身份码获取真实 room_id
   * 接口：room/v1/Room/room_init  无需鉴权
   */
  _getRoomId(id) {
    return this._get(
      `https://api.live.bilibili.com/room/v1/Room/room_init?id=${encodeURIComponent(id)}`,
    ).then((json) => {
      if (json.code !== 0)
        throw new Error(`code=${json.code} msg=${json.message}`);
      return json.data.room_id;
    });
  }

  /**
   * 通过真实 room_id 获取弹幕服务器地址和 token
   * 接口：xlive/web-room/v1/index/getDanmuInfo  无需鉴权（可选 SESSDATA）
   * 返回 { token, host, wssPort }
   */
  _getDanmuInfo(roomId) {
    return this._get(
      `https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo?id=${roomId}`,
    ).then((json) => {
      if (json.code !== 0)
        throw new Error(`code=${json.code} msg=${json.message}`);
      const d = json.data;
      const token = d.token;
      // 优先选第一个 host_list 条目
      const hostInfo = (d.host_list && d.host_list[0]) || {
        host: "broadcastlv.chat.bilibili.com",
        wss_port: 2245,
      };
      return {
        token,
        host: hostInfo.host,
        wssPort: hostInfo.wss_port,
      };
    });
  }

  /**
   * 简单 HTTPS GET，返回解析后的 JSON
   */
  _get(url) {
    return new Promise((resolve, reject) => {
      const opts = {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://live.bilibili.com/",
        },
      };
      https
        .get(url, opts, (res) => {
          let raw = "";
          res.on("data", (c) => {
            raw += c;
          });
          res.on("end", () => {
            try {
              resolve(JSON.parse(raw));
            } catch {
              reject(new Error(`JSON 解析失败: ${raw.slice(0, 200)}`));
            }
          });
        })
        .on("error", reject);
    });
  }
}

const connector = new BilibiliConnector();
module.exports = connector;
