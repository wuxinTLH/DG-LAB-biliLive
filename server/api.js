const { Router } = require("express");
const QRCode = require("qrcode");
const biliConnector = require("./bilibili/connector");
const ruleEngine = require("./bilibili/ruleEngine");
const dgController = require("./dglab/controller");
const logger = require("./utils/logger");

const eventLog = [];
const MAX_LOG = 100;

function pushEvent(type, data) {
  eventLog.unshift({ type, data, ts: Date.now() });
  if (eventLog.length > MAX_LOG) eventLog.pop();
  ruleEngine.process(type, data);
}

biliConnector.on("gift", (d) => pushEvent("gift", d));
biliConnector.on("guard", (d) => pushEvent("guard", d));
biliConnector.on("superchat", (d) => pushEvent("superchat", d));
biliConnector.on("danmaku", (d) => pushEvent("danmaku", d));
biliConnector.on("online", (d) => pushEvent("online", d));
biliConnector.on("connected", () => pushEvent("biliConnected", {}));
biliConnector.on("disconnected", () => pushEvent("biliDisconnected", {}));
biliConnector.on("error", (d) => pushEvent("biliError", d));

ruleEngine.on("action", (action, eventData, rule) => {
  logger.info(`[ACTION] 执行: ${rule.name}`, action);
  dgController.executeAction(action);
  pushEvent("dgAction", { rule: rule.name, action });
});

function createApiRouter() {
  const router = Router();

  // ── 状态 ──
  router.get("/status", (req, res) => {
    res.json({
      bili: {
        connected: biliConnector.isConnected(),
        roomId: biliConnector.getRoomId(),
      },
      dglab: {
        ready: dgController.isReady(),
        state: dgController.state,
        clientId: dgController.myClientId,
        appClientId: dgController.appClientId,
      },
      rules: {
        enabled: ruleEngine.enabled,
        count: ruleEngine.rules.length,
      },
    });
  });

  // ── B站连接（直播间号）──
  router.post("/bili/connect", async (req, res) => {
    const roomId = (req.body.roomId || req.body.room_id || req.body.code || "")
      .toString()
      .trim();
    if (!roomId || !/^\d+$/.test(roomId)) {
      return res.status(400).json({ error: "请传入数字直播间号（roomId）" });
    }
    try {
      await biliConnector.connect(roomId);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── SESSDATA 动态写入（运行时修改 process.env，无需重启）──
  router.post("/bili/sessdata", (req, res) => {
    const { sessdata } = req.body;
    process.env.BILI_SESSDATA = (sessdata || "").trim();
    logger.info(
      `[API] SESSDATA ${process.env.BILI_SESSDATA ? "已设置" : "已清除"}`,
    );
    res.json({ ok: true });
  });

  router.post("/bili/disconnect", (req, res) => {
    biliConnector.disconnect();
    res.json({ ok: true });
  });

  // ── 二维码 ──
  router.get("/qrcode", async (req, res) => {
    const { host, port, clientId } = req.query;
    if (!host || !clientId) return res.status(400).json({ error: "缺少参数" });
    const wsPort = port || process.env.DGLAB_WS_PORT || "9999";
    const wsUrl = `ws://${host}:${wsPort}/${clientId}`;
    const content = `https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#${wsUrl}`;
    try {
      const dataUrl = await QRCode.toDataURL(content, {
        width: 300,
        margin: 2,
      });
      res.json({ ok: true, dataUrl, qrContent: content, wsUrl });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── DG-LAB 手动控制 ──
  router.post("/dglab/strength", (req, res) => {
    const { channel, value, mode } = req.body;
    if (mode === "increase") dgController.increaseStrength(channel);
    else if (mode === "decrease") dgController.decreaseStrength(channel);
    else dgController.setStrength(channel, value);
    res.json({ ok: true });
  });

  router.post("/dglab/clear", (req, res) => {
    dgController.clearChannel("A");
    dgController.clearChannel("B");
    res.json({ ok: true });
  });

  router.post("/dglab/pulse", (req, res) => {
    const { channel, preset, duration } = req.body;
    dgController.sendPreset(channel || "A", preset || "rhythm", duration || 5);
    res.json({ ok: true });
  });

  // ── 规则 ──
  router.get("/rules", (req, res) => {
    res.json({ rules: ruleEngine.getRules(), enabled: ruleEngine.enabled });
  });

  router.put("/rules", (req, res) => {
    const { rules } = req.body;
    if (!Array.isArray(rules))
      return res.status(400).json({ error: "无效规则格式" });
    ruleEngine.updateRules(rules);
    res.json({ ok: true });
  });

  router.post("/rules/toggle", (req, res) => {
    ruleEngine.setEnabled(!!req.body.enabled);
    res.json({ ok: true, enabled: ruleEngine.enabled });
  });

  // ── 事件日志 ──
  router.get("/events", (req, res) => {
    const since = parseInt(req.query.since || "0");
    res.json({ events: eventLog.filter((e) => e.ts > since) });
  });

  // ── DG-LAB 配对注册 ──
  router.post("/dglab/register", (req, res) => {
    const { myClientId, appClientId } = req.body;
    const cm = global.__connManager;
    if (!cm) return res.status(500).json({ error: "服务未就绪" });
    const ws = cm.getWs(myClientId);
    if (!ws) return res.status(404).json({ error: "客户端不存在" });
    dgController.setConnection(myClientId, appClientId, ws);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createApiRouter };
