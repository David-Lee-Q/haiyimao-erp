<template>
  <div class="page help-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">帮助中心</h2>
        <div class="muted" style="margin-top: 4px">
          当前角色：<el-tag size="small">{{ content.label }}</el-tag>
        </div>
      </div>
    </div>

    <div class="card-block help-banner">
      <el-icon :size="26"><QuestionFilled /></el-icon>
      <div>
        <div class="banner-title">{{ content.label }} 操作指引</div>
        <div class="banner-desc">{{ content.summary }}</div>
      </div>
    </div>

    <div class="help-body">
      <aside class="help-nav card-block">
        <div class="nav-title">功能目录</div>
        <ul>
          <li v-for="(m, i) in content.modules" :key="m.key">
            <a :class="{ active: activeKey === m.key }" @click.prevent="scrollTo(m.key)">{{ i + 1 }}. {{ m.title }}</a>
          </li>
        </ul>
      </aside>

      <main class="help-main">
        <section v-for="m in content.modules" :key="m.key" :id="`sec-${m.key}`" class="card-block module-block">
          <h3 class="module-title">{{ m.title }}</h3>
          <p class="module-desc">{{ m.desc }}</p>
          <div class="module-shot">
            <el-image :src="img(m.img)" :preview-src-list="[img(m.img)]" fit="contain" class="shot" preview-teleported />
            <div class="shot-cap">系统截图，点击可放大查看</div>
          </div>
          <div class="module-points">
            <div class="points-title">操作要点</div>
            <ul>
              <li v-for="(p, i) in m.points" :key="i">{{ p }}</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { QuestionFilled } from '@element-plus/icons-vue';
import { useAuthStore } from '../store/auth';
import { getHelpByRole } from '../helpContent';

const auth = useAuthStore();
const content = computed(() => getHelpByRole(auth.role));
const activeKey = ref('');
const img = (name) => `${import.meta.env.BASE_URL}help/${name}`;

function onScroll() {
  const blocks = content.value.modules;
  for (const m of blocks) {
    const el = document.getElementById(`sec-${m.key}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.top <= 160 && rect.bottom > 160) {
        activeKey.value = m.key;
        break;
      }
    }
  }
}

function scrollTo(key) {
  const el = document.getElementById(`sec-${key}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(() => {
  const scroller = document.querySelector('.main');
  if (scroller) scroller.addEventListener('scroll', onScroll);
  onScroll();
});
onBeforeUnmount(() => {
  const scroller = document.querySelector('.main');
  if (scroller) scroller.removeEventListener('scroll', onScroll);
});
</script>

<style scoped>
.help-banner {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  color: #16508f;
  background: linear-gradient(120deg, #eaf3ff, #f6fbff);
  border: 1px solid #d8e8fb;
}
.banner-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2d3d;
}
.banner-desc {
  font-size: 13px;
  color: #5a6b80;
  margin-top: 6px;
  line-height: 1.7;
}
.help-body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.help-nav {
  flex: 0 0 210px;
  position: sticky;
  top: 0;
  max-height: calc(100vh - 40px);
  overflow: auto;
}
.nav-title {
  font-weight: 600;
  margin-bottom: 10px;
  font-size: 14px;
}
.help-nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.help-nav li a {
  display: block;
  padding: 7px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: #43536b;
  cursor: pointer;
  line-height: 1.4;
}
.help-nav li a:hover {
  background: #f2f6fc;
  color: #16508f;
}
.help-nav li a.active {
  background: #eaf3ff;
  color: #16508f;
  font-weight: 600;
}
.help-main {
  flex: 1 1 auto;
  min-width: 0;
}
.module-block {
  scroll-margin-top: 12px;
}
.module-title {
  margin: 0 0 8px;
  font-size: 16px;
  padding-left: 10px;
  border-left: 3px solid #16508f;
}
.module-desc {
  font-size: 13.5px;
  color: #5a6b80;
  line-height: 1.8;
  margin: 0 0 14px;
}
.module-shot {
  border: 1px solid #e3e9f2;
  border-radius: 10px;
  overflow: hidden;
  background: #f7f9fc;
}
.shot {
  width: 100%;
  max-height: 460px;
  display: block;
}
.shot-cap {
  font-size: 12px;
  color: #93a1b5;
  text-align: center;
  padding: 6px 0;
  border-top: 1px solid #eef2f7;
  background: #fff;
}
.module-points {
  margin-top: 14px;
}
.points-title {
  font-size: 13.5px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #1f2d3d;
}
.module-points ul {
  margin: 0;
  padding-left: 20px;
}
.module-points li {
  font-size: 13px;
  line-height: 1.9;
  color: #4a5a70;
}
@media (max-width: 900px) {
  .help-body {
    flex-direction: column;
  }
  .help-nav {
    position: static;
    width: 100%;
    flex: none;
  }
}
</style>
