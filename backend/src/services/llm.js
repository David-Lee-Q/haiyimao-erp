const { llm } = require('../config');

async function chat(messages, opts = {}) {
  if (!llm.apiKey) {
    const e = new Error('未配置大模型 API Key，请在 backend/.env 中设置 LLM_API_KEY');
    e.status = 503;
    throw e;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout || 60000);
  try {
    const res = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model || llm.model,
        messages,
        temperature: opts.temperature != null ? opts.temperature : 0.2,
        max_tokens: opts.maxTokens || 1500,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      const e = new Error(`大模型接口返回 ${res.status}：${text.slice(0, 200)}`);
      e.status = 502;
      throw e;
    }
    const data = await res.json();
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    return (msg && msg.content) || '';
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('大模型响应超时，请稍后重试');
      err.status = 504;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { chat };
