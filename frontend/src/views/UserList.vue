<template>
  <div class="page">
    <div class="page-header">
      <h2 class="page-title">用户与角色</h2>
      <div>
        <el-button :icon="View" @click="showRoles">角色权限说明</el-button>
        <el-button v-if="canManage" type="primary" :icon="Plus" @click="openCreate">新建用户</el-button>
      </div>
    </div>

    <div class="card-block" v-loading="loading">
      <el-table :data="rows" size="small" empty-text="暂无用户">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="username" label="账号" width="150" />
        <el-table-column prop="real_name" label="姓名" width="150" />
        <el-table-column label="角色" width="150">
          <template #default="{ row }"><el-tag size="small">{{ row.role_label }}</el-tag></template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">{{ row.status === 'ACTIVE' ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column v-if="canManage" label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">停用</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑用户' : '新建用户'" width="460px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="账号" required>
          <el-input v-model="form.username" :disabled="!!form.id" />
        </el-form-item>
        <el-form-item label="姓名" required><el-input v-model="form.real_name" /></el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="form.role" style="width: 100%">
            <el-option v-for="r in roles" :key="r.role" :label="r.label" :value="r.role" />
          </el-select>
        </el-form-item>
        <el-form-item :label="form.id ? '重置密码' : '密码'" :required="!form.id">
          <el-input v-model="form.password" type="password" show-password :placeholder="form.id ? '留空则不修改' : '请输入初始密码'" />
        </el-form-item>
        <el-form-item v-if="form.id" label="状态">
          <el-switch v-model="form.status" active-value="ACTIVE" inactive-value="DISABLED" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rolesVisible" title="角色权限矩阵" width="720px">
      <el-table :data="roles" size="small" border>
        <el-table-column prop="label" label="角色" width="130" />
        <el-table-column label="权限项">
          <template #default="{ row }">
            <el-tag v-for="(p, i) in row.permission_labels" :key="i" size="small" style="margin: 2px">{{ p }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Plus, View } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { toastError } from '../api';
import { useAuthStore } from '../store/auth';

const auth = useAuthStore();
const canManage = computed(() => auth.hasPerm('user:manage'));
const loading = ref(false);
const saving = ref(false);
const rows = ref([]);
const roles = ref([]);
const dialogVisible = ref(false);
const rolesVisible = ref(false);
const form = reactive({ id: null, username: '', real_name: '', role: 'purchase', password: '', status: 'ACTIVE' });

async function load() {
  loading.value = true;
  try {
    const [uRes, rRes] = await Promise.all([api.get('/users'), api.get('/users/roles')]);
    rows.value = uRes.data;
    roles.value = rRes.data;
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}

function showRoles() {
  rolesVisible.value = true;
}
function openCreate() {
  Object.assign(form, { id: null, username: '', real_name: '', role: 'purchase', password: '', status: 'ACTIVE' });
  dialogVisible.value = true;
}
function openEdit(row) {
  Object.assign(form, { id: row.id, username: row.username, real_name: row.real_name, role: row.role, password: '', status: row.status });
  dialogVisible.value = true;
}

async function save() {
  if (!form.username || !form.real_name) return ElMessage.warning('账号与姓名必填');
  if (!form.id && !form.password) return ElMessage.warning('请输入初始密码');
  saving.value = true;
  try {
    if (form.id) {
      await api.put(`/users/${form.id}`, { real_name: form.real_name, role: form.role, password: form.password || undefined, status: form.status });
      ElMessage.success('更新成功');
    } else {
      await api.post('/users', { username: form.username, password: form.password, real_name: form.real_name, role: form.role });
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
    await ElMessageBox.confirm(`确认停用用户「${row.real_name}」？`, '停用确认', { type: 'warning' });
    const res = await api.delete(`/users/${row.id}`);
    ElMessage.success(res.message);
    load();
  } catch (e) {
    if (e !== 'cancel') toastError(e);
  }
}

onMounted(load);
</script>
