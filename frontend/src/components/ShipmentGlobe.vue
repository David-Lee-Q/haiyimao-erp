<template>
  <div ref="container" class="globe-container"></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Globe from 'globe.gl';
import { countriesFeatures as countries, COUNTRY_ZH, WORLD_CITIES, portEnName } from '../globeData';

const props = defineProps({ track: { type: Object, required: true } });

const container = ref(null);
let globe = null;
let ro = null;

function toRad(d) { return (d * Math.PI) / 180; }
function toDeg(r) { return (r * 180) / Math.PI; }

// 球面大圆插值：返回两点连线在比例 f 处的经纬度
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
  const t = props.track;
  const dep = t.departure || {};
  const arr = t.arrival || {};
  const hasCoords = dep.lat != null && arr.lat != null;

  const depPt = hasCoords ? { lat: dep.lat, lng: dep.lon } : { lat: -33.05, lng: -71.61 };
  const arrPt = hasCoords ? { lat: arr.lat, lng: arr.lon } : { lat: 31.23, lng: 121.47 };
  const progress = Math.max(0, Math.min(1, t.progress || 0));
  const cur = gcInterpolate(depPt, arrPt, progress);

  const arcs = [
    { startLat: depPt.lat, startLng: depPt.lng, endLat: cur.lat, endLng: cur.lng, color: ['#b8ffd9', '#4fd0ff'], stroke: 1.1, dashLength: 1, dashGap: 0, anim: 0 },
    { startLat: cur.lat, startLng: cur.lng, endLat: arrPt.lat, endLng: arrPt.lng, color: ['rgba(143,216,255,0.9)', 'rgba(143,216,255,0.45)'], stroke: 0.7, dashLength: 0.2, dashGap: 0.45, anim: 2200 },
  ];

  const points = [
    { lat: depPt.lat, lng: depPt.lng, color: '#4fd0ff', radius: 0.8, altitude: 0.02, label: (dep.label || dep.name || '起运港') + '（起运港）' },
    { lat: arrPt.lat, lng: arrPt.lng, color: '#8affc1', radius: 0.8, altitude: 0.02, label: (arr.label || arr.name || '目的港') + '（目的港）' },
    { lat: cur.lat, lng: cur.lng, color: '#ffd166', radius: 1.0, altitude: 0.03, label: `当前位置（航行 ${Math.round(progress * 100)}%）` },
  ];

  const portLabels = [
    { lat: depPt.lat, lng: depPt.lng, text: portEnName(dep.name) || 'Origin', color: '#bfe9ff', size: 1.4, dot: 0.28 },
    { lat: arrPt.lat, lng: arrPt.lng, text: portEnName(arr.name) || 'Destination', color: '#c6ffe1', size: 1.4, dot: 0.28 },
  ];

  const currentLabel = {
    lat: cur.lat,
    lng: cur.lng,
    text: `CURRENT · ${Math.round(progress * 100)}%`,
    color: '#ffd166',
    size: 1.15,
    dot: 0.24,
  };

  const cityLabels = WORLD_CITIES.map((c) => ({ lat: c.lat, lng: c.lng, text: c.en, color: 'rgba(226,240,255,0.75)', size: 0.62, dot: 0.15 }));

  return { depPt, arrPt, cur, arcs, points, labels: [currentLabel, ...portLabels, ...cityLabels] };
}

function render() {
  if (!globe) return;
  const data = buildData();
  globe
    .arcsData(data.arcs)
    .arcStartLat((d) => d.startLat).arcStartLng((d) => d.startLng)
    .arcEndLat((d) => d.endLat).arcEndLng((d) => d.endLng)
    .arcColor((d) => d.color)
    .arcStroke((d) => d.stroke)
    .arcAltitudeAutoScale(0.55)
    .arcDashLength((d) => d.dashLength)
    .arcDashGap((d) => d.dashGap)
    .arcDashAnimateTime((d) => d.anim)
    .pointsData(data.points)
    .pointLat((d) => d.lat).pointLng((d) => d.lng)
    .pointColor((d) => d.color)
    .pointRadius((d) => d.radius)
    .pointAltitude((d) => d.altitude)
    .pointLabel((d) => d.label)
    .labelsData(data.labels)
    .labelLat((d) => d.lat).labelLng((d) => d.lng)
    .labelText((d) => d.text)
    .labelColor((d) => d.color)
    .labelSize((d) => d.size)
    .labelDotRadius((d) => d.dot)
    .labelAltitude(0.015)
    .ringsData([{ lat: data.cur.lat, lng: data.cur.lng }])
    .ringColor(() => (tt) => `rgba(255,209,102,${1 - tt})`)
    .ringMaxRadius(4)
    .ringPropagationSpeed(2)
    .ringRepeatPeriod(900);

  // 视角对准当前位置（可看到当前货轮与航线延伸方向）
  globe.pointOfView({ lat: data.cur.lat, lng: data.cur.lng, altitude: 2.2 }, 0);
}

onMounted(() => {
  globe = new Globe(container.value)
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true)
    .atmosphereColor('#5aa9e6')
    .atmosphereAltitude(0.2)
    .polygonsData(countries)
    .polygonCapColor(() => 'rgba(74,146,120,0.78)')
    .polygonSideColor(() => 'rgba(40,96,78,0.7)')
    .polygonStrokeColor(() => 'rgba(214,240,255,0.9)')
    .polygonAltitude(0.008)
    .polygonLabel((d) => `<div style="padding:2px 6px">${COUNTRY_ZH[d.name] || d.name}</div>`);

  const mat = globe.globeMaterial();
  mat.color.set('#0b3a5c');
  if (mat.emissive) {
    mat.emissive.set('#062038');
    mat.emissiveIntensity = 0.35;
  }
  mat.shininess = 6;

  const ctrls = globe.controls();
  ctrls.autoRotate = true;
  ctrls.autoRotateSpeed = 0.35;
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
    setTimeout(render, 400);
  });
  render();
});

watch(() => props.track, render, { deep: true });

onBeforeUnmount(() => {
  if (ro) ro.disconnect();
  if (container.value) container.value.innerHTML = '';
  globe = null;
});
</script>

<style scoped>
.globe-container {
  width: 100%;
  height: 100%;
}
</style>
