/**
 * Coyote Live — 前端逻辑
 * HTTP API  → localhost:9998/api
 * WebSocket → localhost:9999 (DG-LAB)
 */
const App = (() => {
  const API_BASE = "http://localhost:9998/api";
  let ws = null;
  let myClientId = null;
  let appClientId = null;
  let lastEventTs = 0;
  let rules = [];

  async function init() {
    setupNav();
    bindEvents();
    await connectWS();
    startPoll();
    await loadRules();
  }

  // ══ 导航 ══
  function setupNav() {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".nav-btn")
          .forEach((b) => b.classList.remove("active"));
        document
          .querySelectorAll(".page")
          .forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        document
          .getElementById(`page-${btn.dataset.page}`)
          .classList.add("active");
      });
    });
  }

  // ══ 事件绑定 ══
  function bindEvents() {
    // B站连接 - 直播间号
    document
      .getElementById("btnBiliConnect")
      .addEventListener("click", toggleBili);
    document.getElementById("roomIdInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") toggleBili();
    });

    // SESSDATA 保存
    const btnSaveSessdata = document.getElementById("btnSaveSessdata");
    if (btnSaveSessdata) {
      btnSaveSessdata.addEventListener("click", async () => {
        const val = document.getElementById("sessdataInput").value.trim();
        const res = await api("POST", "/bili/sessdata", { sessdata: val });
        const hint = document.getElementById("sessdataHint");
        if (res?.ok) {
          hint.textContent = val
            ? "✅ SESSDATA 已保存，重新连接直播间后生效"
            : "✅ 已清除 SESSDATA";
          btnSaveSessdata.innerHTML = "✅ 已保存";
          setTimeout(() => {
            btnSaveSessdata.innerHTML = "保存";
          }, 2000);
        } else {
          hint.textContent = `❌ 保存失败：${res?.error || "未知错误"}`;
        }
      });
    }

    // 郊狼
    document
      .getElementById("btnDglabConnect")
      .addEventListener("click", generateQR);
    document
      .getElementById("btnRefreshQR")
      .addEventListener("click", generateQR);

    // 规则
    document.getElementById("rulesEnabled").addEventListener("change", (e) => {
      api("POST", "/rules/toggle", { enabled: e.target.checked });
    });
    document
      .getElementById("btnSaveRules")
      .addEventListener("click", saveRules);
    document.getElementById("btnAddRule").addEventListener("click", addRule);

    // 强度滑块
    ["A", "B"].forEach((ch, i) => {
      const channel = i + 1;
      document.getElementById(`slider${ch}`).addEventListener("input", (e) => {
        document.getElementById(`strength${ch}`).textContent = e.target.value;
        api("POST", "/dglab/strength", {
          channel,
          value: parseInt(e.target.value),
          mode: "set",
        });
      });
    });

    // 波形预设
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dur =
          parseInt(document.getElementById("presetDuration").value) || 5;
        api("POST", "/dglab/pulse", {
          channel: btn.dataset.ch,
          preset: btn.dataset.preset,
          duration: dur,
        });
        btn.classList.add("active-flash");
        setTimeout(() => btn.classList.remove("active-flash"), 700);
      });
    });

    document.getElementById("btnClearAll").addEventListener("click", () => {
      api("POST", "/dglab/clear", { channel: "A" });
    });
    document.getElementById("btnClearLog").addEventListener("click", () => {
      document.getElementById("logContainer").innerHTML = "";
    });
  }

  // ══ WebSocket (DG-LAB) ══
  function connectWS() {
    return new Promise((resolve) => {
      const tryConnect = () => {
        try {
          ws = new WebSocket("ws://localhost:9999");
        } catch {
          setTimeout(tryConnect, 3000);
          return;
        }
        ws.onopen = () => {
          resolve();
        };
        ws.onmessage = ({ data }) => {
          try {
            handleWS(JSON.parse(data));
          } catch {}
        };
        ws.onclose = () => {
          myClientId = null;
          appClientId = null;
          updateDotLabel("dotDglab", "lblDglab", false, "郊狼 未连接");
          setTimeout(tryConnect, 3000);
        };
        ws.onerror = () => {};
      };
      tryConnect();
    });
  }

  function handleWS(msg) {
    const { type, clientId, targetId, message } = msg;
    if (type === "bind" && message === "targetId") {
      myClientId = clientId;
      setStatusCard("scWs", true, `ws://localhost:9999`);
    }
    if (type === "bind" && message === "200") {
      appClientId = clientId !== myClientId ? clientId : targetId;
      api("POST", "/dglab/register", { myClientId, appClientId });
      setBadge("dglabStatus", "已配对 💕", "connected");
      setBadge("qrStatusBadge", "配对成功 ✓", "connected");
      updateDotLabel("dotDglab", "lblDglab", true, "郊狼 已连接");
      setStatusCard("scDg", true, "APP 已配对");
    }
    if (type === "bind" && message === "400")
      setBadge("dglabStatus", "配对失败", "error");
    if (type === "break") {
      appClientId = null;
      setBadge("dglabStatus", "已断开", "");
      updateDotLabel("dotDglab", "lblDglab", false, "郊狼 已断开");
      setStatusCard("scDg", false, "连接已断开");
    }
    if (
      type === "msg" &&
      typeof message === "string" &&
      message.startsWith("strength-")
    ) {
      const parts = message.replace("strength-", "").split("+");
      if (parts.length >= 2)
        syncStrength(parseInt(parts[0]), parseInt(parts[1]));
    }
  }

  // ══ 二维码 ══
  async function generateQR() {
    if (!myClientId) {
      showHint("biliHint", "⚠️ WebSocket 服务未就绪，请稍等...");
      return;
    }
    const host =
      document.getElementById("wsHostInput").value.trim() || "localhost";
    const port = document.getElementById("wsPortInput").value.trim() || "9999";
    const res = await api(
      "GET",
      `/qrcode?host=${encodeURIComponent(host)}&port=${port}&clientId=${myClientId}`,
    );
    if (res?.ok) {
      document.getElementById("qrSection").style.display = "block";
      document.getElementById("qrImg").src = res.dataUrl;
      document.getElementById("qrUrl").textContent = res.qrContent;
      setBadge("qrStatusBadge", "等待扫描 👀", "badge-warn");
      document
        .getElementById("qrSection")
        .scrollIntoView({ behavior: "smooth" });
    }
  }

  // ══ B站连接（直播间号）══
  async function toggleBili() {
    const badge = document.getElementById("biliStatus");
    const btn = document.getElementById("btnBiliConnect");
    if (badge.classList.contains("connected")) {
      await api("POST", "/bili/disconnect");
      updateBiliUI(false);
      return;
    }
    const roomId = document.getElementById("roomIdInput").value.trim();
    if (!roomId || !/^\d+$/.test(roomId)) {
      showHint("biliHint", "⚠️ 请输入数字直播间号");
      return;
    }
    btn.textContent = "连接中...";
    btn.disabled = true;
    const res = await api("POST", "/bili/connect", { roomId });
    btn.disabled = false;
    if (res?.ok) {
      btn.textContent = "断开连接";
      showHint("biliHint", "🌸 正在连接，请稍候...");
    } else {
      btn.textContent = "连接";
      showHint("biliHint", `❌ ${res?.error || "连接失败"}`);
    }
  }

  // ══ 手动控制 ══
  function adjustStrength(channel, delta) {
    const mode = delta > 0 ? "increase" : "decrease";
    const abs = Math.abs(delta);
    for (let i = 0; i < abs; i++)
      api("POST", "/dglab/strength", { channel, mode });
    const ch = channel === 1 ? "A" : "B";
    const cur =
      parseInt(document.getElementById(`strength${ch}`).textContent) || 0;
    const next = Math.max(0, Math.min(200, cur + delta));
    document.getElementById(`strength${ch}`).textContent = next;
    document.getElementById(`slider${ch}`).value = next;
  }

  function setStrength(channel, value) {
    api("POST", "/dglab/strength", { channel, value, mode: "set" });
    const ch = channel === 1 ? "A" : "B";
    document.getElementById(`strength${ch}`).textContent = value;
    document.getElementById(`slider${ch}`).value = value;
  }

  // ══ 规则 ══
  async function loadRules() {
    const data = await api("GET", "/rules");
    if (!data) return;
    rules = data.rules || [];
    document.getElementById("rulesEnabled").checked = data.enabled !== false;
    renderRules();
  }

  function renderRules() {
    const c = document.getElementById("rulesContainer");
    if (rules.length === 0) {
      c.innerHTML = `<div class="empty-state"><div class="empty-icon">🌸</div><div class="empty-text">暂无规则，点击「添加规则」新建</div></div>`;
      return;
    }
    c.innerHTML = "";
    rules.forEach((rule, idx) => {
      const el = document.createElement("div");
      el.className = `rule-item ${rule.enabled ? "" : "disabled"}`;
      el.innerHTML = `
        <label class="toggle-label" style="gap:0">
          <input type="checkbox" ${rule.enabled ? "checked" : ""} class="rule-toggle" data-idx="${idx}">
          <span class="toggle-track"></span>
        </label>
        <div class="rule-name">${esc(rule.name)}</div>
        <span class="rule-tag trigger">${triggerLabel(rule.trigger)}</span>
        <span class="rule-tag action">${actionLabel(rule.action)}</span>
        <button class="btn btn-ghost btn-xs" data-del="${idx}" title="删除">✕</button>
      `;
      el.querySelector(".rule-toggle").addEventListener("change", (e) => {
        rules[idx].enabled = e.target.checked;
        el.classList.toggle("disabled", !e.target.checked);
      });
      el.querySelector("[data-del]").addEventListener("click", () => {
        rules.splice(idx, 1);
        renderRules();
      });
      c.appendChild(el);
    });
  }

  async function saveRules() {
    await api("PUT", "/rules", { rules });
    const btn = document.getElementById("btnSaveRules");
    const orig = btn.innerHTML;
    btn.innerHTML = "✅ 已保存";
    setTimeout(() => {
      btn.innerHTML = orig;
    }, 1500);
  }

  function addRule() {
    rules.push({
      id: `rule_${Date.now()}`,
      name: "新规则",
      enabled: true,
      trigger: { type: "gift", coinType: "gold", minCoin: 500 },
      action: {
        type: "pulse",
        channel: "A",
        strengthA: 30,
        duration: 3,
        wavePreset: "light",
      },
    });
    renderRules();
  }

  // ══ 轮询状态 ══
  function startPoll() {
    setInterval(async () => {
      const evData = await api("GET", `/events?since=${lastEventTs}`);
      if (evData?.events?.length) {
        evData.events.forEach((e) => {
          if (e.ts > lastEventTs) lastEventTs = e.ts;
          addLog(e);
        });
      }
      const status = await api("GET", "/status");
      if (status) syncStatus(status);
    }, 1500);
  }

  function syncStatus(s) {
    const biliOn = s.bili?.connected;
    updateBiliUI(biliOn, s.bili?.roomId);
    const ruleOn = s.rules?.enabled;
    setStatusCard(
      "scRule",
      ruleOn,
      ruleOn ? `${s.rules?.count} 条规则已激活` : "已暂停",
    );
    if (s.dglab?.state)
      syncStrength(s.dglab.state.strengthA, s.dglab.state.strengthB);
  }

  // ══ UI 工具 ══
  function updateBiliUI(on, roomId) {
    setBadge("biliStatus", on ? "已连接 💕" : "未连接", on ? "connected" : "");
    updateDotLabel("dotBili", "lblBili", on, `B站 ${on ? "已连接" : "未连接"}`);
    setStatusCard(
      "scBili",
      on,
      on
        ? `房间 ${roomId || document.getElementById("roomIdInput").value}`
        : "—",
    );
    const btn = document.getElementById("btnBiliConnect");
    if (btn && !btn.disabled) btn.textContent = on ? "断开连接" : "连接";
    if (on) showHint("biliHint", `🌸 房间 ${roomId} 已连接，正在监听直播事件`);
  }

  function syncStrength(sA, sB) {
    if (sA !== undefined) {
      document.getElementById("strengthA").textContent = sA;
      document.getElementById("sliderA").value = sA;
    }
    if (sB !== undefined) {
      document.getElementById("strengthB").textContent = sB;
      document.getElementById("sliderB").value = sB;
    }
  }

  function setStatusCard(id, on, valText) {
    const card = document.getElementById(id);
    if (!card) return;
    card.className = `status-card${on ? " on" : ""}`;
    const val = card.querySelector(".sc-val");
    if (val) val.textContent = valText || "—";
  }

  function setBadge(id, text, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = "badge" + (cls ? " " + cls : "");
  }

  function updateDotLabel(dotId, lblId, on, text) {
    const dot = document.getElementById(dotId);
    if (dot) dot.className = `dot${on ? " on" : ""}`;
    const lbl = document.getElementById(lblId);
    if (lbl) lbl.textContent = text;
    const pill = dot?.closest(".status-pill");
    if (pill) pill.classList.toggle("on", on);
  }

  function showHint(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ══ 日志 ══
  function addLog(ev) {
    const c = document.getElementById("logContainer");
    const empty = c.querySelector(".empty-state");
    if (empty) empty.remove();
    const el = document.createElement("div");
    el.className = "log-item";
    const t = new Date(ev.ts).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    el.innerHTML = `
      <span class="log-time">${t}</span>
      <span class="log-type ${ev.type}">${typeLabel(ev.type)}</span>
      <span class="log-msg">${formatMsg(ev)}</span>
    `;
    c.prepend(el);
    while (c.children.length > 100) c.removeChild(c.lastChild);
  }

  // ══ HTTP API ══
  async function api(method, path, body) {
    try {
      const opts = { method, headers: { "Content-Type": "application/json" } };
      if (body) opts.body = JSON.stringify(body);
      const r = await fetch(API_BASE + path, opts);
      return await r.json();
    } catch {
      return null;
    }
  }

  // ══ 格式化 ══
  const GN = { 1: "总督", 2: "提督", 3: "舰长" };
  function triggerLabel(t) {
    if (!t) return "?";
    if (t.type === "gift")
      return `礼物 ≥¥${((t.minCoin || 0) / 1000).toFixed(1)}`;
    if (t.type === "guard") return GN[t.guardLevel] || "上舰";
    if (t.type === "superchat") return `SC ≥¥${t.minPrice || 0}`;
    if (t.type === "danmaku") return `弹幕: ${t.keyword || "*"}`;
    return t.type;
  }
  function actionLabel(a) {
    if (!a) return "?";
    if (a.type === "pulse")
      return `${a.channel || "A"}ch ${a.wavePreset || ""} ${a.duration || 5}s`;
    return a.type;
  }
  function typeLabel(t) {
    return (
      {
        gift: "礼物",
        guard: "上舰",
        superchat: "SC",
        danmaku: "弹幕",
        dgAction: "指令",
        biliConnected: "连接",
        biliDisconnected: "断开",
        biliError: "错误",
        online: "在线",
      }[t] || t
    );
  }
  function formatMsg(ev) {
    const d = ev.data || {};
    switch (ev.type) {
      case "gift":
        return `${esc(d.uname || "?")} 送出 ${esc(d.giftName || "?")} ×${d.num}（${d.coinType === "gold" ? "💰" : "🥈"}¥${((d.totalCoin || 0) / 1000).toFixed(1)}）`;
      case "guard":
        return `${esc(d.uname || "?")} 开通了 ${GN[d.guardLevel] || "?"} ×${d.num}`;
      case "superchat":
        return `${esc(d.uname || "?")} SC ¥${d.price}：${esc(d.message || "")}`;
      case "danmaku":
        return `${esc(d.uname || "?")}：${esc(d.message || "")}`;
      case "dgAction":
        return `规则「${esc(d.rule || "?")}」→ ${d.action?.wavePreset || ""} ${d.action?.duration || ""}s`;
      case "biliConnected":
        return "直播间连接成功 🌸";
      case "biliDisconnected":
        return "直播间连接断开";
      case "biliError":
        return `错误：${esc(d.message || "?")}`;
      default:
        return JSON.stringify(d);
    }
  }
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  return { init, adjustStrength, setStrength };
})();

document.addEventListener("DOMContentLoaded", () => App.init());
