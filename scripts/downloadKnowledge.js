const https = require('https')
const fs = require('fs')
const path = require('path')

const targets = [
  { url: 'https://clocktower-wiki.gstonegames.com/index.php?title=%E8%A7%84%E5%88%99%E6%A6%82%E8%A6%81', name: '规则概要.md' },
  { url: 'https://clocktower-wiki.gstonegames.com/index.php?title=%E9%87%8D%E8%A6%81%E7%BB%86%E8%8A%82', name: '重要细节.md' },
  { url: 'https://clocktower-wiki.gstonegames.com/index.php?title=%E6%9C%AF%E8%AF%AD%E6%B1%87%E6%80%BB', name: '术语汇总.md' },
  { url: 'https://clocktower-wiki.gstonegames.com/index.php?title=%E7%BB%99%E8%AF%B4%E4%B9%A6%E4%BA%BA%E7%9A%84%E5%BB%BA%E8%AE%AE', name: '给说书人的建议.md' },
  { url: 'https://clocktower-wiki.gstonegames.com/index.php?title=%E8%A7%84%E5%88%99%E8%A7%A3%E9%87%8A', name: '规则解释.md' },
  { url: 'https://clocktower-wiki.gstonegames.com/index.php?title=%E6%9A%97%E6%B5%81%E6%B6%8C%E5%8A%A8', name: '暗流涌动.md' }
]

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const chunks = []
      res.on('data', d => chunks.push(d))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    }).on('error', reject)
  })
}

function htmlToMd(html) {
  let s = html
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, '')
  s = s.replace(/<footer[\s\S]*?<\/footer>/gi, '')
  s = s.replace(/<header[\s\S]*?<\/header>/gi, '')
  s = s.replace(/<br\s*\/?\s*>/gi, '\n')
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n')
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n')
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n')
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n')
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
  s = s.replace(/<table[\s\S]*?<\/table>/gi, '')
  s = s.replace(/<[^>]+>/g, '')
  s = s.replace(/&nbsp;/g, ' ')
  s = s.replace(/&amp;/g, '&')
  s = s.replace(/&lt;/g, '<')
  s = s.replace(/&gt;/g, '>')
  s = s.replace(/[ \t]+/g, ' ')
  s = s.replace(/\n{3,}/g, '\n\n')
  s = s.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n')
  return s
}

async function main() {
  const dir = path.resolve(process.cwd(), 'knowledge')
  try { fs.mkdirSync(dir) } catch {}
  for (const t of targets) {
    const html = await fetch(t.url)
    const md = htmlToMd(html)
    fs.writeFileSync(path.join(dir, t.name), md, 'utf8')
    process.stdout.write(`saved: ${t.name}\n`)
  }
}

main()