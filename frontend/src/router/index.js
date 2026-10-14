import { createRouter, createWebHistory } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../store/auth';

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/Login.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../layout/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '经营概览', permission: 'dashboard:view' } },
      { path: 'help', name: 'help', component: () => import('../views/Help.vue'), meta: { title: '帮助中心' } },
      { path: 'changelog', name: 'changelog', component: () => import('../views/Changelog.vue'), meta: { title: '版本记录' } },
      { path: 'ai', name: 'ai', component: () => import('../views/AiAssistant.vue'), meta: { title: '智能助手', permission: 'ai:use' } },

      { path: 'suppliers', name: 'suppliers', component: () => import('../views/SupplierList.vue'), meta: { title: '供应商管理', permission: 'supplier:view' } },

      { path: 'purchase/orders', name: 'purchase-orders', component: () => import('../views/purchase/OrderList.vue'), meta: { title: '采购订单', permission: 'purchase:view' } },
      { path: 'purchase/order/create', name: 'purchase-order-create', component: () => import('../views/purchase/OrderCreate.vue'), meta: { title: '新建采购订单', permission: 'purchase:create' } },
      { path: 'purchase/order/:id/edit', name: 'purchase-order-edit', component: () => import('../views/purchase/OrderCreate.vue'), meta: { title: '编辑采购订单', permission: 'purchase:edit' } },
      { path: 'purchase/order/:id', name: 'purchase-order-detail', component: () => import('../views/purchase/OrderDetail.vue'), meta: { title: '采购订单详情', permission: 'purchase:view' } },

      { path: 'shipment/batches', name: 'shipment-batches', component: () => import('../views/shipment/BatchList.vue'), meta: { title: '货运批次', permission: 'shipment:view' } },
      { path: 'shipment/global', name: 'shipment-global', component: () => import('../views/shipment/GlobalOverview.vue'), meta: { title: '全球货运态势', permission: 'shipment:view' } },
      { path: 'shipment/batch/:id', name: 'shipment-batch-detail', component: () => import('../views/shipment/BatchDetail.vue'), meta: { title: '批次与单证控制台', permission: 'shipment:view' } },

      { path: 'wms/inbound', name: 'wms-inbound', component: () => import('../views/wms/Inbound.vue'), meta: { title: '入库理算', permission: 'wms:inbound' } },
      { path: 'wms/inventory', name: 'wms-inventory', component: () => import('../views/wms/Inventory.vue'), meta: { title: '库存批次', permission: 'wms:view' } },

      { path: 'finance/land-cost', name: 'land-cost', component: () => import('../views/finance/LandCost.vue'), meta: { title: '落地成本核算', permission: 'finance:view' } },
      { path: 'finance/customs', name: 'customs', component: () => import('../views/finance/Customs.vue'), meta: { title: '关税倒算', permission: 'finance:view' } },

      { path: 'sales/orders', name: 'sales-orders', component: () => import('../views/sales/SalesOrders.vue'), meta: { title: '销售出库', permission: 'sales:view' } },
      { path: 'monitor/temperature', name: 'temperature', component: () => import('../views/monitor/Temperature.vue'), meta: { title: '冷链温控监控', permission: 'monitor:view' } },
      { path: 'approvals', name: 'approvals', component: () => import('../views/Approvals.vue'), meta: { title: '审批中心', permission: 'approval:view' } },
      { path: 'users', name: 'users', component: () => import('../views/UserList.vue'), meta: { title: '用户管理', permission: 'user:view' } },
      { path: 'audit-logs', name: 'audit-logs', component: () => import('../views/AuditLog.vue'), meta: { title: '操作日志', permission: 'audit:view' } },
      { path: 'profile', name: 'profile', component: () => import('../views/Profile.vue'), meta: { title: '我的权限' } },
    ],
  },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isLoggedIn) return { name: 'login' };
  if (to.name === 'login' && auth.isLoggedIn) return { path: '/' };
  if (auth.isLoggedIn && (!auth.user || !Array.isArray(auth.user.permissions))) {
    try {
      await auth.refreshMe();
    } catch (e) {
      auth.logout();
      return { name: 'login' };
    }
  }
  if (to.meta.permission && !auth.hasPerm(to.meta.permission)) {
    ElMessage.error('当前角色无权访问该页面');
    return { path: '/dashboard' };
  }
  return true;
});

export default router;
