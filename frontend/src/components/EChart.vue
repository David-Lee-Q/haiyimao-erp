<template>
  <div ref="el" :style="{ height: height + 'px', width: '100%' }"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: Number, default: 300 },
});

const el = ref(null);
let chart = null;

function render() {
  if (!chart) return;
  chart.setOption(props.option, true);
}

function resize() {
  chart && chart.resize();
}

onMounted(() => {
  chart = echarts.init(el.value);
  render();
  window.addEventListener('resize', resize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  chart && chart.dispose();
  chart = null;
});

watch(() => props.option, render, { deep: true });
</script>
