<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">版本记录</h2>
        <div class="muted" style="margin-top: 4px">当前版本 v{{ version }}</div>
      </div>
    </div>

    <div class="card-block">
      <el-timeline>
        <el-timeline-item
          v-for="(v, i) in changelog"
          :key="v.version"
          :type="i === 0 ? 'primary' : 'info'"
          :hollow="i !== 0"
          :timestamp="v.date"
          placement="top"
        >
          <div class="ver-head">
            <span class="ver-tag">v{{ v.version }}</span>
            <span class="ver-title">{{ v.title }}</span>
            <el-tag v-if="i === 0" size="small" type="success" effect="light">最新</el-tag>
          </div>
          <ul class="ver-items">
            <li v-for="(it, j) in v.items" :key="j">{{ it }}</li>
          </ul>
        </el-timeline-item>
      </el-timeline>
    </div>
  </div>
</template>

<script setup>
import { APP_VERSION, CHANGELOG } from '../version';

const version = APP_VERSION;
const changelog = CHANGELOG;
</script>

<style scoped>
.ver-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.ver-tag {
  background: #16508f;
  color: #fff;
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 13px;
  font-weight: 700;
}
.ver-title { font-weight: 600; font-size: 14px; }
.ver-items { margin: 0; padding-left: 20px; }
.ver-items li { font-size: 13px; line-height: 1.9; color: #4a5a70; }
</style>
