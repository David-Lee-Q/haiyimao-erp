const express = require('express');
const { requirePermission } = require('../auth');
const { llm } = require('../config');
const { ask, query } = require('../services/aiAgent');

const router = express.Router();

router.get('/health', requirePermission('ai:use'), (req, res) => {
  res.json({ code: 200, data: { enabled: llm.enabled, model: llm.model, baseUrl: llm.baseUrl } });
});

// 智能问答：支持多轮对话，模型可按需查询数据库
router.post('/chat', requirePermission('ai:use'), async (req, res, next) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ code: 400, message: 'messages 不能为空' });
    }
    const clean = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    const result = await ask(clean);
    res.json({ code: 200, data: { answer: result.answer, queries: result.queries } });
  } catch (e) {
    next(e);
  }
});

// 智能问数：自然语言转 SQL 并返回结果表
router.post('/query', requirePermission('ai:use'), async (req, res, next) => {
  try {
    const { question } = req.body || {};
    if (!question || !String(question).trim()) {
      return res.status(400).json({ code: 400, message: 'question 不能为空' });
    }
    const result = await query(String(question).slice(0, 1000));
    res.json({ code: 200, data: result });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
