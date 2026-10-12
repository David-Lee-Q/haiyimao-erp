const express = require('express');
const db = require('../db');
const { PO_STATUS_LABEL, SHIPMENT_STATUS_LABEL, ZONE_LABELS } = require('../constants');
const { requirePermission } = require('../auth');

const router = express.Router();

router.get('/summary', requirePermission('dashboard:view'), (req, res) => {
  const poRows = db.prepare('SELECT status, COUNT(*) AS cnt FROM t_purchase_order GROUP BY status').all();
  const statusMap = {};
  for (const r of poRows) statusMap[r.status] = r.cnt;
  const poByStatus = Object.keys(PO_STATUS_LABEL).map((k) => ({
    status: k,
    label: PO_STATUS_LABEL[k],
    count: statusMap[k] || 0,
  }));

  const totalPoAmount = db
    .prepare(`SELECT COALESCE(SUM(total_amount_cny),0) AS v FROM t_purchase_order WHERE status NOT IN ('DRAFT','CANCELLED','REJECTED')`)
    .get().v;

  const inv = db
    .prepare('SELECT COALESCE(SUM(current_boxes),0) AS boxes, COALESCE(SUM(current_net_weight),0) AS net FROM t_inventory_batch')
    .get();

  const zoneRows = db
    .prepare('SELECT zone_type, COALESCE(SUM(current_boxes),0) AS boxes, COALESCE(SUM(current_net_weight),0) AS net FROM t_inventory_batch GROUP BY zone_type')
    .all();
  const byZone = zoneRows.map((z) => ({ zone_type: z.zone_type, label: ZONE_LABELS[z.zone_type] || z.zone_type, boxes: z.boxes, net_weight: z.net }));

  const openAlerts = db.prepare(`SELECT COUNT(*) AS c FROM t_alert WHERE status='OPEN'`).get().c;
  const pendingApprovals = db.prepare(`SELECT COUNT(*) AS c FROM t_approval WHERE status='PENDING'`).get().c;
  const lockedBatches = db.prepare(`SELECT COUNT(*) AS c FROM t_inventory_batch WHERE sales_locked = 1`).get().c;

  const shipmentRows = db.prepare('SELECT status, COUNT(*) AS cnt FROM t_shipment_batch GROUP BY status').all();
  const shipmentMap = {};
  for (const r of shipmentRows) shipmentMap[r.status] = r.cnt;
  const shipments = Object.keys(SHIPMENT_STATUS_LABEL).map((k) => ({
    status: k,
    label: SHIPMENT_STATUS_LABEL[k],
    count: shipmentMap[k] || 0,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const expiring = db
    .prepare(
      `SELECT * FROM t_inventory_batch
       WHERE current_boxes > 0 AND expiry_date <= date('now', '+20 day')
       ORDER BY expiry_date ASC LIMIT 10`
    )
    .all()
    .map((b) => {
      const days = Math.round((new Date(b.expiry_date) - new Date(today)) / 86400000);
      return { ...b, days_to_expiry: days };
    });

  const trend = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS month, COALESCE(SUM(total_amount_cny),0) AS amount, COUNT(*) AS count
       FROM t_purchase_order
       WHERE created_at >= date('now','-6 month')
       GROUP BY month ORDER BY month`
    )
    .all();

  res.json({
    code: 200,
    data: {
      po_by_status: poByStatus,
      total_po_amount_cny: Math.round(totalPoAmount * 100) / 100,
      inventory: { boxes: inv.boxes, net_weight: Math.round(inv.net * 100) / 100, by_zone: byZone },
      open_alerts: openAlerts,
      pending_approvals: pendingApprovals,
      locked_batches: lockedBatches,
      shipments,
      expiring_batches: expiring,
      purchase_trend: trend,
    },
  });
});

module.exports = router;
