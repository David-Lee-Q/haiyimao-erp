const express = require('express');
const db = require('../db');
const { requirePermission } = require('../auth');

const router = express.Router();

router.get('/', requirePermission('audit:view'), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const rows = db.prepare('SELECT * FROM t_audit_log ORDER BY id DESC LIMIT ?').all(limit);
  res.json({ code: 200, data: rows });
});

module.exports = router;
