<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">操作日志</h2>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>
    <div class="card-block" v-loading="loading">
      <el-table :data="rows" size="small" empty-text="暂无操作日志">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="操作人" width="130" />
        <el-table-column label="动作" width="90">
          <template #default="{ row }"><el-tag size="small" :type="row.method === 'DELETE' ? 'danger' : row.method === 'POST' ? 'success' : 'warning'">{{ row.method }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="path" label="接口路径" min-width="320" />
        <el-table-column prop="detail" label="结果" width="120" />
        <el-table-column prop="created_at" label="时间" width="180" />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import api, { toastError } from '../api';

const rows = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await api.get('/audit-logs');
    rows.value = res.data;
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
