<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">全球货运态势</h2>
      <div>
        <span class="muted" style="margin-right: 12px">共 {{ tracks.length }} 条货运批次 · 拖动旋转 / 滚轮缩放 · 悬停查看批次详情</span>
        <el-button :icon="Refresh" @click="load">刷新</el-button>
      </div>
    </div>

    <div class="stat-grid">
      <div v-for="s in legend" :key="s.status" class="stat-card">
        <div class="label"><i class="dot" :style="{ background: s.color }"></i>{{ s.label }}</div>
        <div class="value">{{ counts[s.status] || 0 }}</div>
        <div class="sub">批次数量</div>
      </div>
    </div>

    <div class="card-block" style="margin-top: 16px" v-loading="loading">
      <GlobalShipmentMap :tracks="tracks" />
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import api, { toastError } from '../../api';
import { STATUS_COLOR, STATUS_LABEL } from '../../globeData';

const GlobalShipmentMap = defineAsyncComponent(() => import('../../components/GlobalShipmentMap.vue'));

const tracks = ref([]);
const loading = ref(false);

const legend = Object.keys(STATUS_LABEL).map((k) => ({ status: k, label: STATUS_LABEL[k], color: STATUS_COLOR[k] }));
const counts = computed(() => {
  const c = {};
  for (const t of tracks.value) c[t.status] = (c[t.status] || 0) + 1;
  return c;
});

async function load() {
  loading.value = true;
  try {
    const res = await api.get('/shipment/global');
    tracks.value = res.data || [];
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 6px;
  vertical-align: middle;
}
</style>
