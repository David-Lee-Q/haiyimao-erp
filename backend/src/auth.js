const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('./config');
const { hasPermission, permissionsOf } = require('./permissions');

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, real_name: user.real_name, role: user.role },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录或登录已过期' });
  }
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch (e) {
    return res.status(401).json({ code: 401, message: '登录状态无效，请重新登录' });
  }
}

function requirePermission(code) {
  return (req, res, next) => {
    if (!req.user || !hasPermission(req.user.role, code)) {
      return res.status(403).json({ code: 403, message: `当前角色无「${code}」操作权限` });
    }
    next();
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: '当前角色无该操作权限' });
    }
    next();
  };
}

module.exports = { signToken, authRequired, requirePermission, requireRole, permissionsOf };
