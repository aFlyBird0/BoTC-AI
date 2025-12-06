const { record } = require('./collector')

// 交互层：封装标准输出与 stdin 读取
class Interaction {
  broadcast(text) {
    record('event', text)
  }
  send(seat, message) {
    record('event', `座位${seat} 私密: ${message}`)
  }
  // 全局输入：支持“座位号 内容”格式，未携带座位号则 seat=0
  async questionAny(prompt) {
    record('prompt', prompt)
    return await new Promise(resolve => {
      process.stdin.setEncoding('utf8')
      process.stdin.resume()
      const onData = (chunk) => {
        const line = String(chunk || '').replace(/\r?\n$/, '')
        process.stdin.pause()
        process.stdin.removeListener('data', onData)
        const trimmed = line.trim()
        let seat = 0
        let text = trimmed
        const m = trimmed.match(/^(\d+)\s+(.+)$/)
        if (m) { seat = parseInt(m[1], 10); text = m[2] }
        resolve({ seat, text })
      }
      process.stdin.on('data', onData)
    })
  }
  // 定向输入：向指定座位发起提示，读取一行作为回应
  async questionForSeat(seat, prompt) {
    record('prompt', `座位${seat}: ${prompt}`)
    return await new Promise(resolve => {
      process.stdin.setEncoding('utf8')
      process.stdin.resume()
      const onData = (chunk) => {
        const line = String(chunk || '').replace(/\r?\n$/, '')
        process.stdin.pause()
        process.stdin.removeListener('data', onData)
        resolve({ seat, text: line })
      }
      process.stdin.on('data', onData)
    })
  }
}

module.exports = { Interaction }
