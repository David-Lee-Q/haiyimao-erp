export const PO_STATUS_LABEL = {
  DRAFT: '草稿',
  PENDING_APPROVE: '待审批',
  REJECTED: '已驳回',
  CONFIRMED: '已确认/待发货',
  IN_TRANSIT: '运输中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export const SHIPMENT_STATUS_LABEL = {
  PORT_DEPARTURE: '离港',
  IN_TRANSIT: '海运/空运中',
  PORT_ARRIVED: '到港',
  CUSTOMS_CLEARING: '报关清关中',
  RELEASED: '放行',
  WAREHOUSED: '已入库',
};

export const ZONE_LABEL = {
  FROZEN: '冷冻(-18C)',
  CHILLED: '冷藏(0-4C)',
  AMBIENT: '常温',
};

export const ALLOCATION_LABEL = {
  BY_WEIGHT: '按重量',
  BY_VALUE: '按货值',
  BY_BOX: '按件数',
};

export const COST_TYPE_LABEL = {
  OCEAN_FREIGHT: '海运费',
  CUSTOMS_DUTY: '关税',
  PORT_FEE: '港杂费',
  INSPECTION_FEE: '消杀核酸检',
  INSURANCE: '保险费',
  TRUCKING: '内陆运输',
};

export const SHIPMENT_STEPS = [
  'PORT_DEPARTURE',
  'IN_TRANSIT',
  'PORT_ARRIVED',
  'CUSTOMS_CLEARING',
  'RELEASED',
  'WAREHOUSED',
];
