<template>
  <el-upload
    :show-file-list="false"
    :http-request="doUpload"
    :accept="accept"
    :disabled="disabled"
  >
    <el-button :icon="Upload" :loading="uploading" :disabled="disabled" size="small">{{ label }}</el-button>
  </el-upload>
</template>

<script setup>
import { ref } from 'vue';
import { Upload } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import api, { toastError } from '../api';

const props = defineProps({
  bizType: { type: String, default: '' },
  bizId: { type: [Number, String], default: '' },
  label: { type: String, default: '上传文件' },
  accept: { type: String, default: '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt' },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['success']);

const uploading = ref(false);

async function doUpload({ file }) {
  const fd = new FormData();
  fd.append('file', file);
  if (props.bizType) fd.append('biz_type', props.bizType);
  if (props.bizId !== '' && props.bizId != null) fd.append('biz_id', props.bizId);
  uploading.value = true;
  try {
    const res = await api.post('/files', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    ElMessage.success('文件上传成功');
    emit('success', res.data);
  } catch (e) {
    toastError(e);
  } finally {
    uploading.value = false;
  }
}
</script>
