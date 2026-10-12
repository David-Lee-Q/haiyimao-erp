<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">货品入库理算（重公差校验）</h2>
    </div>

    <div class="card-block">
      <el-form inline>
        <el-form-item label="采购订单">
          <el-select v-model="poId" placeholder="选择已确认的采购订单" style="width: 300px" @change="onPoChange">
            <el-option v-for="po in poList" :key="po.id" :label="`${po.po_code} · ${po.supplier_name}`" :value="po.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="入库仓库">
          <el-select v-model="warehouseId" style="width: 220px">
            <el-option v-for="w in warehouses" :key="w.id" :label="`${w.name}（${ZONE_LABEL[w.zone_type]}）`" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-button type="primary" :loading="calculating" :disabled="!poId" @click="calculate">执行理算</el-button>
      </el-form>
    </div>

    <div v-if="items.length" class="card-block">
      <h3>实际入库明细（可修改实际箱数 / 净重）</h3>
      <el-table :data="items" size="small" border>
        <el-table-column prop="sku_code" label="SKU" width="160" />
        <el-table-column prop="product_name" label="品名" min-width="180" />
        <el-table-column label="合同箱数" width="100">
          <template #default="{ row }">{{ row.contract_box_count }}</template>
        </el-table-column>
        <el-table-column label="合同净重(kg)" width="120">
          <template #default="{ row }">{{ row.contract_net_weight_kg }}</template>
        </el-table-column>
        <el-table-column label="实际箱数" width="120">
          <template #default="{ row }"><el-input-number v-model="row.actual_box_count" :min="0" controls-position="right" style="width: 100%" /></template>
        </el-table-column>
        <el-table-column label="实际毛重(kg)" width="130">
          <template #default="{ row }"><el-input-number v-model="row.actual_gross_weight_kg" :min="0" :precision="2" controls-position="right" style="width: 100%" /></template>
        </el-table-column>
        <el-table-column label="实际净重(kg)" width="130">
          <template #default="{ row }"><el-input-number v-model="row.actual_net_weight_kg" :min="0" :precision="2" controls-position="right" style="width: 100%" /></template>
        </el-table-column>
        <el-table-column label="公差(%)" width="90">
          <template #default="{ row }">{{ row.weight_tolerance_pct }}</template>
        </el-table-column>
        <el-table-column label="原产国" width="120">
          <template #default="{ row }"><el-input v-model="row.origin_country" /></template>
        </el-table-column>
        <el-table-column label="厂号/注册号" width="150">
          <template #default="{ row }"><el-input v-model="row.plant_approval_no" /></template>
        </el-table-column>
        <el-table-column label="生产日期" width="160">
          <template #default="{ row }"><el-date-picker v-model="row.production_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" /></template>
        </el-table-column>
        <el-table-column label="保质期(天)" width="120">
          <template #default="{ row }"><el-input-number v-model="row.shelf_life_days" :min="1" controls-position="right" style="width: 100%" /></template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="result" class="card-block">
      <h3>理算结果</h3>
      <el-alert
        v-if="!result.is_within_tolerance"
        type="error"
        :closable="false"
        show-icon
        title="磅差超出合同约定公差"
        description="系统已阻断直接入库，并自动生成「磅差理赔单」进入二次审批流程。请修改实际数据或在审批中心处理。"
        style="margin-bottom: 12px"
      />
      <el-alert
        v-else
        type="success"
        :closable="false"
        show-icon
        title="磅差校验通过，可确认入库生成批次"
        style="margin-bottom: 12px"
      />
      <el-table :data="result.items" size="small" border>
        <el-table-column prop="sku_code" label="SKU" width="160" />
        <el-table-column prop="batch_code" label="追溯批次号" min-width="200" />
        <el-table-column label="净重偏差" width="110">
          <template #default="{ row }">
            <el-tag :type="row.is_within_tolerance ? 'success' : 'danger'" size="small">{{ row.weight_variance_pct }}%</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="actual_net_weight_kg" label="实际净重(kg)" width="120" />
        <el-table-column prop="actual_box_count" label="实际箱数" width="100" />
        <el-table-column prop="production_date" label="生产日期" width="120" />
        <el-table-column prop="generated_expiry_date" label="生成到期日" width="120" />
        <el-table-column prop="origin_country" label="原产国" width="110" />
      </el-table>
      <div style="text-align: right; margin-top: 12px">
        <el-button type="primary" :disabled="!result.is_within_tolerance" :loading="confirming" @click="confirmInbound">
          确认入库并生成库存批次
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import api, { toastError } from '../../api';
import { ZONE_LABEL } from '../../statusMap';

const poList = ref([]);
const warehouses = ref([]);
const poId = ref(null);
const warehouseId = ref(2);
const items = ref([]);
const result = ref(null);
const calculating = ref(false);
const confirming = ref(false);

async function loadOptions() {
  try {
    const [poRes, whRes] = await Promise.all([
      api.get('/purchase/orders'),
      api.get('/wms/warehouses'),
    ]);
    poList.value = poRes.data.filter((p) => ['CONFIRMED', 'IN_TRANSIT', 'COMPLETED'].includes(p.status));
    warehouses.value = whRes.data;
    if (warehouses.value.length) warehouseId.value = warehouses.value[1]?.id || warehouses.value[0].id;
  } catch (e) {
    toastError(e);
  }
}

async function onPoChange() {
  result.value = null;
  try {
    const res = await api.get(`/purchase/orders/${poId.value}`);
    const today = new Date().toISOString().slice(0, 10);
    items.value = res.data.items.map((it) => ({
      sku_code: it.sku_code,
      product_name: it.product_name,
      contract_box_count: it.box_count,
      contract_net_weight_kg: it.net_weight_kg,
      weight_tolerance_pct: it.weight_tolerance_pct,
      actual_box_count: it.box_count,
      actual_gross_weight_kg: it.gross_weight_kg,
      actual_net_weight_kg: it.net_weight_kg,
      origin_country: it.origin_country || '',
      plant_approval_no: '',
      production_date: today,
      shelf_life_days: 30,
      temperature_requirement: it.temperature_requirement,
    }));
  } catch (e) {
    toastError(e);
  }
}

async function calculate() {
  calculating.value = true;
  try {
    const res = await api.post('/wms/inbound/calculate', {
      po_id: poId.value,
      warehouse_id: warehouseId.value,
      actual_inbound_items: items.value.map((it) => ({ ...it })),
    });
    result.value = res.data;
    if (res.code === 409) {
      ElMessage.warning(res.message);
    } else {
      ElMessage.success(res.message);
    }
  } catch (e) {
    toastError(e);
  } finally {
    calculating.value = false;
  }
}

async function confirmInbound() {
  confirming.value = true;
  try {
    const res = await api.post('/wms/inbound/confirm', {
      po_id: poId.value,
      warehouse_id: warehouseId.value,
      items: result.value.items.map((r) => ({
        batch_code: r.batch_code,
        sku_code: r.sku_code,
        product_name: r.product_name,
        actual_box_count: r.actual_box_count,
        actual_net_weight_kg: r.actual_net_weight_kg,
        origin_country: r.origin_country,
        plant_approval_no: r.plant_approval_no,
        production_date: r.production_date,
        shelf_life_days: r.shelf_life_days,
        generated_expiry_date: r.generated_expiry_date,
        temperature_requirement: r.temperature_requirement,
      })),
    });
    ElMessage.success(res.message);
    result.value = null;
    items.value = [];
  } catch (e) {
    toastError(e);
  } finally {
    confirming.value = false;
  }
}

onMounted(loadOptions);
</script>
