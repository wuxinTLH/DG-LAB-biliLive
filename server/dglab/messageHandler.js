const WebSocket = require("ws");
const logger = require("../utils/logger");

/**
 * 消息处理器：处理前端 → 服务端消息，并转发给 APP
 *
 * 前端消息类型：
 *   type 1  → 强度减少
 *   type 2  → 强度增加
 *   type 3  → 强度设为指定值
 *   type 4  → 直接转发 APP 指令
 *   type "clientMsg" → 发送波形
 *   type "bind"      → APP 绑定请求
 */
class MessageHandler {
  constructor(connManager) {
    this.cm = connManager;
    /** @type {Map<string, NodeJS.Timeout>} 波形定时器 */
    this._waveTimers = new Map();
  }

  handle(clientId, ws, data) {
    const { type, targetId, message, channel, strength, time } = data;

    // ── APP 端发来的 bind 请求 ──
    if (type === "bind") {
      this._handleBind(clientId, ws, data);
      return;
    }

    // ── 已配对验证 ──
    const partner = this.cm.getPartner(clientId);
    if (!partner && type !== "bind") {
      // 未配对时忽略控制消息（APP 可能还未扫码）
      return;
    }

    const partnerWs = this.cm.getWs(partner);
    if (!partnerWs) {
      this._send(ws, {
        type: "error",
        clientId,
        targetId: partner || "",
        message: "404",
      });
      return;
    }

    switch (type) {
      case 1: // 强度减少
        this._sendToApp(
          partnerWs,
          clientId,
          partner,
          `strength-${channel}+0+1`,
        );
        break;

      case 2: // 强度增加
        this._sendToApp(
          partnerWs,
          clientId,
          partner,
          `strength-${channel}+1+1`,
        );
        break;

      case 3: // 强度设为指定值
        if (strength === undefined) {
          this._send(ws, {
            type: "error",
            clientId,
            targetId: partner,
            message: "406",
          });
          return;
        }
        this._sendToApp(
          partnerWs,
          clientId,
          partner,
          `strength-${channel}+2+${strength}`,
        );
        break;

      case 4: // 直接转发
        if (!message) return;
        this._sendToApp(partnerWs, clientId, partner, message);
        break;

      case "clientMsg": // 波形发送
        if (!channel) {
          this._send(ws, {
            type: "error",
            clientId,
            targetId: partner,
            message: "406",
          });
          return;
        }
        this._handleWave(clientId, ws, partnerWs, partner, data);
        break;

      case "msg": // APP → 前端 的消息，直接转发（如 APP 回传强度）
        // 同步强度状态到控制器
        if (typeof message === "string" && message.startsWith("strength-")) {
          // 格式: strength-<ch>+<sA>+<sB>  或  strength-<ch>+<mode>+<val>
          // APP 回传格式: strength-<ch>+<currentA>+<currentB>
          const parts = message.replace("strength-", "").split("+");
          if (parts.length >= 3) {
            const sA = parseInt(parts[1]);
            const sB = parseInt(parts[2]);
            const dgController = require("./controller");
            if (!isNaN(sA) && !isNaN(sB)) {
              dgController.updateState(
                sA,
                sB,
                dgController.state.limitA,
                dgController.state.limitB,
              );
            }
          }
        }
        this._send(ws, { ...data, clientId: partner, targetId: clientId });
        break;

      default:
        logger.warn(`[MSG] 未知消息类型: ${type}`);
    }
  }

  _handleBind(clientId, ws, data) {
    const { targetId: reqTargetId } = data;

    // APP 扫码连接时，URL path 里已存了真正要配对的目标（前端 clientId）
    // 优先使用 intendedTarget，其次才用消息里的 targetId
    const intendedTarget = this.cm.getIntendedTarget(clientId);
    const targetId = intendedTarget || reqTargetId;

    logger.info(
      `[BIND] 请求配对: clientId=${clientId} reqTargetId=${reqTargetId} intendedTarget=${intendedTarget} → targetId=${targetId}`,
    );

    // 验证目标是否存在
    if (!targetId || !this.cm.exists(targetId)) {
      this._send(ws, {
        type: "bind",
        clientId,
        targetId: targetId || "",
        message: "401",
      });
      logger.warn(`[BIND] 目标不存在: ${targetId}`);
      return;
    }

    // 目标是否已被绑定
    if (this.cm.isPaired(targetId)) {
      this._send(ws, { type: "bind", clientId, targetId, message: "400" });
      logger.warn(`[BIND] 目标已配对: ${targetId}`);
      return;
    }

    // 建立配对
    this.cm.pair(clientId, targetId);

    // 通知双方
    const targetWs = this.cm.getWs(targetId);
    this._send(ws, { type: "bind", clientId, targetId, message: "200" });
    this._send(targetWs, { type: "bind", clientId, targetId, message: "200" });

    logger.info(`[BIND] 配对成功: ${clientId} ↔ ${targetId}`);
  }

  _handleWave(clientId, ws, partnerWs, partnerId, data) {
    const { channel, time = 5, message } = data;

    // 解析波形数组
    let waves = [];
    try {
      // message 格式：`A:["hex1","hex2",...]`
      const jsonPart = message.includes(":")
        ? message.split(":").slice(1).join(":")
        : message;
      waves = JSON.parse(jsonPart);
    } catch {
      logger.warn(`[WAVE] 波形数据解析失败: ${message}`);
      return;
    }

    if (!Array.isArray(waves) || waves.length === 0) return;

    const timerKey = `${clientId}_${channel}`;
    const punishmentRate = parseInt(process.env.DEFAULT_PUNISHMENT_TIME || "1");
    const intervalMs = Math.max(100, Math.floor(1000 / punishmentRate));
    let index = 0;
    const totalMs = time * 1000;
    const startTime = Date.now();

    // 清除旧定时器
    if (this._waveTimers.has(timerKey)) {
      clearInterval(this._waveTimers.get(timerKey));
    }

    const timer = setInterval(() => {
      if (Date.now() - startTime >= totalMs) {
        clearInterval(timer);
        this._waveTimers.delete(timerKey);
        return;
      }

      // 每次取最多4条波形
      const batch = [];
      for (let i = 0; i < 4; i++) {
        batch.push(waves[index % waves.length]);
        index++;
      }

      const pulseMsg = `pulse-${channel}:${JSON.stringify(batch)}`;
      this._sendToApp(partnerWs, clientId, partnerId, pulseMsg);
    }, intervalMs);

    this._waveTimers.set(timerKey, timer);
  }

  _sendToApp(partnerWs, clientId, targetId, message) {
    this._send(partnerWs, { type: "msg", clientId, targetId, message });
  }

  _send(ws, obj) {
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
      }
    } catch (e) {
      logger.error("[MSG] send error", e.message);
    }
  }
}

module.exports = { MessageHandler };
