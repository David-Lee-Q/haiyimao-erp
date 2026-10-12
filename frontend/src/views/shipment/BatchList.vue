<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">货运批次与单证</h2>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>
    <div class="card-block" v-loading="loading">
      <el-table :data="rows" size="small" empty-text="暂无货运批次">
        <el-table-column prop="shipment_code" label="批次号" width="180" />
        <el-table-column prop="po_code" label="关联采购单" width="170" />
        <el-table-column prop="supplier_name" label="供应商" min-width="180" />
        <el-table-column prop="vessel" label="船名/航次" min-width="150" />
        <el-table-column prop="container_no" label="柜号" width="140" />
        <el-table-column prop="departure_port" label="起运港" width="150" />
        <el-table-column prop="arrival_port" label="目的港" width="130" />
        <el-table-column label="单证进度" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="row.uploaded_docs >= row.required_docs ? 'success' : 'warning'">
              {{ row.uploaded_docs }}/{{ row.required_docs }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前节点" width="130">
          <template #default="{ row }"><StatusTag :status="row.status" :map="SHIPMENT_STATUS_LABEL" /></template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/shipment/batch/${row.id}`)">控制台</el-button>
            <el-button v-if="can('shipment:delete')" link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { toastError } from '../../api';
import StatusTag from '../../components/StatusTag.vue';
import { SHIPMENT_STATUS_LABEL } from '../../statusMap';
import { useAuthStore } from '../../store/auth';

const auth = useAuthStore();
const can = (c) => auth.hasPerm(c);
const rows = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await api.get('/shipment/batches');
    rows.value = res.data;
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确认删除货运批次 ${row.shipment_code}？`, '删除确认', { type: 'warning' });
    const res = await api.delete(`/shipment/batches/${row.id}`);
    ElMessage.success(res.message);
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

onMounted(load);
</script>
