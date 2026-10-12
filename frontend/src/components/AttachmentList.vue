<template>
  <div>
    <el-table v-if="files.length" :data="files" size="small" border>
      <el-table-column prop="original_name" label="文件名" min-width="200" />
      <el-table-column label="大小" width="100">
        <template #default="{ row }">{{ humanSize(row.size) }}</template>
      </el-table-column>
      <el-table-column prop="created_at" label="上传时间" width="180" />
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="download(row)">下载</el-button>
          <el-button v-if="canDelete" link type="danger" @click="$emit('delete', row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-else :description="emptyText" :image-size="60" />
  </div>
</template>

<script setup>
import { humanSize, downloadFileById } from '../utils/file';
import { ElMessage } from 'element-plus';

defineProps({
  files: { type: Array, default: () => [] },
  canDelete: { type: Boolean, default: false },
  emptyText: { type: String, default: '暂无附件' },
});
defineEmits(['delete']);

async function download(row) {
  try {
    await downloadFileById(row.id, row.original_name);
  } catch (e) {
    ElMessage.error('下载失败');
  }
}
</script>
