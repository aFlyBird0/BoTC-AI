const readline = require('readline')

function createCliAdapter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  let handler = null
  function askSeat() {
    rl.question('座位号> ', s => {
      const seat = parseInt(s, 10)
      if (!seat) return askSeat()
      rl.question('文本> ', t => {
        if (handler) handler(seat, t)
        askSeat()
      })
    })
  }
  askSeat()
  function send(toSeat, payload) {
    if (typeof toSeat === 'number') process.stdout.write(`[发送给${toSeat}] ${JSON.stringify(payload)}\n`)
  }
  function broadcast(payload) {
    process.stdout.write(`[广播] ${JSON.stringify(payload)}\n`)
  }
  function receive(cb) {
    handler = cb
  }
  function close() {
    rl.close()
  }
  return { send, broadcast, receive, close }
}

module.exports = { createCliAdapter }