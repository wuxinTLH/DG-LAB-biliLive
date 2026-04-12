const { EventEmitter } = require("events");
const logger = require("../utils/logger");

/**
 * 规则引擎：将 B站事件映射到 DG-LAB 控制动作
 *
 * 默认规则（可通过 API 修改）：
 *   弹幕      → 无（可配置）
 *   金瓜子礼物 → 按金额增加强度
 *   舰长      → 强度设为 50，发送波形 5 秒
 *   提督      → 强度设为 80，发送波形 10 秒
 *   总督      → 强度设为 120，发送波形 15 秒
 *   SC        → 按价格设强度，发送波形
 */
class RuleEngine extends EventEmitter {
  constructor() {
    super();
    this.rules = getDefaultRules();
    this.enabled = true;
  }

  /** 处理 B站事件，触发对应 DG-LAB 动作 */
  process(eventType, eventData) {
    if (!this.enabled) return;

    const matching = this.rules.filter(
      (r) => r.enabled && r.trigger.type === eventType,
    );

    for (const rule of matching) {
      if (this._matches(rule.trigger, eventData)) {
        logger.info(`[RULE] 命中规则: "${rule.name}"`);
        this.emit("action", rule.action, eventData, rule);
      }
    }
  }

  _matches(trigger, data) {
    if (trigger.type === "gift") {
      if (trigger.coinType && trigger.coinType !== data.coinType) return false;
      if (trigger.minCoin !== undefined && data.totalCoin < trigger.minCoin)
        return false;
      if (trigger.giftId !== undefined && data.giftId !== trigger.giftId)
        return false;
    }
    if (trigger.type === "guard") {
      if (
        trigger.guardLevel !== undefined &&
        data.guardLevel !== trigger.guardLevel
      )
        return false;
    }
    if (trigger.type === "superchat") {
      if (trigger.minPrice !== undefined && data.price < trigger.minPrice)
        return false;
    }
    if (trigger.type === "danmaku") {
      if (trigger.keyword && !data.message?.includes(trigger.keyword))
        return false;
    }
    return true;
  }

  updateRules(rules) {
    this.rules = rules;
    logger.info(`[RULE] 规则已更新，共 ${rules.length} 条`);
  }

  getRules() {
    return this.rules;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    logger.info(`[RULE] 规则引擎已${enabled ? "启用" : "禁用"}`);
  }
}

function getDefaultRules() {
  return [
    {
      id: "rule_guard_3",
      name: "舰长上舰",
      enabled: true,
      trigger: { type: "guard", guardLevel: 3 },
      action: {
        type: "pulse",
        channel: "A",
        strengthA: 50,
        strengthB: 0,
        duration: 5,
        wavePreset: "rhythm",
      },
    },
    {
      id: "rule_guard_2",
      name: "提督上舰",
      enabled: true,
      trigger: { type: "guard", guardLevel: 2 },
      action: {
        type: "pulse",
        channel: "A",
        strengthA: 80,
        strengthB: 0,
        duration: 10,
        wavePreset: "intense",
      },
    },
    {
      id: "rule_guard_1",
      name: "总督上舰",
      enabled: true,
      trigger: { type: "guard", guardLevel: 1 },
      action: {
        type: "pulse",
        channel: "A",
        strengthA: 120,
        strengthB: 0,
        duration: 15,
        wavePreset: "extreme",
      },
    },
    {
      id: "rule_sc_50",
      name: "SC 50元以上",
      enabled: true,
      trigger: { type: "superchat", minPrice: 50 },
      action: {
        type: "pulse",
        channel: "A",
        strengthA: 60,
        strengthB: 0,
        duration: 8,
        wavePreset: "rhythm",
      },
    },
    {
      id: "rule_sc_100",
      name: "SC 100元以上",
      enabled: true,
      trigger: { type: "superchat", minPrice: 100 },
      action: {
        type: "pulse",
        channel: "A",
        strengthA: 90,
        strengthB: 0,
        duration: 12,
        wavePreset: "intense",
      },
    },
    {
      id: "rule_gift_gold_1000",
      name: "金瓜子礼物 1000+",
      enabled: true,
      trigger: { type: "gift", coinType: "gold", minCoin: 1000 },
      action: {
        type: "pulse",
        channel: "A",
        strengthA: 40,
        strengthB: 0,
        duration: 3,
        wavePreset: "light",
      },
    },
  ];
}

const engine = new RuleEngine();
module.exports = engine;
