const { renderScript, parseScript } = require('../game/scriptLoader')
const { ChatArk } = require('./ark')

/**
 * allocate -> start -> storyTellerAgent -> (night) -> roleAgent 
 * 
 * storyTellerAgent -> {
 * // entry : runRoleFinish/start
 *  input() 我是X号，我要询问/放技能/提名
 *  tools()  { // 魔典interface
 *    day/night
 *    kill
 *    ...
 *  }
 *  seqList() 夜间行动顺序表
 * }
 * 
 */

function createStoryTellerAgent({ } = {}) {

    function buildPrompt({state, time, script}) {
        const sys = `角色: 血染钟楼AI说书人
    目标: 白天处决结束后进行一次胜利判定与必要的身份变更
    输出: 仅返回json对象 { "ops": [ { "type": string, "payload": object } ] }
    可用工具: 仅允许 gameover、end_role、change_character
    说明: 若无胜利条件满足，请返回 end_role；若满足则返回 gameover（包含胜利阵营/玩家与原因）。若因处决触发身份变更（如红唇女郎成为恶魔），请先返回 change_character 再返回 end_role`
        const user = `当前全场状态: ${JSON.stringify(state)}
    当前时间: ${time}`
        const msgs = [{ role: 'system', content: sys }, { role: 'user', content: user }]
        if (script) msgs.push({ role: 'user', content: renderScript(script) })
        return msgs
    }

}


module.exports = { createStoryTellerAgent }
