<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">审批中心</h2>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <div class="card-block">
      <el-radio-group v-model="statusFilter" @change="load">
        <el-radio-button label="">全部</el-radio-button>
        <el-radio-button label="PENDING">待处理</el-radio-button>
        <el-radio-button label="APPROVED">已通过</el-radio-button>
        <el-radio-button label="REJECTED">已驳回</el-radio-button>
      </el-radio-group>
    </div>

    <div class="card-block" v-loading="loading">
      <el-table :data="rows" size="small" empty-text="暂无审批事项">
        <el-table-column prop="biz_label" label="事项类型" width="150" />
        <el-table-column prop="reason" label="事由" min-width="320" />
        <el-table-column prop="applicant_name" label="申请人" width="130" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <StatusTag :status="row.status" :map="{ PENDING: '待处理', APPROVED: '已通过', REJECTED: '已驳回' }" />
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="提交时间" width="180" />
        <el-table-column prop="handled_at" label="处理时间" width="180" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'PENDING'">
              <el-button link type="success" :disabled="!canApprove" @click="handle(row, 'approve')">通过</el-button>
              <el-button link type="danger" :disabled="!canApprove" @click="handle(row, 'reject')">驳回</el-button>
            </template>
            <span v-else class="muted">已处理</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { toastError } from '../api';
import StatusTag from '../components/StatusTag.vue';
import { useAuthStore } from '../store/auth';

const auth = useAuthStore();
const canApprove = computed(() => auth.hasPerm('approval:handle'));
const loading = ref(false);
const rows = ref([]);
const statusFilter = ref('');

async function load() {
  loading.value = true;
  try {
    const res = await api.get('/approvals', { params: statusFilter.value ? { status: statusFilter.value } : {} });
    rows.value = res.data;
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

async function handle(row, act) {
  try {
    await ElMessageBox.confirm(`确认${act === 'approve' ? '通过' : '驳回'}该审批事项？`, '审批确认', { type: 'warning' });
    const res = await api.post(`/approvals/${row.id}/${act}`);
    ElMessage.success(res.message);
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

onMounted(load);
</script>
