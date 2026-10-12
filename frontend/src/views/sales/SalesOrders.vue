<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">销售出库（FEFO 先到期先出）</h2>
      <el-button v-if="can('sales:create')" type="primary" :icon="Plus" @click="openCreate">新建出库单</el-button>
    </div>

    <div class="card-block" v-loading="loading">
      <el-table :data="orders" size="small" empty-text="暂无销售出库单">
        <el-table-column type="expand">
          <template #default="{ row }">
            <el-table :data="row.items" size="small" border style="margin: 6px 20px">
              <el-table-column prop="sku_code" label="SKU" width="170" />
              <el-table-column prop="batch_code" label="出库批次" min-width="200" />
              <el-table-column prop="box_count" label="出库箱数" width="110" />
              <el-table-column prop="net_weight" label="出库净重(kg)" width="120" />
              <el-table-column label="剩余保质期比" width="130">
                <template #default="{ row: it }">
                  <el-tag :type="it.remaining_ratio < 0.2 ? 'warning' : 'success'" size="small">{{ (it.remaining_ratio * 100).toFixed(1) }}%</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </el-table-column>
        <el-table-column prop="so_code" label="出库单号" width="190" />
        <el-table-column prop="customer" label="客户" min-width="160" />
        <el-table-column prop="total_boxes" label="总箱数" width="100" />
        <el-table-column prop="total_net_weight" label="总净重(kg)" width="120" />
        <el-table-column prop="remark" label="备注" min-width="120" />
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button v-if="can('sales:edit')" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="can('sales:delete')" link type="danger" @click="remove(row)">作废</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="createVisible" title="新建销售出库单" width="820px">
      <el-form inline>
        <el-form-item label="客户名称" required>
          <el-input v-model="form.customer" placeholder="如：盒马鲜生（华东）" style="width: 260px" />
        </el-form-item>
        <el-button :icon="Plus" @click="addLine">添加出库明细</el-button>
      </el-form>

      <el-table :data="form.items" size="small" border style="margin-top: 10px">
        <el-table-column label="SKU" width="220">
          <template #default="{ row }">
            <el-select v-model="row.sku_code" filterable placeholder="选择 SKU" style="width: 100%" @change="() => (row.batch_id = null)">
              <el-option v-for="s in skuOptions" :key="s.sku_code" :label="s.sku_code" :value="s.sku_code" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="品名" min-width="160">
          <template #default="{ row }">{{ skuOptions.find((s) => s.sku_code === row.sku_code)?.product_name || '-' }}</template>
        </el-table-column>
        <el-table-column label="出库箱数" width="130">
          <template #default="{ row }"><el-input-number v-model="row.box_count" :min="1" controls-position="right" style="width: 100%" /></template>
        </el-table-column>
        <el-table-column label="指定批次" width="220">
          <template #default="{ row }">
            <el-select v-model="row.batch_id" clearable placeholder="自动 FEFO 分配" style="width: 100%">
              <el-option
                v-for="b in batchesOf(row.sku_code)"
                :key="b.id"
                :label="`${b.batch_code}（${b.remaining_ratio != null ? (b.remaining_ratio * 100).toFixed(0) + '%' : ''}）`"
                :value="b.id"
                :disabled="b.sales_locked"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70">
          <template #default="{ $index }"><el-button link type="danger" @click="form.items.splice($index, 1)">删除</el-button></template>
        </el-table-column>
      </el-table>

      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">确认出库</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" title="编辑销售出库单" width="480px">
      <el-form :model="editForm" label-width="90px">
        <el-form-item label="客户名称" required><el-input v-model="editForm.customer" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="editForm.remark" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingEdit" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { toastError } from '../../api';
import { useAuthStore } from '../../store/auth';

const auth = useAuthStore();
const can = (c) => auth.hasPerm(c);
const loading = ref(false);
const submitting = ref(false);
const savingEdit = ref(false);
const createVisible = ref(false);
const editVisible = ref(false);
const orders = ref([]);
const batches = ref([]);
const form = reactive({ customer: '', items: [] });
const editForm = reactive({ id: null, customer: '', remark: '' });

const skuOptions = computed(() => {
  const map = new Map();
  for (const b of batches.value) {
    if (!map.has(b.sku_code)) map.set(b.sku_code, { sku_code: b.sku_code, product_name: b.product_name });
  }
  return [...map.values()];
});

function batchesOf(sku) {
  return batches.value.filter((b) => b.sku_code === sku);
}

function addLine() {
  form.items.push({ sku_code: '', box_count: 10, batch_id: null });
}

function openCreate() {
  form.customer = '';
  form.items = [{ sku_code: '', box_count: 10, batch_id: null }];
  createVisible.value = true;
}

function openEdit(row) {
  Object.assign(editForm, { id: row.id, customer: row.customer, remark: row.remark });
  editVisible.value = true;
}

async function saveEdit() {
  if (!editForm.customer) return ElMessage.warning('请输入客户名称');
  savingEdit.value = true;
  try {
    const res = await api.put(`/sales/orders/${editForm.id}`, { customer: editForm.customer, remark: editForm.remark });
    ElMessage.success(res.message);
    editVisible.value = false;
    load();
  } catch (e) {
    toastError(e);
  } finally {
    savingEdit.value = false;
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确认作废出库单 ${row.so_code}？作废后库存将回滚。`, '作废确认', { type: 'warning' });
    const res = await api.delete(`/sales/orders/${row.id}`);
    ElMessage.success(res.message);
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

async function load() {
  loading.value = true;
  try {
    const [soRes, batRes] = await Promise.all([api.get('/sales/orders'), api.get('/wms/inventory/batches')]);
    orders.value = soRes.data;
    batches.value = batRes.data.filter((b) => b.current_boxes > 0);
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!form.customer) return ElMessage.warning('请输入客户名称');
  const items = form.items.filter((i) => i.sku_code && i.box_count > 0);
  if (!items.length) return ElMessage.warning('请至少添加一条有效出库明细');
  submitting.value = true;
  try {
    const res = await api.post('/sales/orders', {
      customer: form.customer,
      items: items.map((i) => ({ sku_code: i.sku_code, box_count: i.box_count, batch_id: i.batch_id || undefined })),
    });
    ElMessage.success(res.message);
    createVisible.value = false;
    load();
  } catch (e) {
    if (e.code === 409) {
      ElMessage.warning(e.message);
    } else {
      toastError(e);
    }
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>
