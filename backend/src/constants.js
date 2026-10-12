const PO_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVE: 'PENDING_APPROVE',
  REJECTED: 'REJECTED',
  CONFIRMED: 'CONFIRMED',
  IN_TRANSIT: 'IN_TRANSIT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

const PO_STATUS_LABEL = {
  DRAFT: '草稿',
  PENDING_APPROVE: '待审批',
  REJECTED: '已驳回',
  CONFIRMED: '已确认/待发货',
  IN_TRANSIT: '运输中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const PO_TRANSITIONS = {
  submit: { from: ['DRAFT', 'REJECTED'], to: 'PENDING_APPROVE' },
  approve: { from: ['PENDING_APPROVE'], to: 'CONFIRMED' },
  reject: { from: ['PENDING_APPROVE'], to: 'REJECTED' },
  ship: { from: ['CONFIRMED'], to: 'IN_TRANSIT' },
  complete: { from: ['IN_TRANSIT'], to: 'COMPLETED' },
  cancel: { from: ['DRAFT', 'PENDING_APPROVE', 'CONFIRMED', 'IN_TRANSIT'], to: 'CANCELLED' },
};

const SHIPMENT_STATUS = [
  'PORT_DEPARTURE',
  'IN_TRANSIT',
  'PORT_ARRIVED',
  'CUSTOMS_CLEARING',
  'RELEASED',
  'WAREHOUSED',
];

const SHIPMENT_STATUS_LABEL = {
  PORT_DEPARTURE: '离港',
  IN_TRANSIT: '海运/空运中',
  PORT_ARRIVED: '到港',
  CUSTOMS_CLEARING: '报关清关中',
  RELEASED: '放行',
  WAREHOUSED: '已入库',
};

const DOC_TYPES = [
  { doc_type: 'BL', doc_name: '提单 (B/L)', is_required: 1, key_fields: ['bill_of_lading_no', 'container_no', 'seal_no'] },
  { doc_type: 'CO', doc_name: '原产地证 (C/O)', is_required: 1, key_fields: ['origin_country', 'exporter_reg_no'] },
  { doc_type: 'PHYTO', doc_name: '植物检疫证书', is_required: 1, key_fields: ['quarantine_no', 'treatment_method'] },
  { doc_type: 'CUSTOMS', doc_name: '海关报关单', is_required: 1, key_fields: ['declaration_no', 'tariff_amount'] },
  { doc_type: 'INSURANCE', doc_name: '保险单', is_required: 0, key_fields: ['policy_no', 'insured_amount'] },
  { doc_type: 'PACKING', doc_name: '装箱单', is_required: 0, key_fields: ['total_boxes', 'total_net_weight'] },
];

const ZONE_LABELS = {
  FROZEN: '冷冻(-18C)',
  CHILLED: '冷藏(0-4C)',
  AMBIENT: '常温',
};

const WAREHOUSES = [
  { id: 1, name: '上海保税冷链仓', zone_type: 'FROZEN' },
  { id: 2, name: '上海保税冷链仓', zone_type: 'CHILLED' },
  { id: 3, name: '广州南沙恒温仓', zone_type: 'AMBIENT' },
  { id: 4, name: '天津港冷链中心', zone_type: 'FROZEN' },
];

module.exports = {
  PO_STATUS,
  PO_STATUS_LABEL,
  PO_TRANSITIONS,
  SHIPMENT_STATUS,
  SHIPMENT_STATUS_LABEL,
  DOC_TYPES,
  ZONE_LABELS,
  WAREHOUSES,
};
