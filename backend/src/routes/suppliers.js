const express = require('express');
const db = require('../db');
const { requirePermission } = require('../auth');

const router = express.Router();

router.get('/', requirePermission('supplier:view'), (req, res) => {
  const keyword = (req.query.keyword || '').trim();
  let rows;
  if (keyword) {
    rows = db
      .prepare('SELECT * FROM t_supplier WHERE is_deleted = 0 AND (name LIKE ? OR country LIKE ?) ORDER BY id')
      .all(`%${keyword}%`, `%${keyword}%`);
  } else {
    rows = db.prepare('SELECT * FROM t_supplier WHERE is_deleted = 0 ORDER BY id').all();
  }
  res.json({ code: 200, data: rows });
});

router.get('/:id', requirePermission('supplier:view'), (req, res) => {
  const row = db.prepare('SELECT * FROM t_supplier WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!row) return res.status(404).json({ code: 404, message: '供应商不存在' });
  res.json({ code: 200, data: row });
});

router.post('/', requirePermission('supplier:manage'), (req, res) => {
  const { name, country, contact, credit_limit_cny, credit_used_cny } = req.body || {};
  if (!name || !country) return res.status(400).json({ code: 400, message: '供应商名称与原产国为必填' });
  const info = db
    .prepare('INSERT INTO t_supplier (name, country, contact, credit_limit_cny, credit_used_cny) VALUES (?,?,?,?,?)')
    .run(name, country, contact || null, Number(credit_limit_cny) || 0, Number(credit_used_cny) || 0);
  const row = db.prepare('SELECT * FROM t_supplier WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ code: 200, message: '供应商创建成功', data: row });
});

router.put('/:id', requirePermission('supplier:manage'), (req, res) => {
  const row = db.prepare('SELECT * FROM t_supplier WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!row) return res.status(404).json({ code: 404, message: '供应商不存在' });
  const { name, country, contact, credit_limit_cny, credit_used_cny } = req.body || {};
  db.prepare(
    'UPDATE t_supplier SET name=?, country=?, contact=?, credit_limit_cny=?, credit_used_cny=? WHERE id=?'
  ).run(
    name || row.name,
    country || row.country,
    contact != null ? contact : row.contact,
    credit_limit_cny != null ? Number(credit_limit_cny) : row.credit_limit_cny,
    credit_used_cny != null ? Number(credit_used_cny) : row.credit_used_cny,
    row.id
  );
  const updated = db.prepare('SELECT * FROM t_supplier WHERE id = ?').get(row.id);
  res.json({ code: 200, message: '供应商更新成功', data: updated });
});

router.delete('/:id', requirePermission('supplier:manage'), (req, res) => {
  const row = db.prepare('SELECT * FROM t_supplier WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!row) return res.status(404).json({ code: 404, message: '供应商不存在' });
  const using = db
    .prepare("SELECT COUNT(*) AS c FROM t_purchase_order WHERE supplier_id = ? AND is_deleted = 0 AND status NOT IN ('COMPLETED','CANCELLED','REJECTED')")
    .get(row.id).c;
  if (using > 0) {
    return res.status(400).json({ code: 400, message: `该供应商存在 ${using} 个进行中的采购订单，无法删除` });
  }
  db.prepare('UPDATE t_supplier SET is_deleted = 1 WHERE id = ?').run(row.id);
  res.json({ code: 200, message: '供应商已删除' });
});

module.exports = router;
