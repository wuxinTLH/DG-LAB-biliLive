/**
 * 连接管理器：管理 clientId ↔ WebSocket ↔ 配对关系
 */
class ConnectionManager {
  constructor() {
    /** @type {Map<string, WebSocket>} clientId → ws */
    this._clients = new Map()
    /** @type {Map<string, string>} clientId → partnerId */
    this._pairs = new Map()
  }

  register(clientId, ws) {
    this._clients.set(clientId, ws)
  }

  unregister(clientId) {
    const partner = this._pairs.get(clientId)
    if (partner) {
      this._pairs.delete(partner)
    }
    this._pairs.delete(clientId)
    this._clients.delete(clientId)
  }

  /** 建立配对 */
  pair(clientId, targetId) {
    this._pairs.set(clientId, targetId)
    this._pairs.set(targetId, clientId)
  }

  getPartner(clientId) {
    return this._pairs.get(clientId) || null
  }

  getWs(clientId) {
    return this._clients.get(clientId) || null
  }

  exists(clientId) {
    return this._clients.has(clientId)
  }

  isPaired(clientId) {
    return this._pairs.has(clientId)
  }

  /** 返回所有连接状态（供 API 查询） */
  getStatus() {
    const connections = []
    for (const [id, ws] of this._clients) {
      connections.push({
        clientId: id,
        paired: this._pairs.has(id),
        partnerId: this._pairs.get(id) || null,
        readyState: ws.readyState,
      })
    }
    return connections
  }
}

module.exports = { ConnectionManager }
