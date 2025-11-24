function createLlmAgent({ } = {}) {
  const baseURL = process.env.BASE_URL || ''
  const model = process.env.MODEL || ''
  const key = process.env.API_KEY || ''
  const { ChatArk } = require('./ark')
  const ROLE_RATIO = {
    5: { townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
    6: { townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
    7: { townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
    8: { townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
    9: { townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
    10: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
    11: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
    12: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
    13: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
    14: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
    15: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 }
  }
  function renderScript(raw) {
    try {
      const entries = Array.isArray(raw) ? raw : []
      const roles = entries.filter(x => x && x.id && x.team && x.id !== '_meta')
      const lines = []
      lines.push('# 剧本完整角色摘要(包含不在场角色)')
      for (const r of roles) {
        lines.push(`- 名称: ${r.name} | 阵营: ${r.team}`)
        if (r.ability) lines.push(`  能力: ${r.ability}`)
      }
      return lines.join('\n')
    } catch {
      return ''
    }
  }
  function buildRoleMessages({ phase, role, stateSnapshot, script }) {
    const sys = [
      '角色: 血染钟楼AI说书人',
      '目标: 在夜晚按剧本与核心规则结算当前角色的行动',
      '输出: 仅返回JSON对象 { "ops": [ { "type": string, "payload": object } ] }',
      '定位: 从 stateSnapshot 找到当前行动角色的座位(优先 realRole=role.name, 否则 knownRole=role.name)',
      '流程:',
      '1) 若本夜不行动或该角色已死亡则返回空 ops',
      '2) 若能力需要选择/确认, 使用 prompt_player(seat, ability) 询问该角色座位; 等待回应后继续',
      '3) 根据回应与规则更新状态: 使用 add_token 或 remove_token (如 保护/中毒/干扰项/失去能力/死于今日 等)',
      '4) 信息传递: 私密信息用 send_to_player; 公共事件用 broadcast',
      '5) 若满足游戏结束条件（没有存活恶魔是善良阵营获胜，仅剩2人且恶魔存活则邪恶获胜，特定角色有特殊胜利条件）则使用 announce_game_end',
      '6) 最后使用 end_role',
      '工具与使用场景:',
      '- prompt_player: 当该角色需要做出选择(指向玩家、选择数字、确认一次性能力)',
      '- send_to_player: 传递私密信息(角色标记、数字手势、是否包含恶魔等)',
      '- broadcast: 公共信息(进入夜晚/白天、处决结果、死亡公告等)',
      '- add_token/remove_token: 记录/清除状态(例如 保护/中毒/干扰项/失去能力/被提名/死于今日)',
      '- announce_game_end: 满足结算结束条件时宣布胜利',
      '- end_role: 结束本角色结算',
      '注意:',
      '- 中毒或认知覆盖(如酒鬼/疯子)会导致信息不可靠, 仍需执行相应提示与标记。此时对应玩家实际上没有对应技能，只是说书人要欺骗玩家让他以为自己有对应技能，其释放的技能一定失效，但得到的信息可对可错，应该根据情况尽量让该玩家不要意识到自己状态异常。',
      '- 不要泄露隐藏信息给全体, 仅向相关玩家私密发送',
    ].join('\n')
    const user = [
      `当前阶段: ${phase}`,
      `当前角色: ${role.name}`,
      `当前角色所属阵营: ${role.team}`,
      `当前角色能力: ${role.ability}`,
      `基于当前角色能力，你(说书人)需要做的事情: ${phase === 'firstNight' ? role.firstNightReminder : role.otherNightReminder}`,
      `当前角色可以为场上添加的token: ${Array.isArray(role.reminders) ? role.reminders.join(',') : ''}`,
      `当前全场状态: ${JSON.stringify(stateSnapshot)}`,
    ].join('\n')
    const msgs = [{ role: 'system', content: sys }, { role: 'user', content: user }]
    if (script) msgs.push({ role: 'user', content: renderScript(script) })
    return msgs
  }
  async function invokeRoleOps(msgs) {
    const chat = new ChatArk({ model, apiKey: key, baseURL, temperature: 0, extraBody: { response_format: { type: 'json_object' } } })
    const r = await chat.invoke(msgs)
    const txt = typeof r.content === 'string' ? r.content : JSON.stringify(r.content)
    process.stdout.write(`=== LLM 响应 (技能执行) ===\n${txt}\n`)
    try {
      const o = JSON.parse(txt);
      return Array.isArray(o.ops) ? o.ops : []
    } catch {
      return []
    }
  }
  async function decideForRole({ phase, role, stateSnapshot, script }) {
    const msgs = buildRoleMessages({ phase, role, stateSnapshot, script })
    process.stdout.write(`=== LLM 请求 (技能执行) ===\n${JSON.stringify({ phase, role: role && role.name })}\n`)
    return await invokeRoleOps(msgs)
  }
  async function decideAllocation({ playerCount, script, customRules }) {
    if (process.env.DEBUG === '1') {
      process.stdout.write(`[Debug]使用固定角色分配\n`)
      return {
        players: [
          { seat: 1, knownRole: '男爵', realRole: '男爵', tokens: [] },
          { seat: 2, knownRole: '洗衣妇', realRole: '洗衣妇', tokens: [] },
          { seat: 3, knownRole: '陌客', realRole: '陌客', tokens: [] },
          { seat: 4, knownRole: '小恶魔', realRole: '小恶魔', tokens: [] },
          { seat: 5, knownRole: '管家', realRole: '管家', tokens: [] },
          { seat: 6, knownRole: '厨师', realRole: '厨师', tokens: [] },
          { seat: 7, knownRole: '士兵', realRole: '士兵', tokens: [] },
          { seat: 8, knownRole: '图书管理员', realRole: '酒鬼', tokens: ['是酒鬼'] }
        ]
      }
    }
    function buildCandidates(raw) {
      const entries = Array.isArray(raw) ? raw : []
      const roles = entries.filter(x => x && x.id && x.team && x.id !== '_meta' && x.team !== 'traveler')
      const byTeam = { townsfolk: [], outsider: [], minion: [], demon: [] }
      for (const r of roles) {
        if (byTeam[r.team]) byTeam[r.team].push({ name: r.name, team: r.team, ability: r.ability })
      }
      const meta = entries.find(x => x && x.id === '_meta') || {}
      return { candidates: byTeam, meta }
    }
    const { candidates, meta } = buildCandidates(script)
    function extractSetupAdjustments(raw) {
      const entries = Array.isArray(raw) ? raw : []
      const list = []
      for (const r of entries) {
        if (!r || r.id === '_meta' || r.team === 'traveler') continue
        const ab = String(r.ability || '')
        const m = ab.match(/\[([^\]]+)\]/)
        if (m) list.push({ name: r.name, team: r.team, text: m[1] })
      }
      return list
    }
    const setupAdjust = extractSetupAdjustments(script)
    const base = ROLE_RATIO[playerCount] || {}
    const sys = [
      '角色: 血染钟楼AI说书人',
      '任务: 根据玩家人数与剧本乱序随机分配角色, 并生成全局token图',
      '输出: 仅返回JSON对象, 格式 { "players": [ { "seat": number, "knownRole": string, "realRole"?: string, "tokens": string[] } ] }',
      '硬约束:',
      '- 所有角色唯一分配 (同名角色不可重复)',
      '- 阵营数量必须满足基础比例 (镇民/外来者/爪牙/恶魔)',
      '- 仅可从候选角色列表中选择分配',
      '初始比例特殊调整规则:',
      '- 如果你决定初始角色中包含以下任意一个角色，你在按照初始比例分配角色之后，还需要按照对应角色技能描述的[]内的要求继续进行调整，对应的差额数量从镇民中扣除',
      ...(setupAdjust.length ? setupAdjust.map(a => `- ${a.name}(${a.team}): ${a.text}`) : ['- (本剧本不包含可影响初始比例的角色)']),
      '一致性规则:',
      '- 若技能描述包含“你以为自己是xxx”（认知覆盖类角色）, 则 knownRole 与 realRole 不一致, knownRole要按照角色能力描述分配；否则 knownRole=realRole',
      '- 座位号从 1 到玩家总数连续分配',
      '提示: 初始 tokens 请根据 setup 与开局信息最小化生成 (如 "是酒鬼"、必要的提醒等)',
    ].join('\n')
    const userPayload = {
      playerCount,
      baseRatio: base,
      scriptName: meta && meta.name || '',
      candidates,
      require: { format: { players: [{ seat: 1, knownRole: '', realRole: '', tokens: [] }] } }
    }
    const user = JSON.stringify(userPayload)
    const msgs = [{ role: 'system', content: sys }, { role: 'user', content: user }]
    if (customRules) msgs.push({ role: 'user', content: customRules })
    process.stdout.write(`=== LLM 请求 (角色分配) ===\n${JSON.stringify({ sys, user, customRules })}\n`)
    const chat = new ChatArk({ model, apiKey: key, baseURL, temperature: 0, extraBody: { response_format: { type: 'json_object' } } })
    const r = await chat.invoke(msgs)
    const txt = typeof r.content === 'string' ? r.content : JSON.stringify(r.content)
    process.stdout.write(`=== LLM 响应 (角色分配) ===\n${txt}\n`)
    try {
      const obj = JSON.parse(txt)
      const { shuffleTokenMap } = require('./playerShuffle')
      return shuffleTokenMap(obj)
    } catch {
      return null
    }
  }
  return { decideForRole, decideAllocation, buildRoleMessages, invokeRoleOps }
}

module.exports = { createLlmAgent }