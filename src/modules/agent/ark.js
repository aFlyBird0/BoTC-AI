const { OpenAI } = require('openai')

class ChatArk {
  constructor({ model, apiKey, baseURL, temperature = 0, extraBody = {} } = {}) {
    this.model = model
    this.temperature = temperature
    this.extraBody = extraBody
    this.client = new OpenAI({ apiKey, baseURL })
  }
  async invoke(messages) {
    const body = {
      model: this.model,
      messages,
      temperature: this.temperature,
      ...this.extraBody
    }
    const r = await this.client.chat.completions.create(body)
    const txt = r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content ? r.choices[0].message.content : ''
    const reason = r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.reasoning_content ? r.choices[0].message.reasoning_content : ''
    return { content: txt, reason: reason, raw: r }
  }
}

module.exports = { ChatArk }