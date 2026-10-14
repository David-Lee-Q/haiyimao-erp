<template>
  <el-container class="layout">
    <el-aside v-if="!isMobile" :width="collapsed ? '64px' : '224px'" class="aside">
      <div class="brand" :class="{ mini: collapsed }">
        <img class="brand-logo" :src="logoUrl" alt="海易贸" />
        <div v-show="!collapsed" class="brand-text">
          <span class="brand-name">海易贸</span>
          <span class="brand-sub">生鲜外贸ERP</span>
        </div>
      </div>
      <el-scrollbar class="menu-scroll">
        <SideMenu :collapse="collapsed" />
      </el-scrollbar>
    </el-aside>

    <el-drawer v-model="mobileOpen" direction="ltr" :with-header="false" size="232px" class="mobile-drawer">
      <div class="brand">
        <img class="brand-logo" :src="logoUrl" alt="海易贸" />
        <div class="brand-text">
          <span class="brand-name">海易贸</span>
          <span class="brand-sub">生鲜外贸ERP</span>
        </div>
      </div>
      <SideMenu @navigate="mobileOpen = false" />
    </el-drawer>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon class="toggle" :size="20" @click="toggle">
            <Fold v-if="!isMobile && !collapsed" />
            <Expand v-else />
          </el-icon>
          <div class="crumb">{{ currentTitle }}</div>
        </div>
        <div class="user">
          <el-tag v-if="!isMobile" size="small" type="info">{{ auth.user?.role_label || roleLabel }}</el-tag>
          <el-dropdown @command="onCommand">
            <span class="user-name"><el-icon><User /></el-icon> <span class="uname">{{ auth.user?.real_name || '未登录' }}</span></span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">我的权限</el-dropdown-item>
                <el-dropdown-item command="help">帮助中心</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
        <AiMascot v-if="can('ai:use')" @open="$router.push('/ai')" />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../store/auth';
import SideMenu from './SideMenu.vue';
import logoUrl from '../assets/logo.svg';
import AiMascot from '../components/AiMascot.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const collapsed = ref(false);
const mobileOpen = ref(false);
const isMobile = ref(false);

const currentTitle = computed(() => route.meta.title || '海易贸 · 生鲜外贸ERP');

const ROLE_LABEL = {
  admin: '系统管理员', manager: '采购经理', purchase: '采购员',
  warehouse: '仓储主管', finance: '财务专员', quality: '生鲜品质主管',
};
const roleLabel = computed(() => ROLE_LABEL[auth.user?.role] || auth.user?.role || '');
const can = (code) => auth.hasPerm(code);

function toggle() {
  if (isMobile.value) mobileOpen.value = true;
  else collapsed.value = !collapsed.value;
}

function syncViewport() {
  const mobile = window.innerWidth <= 768;
  isMobile.value = mobile;
  if (!mobile) mobileOpen.value = false;
}

function onCommand(cmd) {
  if (cmd === 'logout') {
    auth.logout();
    router.push('/login');
  } else if (cmd === 'profile') {
    router.push('/profile');
  } else if (cmd === 'help') {
    router.push('/help');
  }
}

onMounted(() => {
  syncViewport();
  window.addEventListener('resize', syncViewport);
  auth.refreshMe().catch(() => {});
});
onBeforeUnmount(() => window.removeEventListener('resize', syncViewport));
</script>

<style scoped>
.layout { height: 100vh; }
.aside {
  background: #0f2039;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.25s ease;
}
.menu-scroll { flex: 1 1 auto; }
.brand {
  height: 60px; display: flex; align-items: center; gap: 10px; padding: 0 18px;
  color: #fff; font-weight: 600; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); flex-shrink: 0;
}
.brand.mini { justify-content: center; padding: 0; }
.brand-logo { width: 26px; height: 26px; border-radius: 7px; display: block; flex-shrink: 0; }
.brand-text { display: flex; flex-direction: column; line-height: 1.15; }
.brand-name { font-size: 16px; }
.brand-sub { font-size: 11px; font-weight: 400; color: rgba(255, 255, 255, 0.55); letter-spacing: 1px; }
.header {
  height: 60px; background: #fff; display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05); padding: 0 16px;
}
.header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.toggle { cursor: pointer; color: #43536b; }
.toggle:hover { color: #16508f; }
.crumb { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.user-name { cursor: pointer; display: flex; align-items: center; gap: 4px; }
.main { padding: 0; overflow: auto; }

@media (max-width: 768px) {
  .header { height: 52px; padding: 0 12px; }
  .crumb { font-size: 15px; }
  .uname { max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: bottom; }
}
</style>
