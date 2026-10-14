<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ detail.shipment?.shipment_code || '货运批次控制台' }}</h2>
        <div class="muted" style="margin-top: 4px">关联采购单：{{ detail.po?.po_code }}</div>
      </div>
      <div>
        <el-button @click="$router.push('/shipment/batches')">返回列表</el-button>
        <el-button :icon="Location" @click="trackVisible = true">货运海图</el-button>
        <el-button v-if="can('shipment:manage')" :icon="Edit" @click="openEditShipment">编辑货运信息</el-button>
        <el-button v-if="can('shipment:manage') && detail.current_step_index < steps.length - 1" type="primary" :loading="advancing" @click="advance">
          推进至「{{ steps[detail.current_step_index + 1] ? SHIPMENT_STATUS_LABEL[steps[detail.current_step_index + 1]] : '-' }}」
        </el-button>
        <el-button v-if="can('shipment:delete')" type="danger" plain @click="removeShipment">删除</el-button>
      </div>
    </div>

    <div class="card-block">
      <h3>物流状态看板</h3>
      <el-steps :active="detail.current_step_index" align-center finish-status="success" process-status="process">
        <el-step v-for="s in steps" :key="s" :title="SHIPMENT_STATUS_LABEL[s]" />
      </el-steps>
    </div>

    <el-row :gutter="16">
      <el-col :xs="24" :md="14">
        <div class="card-block">
          <h3>提单 / 运输信息</h3>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="运输方式">{{ detail.shipment?.transport_mode }}</el-descriptions-item>
            <el-descriptions-item label="提单号">{{ detail.shipment?.bl_no || '-' }}</el-descriptions-item>
            <el-descriptions-item label="船名/航次">{{ detail.shipment?.vessel || '-' }}</el-descriptions-item>
            <el-descriptions-item label="集装箱号">{{ detail.shipment?.container_no || '-' }}</el-descriptions-item>
            <el-descriptions-item label="封号">{{ detail.shipment?.seal_no || '-' }}</el-descriptions-item>
            <el-descriptions-item label="起运港">{{ detail.shipment?.departure_port || '-' }}</el-descriptions-item>
            <el-descriptions-item label="目的港">{{ detail.shipment?.arrival_port || '-' }}</el-descriptions-item>
            <el-descriptions-item label="ETD / ETA">{{ detail.shipment?.etd || '-' }} / {{ detail.shipment?.eta || '-' }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </el-col>
      <el-col :xs="24" :md="10">
        <div class="card-block">
          <h3>单证完整性</h3>
          <el-progress type="dashboard" :percentage="docPercent" :color="docPercent >= 100 ? '#67c23a' : '#e6a23c'" />
          <div class="muted" style="text-align: center; margin-top: 6px">必需单证 {{ uploadedRequired }}/{{ requiredTotal }} 已上传</div>
        </div>
      </el-col>
    </el-row>

    <div class="card-block">
      <h3>单证核销矩阵</h3>
      <el-table :data="detail.documents" size="small" border>
        <el-table-column prop="doc_name" label="单证类型" min-width="170" />
        <el-table-column label="是否必需" width="100">
          <template #default="{ row }"><el-tag :type="row.is_required ? 'danger' : 'info'" size="small">{{ row.is_required ? '必需' : '选填' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="上传状态" width="110">
          <template #default="{ row }"><StatusTag :status="row.status" :map="{ UPLOADED: '已上传', PENDING: '待上传' }" /></template>
        </el-table-column>
        <el-table-column label="附件" width="180">
          <template #default="{ row }">
            <el-button v-if="row.file_id" link type="primary" @click="downloadDoc(row)">{{ row.file_name }}</el-button>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="关键字段提取" min-width="240">
          <template #default="{ row }">
            <el-tag v-for="(v, k) in row.key_fields" :key="k" size="small" type="info" style="margin: 2px">{{ k }}: {{ v }}</el-tag>
            <span v-if="!Object.keys(row.key_fields || {}).length" class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-if="can('shipment:manage')" link type="primary" @click="openUpload(row)">{{ row.status === 'UPLOADED' ? '替换' : '上传' }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="card-block">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px">
        <h3 style="margin: 0">批次通用附件</h3>
        <FileUpload v-if="can('file:upload')" biz-type="SHIPMENT" :biz-id="$route.params.id" label="上传附件" @success="load" />
      </div>
      <AttachmentList :files="detail.attachments || []" :can-delete="can('file:delete')" @delete="removeFile" empty-text="暂无附件" />
    </div>

    <el-dialog v-model="uploadVisible" :title="`上传单证：${currentDoc?.doc_name || ''}`" width="480px">
      <el-form label-width="110px">
        <el-form-item label="文件">
          <FileUpload biz-type="SHIPMENT_DOC" :label="uploadForm.file_name ? '重新选择文件' : '选择文件'" @success="onDocFile" />
          <div v-if="uploadForm.file_name" class="form-tip">已选：{{ uploadForm.file_name }}</div>
        </el-form-item>
        <el-form-item v-for="f in currentDoc?.required_field_names || []" :key="f" :label="f">
          <el-input v-model="uploadForm.key_fields[f]" :placeholder="`请输入 ${f}`" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="doUpload">确认上传</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" title="编辑货运信息" width="560px">      <el-form :model="editForm" label-width="120px">
        <el-form-item label="船名/航次"><el-input v-model="editForm.vessel" /></el-form-item>
        <el-form-item label="集装箱号"><el-input v-model="editForm.container_no" /></el-form-item>
        <el-form-item label="封号"><el-input v-model="editForm.seal_no" /></el-form-item>
        <el-form-item label="提单号"><el-input v-model="editForm.bl_no" /></el-form-item>
        <el-form-item label="起运港"><el-input v-model="editForm.departure_port" /></el-form-item>
        <el-form-item label="目的港"><el-input v-model="editForm.arrival_port" /></el-form-item>
        <el-form-item label="ETD"><el-date-picker v-model="editForm.etd" type="date" value-format="YYYY-MM-DD" style="width: 100%" /></el-form-item>
        <el-form-item label="ETA"><el-date-picker v-model="editForm.eta" type="date" value-format="YYYY-MM-DD" style="width: 100%" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="editForm.remark" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingEdit" @click="saveShipment">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="trackVisible" :title="`货运海图 · ${detail.shipment?.shipment_code || ''}`" width="960px" top="6vh" destroy-on-close>
      <ShipmentTrack v-if="trackVisible" :shipment-id="$route.params.id" />
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Edit, Location } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { toastError } from '../../api';
import StatusTag from '../../components/StatusTag.vue';
import FileUpload from '../../components/FileUpload.vue';
import AttachmentList from '../../components/AttachmentList.vue';
import ShipmentTrack from '../../components/ShipmentTrack.vue';
import { downloadFileById } from '../../utils/file';
import { SHIPMENT_STATUS_LABEL, SHIPMENT_STEPS } from '../../statusMap';
import { useAuthStore } from '../../store/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const can = (c) => auth.hasPerm(c);
const steps = SHIPMENT_STEPS;
const loading = ref(false);
const advancing = ref(false);
const uploading = ref(false);
const savingEdit = ref(false);
const detail = ref({});
const uploadVisible = ref(false);
const editVisible = ref(false);
const trackVisible = ref(false);
const currentDoc = ref(null);
const uploadForm = reactive({ file_name: '', file_id: null, key_fields: {} });
const editForm = reactive({});

const docPercent = computed(() => {
  const docs = detail.value.documents || [];
  const req = docs.filter((d) => d.is_required);
  if (!req.length) return 0;
  return Math.round((req.filter((d) => d.status === 'UPLOADED').length / req.length) * 100);
});
const requiredTotal = computed(() => (detail.value.documents || []).filter((d) => d.is_required).length);
const uploadedRequired = computed(() => (detail.value.documents || []).filter((d) => d.is_required && d.status === 'UPLOADED').length);

async function load() {
  loading.value = true;
  try {
    const res = await api.get(`/shipment/batches/${route.params.id}`);
    detail.value = res.data;
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

async function advance() {
  advancing.value = true;
  try {
    const res = await api.post(`/shipment/batches/${route.params.id}/advance`);
    ElMessage.success(res.message);
    load();
  } catch (e) {
    toastError(e);
  } finally {
    advancing.value = false;
  }
}

async function removeShipment() {
  try {
    await ElMessageBox.confirm('确认删除该货运批次？', '删除确认', { type: 'warning' });
    const res = await api.delete(`/shipment/batches/${route.params.id}`);
    ElMessage.success(res.message);
    router.push('/shipment/batches');
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

function openEditShipment() {
  Object.assign(editForm, { ...detail.value.shipment });
  editVisible.value = true;
}

async function saveShipment() {
  savingEdit.value = true;
  try {
    const res = await api.patch(`/shipment/batches/${route.params.id}`, { ...editForm });
    ElMessage.success(res.message);
    editVisible.value = false;
    load();
  } catch (e) {
    toastError(e);
  } finally {
    savingEdit.value = false;
  }
}

function openUpload(doc) {
  currentDoc.value = doc;
  uploadForm.file_name = doc.file_name || '';
  uploadForm.file_id = doc.file_id || null;
  uploadForm.key_fields = { ...(doc.key_fields || {}) };
  uploadVisible.value = true;
}

function onDocFile(file) {
  uploadForm.file_name = file.original_name;
  uploadForm.file_id = file.id;
}

async function doUpload() {
  uploading.value = true;
  try {
    const res = await api.post(`/shipment/batches/${route.params.id}/documents/${currentDoc.value.id}/upload`, {
      file_name: uploadForm.file_name,
      file_id: uploadForm.file_id,
      key_fields: uploadForm.key_fields,
    });
    ElMessage.success(res.message);
    uploadVisible.value = false;
    load();
  } catch (e) {
    toastError(e);
  } finally {
    uploading.value = false;
  }
}

async function downloadDoc(doc) {
  try {
    await downloadFileById(doc.file_id, doc.file_name);
  } catch (e) {
    ElMessage.error('下载失败');
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
