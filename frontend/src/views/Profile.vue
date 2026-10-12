<template>
  <div class="page">
    <div class="page-header"><h2 class="page-title">我的权限</h2></div>
    <div class="card-block" v-loading="loading">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="账号">{{ user.username }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ user.real_name }}</el-descriptions-item>
        <el-descriptions-item label="角色">{{ user.role_label }}</el-descriptions-item>
        <el-descriptions-item label="权限数量">{{ permissions.length }}</el-descriptions-item>
      </el-descriptions>
      <h3 style="margin-top: 16px">已授权功能</h3>
      <el-tag v-for="p in permissionLabels" :key="p" style="margin: 4px" size="small">{{ p }}</el-tag>
      <el-empty v-if="!permissions.length" description="暂无权限" :image-size="60" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import api, { toastError } from '../api';

const user = ref({});
const permissions = ref([]);
const labels = ref({});
const loading = ref(false);

const permissionLabels = computed(() => {
  if (permissions.value.includes('*')) return ['全部权限'];
  return permissions.value.map((p) => labels.value[p] || p);
});

async function load() {
  loading.value = true;
  try {
    const res = await api.get('/auth/me');
    user.value = res.data;
    permissions.value = res.data.permissions || [];
    const pRes = await api.get('/users/permissions').catch(() => null);
    labels.value = pRes ? pRes.data : {};
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
