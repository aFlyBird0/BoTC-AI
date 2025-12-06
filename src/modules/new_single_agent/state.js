// 最小状态管理：
// - players: 座位、角色认知、真实角色、生死与 tokens
// - tokenMap: 每座位的标记列表
class NewSingleAgentState {
  constructor({ players }) {
    this.players = Array.isArray(players) ? players.map(p => ({ ...p, alive: true, executed: false, tokens: Array.isArray(p.tokens) ? p.tokens.slice() : [] })) : []
    this.tokenMap = new Map()
    for (const p of this.players) this.tokenMap.set(p.seat, p.tokens.slice())
  }
  // 查找玩家
  getPlayer(seat) {
    return this.players.find(p => p.seat === seat)
  }
  // 获取某座位的 tokens
  getTokens(seat) {
    return (this.tokenMap.get(seat) || []).slice()
  }
  // 添加标记
  addToken(seat, token) {
    const list = this.tokenMap.get(seat) || []
    list.push(token)
    this.tokenMap.set(seat, list)
    const p = this.getPlayer(seat)
    if (p) p.tokens = list.slice()
  }
  // 移除标记
  removeToken(seat, token) {
    const list = (this.tokenMap.get(seat) || []).filter(t => t !== token)
    this.tokenMap.set(seat, list)
    const p = this.getPlayer(seat)
    if (p) p.tokens = list.slice()
  }
  // 标记死亡
  kill(seat) {
    const p = this.getPlayer(seat)
    if (p) p.alive = false
  }
  // 设置真实/已知角色（认知覆盖）
  setRealRole(seat, role) {
    const p = this.getPlayer(seat)
    if (p) p.realRole = role
  }
  setKnownRole(seat, role) {
    const p = this.getPlayer(seat)
    if (p) p.knownRole = role
  }
  // 导出简版快照（给 LLM）
  snapshot() {
    return { players: this.players.map(p => ({ seat: p.seat, alive: p.alive, executed: p.executed, knownRole: p.knownRole, realRole: p.realRole, tokens: this.getTokens(p.seat) })) }
  }
}

function renderStateTable(state) {
  const rows = state.players.map(p => {
    const tokens = state.getTokens(p.seat).join(', ')
    return `${p.seat}\t${p.alive ? '存活' : '死亡'}\t${p.knownRole || ''}\t${p.realRole || ''}\t${tokens}`
  })
  const header = '座位\t状态\t可见身份\t真实身份\tTokens'
  return [header, ...rows].join('\n')
}

module.exports = { NewSingleAgentState, renderStateTable }
