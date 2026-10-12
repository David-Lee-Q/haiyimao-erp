<template>
  <el-container class="layout">
    <el-aside width="224px" class="aside">
      <div class="brand">
        <el-icon :size="22"><Sunny /></el-icon>
        <div class="brand-text">
          <span class="brand-name">海易贸</span>
          <span class="brand-sub">生鲜外贸ERP</span>
        </div>
      </div>
      <el-scrollbar>
        <el-menu :default-active="activeMenu" router class="menu" background-color="#0f2039" text-color="#c3ccdb" active-text-color="#ffffff">
          <el-menu-item v-if="can('dashboard:view')" index="/dashboard"><el-icon><DataLine /></el-icon><span>经营概览</span></el-menu-item>

          <el-sub-menu v-if="can('purchase:view') || can('supplier:view')" index="purchase">
            <template #title><el-icon><ShoppingCart /></el-icon><span>采购管理</span></template>
            <el-menu-item v-if="can('purchase:view')" index="/purchase/orders">采购订单</el-menu-item>
            <el-menu-item v-if="can('purchase:create')" index="/purchase/order/create">新建采购订单</el-menu-item>
            <el-menu-item v-if="can('supplier:view')" index="/suppliers">供应商管理</el-menu-item>
          </el-sub-menu>

          <el-sub-menu v-if="can('shipment:view')" index="shipment">
            <template #title><el-icon><Ship /></el-icon><span>国际货运</span></template>
            <el-menu-item index="/shipment/batches">货运批次与单证</el-menu-item>
          </el-sub-menu>

          <el-sub-menu v-if="can('wms:view')" index="wms">
            <template #title><el-icon><Box /></el-icon><span>仓储管理</span></template>
            <el-menu-item v-if="can('wms:inbound')" index="/wms/inbound">入库理算</el-menu-item>
            <el-menu-item index="/wms/inventory">库存批次</el-menu-item>
          </el-sub-menu>

          <el-sub-menu v-if="can('finance:view')" index="finance">
            <template #title><el-icon><Money /></el-icon><span>财务成本</span></template>
            <el-menu-item index="/finance/land-cost">落地成本核算</el-menu-item>
            <el-menu-item index="/finance/customs">关税/增值税倒算</el-menu-item>
          </el-sub-menu>

          <el-menu-item v-if="can('sales:view')" index="/sales/orders"><el-icon><Sell /></el-icon><span>销售出库 (FEFO)</span></el-menu-item>
          <el-menu-item v-if="can('monitor:view')" index="/monitor/temperature"><el-icon><Odometer /></el-icon><span>冷链温控监控</span></el-menu-item>
          <el-menu-item v-if="can('approval:view')" index="/approvals"><el-icon><Checked /></el-icon><span>审批中心</span></el-menu-item>

          <el-menu-item index="/help"><el-icon><QuestionFilled /></el-icon><span>帮助中心</span></el-menu-item>

          <el-sub-menu v-if="can('user:view') || can('audit:view')" index="system">
            <template #title><el-icon><Setting /></el-icon><span>系统管理</span></template>
            <el-menu-item v-if="can('user:view')" index="/users">用户与角色</el-menu-item>
            <el-menu-item v-if="can('audit:view')" index="/audit-logs">操作日志</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="crumb">{{ currentTitle }}</div>
        <div class="user">
          <el-tag size="small" type="info">{{ auth.user?.role_label || roleLabel }}</el-tag>
          <el-dropdown @command="onCommand">
            <span class="user-name"><el-icon><User /></el-icon> {{ auth.user?.real_name || '未登录' }}</span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">我的权限</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../store/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const activeMenu = computed(() => route.path);
const currentTitle = computed(() => route.meta.title || '海易贸 · 生鲜外贸ERP');

const ROLE_LABEL = {
  admin: '系统管理员', manager: '采购经理', purchase: '采购员',
  warehouse: '仓储主管', finance: '财务专员', quality: '生鲜品质主管',
};
const roleLabel = computed(() => ROLE_LABEL[auth.user?.role] || auth.user?.role || '');

function can(code) {
  return auth.hasPerm(code);
}

function onCommand(cmd) {
  if (cmd === 'logout') {
    auth.logout();
    router.push('/login');
  } else if (cmd === 'profile') {
    router.push('/profile');
  }
}

onMounted(() => {
  auth.refreshMe().catch(() => {});
});
</script>

<style scoped>
.layout { height: 100vh; }
.aside { background: #0f2039; display: flex; flex-direction: column; overflow: hidden; }
.brand {
  height: 60px; display: flex; align-items: center; gap: 10px; padding: 0 18px;
  color: #fff; font-weight: 600; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); flex-shrink: 0;
}
.brand-text { display: flex; flex-direction: column; line-height: 1.15; }
.brand-name { font-size: 16px; }
.brand-sub { font-size: 11px; font-weight: 400; color: rgba(255, 255, 255, 0.55); letter-spacing: 1px; }
.menu { border-right: none; }
.header { height: 60px; background: #fff; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05); }
.crumb { font-weight: 600; }
.user { display: flex; align-items: center; gap: 10px; }
.user-name { cursor: pointer; display: flex; align-items: center; gap: 4px; }
.main { padding: 0; overflow: auto; }
</style>
