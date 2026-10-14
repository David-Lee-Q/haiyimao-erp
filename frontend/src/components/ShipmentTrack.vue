<template>
  <div class="track-wrap" v-loading="loading">
    <template v-if="track">
      <div class="track-summary">
        <div class="ts-item">
          <span class="ts-label">当前状态</span>
          <el-tag :type="statusType" size="small">{{ track.status_label }}</el-tag>
        </div>
        <div class="ts-item">
          <span class="ts-label">航行进度</span>
          <b>{{ Math.round(track.progress * 100) }}%</b>
        </div>
        <div class="ts-item">
          <span class="ts-label">ETD</span>
          <b>{{ track.etd || '-' }}</b>
        </div>
        <div class="ts-item">
          <span class="ts-label">预估到港（ETA）</span>
          <b class="eta">{{ track.eta || '待定' }}</b>
        </div>
        <div class="ts-item" style="margin-left: auto">
          <span class="muted">拖动可旋转 / 滚轮缩放 · 悬停国家查看名称</span>
        </div>
      </div>

      <div class="globe-box">
        <ShipmentGlobe v-if="track" :track="track" />
      </div>

      <div class="track-body">
        <div class="timeline-panel">
          <h4>货运节点记录</h4>
          <el-timeline>
            <el-timeline-item
              v-for="n in track.timeline"
              :key="n.status"
              :type="n.done ? 'success' : 'info'"
              :hollow="!n.done"
              :timestamp="n.time || '待发生'"
              placement="top"
            >
              <span :class="{ 'node-done': n.done, 'node-todo': !n.done }">{{ n.status_label }}</span>
              <span v-if="n.remark" class="muted"> · {{ n.remark }}</span>
            </el-timeline-item>
          </el-timeline>
        </div>
        <div class="info-panel">
          <h4>航次信息</h4>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="批次号">{{ track.shipment.shipment_code }}</el-descriptions-item>
            <el-descriptions-item label="采购单">{{ track.po_code || '-' }}</el-descriptions-item>
            <el-descriptions-item label="运输方式">{{ track.transport_mode }}</el-descriptions-item>
            <el-descriptions-item label="起运港">{{ depLabel }}</el-descriptions-item>
            <el-descriptions-item label="目的港">{{ arrLabel }}</el-descriptions-item>
            <el-descriptions-item label="船名/航次">{{ track.shipment.vessel || '-' }}</el-descriptions-item>
            <el-descriptions-item label="集装箱号">{{ track.shipment.container_no || '-' }}</el-descriptions-item>
            <el-descriptions-item label="预估到港">{{ track.eta || '待定' }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </template>
    <el-empty v-else-if="!loading" description="暂无货运轨迹数据" />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import api, { toastError } from '../api';

const ShipmentGlobe = defineAsyncComponent(() => import('./ShipmentGlobe.vue'));

const props = defineProps({ shipmentId: { type: [Number, String], required: true } });

const loading = ref(false);
const track = ref(null);

const STATUS_TYPE = {
  PORT_DEPARTURE: 'warning',
  IN_TRANSIT: 'primary',
  PORT_ARRIVED: 'primary',
  CUSTOMS_CLEARING: 'warning',
  RELEASED: 'primary',
  WAREHOUSED: 'success',
};
const statusType = computed(() => (track.value ? STATUS_TYPE[track.value.shipment.status] || 'info' : 'info'));

const depLabel = computed(() => (track.value?.departure ? track.value.departure.label || track.value.departure.name : '起运港'));
const arrLabel = computed(() => (track.value?.arrival ? track.value.arrival.label || track.value.arrival.name : '目的港'));

async function load() {
  loading.value = true;
  try {
    const res = await api.get(`/shipment/batches/${props.shipmentId}/track`);
    track.value = res.data;
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

watch(() => props.shipmentId, load);
onMounted(load);
</script>

<style scoped>
.track-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
  padding: 12px 16px;
  background: #f4f8fd;
  border-radius: 8px;
  margin-bottom: 12px;
}
.ts-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.ts-label { color: #7a8699; }
.ts-item .eta { color: #16508f; }
.globe-box {
  position: relative;
  width: 100%;
  height: 460px;
  border-radius: 12px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 40%, #0a2b4a 0%, #04121f 70%);
}
.track-body {
  display: flex;
  gap: 16px;
  margin-top: 14px;
}
.timeline-panel { flex: 1 1 auto; min-width: 0; }
.timeline-panel h4, .info-panel h4 { margin: 0 0 12px; font-size: 14px; }
.info-panel { flex: 0 0 320px; }
.node-done { font-weight: 600; color: #2f9e6b; }
.node-todo { color: #9aa5b5; }
@media (max-width: 768px) {
  .track-body { flex-direction: column; }
  .info-panel { flex: none; }
  .globe-box { height: 340px; }
}
</style>
