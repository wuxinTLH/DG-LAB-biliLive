/**
 * 波形预设库
 * 每条 8位HEX = 4字节 = 100ms
 * [freqX][freqY][z1][z2]  各1字节 hex
 */

function hex(fx, fy, z1, z2) {
  const fc = (v) => Math.max(1, Math.min(100, v)).toString(16).padStart(2, '0').toUpperCase()
  const zc = (v) => Math.max(0, Math.min(100, v)).toString(16).padStart(2, '0').toUpperCase()
  return `${fc(fx)}${fc(fy)}${zc(z1)}${zc(z2)}`
}

// 生成 N 条波形（N × 100ms）
function repeat(wave, n) { return Array(n).fill(wave) }

const WAVE_PRESETS = {
  // 轻柔 - 低频低强度
  light: [
    ...repeat(hex(5, 5, 10, 10), 4),
    ...repeat(hex(5, 5, 15, 10), 4),
    ...repeat(hex(5, 5, 10, 15), 2),
  ],

  // 节奏 - 中频中强度
  rhythm: [
    ...repeat(hex(10, 10, 50, 0), 3),
    ...repeat(hex(10, 10, 0, 0), 1),
    ...repeat(hex(10, 10, 50, 0), 3),
    ...repeat(hex(10, 10, 0, 0), 1),
    ...repeat(hex(15, 10, 60, 20), 2),
  ],

  // 强烈 - 高强度节律
  intense: [
    ...repeat(hex(20, 20, 80, 40), 3),
    ...repeat(hex(20, 20, 20, 20), 1),
    ...repeat(hex(25, 15, 90, 50), 3),
    ...repeat(hex(20, 20, 20, 20), 1),
    ...repeat(hex(30, 20, 80, 60), 2),
  ],

  // 极端 - 最高强度
  extreme: [
    ...repeat(hex(30, 30, 100, 80), 4),
    ...repeat(hex(15, 15, 30, 30), 2),
    ...repeat(hex(50, 30, 100, 90), 4),
  ],

  // 脉冲 - 间歇式
  pulse: [
    hex(10, 10, 60, 60),
    hex(1, 1, 0, 0),
    hex(10, 10, 60, 60),
    hex(1, 1, 0, 0),
    hex(15, 15, 80, 80),
    hex(1, 1, 0, 0),
    hex(15, 15, 80, 80),
    hex(1, 1, 0, 0),
  ],

  // 波浪 - 渐强渐弱
  wave: [
    hex(10, 10, 20, 10),
    hex(10, 10, 35, 20),
    hex(10, 10, 50, 35),
    hex(10, 10, 65, 50),
    hex(10, 10, 80, 65),
    hex(10, 10, 65, 50),
    hex(10, 10, 50, 35),
    hex(10, 10, 35, 20),
    hex(10, 10, 20, 10),
    hex(10, 10, 10, 5),
  ],
}

module.exports = { WAVE_PRESETS, hex }
