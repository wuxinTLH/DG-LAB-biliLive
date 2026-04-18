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
    const { channel } = req.body;
    if (channel === "A") dgController.clearChannel("A");
    else if (channel === "B") dgController.clearChannel("B");
    else {
      dgController.clearChannel("A");
      dgController.clearChannel("B");
    }
    res.json({ ok: true });
  });

  router.post("/dglab/pulse", (req, res) => {
    const { channel, preset, duration } = req.body;
    const ch = channel || "A";
    const pre = preset || "rhythm";
    const dur = duration || 5;
    if (ch === "AB") {
      dgController.sendPreset("A", pre, dur);
      dgController.sendPreset("B", pre, dur);
    } else {
      dgController.sendPreset(ch, pre, dur);
    }
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
    if (!cm.getWs(myClientId))
      return res.status(404).json({ error: "客户端不存在" });
    dgController.setConnection(myClientId, appClientId, cm);
    res.json({ ok: true });
  });

  return router;
}

// ── OBS 覆盖层路由（挂载在根路径 /obs）──
function createObsRouter() {
  const router = Router();

  router.get("/obs", (req, res) => {
    const theme = (req.query.theme || "default").replace(/[^a-z]/g, "");
    const sA = dgController.state?.strengthA ?? 0;
    const sB = dgController.state?.strengthB ?? 0;
    const connected = dgController.isReady();
    const recentEvents = eventLog.slice(0, 3);

    const themeStyles = {
      default: `
        body { background: transparent; font-family: 'Nunito', sans-serif; }
        .overlay { background: linear-gradient(135deg,rgba(255,240,248,0.92),rgba(237,250,255,0.92)); border: 2px solid rgba(255,110,180,0.3); border-radius: 14px; backdrop-filter: blur(8px); }
        .header { background: linear-gradient(90deg,#ff6eb4,#c084fc); color: white; }
        .bar-a { background: linear-gradient(90deg,#ff6eb4,#c084fc); }
        .bar-b { background: linear-gradient(90deg,#5bc8f5,#38bdf8); }
        .bar-track { background: #ffd6eb; }
        .ch-label, .ch-val { color: #3d2552; }
        .ev-feed { background: rgba(255,110,180,0.07); border: 1.5px solid #ffd6eb; }
        .ev-item { color: #7a5a96; }
        .conn-on { color: #4ade80; } .conn-off { color: #b398c8; }
      `,
      dark: `
        body { background: transparent; font-family: 'Nunito', sans-serif; }
        .overlay { background: linear-gradient(135deg,rgba(20,12,40,0.95),rgba(8,16,32,0.95)); border: 2px solid rgba(192,132,252,0.3); border-radius: 14px; }
        .header { background: linear-gradient(90deg,#3b1a6b,#1a2455); color: #e0c8ff; }
        .bar-a { background: linear-gradient(90deg,#a855f7,#6366f1); }
        .bar-b { background: linear-gradient(90deg,#38bdf8,#0ea5e9); }
        .bar-track { background: rgba(100,50,200,0.2); }
        .ch-label, .ch-val { color: #d4b8ff; }
        .ev-feed { background: rgba(100,50,200,0.1); border: 1.5px solid rgba(160,100,255,0.2); }
        .ev-item { color: #c0a0e8; }
        .conn-on { color: #4ade80; } .conn-off { color: #7c5fa0; }
      `,
      neon: `
        body { background: transparent; font-family: 'Courier New', monospace; }
        .overlay { background: rgba(5,5,20,0.96); border: 2px solid rgba(0,255,200,0.5); border-radius: 14px; box-shadow: 0 0 20px rgba(0,255,200,0.2); }
        .header { background: rgba(0,255,200,0.1); border-bottom: 1px solid rgba(0,255,200,0.3); }
        .logo { color: #00ffcc; text-shadow: 0 0 10px #00ffcc; }
        .bar-a { background: linear-gradient(90deg,#00ffcc,#00aaff); box-shadow: 0 0 8px #00ffcc; }
        .bar-b { background: linear-gradient(90deg,#ff00aa,#ff6600); box-shadow: 0 0 8px #ff00aa; }
        .bar-track { background: rgba(0,255,200,0.1); border: 1px solid rgba(0,255,200,0.2); }
        .ch-label { color: #00ffcc; text-shadow: 0 0 6px #00ffcc; }
        .ch-val { color: #00ffcc; text-shadow: 0 0 6px #00ffcc; }
        .ev-feed { background: rgba(0,255,200,0.05); border: 1.5px solid rgba(0,255,200,0.2); }
        .ev-item { color: #88ffee; }
        .conn-on { color: #00ffcc; text-shadow: 0 0 8px #00ffcc; } .conn-off { color: #336655; }
      `,
      minimal: `
        body { background: transparent; font-family: -apple-system, Arial, sans-serif; }
        .overlay { background: rgba(255,255,255,0.95); border: 1.5px solid #e0e0e0; border-radius: 14px; }
        .header { background: #f8f8f8; border-bottom: 1px solid #e0e0e0; }
        .logo { color: #333; }
        .bar-a, .bar-b { background: #333; }
        .bar-track { background: #e8e8e8; }
        .ch-label, .ch-val { color: #555; }
        .ev-feed { background: #f5f5f5; border: 1.5px solid #e0e0e0; }
        .ev-item { color: #666; }
        .conn-on { color: #22c55e; } .conn-off { color: #aaa; }
      `,
    };

    const evItems = recentEvents.length
      ? recentEvents
          .map((e) => {
            const d = e.data || {};
            let text = "";
            const GN = { 1: "总督", 2: "提督", 3: "舰长" };
            if (e.type === "gift")
              text = `🎁 ${d.uname || "?"} 送出 ${d.giftName || "?"}`;
            else if (e.type === "guard")
              text = `⚓ ${d.uname || "?"} 开通${GN[d.guardLevel] || "上舰"}`;
            else if (e.type === "superchat")
              text = `💬 SC ¥${d.price} — ${d.uname || "?"}`;
            else if (e.type === "dgAction")
              text = `⚡ 规则「${d.rule || "?"}」触发`;
            if (!text) return "";
            return `<div class="ev-item">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
          })
          .filter(Boolean)
          .join("")
      : `<div class="ev-item" style="opacity:0.5">等待事件...</div>`;

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="3">
  <title>Coyote Live OBS</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 400px; background: transparent; }
    ${themeStyles[theme] || themeStyles.default}
    .overlay { width: 400px; overflow: hidden; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; font-size: 12px; font-weight: 700; }
    .logo { font-size: 13px; font-weight: 800; }
    .conn-status { font-size: 10px; font-weight: 700; }
    .body { padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
    .channel { display: flex; align-items: center; gap: 8px; }
    .ch-label { font-size: 11px; font-weight: 800; width: 18px; flex-shrink: 0; }
    .bar-track { flex: 1; height: 10px; border-radius: 5px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 5px; transition: width 0.3s ease; }
    .ch-val { font-size: 11px; font-weight: 700; width: 28px; text-align: right; flex-shrink: 0; font-family: 'Courier New', monospace; }
    .ev-feed { border-radius: 8px; padding: 6px 10px; min-height: 28px; display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
    .ev-item { font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style>
</head>
<body>
  <div class="overlay">
    <div class="header">
      <span class="logo">⚡ Coyote Live</span>
      <span class="conn-status ${connected ? "conn-on" : "conn-off"}">${connected ? "● 已连接" : "● 未连接"}</span>
    </div>
    <div class="body">
      <div class="channel">
        <span class="ch-label">A</span>
        <div class="bar-track"><div class="bar-fill bar-a" style="width:${Math.min(100, (sA / 200) * 100).toFixed(1)}%"></div></div>
        <span class="ch-val">${sA}</span>
      </div>
      <div class="channel">
        <span class="ch-label">B</span>
        <div class="bar-track"><div class="bar-fill bar-b" style="width:${Math.min(100, (sB / 200) * 100).toFixed(1)}%"></div></div>
        <span class="ch-val">${sB}</span>
      </div>
      <div class="ev-feed">${evItems}</div>
    </div>
  </div>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  return router;
}

// 覆盖旧的 exports
module.exports = { createApiRouter, createObsRouter };
