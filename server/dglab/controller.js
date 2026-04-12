const WebSocket = require('ws')
const logger = require('../utils/logger')
const { WAVE_PRESETS } = require('./wavePresets')

/**
 * DG-LAB 控制器：向已配对的 APP 发送强度/波形指令
 */
class DGLabController {
  constructor() {
    /** @type {string|null} 已配对的 APP clientId（targetId 视角） */
    this.appClientId = null
    /** @type {string|null} 我们自己的 clientId */
    this.myClientId = null
    /** @type {WebSocket|null} */
    this.ws = null
    this._waveTimers = new Map()
    // 当前强度状态（从 APP 回传同步）
    this.state = { strengthA: 0, strengthB: 0, limitA: 200, limitB: 200 }
  }

  setConnection(myClientId, appClientId, ws) {
    this.myClientId = myClientId
    this.appClientId = appClientId
    this.ws = ws
    logger.info(`[CTRL] 控制器就绪 my=${myClientId} app=${appClientId}`)
  }

  updateState(strengthA, strengthB, limitA, limitB) {
    this.state = { strengthA, strengthB, limitA, limitB }
  }

  clearConnection() {
    this.appClientId = null
    this.myClientId = null
    this.ws = null
    this._clearAllTimers()
  }

  isReady() {
    return !!(this.appClientId && this.ws && this.ws.readyState === WebSocket.OPEN)
  }

  /** 强度减少 */
  decreaseStrength(channel) {
    this._send({ type: 1, channel, message: 'set channel', ...this._ids() })
  }

  /** 强度增加 */
  increaseStrength(channel) {
    this._send({ type: 2, channel, message: 'set channel', ...this._ids() })
  }

  /** 强度设为指定值 (0~200) */
  setStrength(channel, value) {
    this._send({ type: 3, channel, strength: Math.max(0, Math.min(200, value)), message: 'set channel', ...this._ids() })
  }

  /** 清空通道波形队列 */
  clearChannel(channel) {
    const ch = channel === 'A' || channel === 1 ? 1 : 2
    this._send({ type: 4, message: `clear-${ch}`, ...this._ids() })
  }

  /** 发送波形（通过 clientMsg） */
  sendPulse(channel, waves, duration = 5) {
    if (!waves || waves.length === 0) return
    const msg = `${channel}:${JSON.stringify(waves)}`
    this._send({ type: 'clientMsg', channel, time: duration, message: msg, ...this._ids() })
  }

  /** 发送预设波形 */
  sendPreset(channel, presetName, duration = 5) {
    const waves = WAVE_PRESETS[presetName] || WAVE_PRESETS.rhythm
    this.sendPulse(channel, waves, duration)
  }

  /** 执行规则动作 */
  executeAction(action) {
    if (!this.isReady()) {
      logger.warn('[CTRL] 执行动作失败：APP 未连接')
      return
    }
    const { type, channel, strengthA, strengthB, duration, wavePreset } = action

    if (type === 'pulse') {
      if (strengthA !== undefined) this.setStrength(1, strengthA)
      if (strengthB !== undefined) this.setStrength(2, strengthB)
      if (wavePreset) this.sendPreset(channel || 'A', wavePreset, duration || 5)
    } else if (type === 'setStrength') {
      if (strengthA !== undefined) this.setStrength(1, strengthA)
      if (strengthB !== undefined) this.setStrength(2, strengthB)
    } else if (type === 'clear') {
      this.clearChannel('A')
      this.clearChannel('B')
    }
  }

  _ids() {
    return { clientId: this.myClientId, targetId: this.appClientId }
  }

  _send(payload) {
    if (!this.isReady()) return
    try {
      const str = JSON.stringify(payload)
      if (str.length > 1950) { logger.warn('[CTRL] 消息过长，跳过'); return }
      this.ws.send(str)
    } catch (e) {
      logger.error('[CTRL] 发送失败', e.message)
    }
  }

  _clearAllTimers() {
    for (const t of this._waveTimers.values()) clearInterval(t)
    this._waveTimers.clear()
  }
}

const controller = new DGLabController()
module.exports = controller
