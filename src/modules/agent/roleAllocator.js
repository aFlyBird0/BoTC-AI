const { createLlmAgent } = require('./llmAgent')

async function allocateRoles({ playerCount, scriptData, customRules }) {
  const llm = createLlmAgent({})
  const res = await llm.decideAllocation({ playerCount, script: scriptData, customRules })
  return res
}

module.exports = { allocateRoles }