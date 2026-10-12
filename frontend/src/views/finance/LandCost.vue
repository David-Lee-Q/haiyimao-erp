<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">进口落地成本（Land Cost）分摊核算</h2>
    </div>

    <div class="card-block">
      <el-form inline>
        <el-form-item label="采购订单">
          <el-select v-model="poId" placeholder="选择采购订单" style="width: 320px" @change="reset">
            <el-option v-for="po in poList" :key="po.id" :label="`${po.po_code} · ${po.supplier_name}`" :value="po.id" />
          </el-select>
        </el-form-item>
        <el-button :icon="Plus" @click="addCost">添加费用项</el-button>
        <el-button type="primary" :loading="calculating" :disabled="!poId" @click="calculate">计算分摊</el-button>
      </el-form>

      <el-table :data="costs" size="small" border style="margin-top: 12px">
        <el-table-column label="费用类型" width="220">
          <template #default="{ row }">
            <el-select v-model="row.cost_type" style="width: 100%">
              <el-option v-for="(label, key) in COST_TYPE_LABEL" :key="key" :label="label" :value="key" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="金额 (CNY)" width="200">
          <template #default="{ row }"><el-input-number v-model="row.amount_cny" :min="0" :precision="2" controls-position="right" style="width: 100%" /></template>
        </el-table-column>
        <el-table-column label="分摊方式" width="200">
          <template #default="{ row }">
            <el-select v-model="row.allocation_method" style="width: 100%">
              <el-option v-for="(label, key) in ALLOCATION_LABEL" :key="key" :label="label" :value="key" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ $index }"><el-button link type="danger" @click="costs.splice($index, 1)">删除</el-button></template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="result" class="card-block">
      <h3>分摊结果</h3>
      <el-row :gutter="16" style="margin-bottom: 12px">
        <el-col :span="8"><div class="stat-card"><div class="label">货物基础成本</div><div class="value">¥ {{ fmt(result.base_goods_cost_cny) }}</div></div></el-col>
        <el-col :span="8"><div class="stat-card"><div class="label">附加费用合计</div><div class="value">¥ {{ fmt(additionalTotal) }}</div></div></el-col>
        <el-col :span="8"><div class="stat-card"><div class="label">完税后落地总成本</div><div class="value" style="color:#16508f">¥ {{ fmt(result.total_landed_cost_cny) }}</div></div></el-col>
      </el-row>
      <el-table :data="result.items_breakdown" size="small" border>
        <el-table-column prop="sku_code" label="SKU" width="170" />
        <el-table-column prop="product_name" label="品名" min-width="180" />
        <el-table-column prop="actual_net_weight_kg" label="净重(kg)" width="110" />
        <el-table-column prop="actual_box_count" label="箱数" width="90" />
        <el-table-column label="分摊附加成本" width="140"><template #default="{ row }">¥ {{ fmt(row.allocated_cost_cny) }}</template></el-table-column>
        <el-table-column label="单品总成本" width="140"><template #default="{ row }">¥ {{ fmt(row.total_cost_cny) }}</template></el-table-column>
        <el-table-column label="折合每公斤" width="130"><template #default="{ row }"><b style="color:#16508f">¥ {{ row.landed_cost_per_kg }}</b></template></el-table-column>
        <el-table-column label="折合每箱" width="130"><template #default="{ row }"><b style="color:#16508f">¥ {{ row.landed_cost_per_box }}</b></template></el-table-column>
      </el-table>
    </div>

    <div class="card-block">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h3 style="margin:0">落地成本记录</h3>
        <el-button size="small" :icon="Refresh" @click="loadRecords">刷新</el-button>
      </div>
      <el-table :data="records" size="small" empty-text="暂无核算记录">
        <el-table-column prop="po_code" label="采购单" width="180" />
        <el-table-column prop="currency" label="币种" width="90" />
        <el-table-column label="货物成本" width="140"><template #default="{ row }">¥ {{ fmt(row.total_amount_cny) }}</template></el-table-column>
        <el-table-column label="分摊附加成本" width="150"><template #default="{ row }">¥ {{ fmt(row.allocated_total) }}</template></el-table-column>
        <el-table-column prop="item_count" label="明细数" width="90" />
        <el-table-column prop="created_at" label="核算时间" width="180" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="loadForPo(row.po_id)">查看</el-button>
            <el-button v-if="can('finance:delete')" link type="danger" @click="removeRecord(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Plus, Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { toastError } from '../../api';
import { COST_TYPE_LABEL, ALLOCATION_LABEL } from '../../statusMap';
import { useAuthStore } from '../../store/auth';

const auth = useAuthStore();
const can = (c) => auth.hasPerm(c);
const poList = ref([]);
const poId = ref(null);
const calculating = ref(false);
const result = ref(null);
const records = ref([]);
const costs = reactive([
  { cost_type: 'OCEAN_FREIGHT', amount_cny: 0, allocation_method: 'BY_WEIGHT' },
]);

const fmt = (n) => Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const additionalTotal = computed(() => costs.reduce((s, c) => s + (Number(c.amount_cny) || 0), 0));

function addCost() {
  costs.push({ cost_type: 'PORT_FEE', amount_cny: 0, allocation_method: 'BY_BOX' });
}
function reset() {
  result.value = null;
}

async function load() {
  try {
    const res = await api.get('/purchase/orders');
    poList.value = res.data.filter((p) => !['DRAFT', 'CANCELLED', 'REJECTED'].includes(p.status));
  } catch (e) {
    toastError(e);
  }
}

async function calculate() {
  calculating.value = true;
  try {
    const res = await api.post('/finance/land-cost/calculate', { po_id: poId.value, additional_costs: costs.map((c) => ({ ...c })) });
    result.value = res.data;
    ElMessage.success(res.message);
    loadRecords();
  } catch (e) {
    toastError(e);
  } finally {
    calculating.value = false;
  }
}

async function loadRecords() {
  const res = await api.get('/finance/land-cost').catch(() => null);
  records.value = res ? res.data : [];
}

async function loadForPo(id) {
  poId.value = id;
  const po = poList.value.find((p) => p.id === id);
  const res = await api.post('/finance/land-cost/calculate', { po_id: id, additional_costs: [] });
  result.value = res.data;
}

async function removeRecord(row) {
  try {
    await ElMessageBox.confirm(`确认清除采购单 ${row.po_code} 的落地成本记录？`, '删除确认', { type: 'warning' });
    const res = await api.delete(`/finance/land-cost/${row.po_id}`);
    ElMessage.success(res.message);
    loadRecords();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

onMounted(() => {
  load();
  loadRecords();
});
</script>
