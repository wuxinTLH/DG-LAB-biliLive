const WebSocket = require('ws')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')
const { ConnectionManager } = require('./connectionManager')
const { MessageHandler } = require('./messageHandler')

/** @type {ConnectionManager} */
let connManager
/** @type {Map<string, NodeJS.Timeout>} */
const heartbeatTimers = new Map()

const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '60000')

function createDGLabWSServer(port) {
  const wss = new WebSocket.Server({ port })
  connManager = new ConnectionManager()
  const msgHandler = new MessageHandler(connManager)

  wss.on('connection', (ws) => {
    const clientId = uuidv4()
    connManager.register(clientId, ws)

    // 分配 clientId
    send(ws, { type: 'bind', clientId, targetId: '', message: 'targetId' })
    logger.info(`[WS] 新连接 clientId=${clientId}`)

    // 心跳
    const hbTimer = setInterval(() => {
      const partner = connManager.getPartner(clientId)
      if (partner) {
        send(ws, { type: 'heartbeat', clientId, targetId: partner, message: '200' })
      }
    }, HEARTBEAT_INTERVAL)
    heartbeatTimers.set(clientId, hbTimer)

    ws.on('message', (raw) => {
      let data
      try {
        data = JSON.parse(raw.toString())
      } catch {
        send(ws, { type: 'error', clientId, targetId: '', message: '403' })
        return
      }
      if (raw.toString().length > 1950) {
        send(ws, { type: 'error', clientId, targetId: '', message: '405' })
        return
      }
      msgHandler.handle(clientId, ws, data)
    })

    ws.on('close', () => {
      clearInterval(heartbeatTimers.get(clientId))
      heartbeatTimers.delete(clientId)
      const partner = connManager.getPartner(clientId)
      if (partner) {
        const partnerWs = connManager.getWs(partner)
        if (partnerWs) {
          send(partnerWs, { type: 'break', clientId, targetId: partner, message: '209' })
        }
      }
      connManager.unregister(clientId)
      logger.info(`[WS] 断开 clientId=${clientId}`)
    })

    ws.on('error', (err) => {
      logger.error(`[WS] 错误 clientId=${clientId}`, err.message)
    })
  })

  // 暴露 connManager 供 API 查询
  wss._connManager = connManager
  global.__connManager = connManager

  logger.info(`[DGLAB] WebSocket 服务已启动，端口 ${port}`)
  return wss
}

function send(ws, obj) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj))
    }
  } catch (e) {
    logger.error('[WS] send error', e.message)
  }
}

module.exports = { createDGLabWSServer }
