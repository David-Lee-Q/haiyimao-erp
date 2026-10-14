import countriesTopo from 'world-atlas/countries-110m.json';
import { feature } from 'topojson-client';

export const countriesFeatures = feature(countriesTopo, countriesTopo.objects.countries).features.map((f) => ({
  ...f,
  name: (f.properties && f.properties.name) || '',
}));

export const COUNTRY_ZH = {
  China: '中国', Chile: '智利', Australia: '澳大利亚', 'New Zealand': '新西兰', Norway: '挪威',
  Thailand: '泰国', Vietnam: '越南', Canada: '加拿大', Peru: '秘鲁', Ecuador: '厄瓜多尔',
  Argentina: '阿根廷', Brazil: '巴西', 'United States of America': '美国', Japan: '日本',
  Singapore: '新加坡', Netherlands: '荷兰', 'United Kingdom': '英国', France: '法国',
  Germany: '德国', Russia: '俄罗斯', India: '印度', 'South Korea': '韩国', Indonesia: '印度尼西亚',
  Malaysia: '马来西亚', Philippines: '菲律宾', Mexico: '墨西哥', 'South Africa': '南非',
};

export const WORLD_CITIES = [
  { name: '北京', en: 'Beijing', lat: 39.9042, lng: 116.4074 },
  { name: '香港', en: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
  { name: '东京', en: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: '新加坡', en: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: '悉尼', en: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { name: '洛杉矶', en: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: '纽约', en: 'New York', lat: 40.7128, lng: -74.006 },
  { name: '鹿特丹', en: 'Rotterdam', lat: 51.9244, lng: 4.4777 },
  { name: '迪拜', en: 'Dubai', lat: 25.2048, lng: 55.2708 },
  { name: '巴拿马城', en: 'Panama City', lat: 8.9824, lng: -79.5199 },
];

// 端口英文显示名（SpriteText 只能稳定渲染 ASCII，中文通过悬停提示展示）
export function portEnName(name) {
  if (!name) return '';
  return String(name).replace(/^Port of\s+/i, '').replace(/\s+Port$/i, '');
}

export const STATUS_COLOR = {
  PORT_DEPARTURE: '#f0a93d',
  IN_TRANSIT: '#4fd0ff',
  PORT_ARRIVED: '#a78bfa',
  CUSTOMS_CLEARING: '#ffd166',
  RELEASED: '#33d6a6',
  WAREHOUSED: '#8affc1',
};

export const STATUS_LABEL = {
  PORT_DEPARTURE: '离港',
  IN_TRANSIT: '海运/空运中',
  PORT_ARRIVED: '到港',
  CUSTOMS_CLEARING: '报关清关中',
  RELEASED: '放行',
  WAREHOUSED: '已入库',
};
