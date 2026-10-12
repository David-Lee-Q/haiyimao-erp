<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">库存批次（按 FEFO 先到期先出排序）</h2>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <div class="card-block">
      <el-form inline>
        <el-form-item label="SKU"><el-input v-model="query.sku_code" placeholder="按 SKU 搜索" clearable style="width: 200px" @keyup.enter="load" /></el-form-item>
        <el-form-item label="温区">
          <el-select v-model="query.zone_type" clearable placeholder="全部" style="width: 150px" @change="load">
            <el-option v-for="(label, key) in ZONE_LABEL" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="销售状态">
          <el-select v-model="query.sales_locked" clearable placeholder="全部" style="width: 150px" @change="load">
            <el-option label="正常" :value="0" /><el-option label="已锁定" :value="1" />
          </el-select>
        </el-form-item>
        <el-button :icon="Search" @click="load">查询</el-button>
      </el-form>
    </div>

    <div class="card-block" v-loading="loading">
      <el-table :data="rows" size="small" empty-text="暂无库存批次">
        <el-table-column prop="batch_code" label="追溯批次号" min-width="210" />
        <el-table-column prop="product_name" label="品名" min-width="180" />
        <el-table-column prop="origin_country" label="原产国" width="100" />
        <el-table-column prop="warehouse_name" label="仓库" width="150" />
        <el-table-column label="温区" width="120"><template #default="{ row }">{{ row.zone_label }}</template></el-table-column>
        <el-table-column prop="current_boxes" label="库存箱数" width="100" />
        <el-table-column prop="current_net_weight" label="库存净重(kg)" width="120" />
        <el-table-column prop="production_date" label="生产日期" width="115" />
        <el-table-column prop="expiry_date" label="到期日" width="115" />
        <el-table-column label="剩余天数" width="100">
          <template #default="{ row }"><el-tag :type="row.days_to_expiry <= 7 ? 'danger' : row.days_to_expiry <= 20 ? 'warning' : 'success'" size="small">{{ row.days_to_expiry }} 天</el-tag></template>
        </el-table-column>
        <el-table-column label="销售状态" width="100">
          <template #default="{ row }">
            <el-tooltip v-if="row.sales_locked" :content="row.lock_reason || '已锁定'"><el-tag type="danger" size="small">已锁定</el-tag></el-tooltip>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button v-if="can('monitor:view')" link type="primary" @click="viewTemp(row)">温控记录</el-button>
            <el-button link type="primary" @click="viewLogs(row)">库存流水</el-button>
            <el-button v-if="can('wms:adjust')" link type="warning" @click="openAdjust(row)">盘点调整</el-button>
            <el-button v-if="can('inventory:delete')" link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="tempVisible" :title="`温控记录 · ${tempBatch?.batch_code || ''}`" width="640px">
      <EChart v-if="tempLogs.length" :option="tempOption" :height="260" />
      <el-empty v-else description="暂无温度记录" :image-size="70" />
    </el-dialog>

    <el-dialog v-model="logVisible" :title="`库存流水 · ${logBatch?.batch_code || ''}`" width="720px">
      <el-table :data="logs" size="small" border empty-text="暂无流水">
        <el-table-column prop="action" label="动作" width="120" />
        <el-table-column prop="box_delta" label="箱数变动" width="100" />
        <el-table-column prop="weight_delta" label="净重变动(kg)" width="130" />
        <el-table-column prop="before_boxes" label="变动前" width="90" />
        <el-table-column prop="after_boxes" label="变动后" width="90" />
        <el-table-column prop="reason" label="原因" min-width="150" />
        <el-table-column prop="created_at" label="时间" width="170" />
      </el-table>
    </el-dialog>

    <el-dialog v-model="adjustVisible" :title="`盘点调整 · ${adjustBatch?.batch_code || ''}`" width="480px">
      <el-form :model="adjustForm" label-width="110px">
        <el-form-item label="调整类型">
          <el-select v-model="adjustForm.action" style="width: 100%">
            <el-option label="库存盘点(增减)" value="ADJUST" />
            <el-option label="报废" value="SCRAP" />
            <el-option label="调拨仓库" value="TRANSFER" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="adjustForm.action !== 'TRANSFER'" label="箱数变动">
          <el-input-number v-model="adjustForm.box_delta" :controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="adjustForm.action !== 'TRANSFER'" label="净重变动(kg)">
          <el-input-number v-model="adjustForm.weight_delta" :precision="2" :controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="adjustForm.action === 'TRANSFER'" label="目标仓库">
          <el-select v-model="adjustForm.to_warehouse_id" style="width: 100%">
            <el-option v-for="w in warehouses" :key="w.id" :label="`${w.name}（${ZONE_LABEL[w.zone_type]}）`" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="原因"><el-input v-model="adjustForm.reason" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button type="primary" :loading="adjusting" @click="doAdjust">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Refresh, Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { toastError } from '../../api';
import EChart from '../../components/EChart.vue';
import { ZONE_LABEL } from '../../statusMap';
import { useAuthStore } from '../../store/auth';

const MAX_TEMP = { CHILLED: 4, FROZEN: -15, AMBIENT: 25 };
const auth = useAuthStore();
const can = (c) => auth.hasPerm(c);
const rows = ref([]);
const warehouses = ref([]);
const loading = ref(false);
const query = reactive({ sku_code: '', zone_type: '', sales_locked: '' });
const tempVisible = ref(false);
const tempBatch = ref(null);
const tempLogs = ref([]);
const logVisible = ref(false);
const logBatch = ref(null);
const logs = ref([]);
const adjustVisible = ref(false);
const adjusting = ref(false);
const adjustBatch = ref(null);
const adjustForm = reactive({ action: 'ADJUST', box_delta: 0, weight_delta: 0, to_warehouse_id: null, reason: '' });

async function load() {
  loading.value = true;
  try {
    const res = await api.get('/wms/inventory/batches', { params: query });
    rows.value = res.data;
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

async function loadWarehouses() {
  const res = await api.get('/wms/warehouses').catch(() => null);
  warehouses.value = res ? res.data : [];
}

async function viewTemp(row) {
  tempBatch.value = row;
  try {
    const res = await api.get(`/alerts/temperature/${row.id}`);
    tempLogs.value = res.data.slice().reverse();
    tempVisible.value = true;
  } catch (e) {
    toastError(e);
  }
}

async function viewLogs(row) {
  logBatch.value = row;
  try {
    const res = await api.get(`/wms/inventory/batches/${row.id}/logs`);
    logs.value = res.data;
    logVisible.value = true;
  } catch (e) {
    toastError(e);
  }
}

function openAdjust(row) {
  adjustBatch.value = row;
  Object.assign(adjustForm, { action: 'ADJUST', box_delta: 0, weight_delta: 0, to_warehouse_id: warehouses.value[0]?.id || null, reason: '' });
  adjustVisible.value = true;
}

async function doAdjust() {
  adjusting.value = true;
  try {
    const res = await api.post('/wms/inventory/adjust', { batch_id: adjustBatch.value.id, ...adjustForm });
    ElMessage.success(res.message);
    adjustVisible.value = false;
    load();
  } catch (e) {
    toastError(e);
  } finally {
    adjusting.value = false;
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确认删除库存批次 ${row.batch_code}？`, '删除确认', { type: 'warning' });
    const res = await api.delete(`/wms/inventory/batches/${row.id}`);
    ElMessage.success(res.message);
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

const tempOption = computed(() => {
  const max = MAX_TEMP[tempBatch.value?.zone_type] ?? 4;
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: tempLogs.value.map((l) => l.recorded_at.slice(5, 16)) },
    yAxis: { type: 'value', name: '°C' },
    series: [{ name: '温度', type: 'line', data: tempLogs.value.map((l) => l.temperature), itemStyle: { color: '#f56c6c' }, markLine: { data: [{ yAxis: max, name: '上限' }], lineStyle: { color: '#e6a23c' } } }],
  };
});

onMounted(() => {
  load();
  loadWarehouses();
});
</script>
