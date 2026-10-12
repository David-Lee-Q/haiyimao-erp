const db = require('../db');
const { DOC_TYPES, SHIPMENT_STATUS } = require('../constants');
const { nextSeqCode } = require('../utils');

function createShipmentForPo(poId) {
  const po = db.prepare('SELECT * FROM t_purchase_order WHERE id = ?').get(poId);
  if (!po) return null;
  const existing = db.prepare('SELECT * FROM t_shipment_batch WHERE po_id = ? AND is_deleted = 0').get(poId);
  if (existing) return existing;

  const shipmentCode = nextSeqCode(db, 't_shipment_batch', 'shipment_code', 'SHP');
  const info = db
    .prepare(
      `INSERT INTO t_shipment_batch
       (shipment_code, po_id, status, transport_mode, departure_port, arrival_port, etd)
       VALUES (?,?,?,?,?,?, date('now'))`
    )
    .run(shipmentCode, poId, SHIPMENT_STATUS[0], 'SEA', 'Port of Valparaiso', 'Shanghai Port');

  const shipmentId = info.lastInsertRowid;
  const insertDoc = db.prepare(
    `INSERT INTO t_shipment_document (shipment_id, doc_type, doc_name, is_required, status)
     VALUES (?,?,?,?, 'PENDING')`
  );
  for (const d of DOC_TYPES) {
    insertDoc.run(shipmentId, d.doc_type, d.doc_name, d.is_required);
  }
  return db.prepare('SELECT * FROM t_shipment_batch WHERE id = ?').get(shipmentId);
}

function getShipmentDetail(id) {
  const shipment = db.prepare('SELECT * FROM t_shipment_batch WHERE id = ?').get(id);
  if (!shipment) return null;
  const documents = db
    .prepare('SELECT * FROM t_shipment_document WHERE shipment_id = ? ORDER BY id')
    .all(id);
  const po = db.prepare('SELECT * FROM t_purchase_order WHERE id = ?').get(shipment.po_id);
  const parsedDocs = documents.map((d) => ({
    ...d,
    key_fields: d.key_fields ? JSON.parse(d.key_fields) : {},
    required_field_names: (DOC_TYPES.find((t) => t.doc_type === d.doc_type) || {}).key_fields || [],
  }));
  return { shipment, documents: parsedDocs, po };
}

function advanceShipment(id) {
  const shipment = db.prepare('SELECT * FROM t_shipment_batch WHERE id = ?').get(id);
  if (!shipment) return { error: '货运批次不存在' };
  const idx = SHIPMENT_STATUS.indexOf(shipment.status);
  if (idx < 0) return { error: '批次状态异常' };
  if (idx >= SHIPMENT_STATUS.length - 1) {
    return { error: '该批次已完成全部流转节点' };
  }
  const next = SHIPMENT_STATUS[idx + 1];

  if (shipment.status === 'PORT_DEPARTURE') {
    const missing = db
      .prepare(
        `SELECT doc_name FROM t_shipment_document
         WHERE shipment_id = ? AND is_required = 1 AND status != 'UPLOADED'`
      )
      .all(id);
    if (missing.length > 0) {
      return {
        error: `以下必需单证尚未上传，无法进入运输中：${missing.map((m) => m.doc_name).join('、')}`,
      };
    }
  }

  db.prepare('UPDATE t_shipment_batch SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(next, id);
  if (next === 'IN_TRANSIT' && !shipment.etd) {
    db.prepare("UPDATE t_shipment_batch SET etd = date('now') WHERE id = ?").run(id);
  }
  if (next === 'WAREHOUSED') {
    db.prepare('UPDATE t_purchase_order SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      'COMPLETED',
      shipment.po_id
    );
  }
  return { shipment: db.prepare('SELECT * FROM t_shipment_batch WHERE id = ?').get(id) };
}

module.exports = { createShipmentForPo, getShipmentDetail, advanceShipment };
