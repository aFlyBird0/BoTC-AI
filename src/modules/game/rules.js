const { allocateRoles } = require('../agent/roleAllocator')

async function determineRoleCounts(playerCount, script, customRules) {
  const res = await allocateRoles({ playerCount, scriptData: script, customRules })
  return res || null
}

function checkVictory(state, script) {
  return { ended: false, winner: null, reason: null }
}

module.exports = { determineRoleCounts, checkVictory }