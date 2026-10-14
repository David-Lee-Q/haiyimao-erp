<template>
  <div class="login-page">
    <div class="bg-layer" :style="bgStyle"></div>

    <div class="login-panel">
      <section class="intro">
        <div class="brand">
          <img class="brand-logo" :src="logoUrl" alt="海易贸" />
          <div class="brand-text">
            <h1>海易贸 · 生鲜外贸ERP</h1>
            <p>Fresh Food Foreign Trade ERP</p>
          </div>
        </div>

        <h2 class="slogan">采购 · 货运 · 冷链 · 成本<br />全链路一体化管理平台</h2>
        <p class="desc">
          面向进口生鲜外贸场景，覆盖境外采购、国际货运单证、保税冷链仓储、
          落地成本核算到销售出库的完整业务闭环。
        </p>

        <ul class="features">
          <li v-for="f in features" :key="f.title">
            <el-icon class="feat-icon" :size="18"><component :is="f.icon" /></el-icon>
            <div>
              <div class="feat-title">{{ f.title }}</div>
              <div class="feat-desc">{{ f.desc }}</div>
            </div>
          </li>
        </ul>

        <div class="aside-foot">© {{ year }} 海易贸 · COSMO Code AI 智能开发平台</div>
      </section>

      <section class="form-col">
        <div class="login-card">
          <div class="card-head">
            <h3>欢迎登录</h3>
            <p>请使用您的企业账号登录系统</p>
          </div>

          <el-form :model="form" label-position="top" @submit.prevent="onSubmit">
            <el-form-item label="账号">
              <el-input v-model="form.username" placeholder="请输入账号" size="large" :prefix-icon="User" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large" show-password :prefix-icon="Lock" @keyup.enter="onSubmit" />
            </el-form-item>
            <el-button type="primary" size="large" style="width: 100%; margin-top: 4px" :loading="loading" @click="onSubmit">
              登录系统
            </el-button>
          </el-form>

          <el-divider>演示账号</el-divider>
          <div class="demo-accounts">
            <el-tag v-for="a in accounts" :key="a.u" class="demo-tag" @click="quick(a)">
              {{ a.label }}：{{ a.u }}
            </el-tag>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock, Sunny, ShoppingCart, Ship, Box, Money, Odometer } from '@element-plus/icons-vue';
import { useAuthStore } from '../store/auth';
import { toastError } from '../api';
import logoUrl from '../assets/logo.svg';

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const year = new Date().getFullYear();
const form = reactive({ username: 'buyer', password: 'buyer123' });

// 随机海运实景大图背景（预设 5 张高清图，位于 public/login-bg/）
const base = import.meta.env.BASE_URL || '/';
const sceneList = Array.from({ length: 5 }, (_, i) => `${base}login-bg/bg${i + 1}.jpg`);
const scene = sceneList[Math.floor(Math.random() * sceneList.length)];
const bgStyle = computed(() => ({ backgroundImage: `url("${scene}")` }));

const features = [
  { icon: ShoppingCart, title: '采购订单管理', desc: '多币种锁汇、双单位联动、审批状态机' },
  { icon: Ship, title: '国际货运与单证', desc: '批次节点流转、单证核销矩阵' },
  { icon: Box, title: '保税冷链仓储', desc: '重公差校验、批次追溯、FEFO 先到期先出' },
  { icon: Money, title: '落地成本核算', desc: '按重量/货值/件数分摊、关税增值税倒算' },
  { icon: Odometer, title: '冷链温控监控', desc: 'IoT 温度告警、异常批次自动锁定' },
];

const accounts = [
  { u: 'admin', label: '管理员' },
  { u: 'manager', label: '采购经理' },
  { u: 'buyer', label: '采购员' },
  { u: 'warehouse', label: '仓储主管' },
  { u: 'finance', label: '财务专员' },
  { u: 'quality', label: '品质主管' },
];

function quick(a) {
  form.username = a.u;
  form.password = `${a.u}123`;
}

async function onSubmit() {
  if (!form.username || !form.password) return ElMessage.warning('请输入账号和密码');
  loading.value = true;
  try {
    await auth.login({ ...form });
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch (e) {
    toastError(e);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  position: relative;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: clamp(24px, 7vw, 160px);
  background: #0a1a2f;
  /* 登录表单容器的毛玻璃背景模糊度（仅作用于容器，不影响背景大图） */
  --login-panel-blur: 14px;
}

/* 随机海运实景大图（清晰原图，不做虚化） */
.bg-layer {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transition: background-image 0.6s ease;
}

/* 悬浮玻璃面板：左右同处一个背景之上（宽度较原版压缩 30%） */
.login-panel {
  position: relative;
  z-index: 2;
  display: flex;
  width: min(742px, 92vw);
  border-radius: 24px;
  overflow: hidden;
  background: rgba(9, 24, 44, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: 0 30px 80px rgba(4, 18, 36, 0.45);
  backdrop-filter: blur(var(--login-panel-blur));
  -webkit-backdrop-filter: blur(var(--login-panel-blur));
}

.intro {
  flex: 1 1 auto;
  min-width: 0;
  padding: 36px clamp(22px, 3vw, 40px);
  color: #fff;
  display: flex;
  flex-direction: column;
}
.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 34px;
}
.brand-logo {
  width: 50px;
  height: 50px;
  border-radius: 14px;
  display: block;
  box-shadow: 0 4px 14px rgba(9, 32, 60, 0.35);
}
.brand-text h1 {
  margin: 0;
  font-size: 18px;
  letter-spacing: 0.5px;
}
.brand-text p {
  margin: 3px 0 0;
  font-size: 10px;
  letter-spacing: 1.4px;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
}
.slogan {
  font-size: 21px;
  line-height: 1.45;
  font-weight: 700;
  margin: 0 0 12px;
}
.desc {
  font-size: 12px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 20px;
  max-width: 460px;
}
.features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 11px;
}
.features li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.feat-icon {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.12);
  color: #8fd8ff;
}
.feat-title {
  font-size: 13px;
  font-weight: 600;
}
.feat-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.58);
  margin-top: 1px;
}
.aside-foot {
  margin-top: auto;
  padding-top: 28px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.form-col {
  flex: 0 0 330px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 24px;
}
.login-card {
  width: 100%;
  max-width: 300px;
}
.card-head {
  margin-bottom: 22px;
}
.card-head h3 {
  font-size: 22px;
  margin: 0;
  color: #fff;
}
.card-head p {
  margin: 8px 0 0;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.6);
}
:deep(.el-form-item__label) {
  color: rgba(255, 255, 255, 0.8);
}
:deep(.el-divider) {
  --el-border-color: rgba(255, 255, 255, 0.18);
}
:deep(.el-divider__text) {
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
}
.demo-accounts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.demo-tag {
  cursor: pointer;
}

@media (max-width: 900px) {
  .login-page {
    justify-content: center;
    padding-right: 0;
  }
  .login-panel {
    width: 92vw;
  }
  .intro {
    display: none;
  }
  .form-col {
    flex: 1 1 auto;
  }
}
</style>
