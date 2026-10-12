const express = require('express');
const db = require('../db');
const { ZONE_LABELS } = require('../constants');
const { requirePermission } = require('../auth');

const router = express.Router();

const ZONE_MAX_TEMP = { CHILLED: 4, FROZEN: -15, AMBIENT: 25 };
const CONSECUTIVE_LIMIT = 3;

router.get('/', requirePermission('monitor:view'), (req, res) => {
  const { status } = req.query;
  const conditions = ['is_deleted = 0'];
  const params = [];
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  const rows = db.prepare(`SELECT * FROM t_alert WHERE ${conditions.join(' AND ')} ORDER BY id DESC`).all(...params);
  res.json({ code: 200, data: rows });
});

router.post('/temperature', requirePermission('monitor:view'), (req, res) => {
  const { batch_id, temperature, warehouse_name } = req.body || {};
  const batch = db.prepare('SELECT * FROM t_inventory_batch WHERE id = ?').get(batch_id);
  if (!batch) return res.status(404).json({ code: 404, message: '库存批次不存在' });
  const temp = Number(temperature);
  db.prepare(
    `INSERT INTO t_temperature_log (batch_id, warehouse_name, temperature) VALUES (?,?,?)`
  ).run(batch_id, warehouse_name || batch.warehouse_name, temp);

  const maxTemp = ZONE_MAX_TEMP[batch.zone_type] ?? 4;
  const recent = db
    .prepare('SELECT * FROM t_temperature_log WHERE batch_id = ? ORDER BY id DESC LIMIT ?')
    .all(batch_id, CONSECUTIVE_LIMIT);

  let alertCreated = null;
  const over = recent.filter((r) => r.temperature > maxTemp);
  if (recent.length === CONSECUTIVE_LIMIT && over.every((r) => r.temperature > maxTemp)) {
    const existing = db
      .prepare(`SELECT * FROM t_alert WHERE batch_id = ? AND alert_type='TEMPERATURE' AND status='OPEN'`)
      .get(batch_id);
    if (!existing) {
      const info = db
        .prepare(
          `INSERT INTO t_alert (alert_type, level, batch_id, batch_code, warehouse_name, message)
           VALUES ('TEMPERATURE','HIGH',?,?,?,?)`
        )
        .run(
          batch_id,
          batch.batch_code,
          warehouse_name || batch.warehouse_name,
          `${batch.warehouse_name} 批次 ${batch.batch_code}（${ZONE_LABELS[batch.zone_type] || batch.zone_type}）连续${CONSECUTIVE_LIMIT}次温度 ${temp}°C 超过上限 ${maxTemp}°C，已生成高优先级警报并锁定该批次销售`
        );
      db.prepare(`UPDATE t_inventory_batch SET sales_locked = 1, lock_reason = ? WHERE id = ?`).run(
        '冷链温度异常，等待品质确认',
        batch_id
      );
      alertCreated = db.prepare('SELECT * FROM t_alert WHERE id = ?').get(info.lastInsertRowid);
    }
  }

  res.json({
    code: 200,
    message: alertCreated ? '温度异常，已触发高优先级警报并锁定批次' : '温度数据已记录',
    data: { temperature: temp, max_temp: maxTemp, alert: alertCreated },
  });
});

router.get('/temperature/:batchId', requirePermission('monitor:view'), (req, res) => {
  const rows = db
    .prepare('SELECT * FROM t_temperature_log WHERE batch_id = ? ORDER BY id DESC LIMIT 50')
    .all(req.params.batchId);
  res.json({ code: 200, data: rows });
});

router.post('/:id/resolve', requirePermission('monitor:handle'), (req, res) => {
  const alert = db.prepare('SELECT * FROM t_alert WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!alert) return res.status(404).json({ code: 404, message: '警报不存在' });
  const unlock = req.body && req.body.unlock === true;
  db.transaction(() => {
    db.prepare(`UPDATE t_alert SET status='RESOLVED' WHERE id = ?`).run(alert.id);
    if (unlock && alert.batch_id) {
      db.prepare(`UPDATE t_inventory_batch SET sales_locked = 0, lock_reason = NULL WHERE id = ?`).run(alert.batch_id);
    }
  })();
  res.json({ code: 200, message: '警报已处理', data: { unlock } });
});

router.delete('/:id', requirePermission('monitor:handle'), (req, res) => {
  const alert = db.prepare('SELECT * FROM t_alert WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!alert) return res.status(404).json({ code: 404, message: '警报不存在' });
  db.prepare('UPDATE t_alert SET is_deleted = 1 WHERE id = ?').run(alert.id);
  res.json({ code: 200, message: '警报已删除' });
});

module.exports = router;
