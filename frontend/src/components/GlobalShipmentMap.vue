<template>
  <div class="global-map-wrap">
    <div class="map-legend">
      <span v-for="s in legend" :key="s.status" class="lg-item">
        <i :style="{ background: s.color }"></i>{{ s.label }}
        <b>{{ counts[s.status] || 0 }}</b>
      </span>
    </div>
    <div ref="container" class="global-globe"></div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Globe from 'globe.gl';
import { countriesFeatures, COUNTRY_ZH, WORLD_CITIES, STATUS_COLOR, STATUS_LABEL } from '../globeData';

const props = defineProps({ tracks: { type: Array, default: () => [] } });

const container = ref(null);
let globe = null;
let ro = null;

const legend = Object.keys(STATUS_LABEL).map((k) => ({ status: k, label: STATUS_LABEL[k], color: STATUS_COLOR[k] }));
const counts = computed(() => {
  const c = {};
  for (const t of props.tracks) c[t.status] = (c[t.status] || 0) + 1;
  return c;
});

function toRad(d) { return (d * Math.PI) / 180; }
function toDeg(r) { return (r * 180) / Math.PI; }
function gcInterpolate(a, b, f) {
  const φ1 = toRad(a.lat), λ1 = toRad(a.lng), φ2 = toRad(b.lat), λ2 = toRad(b.lng);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d === 0) return { lat: a.lat, lng: a.lng };
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), lng: toDeg(Math.atan2(y, x)) };
}

function buildData() {
  const arcs = [];
  const points = [];
  for (const t of props.tracks) {
    const dep = t.departure || {};
    const arr = t.arrival || {};
    if (dep.lat == null || arr.lat == null) continue;
    const color = STATUS_COLOR[t.status] || '#8fd8ff';
    const p0 = { lat: dep.lat, lng: dep.lon };
    const p1 = { lat: arr.lat, lng: arr.lon };
    const cur = t.current && t.current.lat != null ? { lat: t.current.lat, lng: t.current.lng } : gcInterpolate(p0, p1, t.progress || 0);

    // 已航行（实线）
    arcs.push({ startLat: p0.lat, startLng: p0.lng, endLat: cur.lat, endLng: cur.lng, color: [color, color], stroke: 0.8, dashLength: 1, dashGap: 0, anim: 0 });
    // 剩余（动画虚线）
    arcs.push({ startLat: cur.lat, startLng: cur.lng, endLat: p1.lat, endLng: p1.lng, color: [color, 'rgba(255,255,255,0.15)'], stroke: 0.45, dashLength: 0.18, dashGap: 0.42, anim: 2600 });

    points.push({ lat: cur.lat, lng: cur.lng, color, radius: 0.55, altitude: 0.03, label: `<div style="padding:2px 6px"><b>${t.shipment_code}</b><br/>${t.status_label}（${Math.round((t.progress || 0) * 100)}%）<br/>${dep.label || dep.name} → ${arr.label || arr.name}</div>` });
    points.push({ lat: p0.lat, lng: p0.lng, color: 'rgba(180,220,255,0.65)', radius: 0.22, altitude: 0.015, label: `${dep.label || dep.name}（起运港）` });
    points.push({ lat: p1.lat, lng: p1.lng, color: 'rgba(180,255,220,0.65)', radius: 0.22, altitude: 0.015, label: `${arr.label || arr.name}（目的港）` });
  }
  const cityLabels = WORLD_CITIES.map((c) => ({ lat: c.lat, lng: c.lng, text: c.en, color: 'rgba(226,240,255,0.6)', size: 0.55, dot: 0.14 }));
  return { arcs, points, cityLabels };
}

function render() {
  if (!globe) return;
  const d = buildData();
  globe
    .arcsData(d.arcs)
    .arcStartLat((a) => a.startLat).arcStartLng((a) => a.startLng)
    .arcEndLat((a) => a.endLat).arcEndLng((a) => a.endLng)
    .arcColor((a) => a.color)
    .arcStroke((a) => a.stroke)
    .arcAltitudeAutoScale(0.5)
    .arcDashLength((a) => a.dashLength)
    .arcDashGap((a) => a.dashGap)
    .arcDashAnimateTime((a) => a.anim)
    .pointsData(d.points)
    .pointLat((p) => p.lat).pointLng((p) => p.lng)
    .pointColor((p) => p.color)
    .pointRadius((p) => p.radius)
    .pointAltitude((p) => p.altitude)
    .pointLabel((p) => p.label)
    .labelsData(d.cityLabels)
    .labelLat((l) => l.lat).labelLng((l) => l.lng)
    .labelText((l) => l.text).labelColor((l) => l.color)
    .labelSize((l) => l.size).labelDotRadius((l) => l.dot)
    .labelAltitude(0.015);
}

onMounted(() => {
  globe = new Globe(container.value)
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true)
    .atmosphereColor('#5aa9e6')
    .atmosphereAltitude(0.2)
    .polygonsData(countriesFeatures)
    .polygonCapColor(() => 'rgba(74,146,120,0.72)')
    .polygonSideColor(() => 'rgba(40,96,78,0.65)')
    .polygonStrokeColor(() => 'rgba(214,240,255,0.85)')
    .polygonAltitude(0.006)
    .polygonLabel((f) => `<div style="padding:2px 6px">${COUNTRY_ZH[f.name] || f.name}</div>`);

  const mat = globe.globeMaterial();
  mat.color.set('#0b3a5c');
  if (mat.emissive) {
    mat.emissive.set('#062038');
    mat.emissiveIntensity = 0.35;
  }
  mat.shininess = 6;

  const ctrls = globe.controls();
  ctrls.autoRotate = true;
  ctrls.autoRotateSpeed = 0.4;
  ctrls.enableZoom = true;
  ctrls.enableDamping = true;

  const size = () => {
    if (!container.value) return;
    globe.width(container.value.clientWidth).height(container.value.clientHeight);
  };
  size();
  ro = new ResizeObserver(size);
  ro.observe(container.value);

  globe.onGlobeReady(() => {
    size();
    render();
    globe.pointOfView({ lat: 15, lng: 120, altitude: 2.4 }, 0);
    setTimeout(render, 400);
  });
  render();
});

watch(() => props.tracks, render, { deep: true });

onBeforeUnmount(() => {
  if (ro) ro.disconnect();
  if (container.value) container.value.innerHTML = '';
  globe = null;
});
</script>

<style scoped>
.global-map-wrap { position: relative; }
.map-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 8px 4px 12px;
  font-size: 12.5px;
  color: #43536b;
}
.lg-item { display: inline-flex; align-items: center; gap: 6px; }
.lg-item i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.lg-item b { color: #16508f; }
.global-globe {
  width: 100%;
  height: 520px;
  border-radius: 12px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 40%, #0a2b4a 0%, #04121f 70%);
}
@media (max-width: 768px) {
  .global-globe { height: 360px; }
}
</style>
