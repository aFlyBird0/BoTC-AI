const fs = require('fs')
const path = require('path')

const SCRIPTS_DIR = path.resolve(process.cwd(), 'game_script')

async function listScripts() {
  try {
    const files = await fs.promises.readdir(SCRIPTS_DIR)
    return files.filter(f => f.toLowerCase().endsWith('.json'))
  } catch {
    return []
  }
}

async function loadScript(filename) {
  const full = path.isAbsolute(filename) ? filename : path.join(SCRIPTS_DIR, filename)
  const raw = await fs.promises.readFile(full, 'utf8')
  const data = JSON.parse(raw)
  return data
}

function parseScript(data) {
  const roles = data.filter(x => x && x.id && x.team && x.id !== '_meta' && x.team !== 'traveler')
  const meta = data.find(x => x && x.id === '_meta') || {}
  const firstNight = roles.filter(r => Number(r.firstNight) > 0).sort((a, b) => Number(a.firstNight) - Number(b.firstNight))
  const otherNight = roles.filter(r => Number(r.otherNight) > 0).sort((a, b) => Number(a.otherNight) - Number(b.otherNight))
  return { roles, nightOrder: { firstNight, otherNight }, meta }
}

module.exports = { listScripts, loadScript, parseScript }