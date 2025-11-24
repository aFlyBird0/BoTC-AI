const { parseScript } = require('./scriptLoader')

class GameEngine {
  constructor({ scriptData, storyteller, llmAgent, state }) {
    this.storyteller = storyteller
    this.llm = llmAgent
    this.state = state
    this.script = parseScript(scriptData)
    this.rawScriptData = scriptData
    this.ended = false
    this.nightCounter = 0
  }
  renderStateTable() {
    const rows = this.state.players.map(p => {
      const tokens = this.state.getTokens(p.seat).join(', ')
      return `${p.seat}\t${p.alive ? '存活' : '死亡'}\t${p.knownRole || ''}\t${p.realRole || ''}\t${tokens}`
    })
    const header = '座位\t状态\t可见身份\t真实身份\tTokens'
    return [header, ...rows].join('\n')
  }
  printOps(ops) {
    if (!Array.isArray(ops)) return
    process.stdout.write('工具调用:\n')
    for (const op of ops) {
      const type = op.type
      const pl = op.payload || {}
      const line = `${type} ${JSON.stringify(pl)}`
      process.stdout.write(`- ${line}\n`)
    }
  }
  async runFirstNight() {
    this.nightCounter = 1
    process.stdout.write(`夜晚 ${this.nightCounter} 开始\n${this.renderStateTable()}\n`)
    await this.storyteller.startNight()
    for (const role of this.script.nightOrder.firstNight) {
      if (Number(role.firstNight) === 0) { continue }
      await this.runRoleConversation('firstNight', role)
      if (this.ended) return
    }
    process.stdout.write(`夜晚 ${this.nightCounter} 结束\n${this.renderStateTable()}\n`)
  }
  async runOtherNight() {
    this.nightCounter += 1
    process.stdout.write(`夜晚 ${this.nightCounter} 开始\n${this.renderStateTable()}\n`)
    await this.storyteller.startNight()
    for (const role of this.script.nightOrder.otherNight) {
      if (Number(role.otherNight) === 0) { continue }
      await this.runRoleConversation('otherNight', role)
      if (this.ended) return
    }
    process.stdout.write(`夜晚 ${this.nightCounter} 结束\n${this.renderStateTable()}\n`)
  }
  async runDay() {
    process.stdout.write(`白天 开始\n${this.renderStateTable()}\n`)
    await this.storyteller.startDay()
    await this.storyteller.awaitResponse()
    process.stdout.write(`白天 结束\n${this.renderStateTable()}\n`)
  }
  async loop(maxCycles = 20) {
    let cycles = 0
    await this.runFirstNight()
    while (!this.ended && cycles < maxCycles) {
      await this.runDay()
      if (this.ended) break
      await this.runOtherNight()
      cycles++
    }
  }
  async runRoleConversation(phase, role) {
    const baseMsgs = this.llm.buildRoleMessages({ phase, role, stateSnapshot: this.state.snapshot(), script: this.rawScriptData })
    const msgs = baseMsgs.slice()
    const maxSteps = 10
    for (let step = 0; step < maxSteps; step++) {
      const ops = await this.llm.invokeRoleOps(msgs)
      if (!ops || ops.length === 0) break
      this.printOps(ops)
      msgs.push({ role: 'assistant', content: JSON.stringify({ ops }) })
      const r = await this.storyteller.applyOps(ops)
      if (r && r.ended) { this.ended = true; return }
      const hasEnd = ops.some(o => o.type === 'end_role')
      if (r && r.paused) {
        const resp = await this.storyteller.awaitResponse()
        msgs.push({ role: 'user', content: JSON.stringify({ event: 'player_response', seat: resp && resp.seat, text: resp && resp.text, context: resp && resp.context, state: this.state.snapshot() }) })
        continue
      }
      if (hasEnd) break
      break
    }
  }
}

module.exports = { GameEngine }