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
  let currentObsTheme = "default";

  // ── 预设模式定义 ──
  const PRESET_MODES = [
    {
      id: "gentle",
      name: "温柔模式",
      icon: "💕",
      iconBg: "linear-gradient(135deg,#ff9ec8,#c084fc)",
      desc: "低强度轻柔反馈，适合长时间直播或新手体验",
      tags: ["低强度", "轻柔波形"],
      rules: [
        {
          id: "pm_gentle_gift",
          name: "礼物触发（温柔）",
          enabled: true,
          trigger: { type: "gift", coinType: "gold", minCoin: 500 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 15,
            duration: 3,
            wavePreset: "light",
          },
        },
        {
          id: "pm_gentle_guard3",
          name: "舰长（温柔）",
          enabled: true,
          trigger: { type: "guard", guardLevel: 3 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 25,
            duration: 5,
            wavePreset: "light",
          },
        },
        {
          id: "pm_gentle_sc",
          name: "SC（温柔）",
          enabled: true,
          trigger: { type: "superchat", minPrice: 30 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 30,
            duration: 5,
            wavePreset: "wave",
          },
        },
      ],
    },
    {
      id: "standard",
      name: "标准模式",
      icon: "⚡",
      iconBg: "linear-gradient(135deg,#5bc8f5,#38bdf8)",
      desc: "中等强度节奏感反馈，适合日常互动直播",
      tags: ["中等强度", "多事件"],
      rules: [
        {
          id: "pm_std_gift",
          name: "礼物触发",
          enabled: true,
          trigger: { type: "gift", coinType: "gold", minCoin: 500 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 30,
            duration: 3,
            wavePreset: "rhythm",
          },
        },
        {
          id: "pm_std_guard3",
          name: "舰长上舰",
          enabled: true,
          trigger: { type: "guard", guardLevel: 3 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 50,
            duration: 5,
            wavePreset: "rhythm",
          },
        },
        {
          id: "pm_std_guard2",
          name: "提督上舰",
          enabled: true,
          trigger: { type: "guard", guardLevel: 2 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 80,
            duration: 10,
            wavePreset: "pulse",
          },
        },
        {
          id: "pm_std_guard1",
          name: "总督上舰",
          enabled: true,
          trigger: { type: "guard", guardLevel: 1 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 120,
            duration: 15,
            wavePreset: "intense",
          },
        },
        {
          id: "pm_std_sc",
          name: "SC 触发",
          enabled: true,
          trigger: { type: "superchat", minPrice: 30 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 50,
            duration: 10,
            wavePreset: "pulse",
          },
        },
      ],
    },
    {
      id: "extreme",
      name: "极端模式",
      icon: "🔥",
      iconBg: "linear-gradient(135deg,#fb7185,#f97316)",
      desc: "高强度激烈反馈，适合勇于挑战的主播",
      tags: ["高强度", "极端波形", "刺激"],
      rules: [
        {
          id: "pm_ex_gift",
          name: "礼物（极端）",
          enabled: true,
          trigger: { type: "gift", coinType: "gold", minCoin: 500 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 60,
            duration: 5,
            wavePreset: "intense",
          },
        },
        {
          id: "pm_ex_guard3",
          name: "舰长（极端）",
          enabled: true,
          trigger: { type: "guard", guardLevel: 3 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 100,
            duration: 8,
            wavePreset: "extreme",
          },
        },
        {
          id: "pm_ex_guard2",
          name: "提督（极端）",
          enabled: true,
          trigger: { type: "guard", guardLevel: 2 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 150,
            duration: 15,
            wavePreset: "extreme",
          },
        },
        {
          id: "pm_ex_sc",
          name: "SC（极端）",
          enabled: true,
          trigger: { type: "superchat", minPrice: 30 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 120,
            duration: 15,
            wavePreset: "extreme",
          },
        },
      ],
    },
    {
      id: "danmaku",
      name: "弹幕互动",
      icon: "💬",
      iconBg: "linear-gradient(135deg,#fbbf24,#f59e0b)",
      desc: "以弹幕关键词触发为主，让观众参与互动控制",
      tags: ["弹幕触发", "互动"],
      rules: [
        {
          id: "pm_dm_shock",
          name: "弹幕:电击",
          enabled: true,
          trigger: { type: "danmaku", keyword: "电击" },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 40,
            duration: 2,
            wavePreset: "pulse",
          },
        },
        {
          id: "pm_dm_go",
          name: "弹幕:加油",
          enabled: true,
          trigger: { type: "danmaku", keyword: "加油" },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 25,
            duration: 3,
            wavePreset: "rhythm",
          },
        },
        {
          id: "pm_dm_gift",
          name: "礼物配合",
          enabled: true,
          trigger: { type: "gift", coinType: "gold", minCoin: 1000 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 50,
            duration: 5,
            wavePreset: "intense",
          },
        },
      ],
    },
    {
      id: "twoChannel",
      name: "双通道模式",
      icon: "🎛️",
      iconBg: "linear-gradient(135deg,#c084fc,#818cf8)",
      desc: "A/B 双通道分别响应不同事件，更丰富的感官体验",
      tags: ["双通道", "A+B"],
      rules: [
        {
          id: "pm_2ch_guard3",
          name: "舰长 A通道",
          enabled: true,
          trigger: { type: "guard", guardLevel: 3 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 50,
            duration: 5,
            wavePreset: "rhythm",
          },
        },
        {
          id: "pm_2ch_sc",
          name: "SC B通道",
          enabled: true,
          trigger: { type: "superchat", minPrice: 30 },
          action: {
            type: "pulse",
            channel: "B",
            strengthA: 50,
            duration: 8,
            wavePreset: "pulse",
          },
        },
        {
          id: "pm_2ch_gift",
          name: "礼物 AB双通道",
          enabled: true,
          trigger: { type: "gift", coinType: "gold", minCoin: 1000 },
          action: {
            type: "pulse",
            channel: "A",
            strengthA: 40,
            duration: 5,
            wavePreset: "wave",
          },
        },
      ],
    },
    {
      id: "custom",
      name: "自定义",
      icon: "✏️",
      iconBg: "linear-gradient(135deg,#c084fc,#5bc8f5)",
      desc: "自由配置每个事件的触发条件和波形参数",
      tags: ["完全自定义"],
      custom: true,
    },
  ];

  async function init() {
    setupNav();
    bindEvents();
    initWindowControls();
    renderModes();
    initObsPage();
    await connectWS();
    startPoll();
    await loadRules();
  }

  // ══ 窗口控制按钮 ══
  function initWindowControls() {
    const wc = document.getElementById("windowControls");
    // 在 Electron 环境中通过 preload 暴露的 API 控制窗口
    // 非 Electron 环境下隐藏按钮
    const isElectron = typeof window !== "undefined" && window.electronAPI;
    const isMac = navigator.platform?.toLowerCase().includes("mac");

    if (isMac || !isElectron) {
      if (wc) wc.classList.add("mac-hidden");
      return;
    }

    document.getElementById("btnMinimize")?.addEventListener("click", () => {
      window.electronAPI?.minimizeWindow?.();
    });
    document.getElementById("btnMaximize")?.addEventListener("click", () => {
      window.electronAPI?.maximizeWindow?.();
    });
    document.getElementById("btnClose")?.addEventListener("click", () => {
      window.electronAPI?.closeWindow?.();
    });
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
          ?.classList.add("active");
      });
    });
  }

  // ══ 事件绑定 ══
  function bindEvents() {
    // B站连接
    document
      .getElementById("btnBiliConnect")
      ?.addEventListener("click", toggleBili);
    document.getElementById("roomIdInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") toggleBili();
    });

    // SESSDATA
    document
      .getElementById("btnSaveSessdata")
      ?.addEventListener("click", async () => {
        const val = document.getElementById("sessdataInput").value.trim();
        const res = await api("POST", "/bili/sessdata", { sessdata: val });
        const hint = document.getElementById("sessdataHint");
        const btn = document.getElementById("btnSaveSessdata");
        if (res?.ok) {
          hint.textContent = val
            ? "✅ SESSDATA 已保存，重新连接直播间后生效"
            : "✅ 已清除 SESSDATA";
          btn.innerHTML = "✅ 已保存";
          setTimeout(() => {
            btn.innerHTML = "保存";
          }, 2000);
        } else {
          hint.textContent = `❌ 保存失败：${res?.error || "未知错误"}`;
        }
      });

    // 郊狼
    document
      .getElementById("btnDglabConnect")
      ?.addEventListener("click", generateQR);
    document
      .getElementById("btnRefreshQR")
      ?.addEventListener("click", generateQR);

    // 规则
    document.getElementById("rulesEnabled")?.addEventListener("change", (e) => {
      api("POST", "/rules/toggle", { enabled: e.target.checked });
    });
    document
      .getElementById("btnSaveRules")
      ?.addEventListener("click", saveRules);
    document.getElementById("btnAddRule")?.addEventListener("click", addRule);

    // 强度滑块
    ["A", "B"].forEach((ch, i) => {
      const channel = i + 1;
      document.getElementById(`slider${ch}`)?.addEventListener("input", (e) => {
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

    document.getElementById("btnClearAll")?.addEventListener("click", () => {
      api("POST", "/dglab/clear", { channel: "A" });
    });
    document.getElementById("btnClearLog")?.addEventListener("click", () => {
      document.getElementById("logContainer").innerHTML = "";
    });
  }

  // ══ 模式页 ══
  function renderModes() {
    const grid = document.getElementById("modesGrid");
    if (!grid) return;
    grid.innerHTML = "";
    PRESET_MODES.forEach((mode) => {
      const card = document.createElement("div");
      card.className = "mode-card";
      card.dataset.modeId = mode.id;
      card.innerHTML = `
        <div class="mode-icon" style="background:${mode.iconBg}">${mode.icon}</div>
        <div class="mode-name">${mode.name}</div>
        <div class="mode-desc">${mode.desc}</div>
        <div class="mode-tags">${mode.tags.map((t) => `<span class="mode-tag">${t}</span>`).join("")}</div>
      `;
      card.addEventListener("click", () => applyMode(mode));
      grid.appendChild(card);
    });
  }

  function applyMode(mode) {
    // 高亮选中
    document
      .querySelectorAll(".mode-card")
      .forEach((c) => c.classList.remove("active"));
    document
      .querySelector(`.mode-card[data-mode-id="${mode.id}"]`)
      ?.classList.add("active");

    if (mode.custom) {
      document.getElementById("customModeSection").style.display = "block";
      document
        .getElementById("customModeSection")
        ?.scrollIntoView({ behavior: "smooth" });
      bindCustomModeEvents();
      return;
    }

    // 应用预设规则
    rules = mode.rules.map((r) => ({ ...r, id: `${r.id}_${Date.now()}` }));
    api("PUT", "/rules", { rules });
    document.getElementById("rulesContainer") && renderRules();

    // 提示
    const toast = document.createElement("div");
    toast.style.cssText = `position:fixed;bottom:24px;right:24px;background:linear-gradient(135deg,var(--pink),var(--purple));color:white;padding:10px 20px;border-radius:12px;font-weight:700;font-size:13px;box-shadow:0 4px 20px rgba(255,110,180,0.4);z-index:9999;animation:pageIn 0.3s ease`;
    toast.textContent = `✅ 已应用「${mode.name}」，共 ${rules.length} 条规则`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  function bindCustomModeEvents() {
    // 防止重复绑定
    if (document._cmBound) return;
    document._cmBound = true;

    document.getElementById("btnCloseCM")?.addEventListener("click", () => {
      document.getElementById("customModeSection").style.display = "none";
      document._cmBound = false;
    });

    document.getElementById("btnApplyCM")?.addEventListener("click", () => {
      const newRules = buildCustomRules();
      rules = newRules;
      api("PUT", "/rules", { rules });
      renderRules();
      document.getElementById("customModeSection").style.display = "none";
      document._cmBound = false;

      const toast = document.createElement("div");
      toast.style.cssText = `position:fixed;bottom:24px;right:24px;background:linear-gradient(135deg,var(--pink),var(--purple));color:white;padding:10px 20px;border-radius:12px;font-weight:700;font-size:13px;box-shadow:0 4px 20px rgba(255,110,180,0.4);z-index:9999`;
      toast.textContent = `✅ 自定义模式已应用，共 ${newRules.length} 条规则`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
    });

    document
      .getElementById("btnSaveCMPreset")
      ?.addEventListener("click", () => {
        const name =
          document.getElementById("cmName").value.trim() || "自定义模式";
        const newRules = buildCustomRules();
        // 注入到预设列表
        PRESET_MODES.splice(PRESET_MODES.length - 1, 0, {
          id: `custom_${Date.now()}`,
          name,
          icon: "⭐",
          iconBg: "linear-gradient(135deg,#fbbf24,#fb7185)",
          desc: "用户自定义预设",
          tags: ["自定义"],
          rules: newRules,
        });
        renderModes();
        document.getElementById("customModeSection").style.display = "none";
        document._cmBound = false;

        const toast = document.createElement("div");
        toast.style.cssText = `position:fixed;bottom:24px;right:24px;background:linear-gradient(135deg,var(--pink),var(--purple));color:white;padding:10px 20px;border-radius:12px;font-weight:700;font-size:13px;box-shadow:0 4px 20px rgba(255,110,180,0.4);z-index:9999`;
        toast.textContent = `💾 已保存为「${name}」预设`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
      });
  }

  function buildCustomRules() {
    const ts = Date.now();
    const result = [];

    if (document.getElementById("cmGiftEnable")?.checked) {
      result.push({
        id: `cm_gift_${ts}`,
        name: "自定义-礼物触发",
        enabled: true,
        trigger: {
          type: "gift",
          coinType: "gold",
          minCoin: parseInt(document.getElementById("cmGiftMin")?.value) || 500,
        },
        action: {
          type: "pulse",
          channel: "A",
          strengthA:
            parseInt(document.getElementById("cmGiftStrength")?.value) || 30,
          duration:
            parseInt(document.getElementById("cmGiftDuration")?.value) || 3,
          wavePreset:
            document.getElementById("cmGiftPreset")?.value || "rhythm",
        },
      });
    }
    if (document.getElementById("cmGuardEnable")?.checked) {
      result.push({
        id: `cm_guard_${ts}`,
        name: "自定义-舰长触发",
        enabled: true,
        trigger: { type: "guard", guardLevel: 3 },
        action: {
          type: "pulse",
          channel: "A",
          strengthA:
            parseInt(document.getElementById("cmGuardStrength")?.value) || 60,
          duration:
            parseInt(document.getElementById("cmGuardDuration")?.value) || 8,
          wavePreset: document.getElementById("cmGuardPreset")?.value || "wave",
        },
      });
    }
    if (document.getElementById("cmSCEnable")?.checked) {
      result.push({
        id: `cm_sc_${ts}`,
        name: "自定义-SC触发",
        enabled: true,
        trigger: {
          type: "superchat",
          minPrice: parseInt(document.getElementById("cmSCMin")?.value) || 30,
        },
        action: {
          type: "pulse",
          channel: "A",
          strengthA:
            parseInt(document.getElementById("cmSCStrength")?.value) || 50,
          duration:
            parseInt(document.getElementById("cmSCDuration")?.value) || 10,
          wavePreset: document.getElementById("cmSCPreset")?.value || "pulse",
        },
      });
    }
    if (document.getElementById("cmDanmakuEnable")?.checked) {
      const kw = document.getElementById("cmDanmakuKeyword")?.value.trim();
      if (kw) {
        result.push({
          id: `cm_dm_${ts}`,
          name: `自定义-弹幕"${kw}"`,
          enabled: true,
          trigger: { type: "danmaku", keyword: kw },
          action: {
            type: "pulse",
            channel: "A",
            strengthA:
              parseInt(document.getElementById("cmDanmakuStrength")?.value) ||
              20,
            duration:
              parseInt(document.getElementById("cmDanmakuDuration")?.value) ||
              2,
            wavePreset:
              document.getElementById("cmDanmakuPreset")?.value || "light",
          },
        });
      }
    }
    return result;
  }

  // ══ OBS 页 ══
  function initObsPage() {
    // 复制 URL
    document.getElementById("btnCopyObsUrl")?.addEventListener("click", () => {
      const url = document.getElementById("obsUrlInput").value;
      navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById("btnCopyObsUrl");
        const orig = btn.innerHTML;
        btn.innerHTML = "✅ 已复制";
        setTimeout(() => {
          btn.innerHTML = orig;
        }, 1500);
      });
    });

    // 浏览器打开预览
    document
      .getElementById("btnOpenObsPreview")
      ?.addEventListener("click", () => {
        const url = `http://localhost:9998/obs?theme=${currentObsTheme}`;
        if (window.electronAPI?.openExternal) {
          window.electronAPI.openExternal(url);
        } else {
          window.open(url, "_blank");
        }
      });

    // 主题切换
    document.querySelectorAll(".obs-theme-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".obs-theme-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentObsTheme = btn.dataset.theme;
        const overlay = document.getElementById("obsOverlayPreview");
        if (overlay) overlay.dataset.theme = currentObsTheme;
        // 更新 URL
        const urlInput = document.getElementById("obsUrlInput");
        if (urlInput)
          urlInput.value = `http://localhost:9998/obs?theme=${currentObsTheme}`;
      });
    });
  }

  // 更新 OBS 预览的强度条
  function updateObsPreview(sA, sB, isConnected) {
    const barA = document.getElementById("obsBarA");
    const barB = document.getElementById("obsBarB");
    const valA = document.getElementById("obsValA");
    const valB = document.getElementById("obsValB");
    const status = document.getElementById("obsConnStatus");

    if (barA) barA.style.width = `${Math.min(100, (sA / 200) * 100)}%`;
    if (barB) barB.style.width = `${Math.min(100, (sB / 200) * 100)}%`;
    if (valA) valA.textContent = sA;
    if (valB) valB.textContent = sB;
    if (status) {
      status.textContent = isConnected ? "● 已连接" : "● 未连接";
      status.classList.toggle("on", isConnected);
    }
  }

  // 向 OBS 事件列表添加一条
  function pushObsEvent(text) {
    const feed = document.getElementById("obsEventFeed");
    if (!feed) return;
    const empty = feed.querySelector(".obs-event-empty");
    if (empty) empty.remove();
    const el = document.createElement("div");
    el.className = "obs-event-item";
    el.textContent = text;
    feed.prepend(el);
    while (feed.children.length > 3) feed.removeChild(feed.lastChild);
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
      updateObsPreview(0, 0, true);
    }
    if (type === "bind" && message === "400")
      setBadge("dglabStatus", "配对失败", "error");
    if (type === "break") {
      appClientId = null;
      setBadge("dglabStatus", "已断开", "");
      updateDotLabel("dotDglab", "lblDglab", false, "郊狼 已断开");
      setStatusCard("scDg", false, "连接已断开");
      updateObsPreview(0, 0, false);
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

  // ══ B站连接 ══
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
    if (!c) return;
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
          // 推送到 OBS 预览
          const obsText = formatObsEvent(e);
          if (obsText) pushObsEvent(obsText);
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
    if (s.dglab?.state) {
      const { strengthA, strengthB } = s.dglab.state;
      syncStrength(strengthA, strengthB);
      updateObsPreview(strengthA || 0, strengthB || 0, s.dglab?.ready);
    }
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

  function formatObsEvent(ev) {
    const d = ev.data || {};
    switch (ev.type) {
      case "gift":
        return `🎁 ${esc(d.uname || "?")} 送出 ${esc(d.giftName || "?")}`;
      case "guard":
        return `⚓ ${esc(d.uname || "?")} 开通${GN[d.guardLevel] || "上舰"}`;
      case "superchat":
        return `💬 SC ¥${d.price} - ${esc(d.uname || "?")}`;
      case "dgAction":
        return `⚡ 规则「${esc(d.rule || "?")}」已触发`;
      default:
        return null;
    }
  }

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
