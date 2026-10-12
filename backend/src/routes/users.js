const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requirePermission } = require('../auth');
const { ROLES, ROLE_LABEL, ROLE_PERMISSIONS, PERMISSION_LABEL } = require('../permissions');

const router = express.Router();

function hash(p) {
  return crypto.createHash('sha256').update(p).digest('hex');
}

function serialize(u) {
  return {
    id: u.id,
    username: u.username,
    real_name: u.real_name,
    role: u.role,
    role_label: ROLE_LABEL[u.role] || u.role,
    status: u.status,
    created_at: u.created_at,
  };
}

router.get('/', requirePermission('user:view'), (req, res) => {
  const rows = db.prepare('SELECT * FROM t_user WHERE is_deleted = 0 ORDER BY id').all();
  res.json({ code: 200, data: rows.map(serialize) });
});

router.get('/roles', requirePermission('user:view'), (req, res) => {  res.json({
    code: 200,
    data: ROLES.map((r) => ({
      role: r,
      label: ROLE_LABEL[r],
      permissions: ROLE_PERMISSIONS[r],
      permission_labels: ROLE_PERMISSIONS[r].includes('*')
        ? ['全部权限']
        : ROLE_PERMISSIONS[r].map((p) => PERMISSION_LABEL[p] || p),
    })),
  });
});

router.get('/permissions', requirePermission('user:view'), (req, res) => {
  res.json({ code: 200, data: PERMISSION_LABEL });
});

router.post('/', requirePermission('user:manage'), (req, res) => {
  const { username, password, real_name, role } = req.body || {};
  if (!username || !password || !real_name || !role) {
    return res.status(400).json({ code: 400, message: '账号、密码、姓名、角色均为必填' });
  }
  if (!ROLES.includes(role)) return res.status(400).json({ code: 400, message: '角色不合法' });
  const exists = db.prepare('SELECT id FROM t_user WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ code: 400, message: '账号已存在' });
  const info = db
    .prepare("INSERT INTO t_user (username, password, real_name, role, status) VALUES (?,?,?,?, 'ACTIVE')")
    .run(username, hash(password), real_name, role);
  const row = db.prepare('SELECT * FROM t_user WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ code: 200, message: '用户创建成功', data: serialize(row) });
});

router.put('/:id', requirePermission('user:manage'), (req, res) => {
  const user = db.prepare('SELECT * FROM t_user WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
  const { password, real_name, role, status } = req.body || {};
  if (role && !ROLES.includes(role)) return res.status(400).json({ code: 400, message: '角色不合法' });
  if (role && user.username === 'admin' && role !== 'admin') {
    return res.status(400).json({ code: 400, message: '内置管理员角色不可变更' });
  }
  db.prepare('UPDATE t_user SET password = ?, real_name = ?, role = ?, status = ? WHERE id = ?').run(
    password ? hash(password) : user.password,
    real_name || user.real_name,
    role || user.role,
    status || user.status,
    user.id
  );
  const row = db.prepare('SELECT * FROM t_user WHERE id = ?').get(user.id);
  res.json({ code: 200, message: '用户更新成功', data: serialize(row) });
});

router.delete('/:id', requirePermission('user:manage'), (req, res) => {
  const user = db.prepare('SELECT * FROM t_user WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
  if (user.id === req.user.id) return res.status(400).json({ code: 400, message: '不能删除当前登录账号' });
  if (user.username === 'admin') return res.status(400).json({ code: 400, message: '内置管理员不可删除' });
  db.prepare("UPDATE t_user SET is_deleted = 1, status = 'DISABLED' WHERE id = ?").run(user.id);
  res.json({ code: 200, message: '用户已停用' });
});

module.exports = router;
