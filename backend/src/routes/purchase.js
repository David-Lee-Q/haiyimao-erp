const express = require('express');
const db = require('../db');
const { PO_STATUS, PO_STATUS_LABEL, PO_TRANSITIONS } = require('../constants');
const { nextSeqCode, round } = require('../utils');
const { createShipmentForPo } = require('../services/shipmentService');
const { requirePermission } = require('../auth');
const { hasPermission } = require('../permissions');

const router = express.Router();

const TEMP_ZONES = ['FROZEN', 'CHILLED', 'AMBIENT'];

const ACTION_PERMISSION = {
  submit: 'purchase:submit',
  approve: 'purchase:approve',
  reject: 'purchase:approve',
  ship: 'shipment:manage',
  complete: 'shipment:manage',
  cancel: 'purchase:edit',
};

function computeItemSubTotal(item) {
  const box = Number(item.box_count) || 0;
  const net = Number(item.net_weight_kg) || 0;
  if (item.unit_price_per_box != null && item.unit_price_per_box !== '') {
    return round(box * Number(item.unit_price_per_box));
  }
  if (item.unit_price_per_kg != null && item.unit_price_per_kg !== '') {
    return round(net * Number(item.unit_price_per_kg));
  }
  return 0;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) return '采购明细不能为空';
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const idx = i + 1;
    if (!it.sku_code) return `第${idx}行缺少SKU编码`;
    if (!it.product_name) return `第${idx}行缺少品名`;
    if (!(Number(it.box_count) > 0)) return `第${idx}行箱数必须大于0`;
    if (!(Number(it.net_weight_kg) > 0)) return `第${idx}行净重必须大于0`;
    if (Number(it.gross_weight_kg) < Number(it.net_weight_kg)) return `第${idx}行毛重不能小于净重`;
    if (!TEMP_ZONES.includes(it.temperature_requirement)) return `第${idx}行温区不合法`;
    const hasBox = it.unit_price_per_box != null && it.unit_price_per_box !== '';
    const hasKg = it.unit_price_per_kg != null && it.unit_price_per_kg !== '';
    if (!hasBox && !hasKg) return `第${idx}行必须填写按箱或按公斤单价（二选一）`;
  }
  return null;
}

function insertItems(poId, items) {
  const insertItem = db.prepare(
    `INSERT INTO t_purchase_order_item
     (po_id, sku_code, product_name, origin_country, box_count, gross_weight_kg, net_weight_kg,
      weight_tolerance_pct, unit_price_per_box, unit_price_per_kg, temperature_requirement, sub_total)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  let total = 0;
  for (const it of items) {
    const sub = computeItemSubTotal(it);
    total += sub;
    insertItem.run(
      poId, it.sku_code, it.product_name, it.origin_country || null,
      Number(it.box_count), Number(it.gross_weight_kg), Number(it.net_weight_kg),
      it.weight_tolerance_pct != null ? Number(it.weight_tolerance_pct) : 3.0,
      it.unit_price_per_box != null && it.unit_price_per_box !== '' ? Number(it.unit_price_per_box) : null,
      it.unit_price_per_kg != null && it.unit_price_per_kg !== '' ? Number(it.unit_price_per_kg) : null,
      it.temperature_requirement, sub
    );
  }
  return round(total);
}

function serializeOrder(row) {
  const supplier = db.prepare('SELECT * FROM t_supplier WHERE id = ?').get(row.supplier_id);
  const creator = db.prepare('SELECT real_name FROM t_user WHERE id = ?').get(row.created_by);
  return {
    ...row,
    status_label: PO_STATUS_LABEL[row.status] || row.status,
    supplier_name: supplier ? supplier.name : '',
    supplier_country: supplier ? supplier.country : '',
    creator_name: creator ? creator.real_name : '',
  };
}

function assertCanEdit(order, user) {
  if (user.role !== 'purchase' && user.role !== 'manager' && user.role !== 'admin') return null;
  if (user.role === 'purchase' && order.created_by !== user.id) return '只能维护本人创建的采购订单';
  return null;
}

router.get('/orders', requirePermission('purchase:view'), (req, res) => {
  const { status, keyword } = req.query;
  const conditions = ['po.is_deleted = 0'];
  const params = [];
  if (status) {
    conditions.push('po.status = ?');
    params.push(status);
  }
  if (keyword) {
    conditions.push('(po.po_code LIKE ? OR s.name LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (req.user.role === 'purchase') {
    conditions.push('po.created_by = ?');
    params.push(req.user.id);
  }
  const rows = db
    .prepare(
      `SELECT po.*, s.name AS supplier_name, s.country AS supplier_country
       FROM t_purchase_order po
       LEFT JOIN t_supplier s ON s.id = po.supplier_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY po.id DESC`
    )
    .all(...params);
  res.json({
    code: 200,
    data: rows.map((r) => ({ ...r, status_label: PO_STATUS_LABEL[r.status] || r.status })),
  });
});

router.get('/orders/export', requirePermission('purchase:export'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT po.po_code, s.name AS supplier, s.country, po.incoterms, po.currency, po.exchange_rate,
              po.total_amount, po.total_amount_cny, po.status, po.created_at
       FROM t_purchase_order po
       LEFT JOIN t_supplier s ON s.id = po.supplier_id
       WHERE po.is_deleted = 0 ORDER BY po.id DESC`
    )
    .all();
  const header = ['采购单号', '供应商', '原产国', '贸易条款', '币种', '汇率', '原币金额', '折合CNY', '状态', '创建时间'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [r.po_code, r.supplier, r.country, r.incoterms, r.currency, r.exchange_rate, r.total_amount, r.total_amount_cny, PO_STATUS_LABEL[r.status] || r.status, r.created_at]
        .map((v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`)
        .join(',')
    );
  }
  const csv = '\uFEFF' + lines.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="purchase-orders-${Date.now()}.csv"`);
  res.send(csv);
});

router.get('/orders/:id', requirePermission('purchase:view'), (req, res) => {
  const order = db.prepare('SELECT * FROM t_purchase_order WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!order) return res.status(404).json({ code: 404, message: '采购订单不存在' });
  const items = db.prepare('SELECT * FROM t_purchase_order_item WHERE po_id = ? ORDER BY id').all(order.id);
  const shipment = db
    .prepare('SELECT * FROM t_shipment_batch WHERE po_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT 1')
    .get(order.id);
  const costs = db.prepare('SELECT * FROM t_landing_cost_detail WHERE po_id = ? ORDER BY id').all(order.id);
  const costItems = db.prepare('SELECT * FROM t_landing_cost_item WHERE po_id = ? ORDER BY id').all(order.id);
  const batches = db
    .prepare('SELECT * FROM t_inventory_batch WHERE po_id = ? AND is_deleted = 0 ORDER BY id')
    .all(order.id);
  const approvals = db
    .prepare('SELECT * FROM t_approval WHERE biz_type = ? AND biz_id = ? ORDER BY id DESC')
    .all('PURCHASE_ORDER', order.id);
  const files = db
    .prepare("SELECT id, original_name, size, mime_type, created_at FROM t_file WHERE biz_type='PURCHASE_ORDER' AND biz_id=? AND is_deleted=0 ORDER BY id DESC")
    .all(order.id);
  res.json({
    code: 200,
    data: {
      ...serializeOrder(order),
      items,
      shipment: shipment || null,
      landing_costs: costs,
      landing_cost_items: costItems,
      batches,
      approvals,
      attachments: files,
    },
  });
});

router.post('/orders', requirePermission('purchase:create'), (req, res) => {
  const body = req.body || {};
  const err = validateItems(body.items);
  if (err) return res.status(400).json({ code: 400, message: err });
  if (!body.supplier_id || !body.incoterms || !body.currency || !body.exchange_rate) {
    return res.status(400).json({ code: 400, message: '供应商、贸易条款、币种、汇率为必填项' });
  }
  const supplier = db.prepare('SELECT * FROM t_supplier WHERE id = ? AND is_deleted = 0').get(body.supplier_id);
  if (!supplier) return res.status(400).json({ code: 400, message: '供应商不存在' });

  const poCode = nextSeqCode(db, 't_purchase_order', 'po_code', 'PO');
  const rate = Number(body.exchange_rate);

  let totalAmount;
  const poId = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO t_purchase_order
         (po_code, supplier_id, incoterms, currency, exchange_rate, total_amount, total_amount_cny, status,
          contract_file, contract_file_id, remark, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        poCode, body.supplier_id, body.incoterms, body.currency, rate, 0, 0, PO_STATUS.DRAFT,
        body.contract_file || null, body.contract_file_id || null, body.remark || null, req.user.id
      );
    const id = info.lastInsertRowid;
    totalAmount = insertItems(id, body.items);
    db.prepare('UPDATE t_purchase_order SET total_amount = ?, total_amount_cny = ? WHERE id = ?').run(
      totalAmount, round(totalAmount * rate), id
    );
    return id;
  })();

  const totalCny = round(totalAmount * rate);
  const creditWarning =
    supplier.credit_limit_cny > 0 && totalCny > supplier.credit_limit_cny - supplier.credit_used_cny
      ? `该供应商可用信用额度不足（额度 ${supplier.credit_limit_cny}，已占用 ${supplier.credit_used_cny}），本单金额 ${totalCny} CNY`
      : null;

  res.status(201).json({
    code: 200,
    message: '采购订单创建成功',
    data: { po_id: poId, po_code: poCode, status: PO_STATUS.DRAFT, total_amount: totalAmount, total_amount_cny: totalCny, credit_warning: creditWarning },
  });
});

router.put('/orders/:id', requirePermission('purchase:edit'), (req, res) => {
  const order = db.prepare('SELECT * FROM t_purchase_order WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!order) return res.status(404).json({ code: 404, message: '采购订单不存在' });
  if (!['DRAFT', 'REJECTED'].includes(order.status)) {
    return res.status(400).json({ code: 400, message: '仅草稿或被驳回的订单可编辑' });
  }
  const scopeErr = assertCanEdit(order, req.user);
  if (scopeErr) return res.status(403).json({ code: 403, message: scopeErr });

  const body = req.body || {};
  const err = validateItems(body.items);
  if (err) return res.status(400).json({ code: 400, message: err });

  let totalAmount;
  db.transaction(() => {
    db.prepare('DELETE FROM t_purchase_order_item WHERE po_id = ?').run(order.id);
    totalAmount = insertItems(order.id, body.items);
    const rate = body.exchange_rate != null ? Number(body.exchange_rate) : order.exchange_rate;
    db.prepare(
      `UPDATE t_purchase_order SET supplier_id=?, incoterms=?, currency=?, exchange_rate=?, total_amount=?, total_amount_cny=?,
       contract_file=?, contract_file_id=?, remark=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(
      body.supplier_id != null ? body.supplier_id : order.supplier_id,
      body.incoterms || order.incoterms,
      body.currency || order.currency,
      rate,
      totalAmount,
      round(totalAmount * rate),
      body.contract_file != null ? body.contract_file : order.contract_file,
      body.contract_file_id != null ? body.contract_file_id : order.contract_file_id,
      body.remark != null ? body.remark : order.remark,
      order.id
    );
  })();

  const updated = db.prepare('SELECT * FROM t_purchase_order WHERE id = ?').get(order.id);
  res.json({ code: 200, message: '采购订单更新成功', data: serializeOrder(updated) });
});

router.delete('/orders/:id', requirePermission('purchase:delete'), (req, res) => {
  const order = db.prepare('SELECT * FROM t_purchase_order WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!order) return res.status(404).json({ code: 404, message: '采购订单不存在' });
  if (!['DRAFT', 'REJECTED', 'CANCELLED'].includes(order.status)) {
    return res.status(400).json({ code: 400, message: '仅草稿/被驳回/已取消的订单可删除' });
  }
  const scopeErr = assertCanEdit(order, req.user);
  if (scopeErr) return res.status(403).json({ code: 403, message: scopeErr });
  db.prepare('UPDATE t_purchase_order SET is_deleted = 1 WHERE id = ?').run(order.id);
  res.json({ code: 200, message: '采购订单已删除' });
});

router.post('/orders/:id/action', (req, res) => {
  const { action, reason } = req.body || {};
  const perm = ACTION_PERMISSION[action];
  if (!perm) return res.status(400).json({ code: 400, message: `不支持的操作: ${action}` });
  if (!hasPermission(req.user.role, perm)) {
    return res.status(403).json({ code: 403, message: `当前角色无「${perm}」操作权限` });
  }
  const order = db.prepare('SELECT * FROM t_purchase_order WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!order) return res.status(404).json({ code: 404, message: '采购订单不存在' });
  const transition = PO_TRANSITIONS[action];
  if (!transition) return res.status(400).json({ code: 400, message: `不支持的操作: ${action}` });
  if (!transition.from.includes(order.status)) {
    return res.status(400).json({ code: 400, message: `当前状态「${PO_STATUS_LABEL[order.status]}」不允许执行「${action}」操作` });
  }
  if (action === 'submit' && !order.contract_file && !order.contract_file_id) {
    return res.status(400).json({ code: 400, message: '提交审批前请上传电子版采购合同' });
  }
  if (action === 'reject' && !reason) {
    return res.status(400).json({ code: 400, message: '驳回必须填写驳回原因' });
  }
  if (action === 'complete') {
    const shipment = db
      .prepare('SELECT * FROM t_shipment_batch WHERE po_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT 1')
      .get(order.id);
    if (!shipment || shipment.status !== 'WAREHOUSED') {
      return res.status(400).json({ code: 400, message: '货运批次尚未完成入库，无法结案' });
    }
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE t_purchase_order SET status=?, approved_by=?, approved_at=?, reject_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(
      transition.to,
      action === 'approve' ? req.user.id : order.approved_by,
      action === 'approve' ? new Date().toISOString() : order.approved_at,
      action === 'reject' ? reason : order.reject_reason,
      order.id
    );
    if (action === 'approve' || action === 'reject') {
      db.prepare(
        `INSERT INTO t_approval (biz_type, biz_id, reason, status, applicant_id, approver_id, handled_at)
         VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)`
      ).run('PURCHASE_ORDER', order.id, reason || null, action === 'approve' ? 'APPROVED' : 'REJECTED', order.created_by, req.user.id);
    }
    if (action === 'ship') {
      createShipmentForPo(order.id);
    }
  })();

  const updated = db.prepare('SELECT * FROM t_purchase_order WHERE id = ?').get(order.id);
  res.json({ code: 200, message: `操作成功，订单状态已更新为「${PO_STATUS_LABEL[updated.status]}」`, data: serializeOrder(updated) });
});

module.exports = router;
