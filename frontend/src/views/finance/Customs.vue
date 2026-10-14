<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">关税 / 增值税自动倒算</h2>
    </div>

    <div class="card-block">
      <el-form inline>
        <el-form-item label="采购订单">
          <el-select v-model="poId" placeholder="选择采购订单" style="width: 320px">
            <el-option v-for="po in poList" :key="po.id" :label="`${po.po_code} · ${po.supplier_name}`" :value="po.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="HS Code">
          <el-select v-model="hsCode" style="width: 260px">
            <el-option v-for="h in hsList" :key="h.hs_code" :label="`${h.hs_code} ${h.name}（关税${(h.tariff_rate*100).toFixed(0)}% / 增值税${(h.vat_rate*100).toFixed(0)}%）`" :value="h.hs_code" />
          </el-select>
        </el-form-item>
        <el-button type="primary" :loading="calculating" :disabled="!poId" @click="calculate">倒算</el-button>
      </el-form>
    </div>

    <el-row :gutter="16" v-if="result">
      <el-col :xs="24" :md="12">
        <div class="card-block">
          <h3>计算结果</h3>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="商品"><b>{{ result.hs_name }}（{{ result.hs_code }}）</b></el-descriptions-item>
            <el-descriptions-item label="CIF 完税价格（CNY）">¥ {{ fmt(result.cif_amount_cny) }}</el-descriptions-item>
            <el-descriptions-item label="关税税率">{{ (result.tariff_rate * 100).toFixed(0) }}%</el-descriptions-item>
            <el-descriptions-item label="关税金额">¥ {{ fmt(result.tariff_amount_cny) }}</el-descriptions-item>
            <el-descriptions-item label="增值税税率">{{ (result.vat_rate * 100).toFixed(0) }}%</el-descriptions-item>
            <el-descriptions-item label="增值税金额">¥ {{ fmt(result.vat_amount_cny) }}</el-descriptions-item>
            <el-descriptions-item label="应缴合计"><b style="color:#f56c6c">¥ {{ fmt(result.payable_total_cny) }}</b></el-descriptions-item>
            <el-descriptions-item label="财务预付应付凭证">{{ result.voucher_no }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </el-col>
      <el-col :xs="24" :md="12">
        <div class="card-block">
          <h3>税费结构</h3>
          <EChart :option="pieOption" :height="320" />
        </div>
      </el-col>
    </el-row>

    <div class="card-block">
      <h3>历史报关记录</h3>
      <el-button size="small" @click="loadDeclarations" style="margin-bottom: 10px">刷新记录</el-button>
      <el-table :data="declarations" size="small" empty-text="暂无报关记录">
        <el-table-column prop="po_code" label="采购单" width="170" />
        <el-table-column prop="declaration_no" label="报关单号" min-width="180" />
        <el-table-column prop="hs_code" label="HS Code" width="120" />
        <el-table-column label="关税" width="120">
          <template #default="{ row }">¥ {{ fmt(row.tariff_amount_cny) }}</template>
        </el-table-column>
        <el-table-column label="增值税" width="120">
          <template #default="{ row }">¥ {{ fmt(row.vat_amount_cny) }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="生成时间" width="180" />
        <el-table-column v-if="can('finance:delete')" label="操作" width="100" fixed="right">
          <template #default="{ row }"><el-button link type="danger" @click="removeDecl(row)">删除</el-button></template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { toastError } from '../../api';
import EChart from '../../components/EChart.vue';
import { useAuthStore } from '../../store/auth';

const auth = useAuthStore();
const can = (c) => auth.hasPerm(c);
const poList = ref([]);
const hsList = ref([]);
const declarations = ref([]);
const poId = ref(null);
const hsCode = ref('0810.10.00');
const calculating = ref(false);
const result = ref(null);

const fmt = (n) => Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pieOption = computed(() => {
  if (!result.value) return {};
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '68%'],
        data: [
          { name: 'CIF 货值', value: result.value.cif_amount_cny },
          { name: '关税', value: result.value.tariff_amount_cny },
          { name: '增值税', value: result.value.vat_amount_cny },
        ],
      },
    ],
  };
});

async function loadOptions() {
  try {
    const [poRes, hsRes] = await Promise.all([api.get('/purchase/orders'), api.get('/finance/hs-codes')]);
    poList.value = poRes.data.filter((p) => !['DRAFT', 'CANCELLED', 'REJECTED'].includes(p.status));
    hsList.value = hsRes.data;
  } catch (e) {
    toastError(e);
  }
}

async function calculate() {
  calculating.value = true;
  try {
    const res = await api.post('/finance/customs/calculate', { po_id: poId.value, hs_code: hsCode.value });
    result.value = res.data;
    ElMessage.success(res.message);
    loadDeclarations();
  } catch (e) {
    toastError(e);
  } finally {
    calculating.value = false;
  }
}

async function loadDeclarations() {
  try {
    const res = await api.get('/finance/customs/declarations');
    declarations.value = res.data;
  } catch (e) {
    toastError(e);
  }
}

async function removeDecl(row) {
  try {
    await ElMessageBox.confirm(`确认删除报关记录 ${row.declaration_no}？`, '删除确认', { type: 'warning' });
    const res = await api.delete(`/finance/customs/declarations/${row.id}`);
    ElMessage.success(res.message);
    loadDeclarations();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

onMounted(() => {
  loadOptions();
  loadDeclarations();
});
</script>
