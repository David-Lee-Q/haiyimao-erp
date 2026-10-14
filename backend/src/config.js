const path = require('path');
const fs = require('fs');

// 简单的 .env 加载器（无需额外依赖），仅在后端目录下读取
function loadEnvFile() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx < 0) continue;
    const key = t.slice(0, idx).trim();
    let val = t.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile();

module.exports = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'fresh-trade-erp-secret-dev',
  jwtExpiresIn: '12h',
  dbFile: process.env.DB_FILE || path.join(__dirname, '..', 'data', 'erp.db'),
  llm: {
    baseUrl: process.env.LLM_BASE_URL || 'https://gpt.cosmoplat.com/v1',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'cosmo-mind',
    enabled: !!process.env.LLM_API_KEY,
  },
};
