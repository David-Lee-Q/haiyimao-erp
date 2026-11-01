<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">经营概览</h2>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="label">在途/已确认采购金额</div>
        <div class="value">¥ {{ fmt(summary.total_po_amount_cny) }}</div>
        <div class="sub">不含草稿与已取消订单</div>
      </div>
      <div class="stat-card">
        <div class="label">当前库存</div>
        <div class="value">{{ fmtInt(summary.inventory?.boxes) }} <small>箱</small></div>
        <div class="sub">净重 {{ fmt(summary.inventory?.net_weight) }} kg</div>
      </div>
      <div class="stat-card">
        <div class="label">待审批事项</div>
        <div class="value" :style="{ color: summary.pending_approvals ? '#e6a23c' : '' }">{{ summary.pending_approvals || 0 }}</div>
        <div class="sub">含采购审批 / 磅差理赔 / 临期出库</div>
      </div>
      <div class="stat-card">
        <div class="label">未处理冷链告警</div>
        <div class="value" :style="{ color: summary.open_alerts ? '#f56c6c' : '' }">{{ summary.open_alerts || 0 }}</div>
        <div class="sub">已锁定批次 {{ summary.locked_batches || 0 }} 个</div>
      </div>
    </div>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :xs="24" :md="12">
        <div class="card-block">
          <h3>采购订单状态分布</h3>
          <EChart :option="poStatusOption" :height="280" />
        </div>
      </el-col>
      <el-col :xs="24" :md="12">
        <div class="card-block">
          <h3>库存温区结构（箱）</h3>
          <EChart :option="zoneOption" :height="280" />
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :xs="24" :md="12">
        <div class="card-block">
          <h3>近 6 个月采购金额趋势（CNY）</h3>
          <EChart :option="trendOption" :height="280" />
        </div>
      </el-col>
      <el-col :xs="24" :md="12">
        <div class="card-block">
          <h3>货运批次节点分布</h3>
          <EChart :option="shipmentOption" :height="280" />
        </div>
      </el-col>
    </el-row>

    <div class="card-block">
      <h3>临期批次预警（20 天内到期）</h3>
      <el-table :data="summary.expiring_batches || []" size="small" empty-text="暂无临期批次">
        <el-table-column prop="batch_code" label="追溯批次号" min-width="200" />
        <el-table-column prop="product_name" label="品名" min-width="200" />
        <el-table-column prop="warehouse_name" label="仓库" width="150" />
        <el-table-column prop="current_boxes" label="库存箱数" width="100" />
        <el-table-column prop="expiry_date" label="到期日" width="120" />
        <el-table-column label="剩余天数" width="110">
          <template #default="{ row }">
            <el-tag :type="row.days_to_expiry <= 7 ? 'danger' : 'warning'" size="small">{{ row.days_to_expiry }} 天</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 全球货运态势悬浮窗 -->
    <div v-if="mapMode === 'expanded'" class="float-mask" @click="minimizeMap"></div>
    <div v-if="mapMode === 'expanded'" class="float-panel">
      <div class="float-head">
        <span class="float-title">全球货运态势</span>
        <el-icon class="float-btn" title="最小化" @click="minimizeMap"><Minus /></el-icon>
      </div>
      <div class="float-body" v-loading="mapLoading">
        <GlobalShipmentMap :tracks="tracks" />
      </div>
    </div>
    <div v-if="mapMode === 'minimized'" class="float-chip" title="展开全球货运态势" @click="expandMap">
      <el-icon><TrendCharts /></el-icon>
      <span>全球货运态势</span>
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { Refresh, Minus, TrendCharts } from '@element-plus/icons-vue';
import api, { toastError } from '../api';
import EChart from '../components/EChart.vue';

const GlobalShipmentMap = defineAsyncComponent(() => import('../components/GlobalShipmentMap.vue'));

const loading = ref(false);
const summary = ref({});

const mapMode = ref('expanded');
const tracks = ref([]);
const mapLoading = ref(false);

function minimizeMap() {
  mapMode.value = 'minimized';
}
function expandMap() {
  mapMode.value = 'expanded';
  if (!tracks.value.length) loadMap();
}
async function loadMap() {
  mapLoading.value = true;
  try {
    const res = await api.get('/shipment/global');
    tracks.value = res.data || [];
  } catch (e) {
    toastError(e);
  } finally {
    mapLoading.value = false;
  }
}

function fmt(n) {
  return Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInt(n) {
  return Number(n || 0).toLocaleString('zh-CN');
}

async function load() {
  loading.value = true;
  try {
    const res = await api.get('/dashboard/summary');
    summary.value = res.data;
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

const poStatusOption = computed(() => {
  const rows = summary.value.po_by_status || [];
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 90, right: 20, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { hideOverlap: true } },
    yAxis: { type: 'category', data: rows.map((r) => r.label) },
    series: [{ type: 'bar', data: rows.map((r) => r.count), itemStyle: { color: '#16508f' }, barWidth: 16 }],
  };
});

const zoneOption = computed(() => {
  const rows = summary.value.inventory?.by_zone || [];
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        data: rows.map((r) => ({ name: r.label, value: r.boxes })),
        label: { formatter: '{b}\n{c} 箱' },
      },
    ],
  };
});

const trendOption = computed(() => {
  const rows = summary.value.purchase_trend || [];
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 70, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: rows.map((r) => r.month) },
    yAxis: { type: 'value' },
    series: [{ type: 'line', smooth: true, areaStyle: { opacity: 0.15 }, data: rows.map((r) => r.amount), itemStyle: { color: '#13c2c2' } }],
  };
});

const shipmentOption = computed(() => {
  const rows = summary.value.shipments || [];
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 90, right: 20, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { hideOverlap: true } },
    yAxis: { type: 'category', data: rows.map((r) => r.label) },
    series: [{ type: 'bar', data: rows.map((r) => r.count), itemStyle: { color: '#67c23a' }, barWidth: 16 }],
  };
});

onMounted(load);
onMounted(loadMap);
</script>

<style scoped>
.float-mask {
  position: fixed;
  inset: 0;
  z-index: 2500;
  background: rgba(15, 26, 45, 0.35);
}
.float-panel {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2600;
  width: min(760px, 92vw);
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 18px 48px rgba(8, 22, 45, 0.35);
}
.float-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: linear-gradient(90deg, #0e3a63, #16508f);
  color: #fff;
}
.float-title { font-weight: 600; font-size: 14px; }
.float-btn { cursor: pointer; padding: 4px; border-radius: 6px; }
.float-btn:hover { background: rgba(255, 255, 255, 0.18); }
.float-body { max-height: 80vh; overflow: hidden; }
.float-body :deep(.map-legend) { padding: 8px 12px 6px; margin: 0; }
.float-body :deep(.global-globe) { height: 430px; border-radius: 0 0 14px 14px; }
.float-chip {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2400;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 24px;
  cursor: pointer;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  background: linear-gradient(90deg, #0e3a63, #16508f);
  box-shadow: 0 10px 26px rgba(8, 22, 45, 0.35);
  transition: transform 0.15s ease;
}
.float-chip:hover { transform: translateY(-2px); }
@media (max-width: 768px) {
  .float-panel { right: 12px; bottom: 12px; width: calc(100vw - 24px); }
  .float-body :deep(.global-globe) { height: 340px; }
  .float-chip { right: 12px; bottom: 12px; }
}
</style>
