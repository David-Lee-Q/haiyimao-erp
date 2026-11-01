const express = require('express');
const { requirePermission } = require('../auth');
const { llm } = require('../config');
const { ask, query } = require('../services/aiAgent');
const conv = require('../services/aiConversation');

const router = express.Router();

router.get('/health', requirePermission('ai:use'), (req, res) => {
  res.json({ code: 200, data: { enabled: llm.enabled, model: llm.model, baseUrl: llm.baseUrl } });
});

// 会话列表（当前用户）
router.get('/conversations', requirePermission('ai:use'), (req, res, next) => {
  try {
    res.json({ code: 200, data: conv.listConversations(req.user.id) });
  } catch (e) {
    next(e);
  }
});

// 新建会话
router.post('/conversations', requirePermission('ai:use'), (req, res, next) => {
  try {
    const { title } = req.body || {};
    const id = conv.createConversation(req.user.id, title);
    res.json({ code: 200, data: { id, title: title || null, messages: [] } });
  } catch (e) {
    next(e);
  }
});

// 会话详情（含消息）
router.get('/conversations/:id', requirePermission('ai:use'), (req, res, next) => {
  try {
    const data = conv.getConversation(Number(req.params.id), req.user.id);
    if (!data) return res.status(404).json({ code: 404, message: '会话不存在' });
    res.json({ code: 200, data });
  } catch (e) {
    next(e);
  }
});

// 删除会话（软删除）
router.delete('/conversations/:id', requirePermission('ai:use'), (req, res, next) => {
  try {
    const ok = conv.removeConversation(Number(req.params.id), req.user.id);
    if (!ok) return res.status(404).json({ code: 404, message: '会话不存在' });
    res.json({ code: 200, data: { removed: true } });
  } catch (e) {
    next(e);
  }
});

// 智能问答：支持多轮对话，模型可按需查询数据库；对话内容持久化
router.post('/chat', requirePermission('ai:use'), async (req, res, next) => {
  try {
    const { messages, conversation_id } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ code: 400, message: 'messages 不能为空' });
    }
    const clean = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    const lastUser = [...clean].reverse().find((m) => m.role === 'user');

    const userId = req.user.id;
    let convId = conversation_id ? Number(conversation_id) : null;
    if (convId && !conv.belongsTo(convId, userId)) {
      return res.status(404).json({ code: 404, message: '会话不存在' });
    }

    const result = await ask(clean);

    if (!convId) {
      convId = conv.createConversation(userId, lastUser && lastUser.content);
    } else if (lastUser) {
      conv.renameIfEmpty(convId, lastUser.content);
    }
    if (lastUser) conv.addMessage(convId, 'user', lastUser.content);
    conv.addMessage(convId, 'assistant', result.answer, result.queries);

    res.json({ code: 200, data: { answer: result.answer, queries: result.queries, conversation_id: convId } });
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
