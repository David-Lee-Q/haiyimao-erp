const db = require('../db');
const { DOC_TYPES, SHIPMENT_STATUS, SHIPMENT_STATUS_LABEL } = require('../constants');
const { nextSeqCode, addDays } = require('../utils');
const { getPortCoord } = require('../constants/ports');
const { gcInterpolate } = require('../utils/geo');

const SEA_TRANSIT_DAYS = 25;

const NODE_PROGRESS = {
  PORT_DEPARTURE: 0,
  IN_TRANSIT: 0.45,
  PORT_ARRIVED: 0.9,
  CUSTOMS_CLEARING: 0.94,
  RELEASED: 0.98,
  WAREHOUSED: 1,
};

function recordNode(shipmentId, status, remark) {
  db.prepare('INSERT INTO t_shipment_node (shipment_id, status, remark) VALUES (?,?,?)').run(
    shipmentId,
    status,
    remark || null
  );
}

function createShipmentForPo(poId) {
  const po = db.prepare('SELECT * FROM t_purchase_order WHERE id = ?').get(poId);
  if (!po) return null;
  const existing = db.prepare('SELECT * FROM t_shipment_batch WHERE po_id = ? AND is_deleted = 0').get(poId);
  if (existing) return existing;

  const shipmentCode = nextSeqCode(db, 't_shipment_batch', 'shipment_code', 'SHP');
  const info = db
    .prepare(
      `INSERT INTO t_shipment_batch
       (shipment_code, po_id, status, transport_mode, departure_port, arrival_port, etd, eta)
       VALUES (?,?,?,?,?,?, date('now'), date('now', '+' || ? || ' day'))`
    )
    .run(shipmentCode, poId, SHIPMENT_STATUS[0], 'SEA', 'Port of Valparaiso', 'Shanghai Port', SEA_TRANSIT_DAYS);

  const shipmentId = info.lastInsertRowid;
  const insertDoc = db.prepare(
    `INSERT INTO t_shipment_document (shipment_id, doc_type, doc_name, is_required, status) VALUES (?,?,?,?, 'PENDING')`
  );
  for (const d of DOC_TYPES) {
    insertDoc.run(shipmentId, d.doc_type, d.doc_name, d.is_required);
  }
  recordNode(shipmentId, SHIPMENT_STATUS[0], '货物离港');
  return db.prepare('SELECT * FROM t_shipment_batch WHERE id = ?').get(shipmentId);
}

function getShipmentDetail(id) {
  const shipment = db.prepare('SELECT * FROM t_shipment_batch WHERE id = ?').get(id);
  if (!shipment) return null;
  const documents = db.prepare('SELECT * FROM t_shipment_document WHERE shipment_id = ? ORDER BY id').all(id);
  const po = db.prepare('SELECT * FROM t_purchase_order WHERE id = ?').get(shipment.po_id);
  const parsedDocs = documents.map((d) => ({
    ...d,
    key_fields: d.key_fields ? JSON.parse(d.key_fields) : {},
    required_field_names: (DOC_TYPES.find((t) => t.doc_type === d.doc_type) || {}).key_fields || [],
  }));
  return { shipment, documents: parsedDocs, po };
}

function buildTrack(id) {
  const shipment = db.prepare('SELECT * FROM t_shipment_batch WHERE id = ? AND is_deleted = 0').get(id);
  if (!shipment) return null;
  const po = db.prepare('SELECT * FROM t_purchase_order WHERE id = ?').get(shipment.po_id);
  const nodes = db
    .prepare('SELECT * FROM t_shipment_node WHERE shipment_id = ? ORDER BY node_time ASC, id ASC')
    .all(id)
    .map((n) => ({ ...n, status_label: SHIPMENT_STATUS_LABEL[n.status] || n.status }));

  const doneSet = new Set(nodes.map((n) => n.status));
  const timeline = SHIPMENT_STATUS.map((s) => {
    const rec = nodes.find((n) => n.status === s);
    return {
      status: s,
      status_label: SHIPMENT_STATUS_LABEL[s],
      done: doneSet.has(s),
      time: rec ? rec.node_time : null,
      remark: rec ? rec.remark : null,
    };
  });

  const progress = NODE_PROGRESS[shipment.status] != null ? NODE_PROGRESS[shipment.status] : 0;
  let eta = shipment.eta;
  if (!eta && shipment.etd) eta = addDays(shipment.etd, SEA_TRANSIT_DAYS);

  return {
    shipment,
    po_code: po ? po.po_code : '',
    status_label: SHIPMENT_STATUS_LABEL[shipment.status] || shipment.status,
    progress,
    departure: getPortCoord(shipment.departure_port),
    arrival: getPortCoord(shipment.arrival_port),
    etd: shipment.etd,
    eta,
    transport_mode: shipment.transport_mode,
    timeline,
    nodes,
  };
}

function advanceShipment(id) {
  const shipment = db.prepare('SELECT * FROM t_shipment_batch WHERE id = ?').get(id);
  if (!shipment) return { error: '货运批次不存在' };
  const idx = SHIPMENT_STATUS.indexOf(shipment.status);
  if (idx < 0) return { error: '批次状态异常' };
  if (idx >= SHIPMENT_STATUS.length - 1) return { error: '该批次已完成全部流转节点' };
  const next = SHIPMENT_STATUS[idx + 1];

  if (shipment.status === 'PORT_DEPARTURE') {
    const missing = db
      .prepare("SELECT doc_name FROM t_shipment_document WHERE shipment_id = ? AND is_required = 1 AND status != 'UPLOADED'")
      .all(id);
    if (missing.length > 0) {
      return { error: `以下必需单证尚未上传，无法进入运输中：${missing.map((m) => m.doc_name).join('、')}` };
    }
  }

  db.transaction(() => {
    db.prepare('UPDATE t_shipment_batch SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(next, id);
    recordNode(id, next, SHIPMENT_STATUS_LABEL[next]);
    if (next === 'IN_TRANSIT' && !shipment.etd) {
      db.prepare("UPDATE t_shipment_batch SET etd = date('now') WHERE id = ?").run(id);
    }
    if (next === 'WAREHOUSED') {
      db.prepare('UPDATE t_purchase_order SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('COMPLETED', shipment.po_id);
    }
  })();
  return { shipment: db.prepare('SELECT * FROM t_shipment_batch WHERE id = ?').get(id) };
}

function buildGlobalTracks() {
  const rows = db.prepare('SELECT * FROM t_shipment_batch WHERE is_deleted = 0 ORDER BY id').all();
  return rows.map((s) => {
    const po = db.prepare('SELECT po_code FROM t_purchase_order WHERE id = ?').get(s.po_id);
    const dep = getPortCoord(s.departure_port);
    const arr = getPortCoord(s.arrival_port);
    const progress = NODE_PROGRESS[s.status] != null ? NODE_PROGRESS[s.status] : 0;
    let current = null;
    if (dep && arr && dep.lat != null && arr.lat != null) {
      current = gcInterpolate({ lat: dep.lat, lng: dep.lon }, { lat: arr.lat, lng: arr.lon }, progress);
    } else if (dep && dep.lat != null) {
      current = { lat: dep.lat, lng: dep.lon };
    } else {
      current = { lat: 0, lng: 0 };
    }
    const eta = s.eta || (s.etd ? addDays(s.etd, SEA_TRANSIT_DAYS) : null);
    return {
      id: s.id,
      shipment_code: s.shipment_code,
      po_code: po ? po.po_code : '',
      status: s.status,
      status_label: SHIPMENT_STATUS_LABEL[s.status] || s.status,
      progress,
      departure: dep,
      arrival: arr,
      current,
      etd: s.etd,
      eta,
      vessel: s.vessel,
      container_no: s.container_no,
    };
  });
}

module.exports = {
  createShipmentForPo,
  getShipmentDetail,
  advanceShipment,
  buildTrack,
  buildGlobalTracks,
  recordNode,
  SEA_TRANSIT_DAYS,
};
