const express = require('express');
const db = require('../db');
const { nextSeqCode, round } = require('../utils');
const { requirePermission } = require('../auth');

const router = express.Router();

function remainingRatio(batch) {
  const today = new Date().toISOString().slice(0, 10);
  const days = (new Date(batch.expiry_date) - new Date(today)) / 86400000;
  if (!batch.shelf_life_days) return 1;
  return round(days / batch.shelf_life_days, 4);
}

router.get('/orders', requirePermission('sales:view'), (req, res) => {
  const rows = db.prepare('SELECT * FROM t_sales_order WHERE is_deleted = 0 ORDER BY id DESC').all();
  const withItems = rows.map((o) => ({ ...o, items: db.prepare('SELECT * FROM t_sales_order_item WHERE so_id = ? ORDER BY id').all(o.id) }));
  res.json({ code: 200, data: withItems });
});

router.get('/orders/:id', requirePermission('sales:view'), (req, res) => {
  const o = db.prepare('SELECT * FROM t_sales_order WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!o) return res.status(404).json({ code: 404, message: '销售出库单不存在' });
  res.json({ code: 200, data: { ...o, items: db.prepare('SELECT * FROM t_sales_order_item WHERE so_id = ? ORDER BY id').all(o.id) } });
});

router.post('/orders', requirePermission('sales:create'), (req, res) => {
  const { customer, remark, items } = req.body || {};
  if (!customer) return res.status(400).json({ code: 400, message: '客户名称不能为空' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ code: 400, message: '销售明细不能为空' });

  const soCode = nextSeqCode(db, 't_sales_order', 'so_code', 'SO');

  for (const item of items) {
    const boxes = Number(item.box_count);
    if (!(boxes > 0)) return res.status(400).json({ code: 400, message: '出库箱数必须大于0' });
    if (item.batch_id) {
      const batch = db.prepare('SELECT * FROM t_inventory_batch WHERE id = ? AND is_deleted = 0').get(item.batch_id);
      if (!batch) return res.status(404).json({ code: 404, message: `批次 ${item.batch_id} 不存在` });
      if (batch.sales_locked) return res.status(400).json({ code: 400, message: `批次 ${batch.batch_code} 已被锁定（${batch.lock_reason || '品质原因'}），禁止出库` });
      if (batch.current_boxes < boxes) return res.status(400).json({ code: 400, message: `批次 ${batch.batch_code} 库存不足（剩余 ${batch.current_boxes} 箱）` });
      const ratio = remainingRatio(batch);
      const approved = db.prepare("SELECT * FROM t_approval WHERE biz_type='FEFO_FORCE' AND biz_id=? AND status='APPROVED'").get(batch.id);
      if (ratio < 0.2 && !approved) {
        const existing = db.prepare("SELECT * FROM t_approval WHERE biz_type='FEFO_FORCE' AND biz_id=? AND status='PENDING'").get(batch.id);
        if (!existing) {
          db.prepare('INSERT INTO t_approval (biz_type, biz_id, reason, status, applicant_id) VALUES (?,?,?,?,?)').run(
            'FEFO_FORCE', batch.id,
            `强制出库临期批次 ${batch.batch_code}，剩余保质期比例 ${(ratio * 100).toFixed(1)}%（低于20%），需生鲜品质主管二次审批`,
            'PENDING', req.user.id
          );
        }
        return res.status(409).json({
          code: 409,
          message: `批次 ${batch.batch_code} 剩余保质期仅 ${(ratio * 100).toFixed(1)}%，低于20%，已触发二次审批，请等待生鲜品质主管审核`,
          data: { batch_id: batch.id, batch_code: batch.batch_code, remaining_ratio: ratio, fefo_warning: true },
        });
      }
    }
  }

  const result = db.transaction(() => {
    const info = db.prepare('INSERT INTO t_sales_order (so_code, customer, status, remark, created_by) VALUES (?,?,?,?,?)').run(soCode, customer, 'CREATED', remark || null, req.user.id);
    const soId = info.lastInsertRowid;
    const insertItem = db.prepare(
      `INSERT INTO t_sales_order_item (so_id, sku_code, batch_id, batch_code, box_count, net_weight, remaining_ratio, fefo_warning)
       VALUES (?,?,?,?,?,?,?,?)`
    );
    let totalBoxes = 0;
    let totalWeight = 0;

    for (const item of items) {
      const sku = item.sku_code;
      let needBoxes = Number(item.box_count);

      if (item.batch_id) {
        const batch = db.prepare('SELECT * FROM t_inventory_batch WHERE id = ?').get(item.batch_id);
        const perBoxWeight = batch.current_boxes > 0 ? batch.current_net_weight / batch.current_boxes : 0;
        const netWeight = round(needBoxes * perBoxWeight);
        db.prepare(
          "UPDATE t_inventory_batch SET current_boxes = current_boxes - ?, current_net_weight = current_net_weight - ?, status = CASE WHEN current_boxes - ? <= 0 THEN 'OUT_OF_STOCK' ELSE status END WHERE id = ?"
        ).run(needBoxes, netWeight, needBoxes, batch.id);
        db.prepare('INSERT INTO t_inventory_log (batch_id, batch_code, action, box_delta, weight_delta, before_boxes, after_boxes, reason, operator_id) VALUES (?,?,?,?,?,?,?,?,?)')
          .run(batch.id, batch.batch_code, 'SALES_OUT', -needBoxes, -netWeight, batch.current_boxes, batch.current_boxes - needBoxes, '销售出库', req.user.id);
        insertItem.run(soId, sku, batch.id, batch.batch_code, needBoxes, netWeight, remainingRatio(batch), 1);
        totalBoxes += needBoxes;
        totalWeight += netWeight;
      } else {
        const batches = db.prepare('SELECT * FROM t_inventory_batch WHERE sku_code = ? AND current_boxes > 0 AND sales_locked = 0 AND is_deleted = 0 ORDER BY expiry_date ASC').all(sku);
        if (batches.reduce((s, b) => s + b.current_boxes, 0) < needBoxes) throw { status: 400, message: `SKU ${sku} 可用库存不足` };
        for (const batch of batches) {
          if (needBoxes <= 0) break;
          const take = Math.min(batch.current_boxes, needBoxes);
          const perBoxWeight = batch.current_boxes > 0 ? batch.current_net_weight / batch.current_boxes : 0;
          const netWeight = round(take * perBoxWeight);
          db.prepare(
            "UPDATE t_inventory_batch SET current_boxes = current_boxes - ?, current_net_weight = current_net_weight - ?, status = CASE WHEN current_boxes - ? <= 0 THEN 'OUT_OF_STOCK' ELSE status END WHERE id = ?"
          ).run(take, netWeight, take, batch.id);
          db.prepare('INSERT INTO t_inventory_log (batch_id, batch_code, action, box_delta, weight_delta, before_boxes, after_boxes, reason, operator_id) VALUES (?,?,?,?,?,?,?,?,?)')
            .run(batch.id, batch.batch_code, 'SALES_OUT', -take, -netWeight, batch.current_boxes, batch.current_boxes - take, '销售出库(FEFO)', req.user.id);
          insertItem.run(soId, sku, batch.id, batch.batch_code, take, netWeight, remainingRatio(batch), 0);
          totalBoxes += take;
          totalWeight += netWeight;
          needBoxes -= take;
        }
      }
    }
    db.prepare('UPDATE t_sales_order SET total_boxes = ?, total_net_weight = ? WHERE id = ?').run(totalBoxes, round(totalWeight), soId);
    return soId;
  })();

  res.status(201).json({ code: 200, message: '销售出库单创建成功（已按 FEFO 先到期先出分配批次）', data: { so_id: result, so_code: soCode } });
});

router.put('/orders/:id', requirePermission('sales:edit'), (req, res) => {
  const o = db.prepare('SELECT * FROM t_sales_order WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!o) return res.status(404).json({ code: 404, message: '销售出库单不存在' });
  const { customer, remark } = req.body || {};
  db.prepare('UPDATE t_sales_order SET customer = ?, remark = ? WHERE id = ?').run(customer || o.customer, remark != null ? remark : o.remark, o.id);
  res.json({ code: 200, message: '销售出库单更新成功', data: db.prepare('SELECT * FROM t_sales_order WHERE id = ?').get(o.id) });
});

router.delete('/orders/:id', requirePermission('sales:delete'), (req, res) => {
  const o = db.prepare('SELECT * FROM t_sales_order WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!o) return res.status(404).json({ code: 404, message: '销售出库单不存在' });
  const items = db.prepare('SELECT * FROM t_sales_order_item WHERE so_id = ?').all(o.id);
  db.transaction(() => {
    for (const it of items) {
      const batch = db.prepare('SELECT * FROM t_inventory_batch WHERE id = ?').get(it.batch_id);
      if (!batch) continue;
      db.prepare(
        "UPDATE t_inventory_batch SET current_boxes = current_boxes + ?, current_net_weight = current_net_weight + ?, status = CASE WHEN current_boxes + ? <= 0 THEN 'OUT_OF_STOCK' ELSE 'IN_STOCK' END WHERE id = ?"
      ).run(it.box_count, it.net_weight, it.box_count, batch.id);
      db.prepare('INSERT INTO t_inventory_log (batch_id, batch_code, action, box_delta, weight_delta, before_boxes, after_boxes, reason, operator_id) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(batch.id, it.batch_code, 'SALES_RETURN', it.box_count, it.net_weight, batch.current_boxes, batch.current_boxes + it.box_count, `作废出库单 ${o.so_code} 退库`, req.user.id);
    }
    db.prepare('UPDATE t_sales_order SET is_deleted = 1, status = ? WHERE id = ?').run('CANCELLED', o.id);
  })();
  res.json({ code: 200, message: '销售出库单已作废，库存已回滚' });
});

module.exports = router;
