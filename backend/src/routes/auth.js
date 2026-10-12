const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { signToken, authRequired } = require('../auth');
const { permissionsOf, ROLE_LABEL } = require('../permissions');

const router = express.Router();

function hash(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '请输入账号和密码' });
  }
  const user = db.prepare('SELECT * FROM t_user WHERE username = ? AND is_deleted = 0').get(username);
  if (!user || user.password !== hash(password)) {
    return res.status(401).json({ code: 401, message: '账号或密码错误' });
  }
  if (user.status !== 'ACTIVE') {
    return res.status(403).json({ code: 403, message: '账号已停用，请联系管理员' });
  }
  const token = signToken(user);
  return res.json({
    code: 200,
    message: '登录成功',
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        real_name: user.real_name,
        role: user.role,
        role_label: ROLE_LABEL[user.role] || user.role,
        permissions: permissionsOf(user.role),
      },
    },
  });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM t_user WHERE id = ? AND is_deleted = 0').get(req.user.id);
  if (!user) return res.status(401).json({ code: 401, message: '账号不存在' });
  return res.json({
    code: 200,
    data: {
      id: user.id,
      username: user.username,
      real_name: user.real_name,
      role: user.role,
      role_label: ROLE_LABEL[user.role] || user.role,
      permissions: permissionsOf(user.role),
    },
  });
});

module.exports = router;
