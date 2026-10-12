<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ order.po_code || '采购订单详情' }}</h2>
        <div class="muted" style="margin-top: 4px">
          <StatusTag :status="order.status" :map="PO_STATUS_LABEL" />
          <span style="margin-left: 8px">{{ order.supplier_name }} · {{ order.supplier_country }}</span>
          <span style="margin-left: 8px">创建人：{{ order.creator_name }}</span>
        </div>
      </div>
      <div>
        <el-button @click="$router.push('/purchase/orders')">返回列表</el-button>
        <el-button v-if="can('purchase:edit') && ['DRAFT', 'REJECTED'].includes(order.status)" type="primary" @click="$router.push(`/purchase/order/${order.id}/edit`)">编辑</el-button>
        <el-button v-if="can('purchase:submit') && ['DRAFT', 'REJECTED'].includes(order.status)" type="primary" @click="act('submit')">提交审批</el-button>
        <el-button v-if="can('purchase:approve') && order.status === 'PENDING_APPROVE'" type="success" @click="act('approve')">审批通过</el-button>
        <el-button v-if="can('purchase:approve') && order.status === 'PENDING_APPROVE'" type="danger" @click="reject">驳回</el-button>
        <el-button v-if="can('shipment:manage') && order.status === 'CONFIRMED'" type="warning" @click="act('ship')">发货并生成货运批次</el-button>
        <el-button v-if="can('shipment:manage') && order.status === 'IN_TRANSIT'" type="success" @click="act('complete')">结案</el-button>
        <el-button v-if="can('purchase:delete') && ['DRAFT', 'REJECTED', 'CANCELLED'].includes(order.status)" type="danger" plain @click="remove">删除</el-button>
      </div>
    </div>

    <el-descriptions :column="4" border class="card-block">
      <el-descriptions-item label="贸易条款">{{ order.incoterms }}</el-descriptions-item>
      <el-descriptions-item label="币种">{{ order.currency }}</el-descriptions-item>
      <el-descriptions-item label="锁定汇率">{{ order.exchange_rate }}</el-descriptions-item>
      <el-descriptions-item label="原币金额">{{ fmt(order.total_amount) }}</el-descriptions-item>
      <el-descriptions-item label="折合CNY">¥ {{ fmt(order.total_amount_cny) }}</el-descriptions-item>
      <el-descriptions-item label="采购合同">{{ order.contract_file || '未上传' }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ order.created_at }}</el-descriptions-item>
      <el-descriptions-item label="备注">{{ order.remark || '-' }}</el-descriptions-item>
    </el-descriptions>

    <div v-if="order.reject_reason" class="card-block">
      <el-alert type="error" :closable="false" show-icon title="驳回原因" :description="order.reject_reason" />
    </div>

    <div class="card-block">
      <h3>采购明细</h3>
      <el-table :data="order.items" size="small" border>
        <el-table-column prop="sku_code" label="SKU" width="170" />
        <el-table-column prop="product_name" label="品名" min-width="200" />
        <el-table-column prop="box_count" label="箱数" width="90" />
        <el-table-column prop="gross_weight_kg" label="总毛重(kg)" width="110" />
        <el-table-column prop="net_weight_kg" label="总净重(kg)" width="110" />
        <el-table-column label="公差" width="80"><template #default="{ row }">{{ row.weight_tolerance_pct }}%</template></el-table-column>
        <el-table-column label="单价" width="160">
          <template #default="{ row }">
            <span v-if="row.unit_price_per_box != null">{{ row.unit_price_per_box }} /箱</span>
            <span v-else-if="row.unit_price_per_kg != null">{{ row.unit_price_per_kg }} /kg</span>
          </template>
        </el-table-column>
        <el-table-column label="小计" width="130"><template #default="{ row }">{{ fmt(row.sub_total) }}</template></el-table-column>
        <el-table-column label="温区" width="130"><template #default="{ row }">{{ ZONE_LABEL[row.temperature_requirement] || row.temperature_requirement }}</template></el-table-column>
      </el-table>
    </div>

    <div class="card-block">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px">
        <h3 style="margin: 0">采购合同附件</h3>
        <FileUpload v-if="can('file:upload')" biz-type="PURCHASE_ORDER" :biz-id="order.id" label="上传附件" @success="reload" />
      </div>
      <AttachmentList :files="order.attachments || []" :can-delete="can('file:delete')" @delete="removeFile" empty-text="暂无附件" />
    </div>

    <el-row :gutter="16">
      <el-col :span="12">
        <div class="card-block">
          <div style="display:flex;justify-content:space-between">
            <h3>国际货运批次</h3>
            <el-button v-if="order.shipment" link type="primary" @click="$router.push(`/shipment/batch/${order.shipment.id}`)">进入控制台</el-button>
          </div>
          <el-empty v-if="!order.shipment" description="尚未生成货运批次（订单确认并发货后生成）" :image-size="70" />
          <el-descriptions v-else :column="2" border size="small">
            <el-descriptions-item label="批次号">{{ order.shipment.shipment_code }}</el-descriptions-item>
            <el-descriptions-item label="状态"><StatusTag :status="order.shipment.status" :map="SHIPMENT_STATUS_LABEL" /></el-descriptions-item>
            <el-descriptions-item label="船名/航次">{{ order.shipment.vessel || '-' }}</el-descriptions-item>
            <el-descriptions-item label="柜号">{{ order.shipment.container_no || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="card-block">
          <div style="display:flex;justify-content:space-between">
            <h3>落地成本分摊</h3>
            <el-button v-if="can('finance:view')" link type="primary" @click="$router.push('/finance/land-cost')">前往核算</el-button>
          </div>
          <el-table :data="order.landing_cost_items" size="small" empty-text="尚未核算落地成本">
            <el-table-column prop="sku_code" label="SKU" width="150" />
            <el-table-column label="每kg成本" width="120"><template #default="{ row }">¥ {{ row.landed_cost_per_kg }}</template></el-table-column>
            <el-table-column label="每箱成本" width="120"><template #default="{ row }">¥ {{ row.landed_cost_per_box }}</template></el-table-column>
          </el-table>
          <div v-if="order.landing_costs?.length" style="margin-top: 10px">
            <el-tag v-for="c in order.landing_costs" :key="c.id" style="margin-right: 6px" type="info">{{ COST_TYPE_LABEL[c.cost_type] || c.cost_type }} ¥{{ fmt(c.amount_cny) }}</el-tag>
          </div>
        </div>
      </el-col>
    </el-row>

    <div class="card-block">
      <h3>已生成库存批次</h3>
      <el-table :data="order.batches" size="small" empty-text="尚未入库生成批次">
        <el-table-column prop="batch_code" label="追溯批次号" min-width="200" />
        <el-table-column prop="warehouse_name" label="仓库" width="150" />
        <el-table-column prop="zone_type" label="温区" width="110" />
        <el-table-column prop="current_boxes" label="库存箱数" width="100" />
        <el-table-column prop="current_net_weight" label="库存净重(kg)" width="120" />
        <el-table-column prop="production_date" label="生产日期" width="120" />
        <el-table-column prop="expiry_date" label="到期日" width="120" />
        <el-table-column label="销售锁定" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.sales_locked" type="danger" size="small">已锁定</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { toastError } from '../../api';
import StatusTag from '../../components/StatusTag.vue';
import FileUpload from '../../components/FileUpload.vue';
import AttachmentList from '../../components/AttachmentList.vue';
import { PO_STATUS_LABEL, SHIPMENT_STATUS_LABEL, ZONE_LABEL, COST_TYPE_LABEL } from '../../statusMap';
import { useAuthStore } from '../../store/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const can = (c) => auth.hasPerm(c);
const loading = ref(false);
const order = ref({});

const fmt = (n) => Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function load() {
  loading.value = true;
  try {
    const res = await api.get(`/purchase/orders/${route.params.id}`);
    order.value = res.data;
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}
function reload() { load(); }

async function act(action) {
  try {
    await ElMessageBox.confirm('确认执行该操作？', '操作确认', { type: 'warning' });
    const res = await api.post(`/purchase/orders/${order.value.id}/action`, { action });
    ElMessage.success(res.message);
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

async function reject() {
  try {
    const { value } = await ElMessageBox.prompt('请输入驳回原因', '驳回采购订单', { inputType: 'textarea', inputValidator: (v) => (v ? true : '驳回原因必填') });
    const res = await api.post(`/purchase/orders/${order.value.id}/action`, { action: 'reject', reason: value });
    ElMessage.success(res.message);
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

async function remove() {
  try {
    await ElMessageBox.confirm(`确认删除采购订单 ${order.value.po_code}？`, '删除确认', { type: 'warning' });
    await api.delete(`/purchase/orders/${order.value.id}`);
    ElMessage.success('已删除');
    router.push('/purchase/orders');
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

async function removeFile(file) {
  try {
    await ElMessageBox.confirm(`确认删除附件「${file.original_name}」？`, '删除确认', { type: 'warning' });
    await api.delete(`/files/${file.id}`);
    ElMessage.success('已删除');
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

onMounted(load);
</script>
