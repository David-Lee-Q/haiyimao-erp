const express = require('express');
const db = require('../db');
const { round, dateStamp, addDays } = require('../utils');
const { WAREHOUSES, ZONE_LABELS } = require('../constants');
const { requirePermission } = require('../auth');

const router = express.Router();

const COUNTRY_CODE = {
  Chile: 'CHL', Australia: 'AUS', 'New Zealand': 'NZL', Thailand: 'THA', Vietnam: 'VNM',
  Norway: 'NOR', Canada: 'CAN', Peru: 'PER', Ecuador: 'ECU', Argentina: 'ARG', Brazil: 'BRA', 'United States': 'USA',
};

function countryCode(country) {
  if (COUNTRY_CODE[country]) return COUNTRY_CODE[country];
  return String(country || 'UNK').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'UNK';
}
function plantSuffix(plantNo) {
  const alnum = String(plantNo || '').replace(/[^A-Za-z0-9]/g, '');
  return alnum.slice(-4) || String(Date.now()).slice(-4);
}
function buildBatchCode(originCountry, plantNo, seq) {
  const base = `BAT-${dateStamp()}-${countryCode(originCountry)}-${plantSuffix(plantNo)}`;
  return seq > 0 ? `${base}-${seq}` : base;
}

router.get('/warehouses', requirePermission('wms:view'), (req, res) => {
  res.json({ code: 200, data: WAREHOUSES });
});

router.post('/inbound/calculate', requirePermission('wms:inbound'), (req, res) => {
  const { po_id, warehouse_id, actual_inbound_items } = req.body || {};
  if (!po_id) return res.status(400).json({ code: 400, message: 'po_id 不能为空' });
  if (!Array.isArray(actual_inbound_items) || actual_inbound_items.length === 0) {
    return res.status(400).json({ code: 400, message: '实际入库明细不能为空' });
  }
  const po = db.prepare('SELECT * FROM t_purchase_order WHERE id = ? AND is_deleted = 0').get(po_id);
  if (!po) return res.status(404).json({ code: 404, message: '采购订单不存在' });
  if (['DRAFT', 'PENDING_APPROVE', 'REJECTED'].includes(po.status)) {
    return res.status(400).json({ code: 400, message: '采购订单尚未确认，无法执行入库理算' });
  }
  const warehouse = WAREHOUSES.find((w) => w.id === Number(warehouse_id));
  if (!warehouse) return res.status(400).json({ code: 400, message: '仓库不存在' });

  const poItems = db.prepare('SELECT * FROM t_purchase_order_item WHERE po_id = ?').all(po_id);
  const results = [];
  let hasVariance = false;

  for (const inbound of actual_inbound_items) {
    const contract = poItems.find((p) => p.sku_code === inbound.sku_code);
    if (!contract) return res.status(400).json({ code: 400, message: `SKU ${inbound.sku_code} 不属于该采购订单` });
    const contractNet = Number(contract.net_weight_kg);
    const actualNet = Number(inbound.actual_net_weight_kg);
    const variancePct = round(((actualNet - contractNet) / contractNet) * 100, 2);
    const tolerance = Number(contract.weight_tolerance_pct);
    const within = Math.abs(variancePct) <= tolerance;
    if (!within) hasVariance = true;
    const shelfLife = Number(inbound.shelf_life_days) || 0;
    results.push({
      sku_code: inbound.sku_code,
      product_name: contract.product_name,
      contract_net_weight_kg: contractNet,
      contract_box_count: contract.box_count,
      actual_net_weight_kg: actualNet,
      actual_box_count: Number(inbound.actual_box_count),
      weight_variance_pct: variancePct,
      weight_tolerance_pct: tolerance,
      is_within_tolerance: within,
      batch_code: buildBatchCode(inbound.origin_country, inbound.plant_approval_no, 0),
      origin_country: inbound.origin_country,
      plant_approval_no: inbound.plant_approval_no,
      production_date: inbound.production_date,
      shelf_life_days: shelfLife,
      generated_expiry_date: addDays(inbound.production_date, shelfLife > 0 ? shelfLife : 30),
      temperature_requirement: contract.temperature_requirement,
    });
  }

  const primary = results[0];
  const payload = {
    po_code: po.po_code,
    warehouse_id: warehouse.id,
    warehouse_name: warehouse.name,
    weight_variance_pct: primary.weight_variance_pct,
    is_within_tolerance: results.every((r) => r.is_within_tolerance),
    batch_code: primary.batch_code,
    generated_expiry_date: primary.generated_expiry_date,
    items: results,
  };

  if (hasVariance) {
    db.prepare('INSERT INTO t_approval (biz_type, biz_id, reason, status, applicant_id) VALUES (?,?,?,?,?)').run(
      'WEIGHT_VARIANCE', po_id,
      `入库净重超出合同公差：${results.filter((r) => !r.is_within_tolerance).map((r) => `${r.sku_code} 偏差 ${r.weight_variance_pct}%`).join('；')}`,
      'PENDING', req.user.id
    );
    return res.status(200).json({ code: 409, message: '磅差超出合同约定公差，已阻断直接入库并生成二次审批（磅差理赔单）', data: payload });
  }
  return res.json({ code: 200, message: '磅差校验通过，已生成预入库批次', data: payload });
});

router.post('/inbound/confirm', requirePermission('wms:inbound'), (req, res) => {
  const { po_id, warehouse_id, items } = req.body || {};
  const po = db.prepare('SELECT * FROM t_purchase_order WHERE id = ? AND is_deleted = 0').get(po_id);
  if (!po) return res.status(404).json({ code: 404, message: '采购订单不存在' });
  const warehouse = WAREHOUSES.find((w) => w.id === Number(warehouse_id));
  if (!warehouse) return res.status(400).json({ code: 400, message: '仓库不存在' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ code: 400, message: '入库明细不能为空' });
  const shipment = db.prepare('SELECT * FROM t_shipment_batch WHERE po_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT 1').get(po_id);

  const created = [];
  db.transaction(() => {
    let seq = 0;
    for (const item of items) {
      const existing = db.prepare('SELECT id FROM t_inventory_batch WHERE batch_code = ?').get(item.batch_code);
      let batchCode = item.batch_code;
      if (existing) { seq += 1; batchCode = `${item.batch_code}-${seq}`; }
      const info = db.prepare(
        `INSERT INTO t_inventory_batch
         (batch_code, sku_code, product_name, po_id, shipment_id, origin_country, plant_approval_no,
          production_date, expiry_date, shelf_life_days, warehouse_id, warehouse_name, zone_type,
          current_boxes, current_net_weight, planned_net_weight, temperature_requirement, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'IN_STOCK')`
      ).run(
        batchCode, item.sku_code, item.product_name || null, po.id, shipment ? shipment.id : null,
        item.origin_country, item.plant_approval_no, item.production_date, item.generated_expiry_date,
        item.shelf_life_days || null, warehouse.id, warehouse.name,
        item.temperature_requirement ? item.temperature_requirement.split('(')[0] : 'CHILLED',
        Number(item.actual_box_count) || 0, Number(item.actual_net_weight_kg) || 0,
        Number(item.actual_net_weight_kg) || 0, item.temperature_requirement
      );
      const batch = db.prepare('SELECT * FROM t_inventory_batch WHERE id = ?').get(info.lastInsertRowid);
      db.prepare(
        'INSERT INTO t_inventory_log (batch_id, batch_code, action, box_delta, weight_delta, before_boxes, after_boxes, reason, operator_id) VALUES (?,?,?,?,?,?,?,?,?)'
      ).run(batch.id, batch.batch_code, 'INBOUND', batch.current_boxes, batch.current_net_weight, 0, batch.current_boxes, '入库理算生成批次', req.user.id);
      created.push(batch);
    }
  })();

  res.status(201).json({ code: 200, message: `入库成功，已生成 ${created.length} 个库存批次`, data: created });
});

router.get('/inventory/batches', requirePermission('wms:view'), (req, res) => {
  const { sku_code, zone_type, sales_locked } = req.query;
  const conditions = ['is_deleted = 0'];
  const params = [];
  if (sku_code) { conditions.push('sku_code LIKE ?'); params.push(`%${sku_code}%`); }
  if (zone_type) { conditions.push('zone_type = ?'); params.push(zone_type); }
  if (sales_locked != null && sales_locked !== '') { conditions.push('sales_locked = ?'); params.push(Number(sales_locked)); }
  const rows = db.prepare(`SELECT * FROM t_inventory_batch WHERE ${conditions.join(' AND ')} ORDER BY expiry_date ASC, id ASC`).all(...params);
  const today = new Date().toISOString().slice(0, 10);
  res.json({
    code: 200,
    data: rows.map((r) => ({ ...r, zone_label: ZONE_LABELS[r.zone_type] || r.zone_type, days_to_expiry: Math.max(0, Math.round((new Date(r.expiry_date) - new Date(today)) / 86400000)) })),
  });
});

router.get('/inventory/batches/:id/logs', requirePermission('wms:view'), (req, res) => {
  const rows = db.prepare('SELECT * FROM t_inventory_log WHERE batch_id = ? ORDER BY id DESC').all(req.params.id);
  res.json({ code: 200, data: rows });
});

router.post('/inventory/adjust', requirePermission('wms:adjust'), (req, res) => {
  const { batch_id, action, box_delta, weight_delta, to_warehouse_id, reason } = req.body || {};
  if (!['ADJUST', 'SCRAP', 'TRANSFER'].includes(action)) {
    return res.status(400).json({ code: 400, message: '调整类型不合法' });
  }
  const batch = db.prepare('SELECT * FROM t_inventory_batch WHERE id = ? AND is_deleted = 0').get(batch_id);
  if (!batch) return res.status(404).json({ code: 404, message: '库存批次不存在' });

  const deltaBoxes = action === 'SCRAP' ? -Math.abs(Number(box_delta) || 0) : Number(box_delta) || 0;
  const deltaWeight = action === 'SCRAP' ? -Math.abs(Number(weight_delta) || 0) : Number(weight_delta) || 0;
  const afterBoxes = batch.current_boxes + deltaBoxes;
  const afterWeight = round(batch.current_net_weight + deltaWeight);
  if (afterBoxes < 0) return res.status(400).json({ code: 400, message: '调整后箱数不能为负' });

  db.transaction(() => {
    let warehouseId = batch.warehouse_id;
    let warehouseName = batch.warehouse_name;
    if (action === 'TRANSFER') {
      const target = WAREHOUSES.find((w) => w.id === Number(to_warehouse_id));
      if (!target) throw { status: 400, message: '目标仓库不存在' };
      warehouseId = target.id;
      warehouseName = target.name;
    }
    db.prepare(
      'UPDATE t_inventory_batch SET current_boxes=?, current_net_weight=?, warehouse_id=?, warehouse_name=?, status = CASE WHEN ? <= 0 THEN \'OUT_OF_STOCK\' ELSE \'IN_STOCK\' END WHERE id=?'
    ).run(afterBoxes, afterWeight, warehouseId, warehouseName, afterBoxes, batch.id);
    db.prepare(
      'INSERT INTO t_inventory_log (batch_id, batch_code, action, box_delta, weight_delta, before_boxes, after_boxes, reason, operator_id) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(batch.id, batch.batch_code, action, deltaBoxes, deltaWeight, batch.current_boxes, afterBoxes, reason || null, req.user.id);
  })();

  res.json({ code: 200, message: '库存调整成功', data: db.prepare('SELECT * FROM t_inventory_batch WHERE id = ?').get(batch.id) });
});

router.delete('/inventory/batches/:id', requirePermission('inventory:delete'), (req, res) => {
  const batch = db.prepare('SELECT * FROM t_inventory_batch WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!batch) return res.status(404).json({ code: 404, message: '库存批次不存在' });
  if (batch.current_boxes > 0) return res.status(400).json({ code: 400, message: '该批次仍有库存，请先报废或调整为0再删除' });
  db.prepare('UPDATE t_inventory_batch SET is_deleted = 1 WHERE id = ?').run(batch.id);
  res.json({ code: 200, message: '库存批次已删除' });
});

router.get('/inventory/feFo/:sku', requirePermission('wms:view'), (req, res) => {
  const rows = db.prepare('SELECT * FROM t_inventory_batch WHERE sku_code = ? AND current_boxes > 0 AND sales_locked = 0 AND is_deleted = 0 ORDER BY expiry_date ASC').all(req.params.sku);
  const today = new Date().toISOString().slice(0, 10);
  res.json({
    code: 200,
    data: rows.map((r) => {
      const days = Math.max(0, Math.round((new Date(r.expiry_date) - new Date(today)) / 86400000));
      const ratio = r.shelf_life_days ? round(days / r.shelf_life_days, 4) : 1;
      return { ...r, days_to_expiry: days, remaining_ratio: ratio, low_remaining: ratio < 0.2 };
    }),
  });
});

module.exports = router;
