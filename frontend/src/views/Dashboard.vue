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
      <el-col :span="12">
        <div class="card-block">
          <h3>采购订单状态分布</h3>
          <EChart :option="poStatusOption" :height="280" />
        </div>
      </el-col>
      <el-col :span="12">
        <div class="card-block">
          <h3>库存温区结构（箱）</h3>
          <EChart :option="zoneOption" :height="280" />
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="12">
        <div class="card-block">
          <h3>近 6 个月采购金额趋势（CNY）</h3>
          <EChart :option="trendOption" :height="280" />
        </div>
      </el-col>
      <el-col :span="12">
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
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import api, { toastError } from '../api';
import EChart from '../components/EChart.vue';

const loading = ref(false);
const summary = ref({});

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
    xAxis: { type: 'value' },
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
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: rows.map((r) => r.label) },
    series: [{ type: 'bar', data: rows.map((r) => r.count), itemStyle: { color: '#67c23a' }, barWidth: 16 }],
  };
});

onMounted(load);
</script>
