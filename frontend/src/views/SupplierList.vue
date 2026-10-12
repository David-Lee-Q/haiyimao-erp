<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">供应商管理</h2>
      <el-button v-if="canManage" type="primary" :icon="Plus" @click="openCreate">新建供应商</el-button>
    </div>

    <div class="card-block">
      <el-form inline>
        <el-form-item label="关键字">
          <el-input v-model="keyword" placeholder="名称 / 原产国" clearable style="width: 220px" @keyup.enter="load" />
        </el-form-item>
        <el-button :icon="Search" @click="load">查询</el-button>
      </el-form>
    </div>

    <div class="card-block" v-loading="loading">
      <el-table :data="rows" size="small" empty-text="暂无供应商">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="供应商名称" min-width="200" />
        <el-table-column prop="country" label="原产国" width="120" />
        <el-table-column prop="contact" label="联系方式" min-width="170" />
        <el-table-column label="信用额度" width="130">
          <template #default="{ row }">¥ {{ fmt(row.credit_limit_cny) }}</template>
        </el-table-column>
        <el-table-column label="已占用" width="130">
          <template #default="{ row }">¥ {{ fmt(row.credit_used_cny) }}</template>
        </el-table-column>
        <el-table-column label="可用额度" width="130">
          <template #default="{ row }"><b :style="{ color: row.credit_limit_cny - row.credit_used_cny > 0 ? '#67c23a' : '#f56c6c' }">¥ {{ fmt(row.credit_limit_cny - row.credit_used_cny) }}</b></template>
        </el-table-column>
        <el-table-column v-if="canManage" label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑供应商' : '新建供应商'" width="480px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="供应商名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="原产国" required><el-input v-model="form.country" /></el-form-item>
        <el-form-item label="联系方式"><el-input v-model="form.contact" /></el-form-item>
        <el-form-item label="信用额度(CNY)"><el-input-number v-model="form.credit_limit_cny" :min="0" controls-position="right" style="width: 100%" /></el-form-item>
        <el-form-item label="已占用(CNY)"><el-input-number v-model="form.credit_used_cny" :min="0" controls-position="right" style="width: 100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Plus, Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { toastError } from '../api';
import { useAuthStore } from '../store/auth';

const auth = useAuthStore();
const canManage = computed(() => auth.hasPerm('supplier:manage'));
const loading = ref(false);
const saving = ref(false);
const rows = ref([]);
const keyword = ref('');
const dialogVisible = ref(false);
const form = reactive({ id: null, name: '', country: '', contact: '', credit_limit_cny: 0, credit_used_cny: 0 });

const fmt = (n) => Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function load() {
  loading.value = true;
  try {
    const res = await api.get('/suppliers', { params: { keyword: keyword.value } });
    rows.value = res.data;
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  Object.assign(form, { id: null, name: '', country: '', contact: '', credit_limit_cny: 0, credit_used_cny: 0 });
  dialogVisible.value = true;
}
function openEdit(row) {
  Object.assign(form, row);
  dialogVisible.value = true;
}

async function save() {
  if (!form.name || !form.country) return ElMessage.warning('名称与原产国必填');
  saving.value = true;
  try {
    if (form.id) {
      await api.put(`/suppliers/${form.id}`, { ...form });
      ElMessage.success('更新成功');
    } else {
      await api.post('/suppliers', { ...form });
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    load();
  } catch (e) {
    toastError(e);
  } finally {
    saving.value = false;
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确认删除供应商「${row.name}」？`, '删除确认', { type: 'warning' });
    const res = await api.delete(`/suppliers/${row.id}`);
    ElMessage.success(res.message);
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

onMounted(load);
</script>
