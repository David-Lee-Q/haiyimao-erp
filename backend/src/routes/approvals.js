const express = require('express');
const db = require('../db');
const { requirePermission } = require('../auth');

const router = express.Router();

const BIZ_LABEL = {
  PURCHASE_ORDER: '采购订单审批',
  WEIGHT_VARIANCE: '磅差理赔单',
  FEFO_FORCE: '临期批次强制出库',
};

router.get('/', requirePermission('approval:view'), (req, res) => {
  const { status } = req.query;
  const where = status ? 'WHERE a.status = ?' : '';
  const params = status ? [status] : [];
  const rows = db
    .prepare(
      `SELECT a.*, u.real_name AS applicant_name, ap.real_name AS approver_name
       FROM t_approval a
       LEFT JOIN t_user u ON u.id = a.applicant_id
       LEFT JOIN t_user ap ON ap.id = a.approver_id
       ${where}
       ORDER BY a.id DESC`
    )
    .all(...params);
  res.json({ code: 200, data: rows.map((r) => ({ ...r, biz_label: BIZ_LABEL[r.biz_type] || r.biz_type })) });
});

router.post('/:id/approve', requirePermission('approval:handle'), (req, res) => {
  const row = db.prepare('SELECT * FROM t_approval WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ code: 404, message: '审批单不存在' });
  if (row.status !== 'PENDING') return res.status(400).json({ code: 400, message: '该审批单已处理' });
  db.prepare("UPDATE t_approval SET status='APPROVED', approver_id=?, handled_at=CURRENT_TIMESTAMP WHERE id=?").run(req.user.id, row.id);
  if (row.biz_type === 'FEFO_FORCE') {
    db.prepare('UPDATE t_inventory_batch SET sales_locked = 0 WHERE id = ?').run(row.biz_id);
  }
  res.json({ code: 200, message: '审批已通过' });
});

router.post('/:id/reject', requirePermission('approval:handle'), (req, res) => {
  const row = db.prepare('SELECT * FROM t_approval WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ code: 404, message: '审批单不存在' });
  if (row.status !== 'PENDING') return res.status(400).json({ code: 400, message: '该审批单已处理' });
  db.prepare("UPDATE t_approval SET status='REJECTED', approver_id=?, handled_at=CURRENT_TIMESTAMP WHERE id=?").run(req.user.id, row.id);
  res.json({ code: 200, message: '审批已驳回' });
});

module.exports = router;
