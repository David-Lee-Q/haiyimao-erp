const express = require('express');
const db = require('../db');
const { SHIPMENT_STATUS_LABEL, SHIPMENT_STATUS } = require('../constants');
const { getShipmentDetail, advanceShipment, buildTrack, buildGlobalTracks } = require('../services/shipmentService');
const { requirePermission } = require('../auth');

const router = express.Router();

router.get('/global', requirePermission('shipment:view'), (req, res) => {
  res.json({ code: 200, data: buildGlobalTracks() });
});

router.get('/batches', requirePermission('shipment:view'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT sb.*, po.po_code, s.name AS supplier_name,
              (SELECT COUNT(*) FROM t_shipment_document d WHERE d.shipment_id = sb.id AND d.status='UPLOADED') AS uploaded_docs,
              (SELECT COUNT(*) FROM t_shipment_document d WHERE d.shipment_id = sb.id AND d.is_required=1) AS required_docs
       FROM t_shipment_batch sb
       LEFT JOIN t_purchase_order po ON po.id = sb.po_id
       LEFT JOIN t_supplier s ON s.id = po.supplier_id
       WHERE sb.is_deleted = 0
       ORDER BY sb.id DESC`
    )
    .all();
  res.json({ code: 200, data: rows.map((r) => ({ ...r, status_label: SHIPMENT_STATUS_LABEL[r.status] || r.status })) });
});

router.get('/batches/:id', requirePermission('shipment:view'), (req, res) => {
  const detail = getShipmentDetail(req.params.id);
  if (!detail || detail.shipment.is_deleted) return res.status(404).json({ code: 404, message: '货运批次不存在' });
  const files = db
    .prepare("SELECT id, original_name, size, mime_type, created_at FROM t_file WHERE biz_type='SHIPMENT' AND biz_id=? AND is_deleted=0 ORDER BY id DESC")
    .all(req.params.id);
  res.json({
    code: 200,
    data: {
      ...detail,
      status_label: SHIPMENT_STATUS_LABEL[detail.shipment.status] || detail.shipment.status,
      steps: SHIPMENT_STATUS,
      steps_label: SHIPMENT_STATUS.map((s) => SHIPMENT_STATUS_LABEL[s]),
      current_step_index: SHIPMENT_STATUS.indexOf(detail.shipment.status),
      attachments: files,
    },
  });
});

router.get('/batches/:id/track', requirePermission('shipment:view'), (req, res) => {
  const track = buildTrack(req.params.id);
  if (!track) return res.status(404).json({ code: 404, message: '货运批次不存在' });
  res.json({ code: 200, data: track });
});

router.patch('/batches/:id', requirePermission('shipment:manage'), (req, res) => {
  const row = db.prepare('SELECT * FROM t_shipment_batch WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!row) return res.status(404).json({ code: 404, message: '货运批次不存在' });
  const f = req.body || {};
  db.prepare(
    `UPDATE t_shipment_batch SET vessel=?, container_no=?, seal_no=?, bl_no=?, departure_port=?, arrival_port=?, etd=?, eta=?, remark=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(
    f.vessel != null ? f.vessel : row.vessel,
    f.container_no != null ? f.container_no : row.container_no,
    f.seal_no != null ? f.seal_no : row.seal_no,
    f.bl_no != null ? f.bl_no : row.bl_no,
    f.departure_port != null ? f.departure_port : row.departure_port,
    f.arrival_port != null ? f.arrival_port : row.arrival_port,
    f.etd != null ? f.etd : row.etd,
    f.eta != null ? f.eta : row.eta,
    f.remark != null ? f.remark : row.remark,
    row.id
  );
  res.json({ code: 200, message: '货运信息更新成功', data: db.prepare('SELECT * FROM t_shipment_batch WHERE id = ?').get(row.id) });
});

router.post('/batches/:id/advance', requirePermission('shipment:manage'), (req, res) => {
  const result = advanceShipment(req.params.id);
  if (result.error) return res.status(400).json({ code: 400, message: result.error });
  const label = SHIPMENT_STATUS_LABEL[result.shipment.status];
  res.json({ code: 200, message: `批次节点已推进至「${label}」`, data: result.shipment });
});

router.post('/batches/:id/documents/:docId/upload', requirePermission('shipment:manage'), (req, res) => {
  const { file_name, key_fields, file_id } = req.body || {};
  const doc = db
    .prepare('SELECT * FROM t_shipment_document WHERE id = ? AND shipment_id = ?')
    .get(req.params.docId, req.params.id);
  if (!doc) return res.status(404).json({ code: 404, message: '单证记录不存在' });
  db.prepare(
    `UPDATE t_shipment_document SET status='UPLOADED', file_name=?, file_id=?, key_fields=?, uploaded_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(file_name || `${doc.doc_type}.pdf`, file_id || null, JSON.stringify(key_fields || {}), doc.id);
  res.json({ code: 200, message: '单证上传成功', data: db.prepare('SELECT * FROM t_shipment_document WHERE id = ?').get(doc.id) });
});

router.delete('/batches/:id', requirePermission('shipment:delete'), (req, res) => {
  const row = db.prepare('SELECT * FROM t_shipment_batch WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!row) return res.status(404).json({ code: 404, message: '货运批次不存在' });
  const linked = db
    .prepare('SELECT COUNT(*) AS c FROM t_inventory_batch WHERE shipment_id = ? AND is_deleted = 0')
    .get(row.id).c;
  if (linked > 0) return res.status(400).json({ code: 400, message: '该批次已生成库存，无法删除' });
  db.prepare('UPDATE t_shipment_batch SET is_deleted = 1 WHERE id = ?').run(row.id);
  res.json({ code: 200, message: '货运批次已删除' });
});

module.exports = router;
