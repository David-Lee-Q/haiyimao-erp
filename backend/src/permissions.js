const ROLES = ['admin', 'manager', 'purchase', 'warehouse', 'finance', 'quality'];

const ROLE_LABEL = {
  admin: '系统管理员',
  manager: '采购经理',
  purchase: '采购员',
  warehouse: '仓储主管',
  finance: '财务专员',
  quality: '生鲜品质主管',
};

const ALL_PERMISSIONS = [
  'dashboard:view',

  'supplier:view',
  'supplier:manage',

  'purchase:view',
  'purchase:create',
  'purchase:edit',
  'purchase:delete',
  'purchase:submit',
  'purchase:approve',
  'purchase:export',

  'shipment:view',
  'shipment:manage',
  'shipment:delete',

  'wms:view',
  'wms:inbound',
  'wms:adjust',
  'inventory:delete',

  'finance:view',
  'finance:calc',
  'finance:delete',

  'sales:view',
  'sales:create',
  'sales:edit',
  'sales:delete',

  'monitor:view',
  'monitor:handle',

  'approval:view',
  'approval:handle',

  'user:view',
  'user:manage',

  'file:upload',
  'file:delete',

  'audit:view',
];

const PERMISSION_LABEL = {
  'dashboard:view': '查看经营概览',
  'supplier:view': '查看供应商',
  'supplier:manage': '维护供应商',
  'purchase:view': '查看采购订单',
  'purchase:create': '新建采购订单',
  'purchase:edit': '编辑采购订单',
  'purchase:delete': '删除采购订单',
  'purchase:submit': '提交采购审批',
  'purchase:approve': '审批采购订单',
  'purchase:export': '导出采购订单',
  'shipment:view': '查看货运批次',
  'shipment:manage': '操作货运批次与单证',
  'shipment:delete': '删除货运批次',
  'wms:view': '查看仓储库存',
  'wms:inbound': '执行入库理算',
  'wms:adjust': '库存盘点与调整',
  'inventory:delete': '删除库存批次',
  'finance:view': '查看财务成本',
  'finance:calc': '落地成本与关税核算',
  'finance:delete': '删除财务记录',
  'sales:view': '查看销售出库',
  'sales:create': '新建销售出库',
  'sales:edit': '编辑销售出库',
  'sales:delete': '作废/删除销售出库',
  'monitor:view': '查看冷链监控',
  'monitor:handle': '处理温度告警',
  'approval:view': '查看审批中心',
  'approval:handle': '处理审批事项',
  'user:view': '查看用户',
  'user:manage': '维护用户与角色',
  'file:upload': '上传附件',
  'file:delete': '删除附件',
  'audit:view': '查看操作日志',
};

const ROLE_PERMISSIONS = {
  admin: ['*'],
  manager: [
    'dashboard:view',
    'supplier:view', 'supplier:manage',
    'purchase:view', 'purchase:create', 'purchase:edit', 'purchase:delete', 'purchase:submit', 'purchase:approve', 'purchase:export',
    'shipment:view', 'shipment:manage', 'shipment:delete',
    'wms:view', 'wms:inbound', 'wms:adjust', 'inventory:delete',
    'finance:view', 'finance:calc',
    'sales:view', 'sales:create', 'sales:edit', 'sales:delete',
    'monitor:view', 'monitor:handle',
    'approval:view', 'approval:handle',
    'user:view',
    'file:upload', 'file:delete',
    'audit:view',
  ],
  purchase: [
    'dashboard:view',
    'supplier:view',
    'purchase:view', 'purchase:create', 'purchase:edit', 'purchase:delete', 'purchase:submit', 'purchase:export',
    'shipment:view', 'shipment:manage',
    'wms:view',
    'sales:view', 'sales:create', 'sales:edit',
    'monitor:view',
    'approval:view',
    'file:upload',
  ],
  warehouse: [
    'dashboard:view',
    'supplier:view',
    'purchase:view',
    'shipment:view', 'shipment:manage',
    'wms:view', 'wms:inbound', 'wms:adjust', 'inventory:delete',
    'sales:view', 'sales:create', 'sales:edit',
    'monitor:view',
    'file:upload',
  ],
  finance: [
    'dashboard:view',
    'supplier:view',
    'purchase:view', 'purchase:export',
    'shipment:view',
    'wms:view',
    'finance:view', 'finance:calc', 'finance:delete',
    'sales:view',
    'approval:view',
    'audit:view',
    'file:upload',
  ],
  quality: [
    'dashboard:view',
    'purchase:view',
    'shipment:view',
    'wms:view',
    'monitor:view', 'monitor:handle',
    'approval:view', 'approval:handle',
    'file:upload',
  ],
};

function permissionsOf(role) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];
  if (perms.includes('*')) return [...ALL_PERMISSIONS];
  return [...perms];
}

function hasPermission(role, code) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  return perms.includes(code);
}

module.exports = {
  ROLES,
  ROLE_LABEL,
  ALL_PERMISSIONS,
  PERMISSION_LABEL,
  ROLE_PERMISSIONS,
  permissionsOf,
  hasPermission,
};
