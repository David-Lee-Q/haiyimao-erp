<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">{{ isEdit ? '编辑采购订单' : '新建采购订单' }}</h2>
      <el-button @click="$router.back()">返回</el-button>
    </div>

    <div class="card-block">
      <h3>基础信息</h3>
      <el-form :model="form" label-width="120px" inline-message>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="供应商" required>
              <el-select v-model="form.supplier_id" filterable remote reserve-keyword placeholder="搜索并选择供应商"
                :remote-method="searchSuppliers" :loading="supplierLoading" style="width: 100%">
                <el-option v-for="s in suppliers" :key="s.id" :label="`${s.name} (${s.country})`" :value="s.id" />
              </el-select>
              <div v-if="currentSupplier" class="form-tip">
                可用信用额度：<b :style="{ color: creditOver ? '#f56c6c' : '#67c23a' }">¥ {{ fmt(remainingCredit) }}</b>
                （额度 {{ fmt(currentSupplier.credit_limit_cny) }} / 已占用 {{ fmt(currentSupplier.credit_used_cny) }}）
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="贸易条款" required>
              <el-select v-model="form.incoterms" style="width: 100%">
                <el-option v-for="t in incoterms" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="币种 / 汇率" required>
              <el-input v-model="form.currency" style="width: 90px" disabled />
              <el-input-number v-model="form.exchange_rate" :precision="4" :step="0.01" :min="0" controls-position="right" style="width: 150px; margin-left: 8px" />
              <el-button link type="primary" style="margin-left: 6px" :loading="rateLoading" @click="fetchRate">取实时汇率</el-button>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="16">
            <el-form-item label="备注"><el-input v-model="form.remark" placeholder="可选，如合同约定、装运要求" /></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="采购合同" required>
              <FileUpload biz-type="PURCHASE_CONTRACT" :label="contractName ? '重新上传合同' : '上传合同'" @success="onContract" />
              <div v-if="contractName" class="form-tip">已选：{{ contractName }}</div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>

    <div class="card-block">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
        <h3 style="margin: 0">采购明细（多单位联动）</h3>
        <el-button type="primary" plain :icon="Plus" @click="addItem">添加明细行</el-button>
      </div>
      <el-table :data="form.items" size="small" border>
        <el-table-column label="生鲜SKU" width="170"><template #default="{ row }"><el-input v-model="row.sku_code" placeholder="SKU编码" /></template></el-table-column>
        <el-table-column label="品名" min-width="200"><template #default="{ row }"><el-input v-model="row.product_name" placeholder="如：智利车厘子 JJ级 5kg板装" /></template></el-table-column>
        <el-table-column label="原产国" width="130"><template #default="{ row }"><el-input v-model="row.origin_country" placeholder="Chile" /></template></el-table-column>
        <el-table-column label="箱数" width="100"><template #default="{ row }"><el-input-number v-model="row.box_count" :min="1" controls-position="right" style="width: 100%" /></template></el-table-column>
        <el-table-column label="单箱毛重(kg)" width="120"><template #default="{ row }"><el-input-number v-model="row.gross_per_box" :min="0" :precision="2" controls-position="right" style="width: 100%" /></template></el-table-column>
        <el-table-column label="单箱净重(kg)" width="120"><template #default="{ row }"><el-input-number v-model="row.net_per_box" :min="0" :precision="2" controls-position="right" style="width: 100%" /></template></el-table-column>
        <el-table-column label="总毛重" width="100"><template #default="{ row }"><span class="mono">{{ calcGross(row).toFixed(2) }}</span></template></el-table-column>
        <el-table-column label="总净重" width="100"><template #default="{ row }"><span class="mono">{{ calcNet(row).toFixed(2) }}</span></template></el-table-column>
        <el-table-column label="公差(%)" width="100"><template #default="{ row }"><el-input-number v-model="row.weight_tolerance_pct" :min="0" :max="20" :precision="2" controls-position="right" style="width: 100%" /></template></el-table-column>
        <el-table-column label="计价模式" width="110">
          <template #default="{ row }"><el-select v-model="row.price_mode"><el-option label="按箱" value="box" /><el-option label="按kg" value="kg" /></el-select></template>
        </el-table-column>
        <el-table-column :label="`单价(${form.currency})`" width="130">
          <template #default="{ row }">
            <el-input-number v-model="row.unit_price" :min="0" :precision="2" controls-position="right" style="width: 100%" />
            <div class="muted">{{ row.price_mode === 'box' ? '/箱' : '/kg' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="小计" width="130"><template #default="{ row }"><span class="mono">{{ calcSubTotal(row).toFixed(2) }}</span></template></el-table-column>
        <el-table-column label="温区" width="150">
          <template #default="{ row }">
            <el-select v-model="row.temperature_requirement">
              <el-option label="冷冻(-18C)" value="FROZEN" />
              <el-option label="冷藏(0-4C)" value="CHILLED" />
              <el-option label="常温" value="AMBIENT" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" fixed="right"><template #default="{ $index }"><el-button link type="danger" @click="form.items.splice($index, 1)">删除</el-button></template></el-table-column>
      </el-table>

      <div class="totals">
        <div>本单原币合计：<b>{{ form.currency }} {{ fmt(totalAmount) }}</b></div>
        <div>折合人民币：<b>¥ {{ fmt(totalAmountCny) }}</b></div>
      </div>
      <div v-if="creditOver" class="credit-warn">
        <el-alert type="warning" :closable="false" show-icon :title="`超出供应商可用信用额度 ¥ ${fmt(totalAmountCny - remainingCredit)}，提交后需走特批`" />
      </div>
    </div>

    <div style="text-align: right">
      <el-button @click="$router.back()">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">{{ isEdit ? '保存修改' : '创建采购订单' }}</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import api, { toastError } from '../../api';
import FileUpload from '../../components/FileUpload.vue';

const route = useRoute();
const router = useRouter();
const incoterms = ['FOB', 'CIF', 'CFR', 'EXW'];
const isEdit = computed(() => route.name === 'purchase-order-edit');
const supplierLoading = ref(false);
const rateLoading = ref(false);
const submitting = ref(false);
const suppliers = ref([]);
const contractName = ref('');

const form = reactive({ supplier_id: null, incoterms: 'CIF', currency: 'USD', exchange_rate: 7.185, remark: '', contract_file: '', contract_file_id: null, items: [] });

function newItem() {
  return { sku_code: '', product_name: '', origin_country: '', box_count: 100, gross_per_box: 5, net_per_box: 4.6, weight_tolerance_pct: 3, price_mode: 'box', unit_price: 0, temperature_requirement: 'CHILLED' };
}
function addItem() { form.items.push(newItem()); }

const calcGross = (row) => (Number(row.box_count) || 0) * (Number(row.gross_per_box) || 0);
const calcNet = (row) => (Number(row.box_count) || 0) * (Number(row.net_per_box) || 0);
const calcSubTotal = (row) => {
  const price = Number(row.unit_price) || 0;
  return row.price_mode === 'box' ? (Number(row.box_count) || 0) * price : calcNet(row) * price;
};
const totalAmount = computed(() => form.items.reduce((s, r) => s + calcSubTotal(r), 0));
const totalAmountCny = computed(() => totalAmount.value * (Number(form.exchange_rate) || 0));
const currentSupplier = computed(() => suppliers.value.find((s) => s.id === form.supplier_id) || null);
const remainingCredit = computed(() => (currentSupplier.value ? Number(currentSupplier.value.credit_limit_cny) - Number(currentSupplier.value.credit_used_cny) : 0));
const creditOver = computed(() => currentSupplier.value && totalAmountCny.value > remainingCredit.value);
const fmt = (n) => Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function searchSuppliers(q) {
  supplierLoading.value = true;
  try {
    const res = await api.get('/suppliers', { params: { keyword: q || '' } });
    suppliers.value = res.data;
  } catch (e) {
    toastError(e);
  } finally {
    supplierLoading.value = false;
  }
}

function onContract(file) {
  form.contract_file = file.original_name;
  form.contract_file_id = file.id;
  contractName.value = file.original_name;
}

async function fetchRate() {
  rateLoading.value = true;
  try {
    const res = await api.get('/finance/exchange-rate', { params: { currency: form.currency } });
    form.exchange_rate = res.data.rate;
    ElMessage.success(`已获取 ${form.currency}/CNY 中间价 ${res.data.rate}`);
  } catch (e) {
    toastError(e);
  } finally {
    rateLoading.value = false;
  }
}

async function loadForEdit() {
  const res = await api.get(`/purchase/orders/${route.params.id}`);
  const o = res.data;
  Object.assign(form, {
    supplier_id: o.supplier_id, incoterms: o.incoterms, currency: o.currency,
    exchange_rate: o.exchange_rate, remark: o.remark, contract_file: o.contract_file, contract_file_id: o.contract_file_id,
    items: o.items.map((it) => {
      const boxes = it.box_count || 1;
      return {
        sku_code: it.sku_code,
        product_name: it.product_name,
        origin_country: it.origin_country,
        box_count: it.box_count,
        gross_per_box: Number((it.gross_weight_kg / boxes).toFixed(3)),
        net_per_box: Number((it.net_weight_kg / boxes).toFixed(3)),
        weight_tolerance_pct: it.weight_tolerance_pct,
        price_mode: it.unit_price_per_box != null ? 'box' : 'kg',
        unit_price: it.unit_price_per_box != null ? it.unit_price_per_box : it.unit_price_per_kg,
        temperature_requirement: it.temperature_requirement,
      };
    }),
  });
  contractName.value = o.contract_file || '';
  await searchSuppliers(o.supplier_name || '');
}

async function submit() {
  if (!form.supplier_id) return ElMessage.warning('请选择供应商');
  if (!form.contract_file && !form.contract_file_id) return ElMessage.warning('请上传电子版采购合同');
  if (form.items.length === 0) return ElMessage.warning('请至少添加一条采购明细');
  for (const [i, it] of form.items.entries()) {
    if (!it.sku_code || !it.product_name) return ElMessage.warning(`第 ${i + 1} 行 SKU 与品名为必填`);
    if (!(Number(it.box_count) > 0)) return ElMessage.warning(`第 ${i + 1} 行箱数必须大于 0`);
    if (!(Number(it.net_per_box) > 0)) return ElMessage.warning(`第 ${i + 1} 行单箱净重必须大于 0`);
    if (Number(it.gross_per_box) < Number(it.net_per_box)) return ElMessage.warning(`第 ${i + 1} 行毛重不能小于净重`);
  }
  const payload = {
    supplier_id: form.supplier_id, incoterms: form.incoterms, currency: form.currency,
    exchange_rate: Number(form.exchange_rate), remark: form.remark,
    contract_file: form.contract_file, contract_file_id: form.contract_file_id,
    items: form.items.map((it) => ({
      sku_code: it.sku_code, product_name: it.product_name, origin_country: it.origin_country,
      box_count: Number(it.box_count), gross_weight_kg: calcGross(it), net_weight_kg: calcNet(it),
      weight_tolerance_pct: Number(it.weight_tolerance_pct),
      unit_price_per_box: it.price_mode === 'box' ? Number(it.unit_price) : null,
      unit_price_per_kg: it.price_mode === 'kg' ? Number(it.unit_price) : null,
      temperature_requirement: it.temperature_requirement,
    })),
  };
  submitting.value = true;
  try {
    if (isEdit.value) {
      const res = await api.put(`/purchase/orders/${route.params.id}`, payload);
      ElMessage.success(res.message);
      router.push(`/purchase/order/${route.params.id}`);
    } else {
      const res = await api.post('/purchase/orders', payload);
      if (res.data.credit_warning) ElMessage.warning(res.data.credit_warning);
      ElMessage.success(`采购订单 ${res.data.po_code} 创建成功`);
      router.push(`/purchase/order/${res.data.po_id}`);
    }
  } catch (e) {
    toastError(e);
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await searchSuppliers('');
  if (isEdit.value) {
    await loadForEdit();
  } else {
    addItem();
  }
});
</script>

<style scoped>
.totals { display: flex; justify-content: flex-end; gap: 30px; margin-top: 14px; font-size: 15px; }
.credit-warn { margin-top: 12px; }
</style>
