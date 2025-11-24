function createStoryteller({ interaction, state, script }) {
  let pendingPrompt = null
  let resolvePrompt = null
  let paused = false
  function printPrompt(targetSeat, payload) {
    const who = typeof targetSeat === 'number' ? targetSeat : '未知座位'
    const role = payload && payload.roleName ? payload.roleName : ''
    const ability = payload && payload.ability ? payload.ability : ''
    process.stdout.write(`询问: 座位 ${who} 角色 ${role}\n提示: ${ability}\n期待: 请按提示进行选择或确认\n`)
  }
  function printPromptResponse(seat, text) {
    process.stdout.write(`回应: 座位 ${seat} -> ${text}\n`)
  }
  async function onPlayerMessage(seat, text) {
    if (typeof text === 'string' && text.startsWith('!token ')) {
      const parts = text.trim().split(/\s+/)
      const action = parts[1]
      const target = parseInt(parts[2], 10)
      const token = parts[3]
      if (action === 'add' && target && token) state.addToken(target, token)
      if (action === 'remove' && target && token) state.removeToken(target, token)
      process.stdout.write(`广播: token 更新 座位 ${target} => [${state.getTokens(target).join(', ')}]\n`)
      return
    }
    if (paused && pendingPrompt) {
      if (!pendingPrompt.seat || pendingPrompt.seat === seat) {
        const ctx = pendingPrompt.context || {}
        if (ctx.type === 'execution') {
          const t = String(text || '').trim().toLowerCase()
          if (t === 'none' || t === 'skip') {
            process.stdout.write('广播: 白天无人处决\n')
            printPromptResponse(seat, text)
          } else if (t.startsWith('execute ')) {
            const num = parseInt(t.split(/\s+/)[1], 10)
            if (num && state.getPlayer(num)) {
              state.markExecuted(num)
              process.stdout.write(`广播: 白天处决座位 ${num}\n`)
              printPromptResponse(seat, text)
            } else {
              process.stdout.write('提示: 输入 "execute 座位号" 或 "none"\n')
              return
            }
          } else {
            process.stdout.write('提示: 输入 "execute 座位号" 或 "none"\n')
            return
          }
        } else if (ctx.type === 'continue') {
          const t = String(text || '').trim().toLowerCase()
          if (t !== 'ok') { process.stdout.write('提示: 输入 ok 继续\n'); return }
          printPromptResponse(seat, text)
        } else {
          printPromptResponse(seat, text)
        }
        const r = { seat, text, context: ctx }
        pendingPrompt = null
        paused = false
        if (resolvePrompt) { const fn = resolvePrompt; resolvePrompt = null; fn(r) }
        return
      }
    }
  }
  async function startNight() {
    interaction.broadcast({ type: 'phase', value: 'night' })
    process.stdout.write('广播: 进入夜晚\n')
  }
  async function startDay() {
    interaction.broadcast({ type: 'phase', value: 'day' })
    process.stdout.write('广播: 进入白天\n')
    pendingPrompt = { seat: null, context: { type: 'execution' } }
    paused = true
    process.stdout.write('询问: 白天提名与处决\n提示: 输入 "execute 座位号" 或 "none"\n期待: 处决一名玩家或无人处决\n')
  }
  async function applyOps(ops) {
    let ended = false
    for (const op of ops || []) {
      if (op.type === 'broadcast') interaction.broadcast(op.payload)
      if (op.type === 'prompt_player') { printPrompt(op.payload && op.payload.seat ? Number(op.payload.seat) : null, op.payload || {}); pendingPrompt = { seat: op.payload && op.payload.seat ? Number(op.payload.seat) : null, context: op.payload }; paused = true }
      if (op.type === 'send_to_player') interaction.send(op.payload.seat, op.payload.message)
      if (op.type === 'add_token') state.addToken(op.payload.seat, op.payload.token)
      if (op.type === 'remove_token') state.removeToken(op.payload.seat, op.payload.token)
      if (op.type === 'announce_game_end') { interaction.broadcast({ type: 'game_end', payload: op.payload }); ended = true }
      if (op.type === 'end_role') {}
      if (paused) break
    }
    return { ended, paused }
  }
  function isPaused() { return paused }
  function awaitResponse() {
    if (!paused) return Promise.resolve(null)
    return new Promise(resolve => { resolvePrompt = resolve })
  }
  function promptContinue() {
    pendingPrompt = { seat: null, context: { type: 'continue' } }
    paused = true
    process.stdout.write('询问: 继续当前流程\n提示: 输入 ok 继续\n期待: 继续下一步\n')
  }
  return { onPlayerMessage, startNight, startDay, applyOps, isPaused, awaitResponse, promptContinue }
}

module.exports = { createStoryteller }