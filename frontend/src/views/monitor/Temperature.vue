<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">冷链温控监控与告警</h2>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <div class="card-block">
      <h3>模拟 IoT 温度传感器上报</h3>
      <el-form inline>
        <el-form-item label="库存批次">
          <el-select v-model="iot.batch_id" filterable placeholder="选择批次" style="width: 340px">
            <el-option
              v-for="b in batches"
              :key="b.id"
              :label="`${b.batch_code} · ${b.warehouse_name} · ${ZONE_LABEL[b.zone_type]}`"
              :value="b.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="温度(°C)">
          <el-input-number v-model="iot.temperature" :precision="1" :step="0.5" controls-position="right" />
        </el-form-item>
        <el-button type="primary" :loading="reporting" @click="report">上报温度</el-button>
      </el-form>
      <div class="form-tip">规则：冷藏区连续 3 次上报温度 &gt; 4°C，系统自动生成高优先级告警并锁定该批次销售。</div>
    </div>

    <div class="card-block" v-loading="loading">
      <h3>告警列表</h3>
      <el-table :data="alerts" size="small" empty-text="暂无告警">
        <el-table-column label="级别" width="90">
          <template #default="{ row }"><el-tag :type="row.level === 'HIGH' ? 'danger' : 'warning'" size="small">{{ row.level }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="alert_type" label="类型" width="140" />
        <el-table-column prop="batch_code" label="批次" min-width="200" />
        <el-table-column prop="warehouse_name" label="仓库" width="150" />
        <el-table-column prop="message" label="告警内容" min-width="320" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }"><StatusTag :status="row.status" :map="{ OPEN: '未处理', RESOLVED: '已处理' }" /></template>
        </el-table-column>
        <el-table-column prop="created_at" label="发生时间" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'OPEN'" link type="primary" :disabled="!canHandle" @click="resolve(row)">处理并解锁</el-button>
            <el-button v-if="canHandle" link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { toastError } from '../../api';
import StatusTag from '../../components/StatusTag.vue';
import { ZONE_LABEL } from '../../statusMap';
import { useAuthStore } from '../../store/auth';

const auth = useAuthStore();
const canHandle = computed(() => auth.hasPerm('monitor:handle'));
const loading = ref(false);
const reporting = ref(false);
const alerts = ref([]);
const batches = ref([]);
const iot = reactive({ batch_id: null, temperature: 6.5 });

async function load() {
  loading.value = true;
  try {
    const [aRes, bRes] = await Promise.all([api.get('/alerts'), api.get('/wms/inventory/batches')]);
    alerts.value = aRes.data;
    batches.value = bRes.data;
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

async function report() {
  if (!iot.batch_id) return ElMessage.warning('请选择批次');
  reporting.value = true;
  try {
    const res = await api.post('/alerts/temperature', { batch_id: iot.batch_id, temperature: iot.temperature });
    if (res.data.alert) {
      ElMessage.error(res.message);
    } else {
      ElMessage.success(res.message);
    }
    load();
  } catch (e) {
    toastError(e);
  } finally {
    reporting.value = false;
  }
}

async function resolve(row) {
  try {
    await ElMessageBox.confirm('确认该温度告警已处理，并解除该批次的销售锁定？', '处理告警', { type: 'warning' });
    const res = await api.post(`/alerts/${row.id}/resolve`, { unlock: true });
    ElMessage.success(res.message);
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm('确认删除该告警记录？', '删除确认', { type: 'warning' });
    const res = await api.delete(`/alerts/${row.id}`);
    ElMessage.success(res.message);
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

onMounted(load);
</script>
