const WebSocket = require("ws");
const logger = require("../utils/logger");
const { WAVE_PRESETS } = require("./wavePresets");

/**
 * DG-LAB 控制器：向已配对的 APP 发送强度/波形指令
 *
 * 消息路径：controller → APP 的 ws（直接发送 APP 协议格式）
 *
 * APP 能理解的消息格式：
 *   强度减少：{ type:'msg', message: 'strength-<ch>+0+1' }
 *   强度增加：{ type:'msg', message: 'strength-<ch>+1+1' }
 *   强度设值：{ type:'msg', message: 'strength-<ch>+2+<val>' }
 *   波形发送：{ type:'msg', message: 'pulse-<ch>:[...]' }
 *   清空队列：{ type:'msg', message: 'clear-<ch>' }
 */
class DGLabController {
  constructor() {
    /** @type {string|null} 已配对的 APP clientId */
    this.appClientId = null;
    /** @type {string|null} 我们自己的 clientId（前端） */
    this.myClientId = null;
    /** @type {WebSocket|null} APP 的 WebSocket 连接 */
    this.appWs = null;
    /** @type {import('./connectionManager').ConnectionManager|null} */
    this._connManager = null;
    this._waveTimers = new Map();
    // 当前强度状态（从 APP 回传同步）
    this.state = { strengthA: 0, strengthB: 0, limitA: 200, limitB: 200 };
  }

  setConnection(myClientId, appClientId, connManager) {
    this.myClientId = myClientId;
    this.appClientId = appClientId;
    this._connManager = connManager;
    this.appWs = connManager.getWs(appClientId);
    logger.info(`[CTRL] 控制器就绪 my=${myClientId} app=${appClientId}`);
  }

  updateState(strengthA, strengthB, limitA, limitB) {
    this.state = { strengthA, strengthB, limitA, limitB };
  }

  clearConnection() {
    this.appClientId = null;
    this.myClientId = null;
    this.appWs = null;
    this._clearAllTimers();
  }

  isReady() {
    // 动态从 connManager 拿最新的 appWs，防止 ws 对象失效
    if (this._connManager && this.appClientId) {
      this.appWs = this._connManager.getWs(this.appClientId);
    }
    return !!(
      this.appClientId &&
      this.appWs &&
      this.appWs.readyState === WebSocket.OPEN
    );
  }

  /** 强度减少（发给 APP） */
  decreaseStrength(channel) {
    const ch = this._chNum(channel);
    this._sendToApp(`strength-${ch}+0+1`);
  }

  /** 强度增加（发给 APP） */
  increaseStrength(channel) {
    const ch = this._chNum(channel);
    this._sendToApp(`strength-${ch}+1+1`);
  }

  /** 强度设为指定值 0~200（发给 APP） */
  setStrength(channel, value) {
    const ch = this._chNum(channel);
    const v = Math.max(0, Math.min(200, value));
    this._sendToApp(`strength-${ch}+2+${v}`);
  }

  /** 清空通道波形队列 */
  clearChannel(channel) {
    const ch = this._chNum(channel);
    this._sendToApp(`clear-${ch}`);
  }

  /** 发送波形数组 */
  sendPulse(channel, waves, duration = 5) {
    if (!waves || waves.length === 0) return;
    const ch =
      typeof channel === "string" ? channel : channel === 1 ? "A" : "B";
    const timerKey = `${ch}_wave`;
    const totalMs = duration * 1000;
    const startTime = Date.now();
    let index = 0;

    if (this._waveTimers.has(timerKey)) {
      clearInterval(this._waveTimers.get(timerKey));
    }

    const timer = setInterval(() => {
      if (!this.isReady() || Date.now() - startTime >= totalMs) {
        clearInterval(timer);
        this._waveTimers.delete(timerKey);
        return;
      }
      const batch = [];
      for (let i = 0; i < 4; i++) {
        batch.push(waves[index % waves.length]);
        index++;
      }
      this._sendToApp(`pulse-${ch}:${JSON.stringify(batch)}`);
    }, 100);

    this._waveTimers.set(timerKey, timer);
  }

  /** 发送预设波形 */
  sendPreset(channel, presetName, duration = 5) {
    const waves = WAVE_PRESETS[presetName] || WAVE_PRESETS.rhythm;
    this.sendPulse(channel, waves, duration);
  }

  /** 执行规则动作 */
  executeAction(action) {
    if (!this.isReady()) {
      logger.warn("[CTRL] 执行动作失败：APP 未连接");
      return;
    }
    const { type, channel, strengthA, strengthB, duration, wavePreset } =
      action;

    if (type === "pulse") {
      if (strengthA !== undefined) this.setStrength(1, strengthA);
      if (strengthB !== undefined) this.setStrength(2, strengthB);
      if (wavePreset)
        this.sendPreset(channel || "A", wavePreset, duration || 5);
    } else if (type === "setStrength") {
      if (strengthA !== undefined) this.setStrength(1, strengthA);
      if (strengthB !== undefined) this.setStrength(2, strengthB);
    } else if (type === "clear") {
      this.clearChannel("A");
      this.clearChannel("B");
    }
  }

  // ── 内部工具 ──

  /** 将 channel 参数统一转为数字 1/2 */
  _chNum(channel) {
    if (channel === "A" || channel === 1) return 1;
    if (channel === "B" || channel === 2) return 2;
    return 1;
  }

  /** 直接向 APP 的 ws 发送 msg 类型消息 */
  _sendToApp(message) {
    if (!this.isReady()) {
      logger.warn(`[CTRL] 无法发送，APP 未连接: ${message}`);
      return;
    }
    const payload = {
      type: "msg",
      clientId: this.myClientId,
      targetId: this.appClientId,
      message,
    };
    try {
      const str = JSON.stringify(payload);
      if (str.length > 1950) {
        logger.warn("[CTRL] 消息过长，跳过");
        return;
      }
      this.appWs.send(str);
      logger.info(`[CTRL] → APP: ${message}`);
    } catch (e) {
      logger.error("[CTRL] 发送失败", e.message);
    }
  }

  _clearAllTimers() {
    for (const t of this._waveTimers.values()) clearInterval(t);
    this._waveTimers.clear();
  }
}

const controller = new DGLabController();
module.exports = controller;
