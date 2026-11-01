const db = require('../db');

function listConversations(userId, limit = 50) {
  return db
    .prepare(
      `SELECT c.id, c.title, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM t_ai_message m WHERE m.conversation_id = c.id AND m.role = 'user') AS message_count
         FROM t_ai_conversation c
        WHERE c.user_id = ? AND c.is_deleted = 0
        ORDER BY c.updated_at DESC, c.id DESC
        LIMIT ?`
    )
    .all(userId, limit);
}

function getConversation(id, userId) {
  const conv = db.prepare('SELECT * FROM t_ai_conversation WHERE id = ? AND user_id = ? AND is_deleted = 0').get(id, userId);
  if (!conv) return null;
  const rows = db.prepare('SELECT * FROM t_ai_message WHERE conversation_id = ? ORDER BY id').all(id);
  const messages = rows.map((m) => ({
    role: m.role,
    content: m.content,
    queries: m.queries ? safeParse(m.queries) : undefined,
  }));
  return { id: conv.id, title: conv.title, created_at: conv.created_at, updated_at: conv.updated_at, messages };
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return undefined;
  }
}

function createConversation(userId, title) {
  const info = db
    .prepare('INSERT INTO t_ai_conversation (user_id, title) VALUES (?, ?)')
    .run(userId, title ? String(title).slice(0, 40) : null);
  return info.lastInsertRowid;
}

function belongsTo(id, userId) {
  const row = db.prepare('SELECT id FROM t_ai_conversation WHERE id = ? AND user_id = ? AND is_deleted = 0').get(id, userId);
  return !!row;
}

function addMessage(conversationId, role, content, queries) {
  db.prepare('INSERT INTO t_ai_message (conversation_id, role, content, queries) VALUES (?,?,?,?)').run(
    conversationId,
    role,
    String(content == null ? '' : content).slice(0, 20000),
    queries && queries.length ? JSON.stringify(queries).slice(0, 20000) : null
  );
  db.prepare('UPDATE t_ai_conversation SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId);
}

function renameIfEmpty(id, title) {
  const conv = db.prepare('SELECT title FROM t_ai_conversation WHERE id = ?').get(id);
  if (conv && !conv.title) {
    db.prepare('UPDATE t_ai_conversation SET title = ? WHERE id = ?').run(String(title).slice(0, 40), id);
  }
}

function removeConversation(id, userId) {
  const info = db.prepare('UPDATE t_ai_conversation SET is_deleted = 1 WHERE id = ? AND user_id = ?').run(id, userId);
  return info.changes > 0;
}

module.exports = {
  listConversations,
  getConversation,
  createConversation,
  belongsTo,
  addMessage,
  renameIfEmpty,
  removeConversation,
};
