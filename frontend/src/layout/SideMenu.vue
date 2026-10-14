<template>
  <el-menu
    :default-active="activeMenu"
    router
    :collapse="collapse"
    :collapse-transition="false"
    class="side-menu"
    background-color="#0f2039"
    text-color="#c3ccdb"
    active-text-color="#ffffff"
    @select="$emit('navigate')"
  >
    <el-menu-item v-if="can('dashboard:view')" index="/dashboard"><el-icon><DataLine /></el-icon><span>经营概览</span></el-menu-item>
    <el-menu-item v-if="can('ai:use')" index="/ai"><el-icon><MagicStick /></el-icon><span>智能助手</span></el-menu-item>

    <el-sub-menu v-if="can('purchase:view') || can('supplier:view')" index="purchase">
      <template #title><el-icon><ShoppingCart /></el-icon><span>采购管理</span></template>
      <el-menu-item v-if="can('purchase:view')" index="/purchase/orders">采购订单</el-menu-item>
      <el-menu-item v-if="can('purchase:create')" index="/purchase/order/create">新建采购订单</el-menu-item>
      <el-menu-item v-if="can('supplier:view')" index="/suppliers">供应商管理</el-menu-item>
    </el-sub-menu>

    <el-sub-menu v-if="can('shipment:view')" index="shipment">
      <template #title><el-icon><Ship /></el-icon><span>国际货运</span></template>
      <el-menu-item index="/shipment/batches">货运批次与单证</el-menu-item>
      <el-menu-item index="/shipment/global">全球货运态势</el-menu-item>
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
    <el-menu-item index="/changelog"><el-icon><Clock /></el-icon><span>版本记录</span></el-menu-item>

    <el-sub-menu v-if="can('user:view') || can('audit:view')" index="system">
      <template #title><el-icon><Setting /></el-icon><span>系统管理</span></template>
      <el-menu-item v-if="can('user:view')" index="/users">用户与角色</el-menu-item>
      <el-menu-item v-if="can('audit:view')" index="/audit-logs">操作日志</el-menu-item>
    </el-sub-menu>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../store/auth';

defineProps({ collapse: { type: Boolean, default: false } });
defineEmits(['navigate']);

const route = useRoute();
const auth = useAuthStore();
const activeMenu = computed(() => route.path);
const can = (code) => auth.hasPerm(code);
</script>

<style scoped>
.side-menu {
  border-right: none;
}
</style>
