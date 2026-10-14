<template>
  <div
    class="ai-mascot"
    role="button"
    aria-label="智能助手（可拖动）"
    :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
    :class="{ dragging }"
    @pointerdown="onDown"
    @click="onClick"
  >
    <div class="mascot-bubble">有问题？问我吧～</div>

    <div class="mascot-stage">
      <span class="halo"></span>
      <svg class="mascot-svg" viewBox="0 0 100 112" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2f86d6" />
            <stop offset="100%" stop-color="#16508f" />
          </linearGradient>
          <linearGradient id="headGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="100%" stop-color="#dceaf8" />
          </linearGradient>
        </defs>

        <g class="antenna">
          <line x1="50" y1="20" x2="50" y2="9" stroke="#8fd8ff" stroke-width="3" stroke-linecap="round" />
          <circle class="antenna-bulb" cx="50" cy="7" r="4.5" fill="#8fd8ff" />
        </g>

        <rect class="mascot-body" x="30" y="72" width="40" height="28" rx="13" fill="url(#bodyGrad)" />
        <circle cx="50" cy="86" r="6" fill="#8fd8ff" opacity="0.9" />

        <g class="arm-left">
          <rect x="14" y="74" width="16" height="10" rx="5" fill="url(#bodyGrad)" />
        </g>
        <g class="arm-wave">
          <rect x="70" y="70" width="16" height="10" rx="5" fill="url(#bodyGrad)" />
          <circle cx="88" cy="75" r="6" fill="#8fd8ff" />
        </g>

        <rect x="16" y="20" width="68" height="54" rx="18" fill="url(#headGrad)" stroke="#bcd8f0" stroke-width="1.5" />
        <rect x="26" y="30" width="48" height="34" rx="14" fill="#0f2b4a" />

        <g class="eyes">
          <circle class="eye" cx="39" cy="46" r="6.5" fill="#8fd8ff" />
          <circle class="eye" cx="61" cy="46" r="6.5" fill="#8fd8ff" />
          <circle cx="39" cy="46" r="2.6" fill="#0f2b4a" />
          <circle cx="61" cy="46" r="2.6" fill="#0f2b4a" />
        </g>
        <path d="M42 58 Q50 64 58 58" stroke="#8fd8ff" stroke-width="2.6" fill="none" stroke-linecap="round" />
        <circle cx="30" cy="55" r="3.4" fill="#ff9db1" opacity="0.85" />
        <circle cx="70" cy="55" r="3.4" fill="#ff9db1" opacity="0.85" />
      </svg>
    </div>

    <span class="mascot-dot"></span>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';

const emit = defineEmits(['open']);

const WIDTH = 84;
const HEIGHT = 92;
const STORAGE_KEY = 'ai_mascot_pos';

const pos = reactive({ x: 0, y: 0 });
const dragging = ref(false);
let start = null;
let moved = false;

function clamp(x, y) {
  const maxX = Math.max(4, window.innerWidth - WIDTH - 4);
  const maxY = Math.max(4, window.innerHeight - HEIGHT - 4);
  return { x: Math.min(Math.max(4, x), maxX), y: Math.min(Math.max(4, y), maxY) };
}

function defaultPos() {
  // 默认：页面右侧、偏中下位置
  return clamp(window.innerWidth - WIDTH - 28, window.innerHeight * 0.62);
}

function applyPosition() {
  const p = clamp(pos.x, pos.y);
  pos.x = p.x;
  pos.y = p.y;
}

function loadPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
      const p = clamp(saved.x, saved.y);
      pos.x = p.x;
      pos.y = p.y;
      return;
    }
  } catch (e) {
    /* ignore */
  }
  const p = defaultPos();
  pos.x = p.x;
  pos.y = p.y;
}

function onDown(e) {
  if (e.button != null && e.button !== 0) return;
  dragging.value = true;
  moved = false;
  start = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function onMove(e) {
  if (!start) return;
  const dx = e.clientX - start.px;
  const dy = e.clientY - start.py;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
  const p = clamp(start.x + dx, start.y + dy);
  pos.x = p.x;
  pos.y = p.y;
}

function onUp() {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  dragging.value = false;
  start = null;
  if (moved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: pos.x, y: pos.y }));
  }
}

function onClick() {
  if (moved) return;
  emit('open');
}

onMounted(() => {
  loadPosition();
  window.addEventListener('resize', applyPosition);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', applyPosition);
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
});
</script>

<style scoped>
.ai-mascot {
  position: fixed;
  z-index: 2000;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.ai-mascot.dragging {
  cursor: grabbing;
}
.mascot-stage {
  position: relative;
  width: 84px;
  height: 92px;
  animation: mascot-float 3s ease-in-out infinite;
}
.mascot-svg {
  width: 100%;
  height: 100%;
  display: block;
  filter: drop-shadow(0 10px 16px rgba(9, 32, 60, 0.35));
  transition: transform 0.25s ease;
}
.ai-mascot:hover .mascot-svg {
  transform: scale(1.06) rotate(-2deg);
}
.halo {
  position: absolute;
  left: 50%;
  bottom: 2px;
  width: 66px;
  height: 20px;
  margin-left: -33px;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(47, 134, 214, 0.5), transparent 70%);
  animation: halo-pulse 2.6s ease-in-out infinite;
}
@keyframes mascot-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes halo-pulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.18); opacity: 0.35; }
}
.eyes {
  transform-origin: 50px 46px;
  animation: mascot-blink 4.6s infinite;
}
@keyframes mascot-blink {
  0%, 92%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.1); }
}
.arm-wave {
  transform-origin: 70px 74px;
  animation: mascot-wave 2.4s ease-in-out infinite;
}
@keyframes mascot-wave {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-22deg); }
  40% { transform: rotate(4deg); }
  60% { transform: rotate(-18deg); }
}
.arm-left {
  transform-origin: 30px 78px;
  animation: mascot-arm-idle 3s ease-in-out infinite;
}
@keyframes mascot-arm-idle {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(6deg); }
}
.antenna-bulb {
  animation: bulb 1.4s ease-in-out infinite;
}
@keyframes bulb {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.mascot-dot {
  position: absolute;
  right: 6px;
  top: 8px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #52d67a;
  border: 2px solid #fff;
  box-shadow: 0 0 0 0 rgba(82, 214, 122, 0.6);
  animation: dot-ping 1.8s infinite;
}
@keyframes dot-ping {
  0% { box-shadow: 0 0 0 0 rgba(82, 214, 122, 0.6); }
  70% { box-shadow: 0 0 0 8px rgba(82, 214, 122, 0); }
  100% { box-shadow: 0 0 0 0 rgba(82, 214, 122, 0); }
}
.mascot-bubble {
  position: absolute;
  right: 76px;
  bottom: 52px;
  white-space: nowrap;
  background: #fff;
  color: #16508f;
  font-size: 12.5px;
  font-weight: 600;
  padding: 7px 12px;
  border-radius: 12px 12px 2px 12px;
  box-shadow: 0 6px 18px rgba(9, 32, 60, 0.22);
  opacity: 0;
  transform: translateY(6px) scale(0.92);
  transform-origin: bottom right;
  animation: bubble-loop 9s ease-in-out infinite;
  pointer-events: none;
}
.mascot-bubble::after {
  content: '';
  position: absolute;
  right: 10px;
  bottom: -6px;
  border: 6px solid transparent;
  border-top-color: #fff;
  border-bottom: 0;
}
.ai-mascot:hover .mascot-bubble {
  opacity: 1;
  transform: translateY(0) scale(1);
  animation: none;
}
@keyframes bubble-loop {
  0%, 55% { opacity: 0; transform: translateY(6px) scale(0.92); }
  65%, 88% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(6px) scale(0.92); }
}
</style>
