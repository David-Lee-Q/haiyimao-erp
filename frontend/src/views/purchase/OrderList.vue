<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">采购订单</h2>
      <div>
        <el-button v-if="can('purchase:export')" :icon="Download" @click="exportCsv">导出 CSV</el-button>
        <el-button v-if="can('purchase:create')" type="primary" :icon="Plus" @click="$router.push('/purchase/order/create')">新建采购订单</el-button>
      </div>
    </div>

    <div class="card-block">
      <el-form inline>
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" style="width: 170px" @change="load">
            <el-option v-for="(label, key) in PO_STATUS_LABEL" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="query.keyword" placeholder="采购单号 / 供应商" style="width: 220px" clearable @keyup.enter="load" />
        </el-form-item>
        <el-button :icon="Search" @click="load">查询</el-button>
      </el-form>
    </div>

    <div class="card-block" v-loading="loading">
      <el-table :data="rows" size="small" empty-text="暂无采购订单">
        <el-table-column prop="po_code" label="采购单号" min-width="170" />
        <el-table-column prop="supplier_name" label="供应商" min-width="180" />
        <el-table-column prop="supplier_country" label="原产国" width="110" />
        <el-table-column prop="incoterms" label="贸易条款" width="100" />
        <el-table-column prop="currency" label="币种" width="80" />
        <el-table-column prop="exchange_rate" label="锁定汇率" width="100" />
        <el-table-column label="原币金额" width="130">
          <template #default="{ row }">{{ fmt(row.total_amount) }}</template>
        </el-table-column>
        <el-table-column label="折合CNY" width="140">
          <template #default="{ row }">¥ {{ fmt(row.total_amount_cny) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="130">
          <template #default="{ row }"><StatusTag :status="row.status" :map="PO_STATUS_LABEL" /></template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/purchase/order/${row.id}`)">详情</el-button>
            <el-button v-if="can('purchase:edit') && ['DRAFT', 'REJECTED'].includes(row.status)" link type="primary" @click="$router.push(`/purchase/order/${row.id}/edit`)">编辑</el-button>
            <el-button v-if="can('purchase:submit') && ['DRAFT', 'REJECTED'].includes(row.status)" link type="primary" @click="act(row, 'submit')">提交</el-button>
            <el-button v-if="can('purchase:approve') && row.status === 'PENDING_APPROVE'" link type="success" @click="act(row, 'approve')">通过</el-button>
            <el-button v-if="can('purchase:approve') && row.status === 'PENDING_APPROVE'" link type="danger" @click="reject(row)">驳回</el-button>
            <el-button v-if="can('shipment:manage') && row.status === 'CONFIRMED'" link type="warning" @click="act(row, 'ship')">发货</el-button>
            <el-button v-if="can('shipment:manage') && row.status === 'IN_TRANSIT'" link type="success" @click="act(row, 'complete')">结案</el-button>
            <el-button v-if="can('purchase:edit') && ['DRAFT', 'PENDING_APPROVE', 'CONFIRMED', 'IN_TRANSIT'].includes(row.status)" link type="info" @click="act(row, 'cancel')">取消</el-button>
            <el-button v-if="can('purchase:delete') && ['DRAFT', 'REJECTED', 'CANCELLED'].includes(row.status)" link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { Plus, Search, Download } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { toastError } from '../../api';
import StatusTag from '../../components/StatusTag.vue';
import { PO_STATUS_LABEL } from '../../statusMap';
import { useAuthStore } from '../../store/auth';
import { downloadBlob } from '../../utils/file';

const auth = useAuthStore();
const can = (c) => auth.hasPerm(c);
const loading = ref(false);
const rows = ref([]);
const query = reactive({ status: '', keyword: '' });

const fmt = (n) => Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function load() {
  loading.value = true;
  try {
    const res = await api.get('/purchase/orders', { params: query });
    rows.value = res.data;
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

async function act(row, action) {
  try {
    await ElMessageBox.confirm(`确认对订单 ${row.po_code} 执行「${actLabel(action)}」操作？`, '操作确认', { type: 'warning' });
    const res = await api.post(`/purchase/orders/${row.id}/action`, { action });
    ElMessage.success(res.message);
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

async function reject(row) {
  try {
    const { value } = await ElMessageBox.prompt('请输入驳回原因', '驳回采购订单', { inputType: 'textarea', inputValidator: (v) => (v ? true : '驳回原因必填') });
    const res = await api.post(`/purchase/orders/${row.id}/action`, { action: 'reject', reason: value });
    ElMessage.success(res.message);
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确认删除采购订单 ${row.po_code}？`, '删除确认', { type: 'warning' });
    const res = await api.delete(`/purchase/orders/${row.id}`);
    ElMessage.success(res.message);
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

async function exportCsv() {
  try {
    const blob = await api.get('/purchase/orders/export', { responseType: 'blob' });
    downloadBlob(blob, `purchase-orders-${Date.now()}.csv`);
  } catch (e) {
    toastError(e);
  }
}

function actLabel(a) {
  return { submit: '提交审批', approve: '审批通过', ship: '发货并生成货运批次', complete: '结案', cancel: '取消' }[a] || a;
}

onMounted(load);
</script>
