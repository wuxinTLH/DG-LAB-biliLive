const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");
const { ConnectionManager } = require("./connectionManager");
const { MessageHandler } = require("./messageHandler");

let connManager;
const heartbeatTimers = new Map();
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || "60000");

/**
 * 每个连接都有角色：
 *   终端（第三方控制器，即本应用前端）：连上后收到 targetId 消息，等待 APP 扫码
 *   APP：扫码后连接，URL path 携带终端 clientId，发送 bind{message:"DGLAB"} 完成配对
 *
 * 区分方式：URL path 是否带有已注册的终端 clientId
 */
function createDGLabWSServer(port) {
  const wss = new WebSocket.Server({ port });
  connManager = new ConnectionManager();
  const msgHandler = new MessageHandler(connManager);

  wss.on("connection", (ws, req) => {
    const urlPath = (req.url || "").replace(/^\//, "").split("?")[0].trim();
    const clientId = uuidv4();
    connManager.register(clientId, ws);

    // 判断是否为 APP 扫码连接（path = 终端clientId）
    const isAppConnection = urlPath && connManager.exists(urlPath);

    if (isAppConnection) {
      // APP 连接：记录意图目标，等待 APP 发 bind{DGLAB}
      connManager.setIntendedTarget(clientId, urlPath);
      logger.info(`[WS] APP连接 clientId=${clientId} → 目标终端=${urlPath}`);
    } else {
      logger.info(`[WS] 终端连接 clientId=${clientId}`);
    }

    // 统一下发 clientId（终端和APP都需要知道自己的 ID）
    send(ws, { type: "bind", clientId, targetId: "", message: "targetId" });

    // 心跳
    const hbTimer = setInterval(() => {
      const partner = connManager.getPartner(clientId);
      if (partner) {
        send(ws, {
          type: "heartbeat",
          clientId,
          targetId: partner,
          message: "200",
        });
      }
    }, HEARTBEAT_INTERVAL);
    heartbeatTimers.set(clientId, hbTimer);

    ws.on("message", (raw) => {
      const str = raw.toString();
      let data;
      try {
        data = JSON.parse(str);
      } catch {
        send(ws, { type: "error", clientId, targetId: "", message: "403" });
        return;
      }
      if (str.length > 4096) {
        send(ws, { type: "error", clientId, targetId: "", message: "405" });
        return;
      }

      // 根据角色分发：如果是已配对的 APP，走 handleFromApp
      const partner = connManager.getPartner(clientId);
      const dgController = require("./controller");
      if (partner && dgController.appClientId === clientId) {
        // 这是 APP 发来的消息
        msgHandler.handleFromApp(clientId, ws, data);
      } else {
        // 这是终端（或待配对的 APP）发来的消息
        msgHandler.handle(clientId, ws, data);
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeatTimers.get(clientId));
      heartbeatTimers.delete(clientId);

      const partner = connManager.getPartner(clientId);
      if (partner) {
        const partnerWs = connManager.getWs(partner);
        if (partnerWs) {
          send(partnerWs, {
            type: "break",
            clientId,
            targetId: partner,
            message: "209",
          });
        }
      }

      // APP 断开时清除控制器连接
      const dgController = require("./controller");
      if (dgController.appClientId === clientId) {
        dgController.clearConnection();
        logger.info(`[CTRL] APP 断开，控制器已清除`);
      }

      connManager.unregister(clientId);
      logger.info(`[WS] 断开 clientId=${clientId}`);
    });

    ws.on("error", (err) => {
      logger.error(`[WS] 错误 clientId=${clientId}`, err.message);
    });
  });

  wss._connManager = connManager;
  global.__connManager = connManager;
  logger.info(`[DGLAB] WebSocket 服务已启动，端口 ${port}`);
  return wss;
}

function send(ws, obj) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  } catch (e) {
    logger.error("[WS] send error", e.message);
  }
}

module.exports = { createDGLabWSServer };
