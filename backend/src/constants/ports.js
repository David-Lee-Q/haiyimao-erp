// 常见港口经纬度（用于海图定位与航线绘制）
const PORT_COORDS = {
  'Port of Valparaiso': { lat: -33.0472, lon: -71.6127, label: '瓦尔帕莱索港 / 智利' },
  'Valparaiso': { lat: -33.0472, lon: -71.6127, label: '瓦尔帕莱索港 / 智利' },
  'Shanghai Port': { lat: 31.2304, lon: 121.4737, label: '上海港 / 中国' },
  'Shanghai': { lat: 31.2304, lon: 121.4737, label: '上海港 / 中国' },
  'Qingdao Port': { lat: 36.0671, lon: 120.3826, label: '青岛港 / 中国' },
  'Ningbo-Zhoushan Port': { lat: 29.8683, lon: 121.544, label: '宁波舟山港 / 中国' },
  'Guangzhou Nansha Port': { lat: 22.7712, lon: 113.5325, label: '广州南沙港 / 中国' },
  'Tianjin Port': { lat: 38.9849, lon: 117.7484, label: '天津港 / 中国' },
  'Port of Melbourne': { lat: -37.8136, lon: 144.9631, label: '墨尔本港 / 澳大利亚' },
  'Port of Sydney': { lat: -33.8688, lon: 151.2093, label: '悉尼港 / 澳大利亚' },
  'Port of Brisbane': { lat: -27.4698, lon: 153.0251, label: '布里斯班港 / 澳大利亚' },
  'Oslo Port': { lat: 59.9139, lon: 10.7522, label: '奥斯陆港 / 挪威' },
  'Port of Auckland': { lat: -36.8485, lon: 174.7633, label: '奥克兰港 / 新西兰' },
  'Port of Tauranga': { lat: -37.6878, lon: 176.1651, label: '陶朗加港 / 新西兰' },
  'Port of Callao': { lat: -12.0566, lon: -77.1181, label: '卡亚俄港 / 秘鲁' },
  'Port of Guayaquil': { lat: -2.1894, lon: -79.8891, label: '瓜亚基尔港 / 厄瓜多尔' },
  'Port of Buenos Aires': { lat: -34.6037, lon: -58.3816, label: '布宜诺斯艾利斯港 / 阿根廷' },
  'Port of Santos': { lat: -23.9608, lon: -46.3336, label: '桑托斯港 / 巴西' },
  'Port of Vancouver': { lat: 49.2827, lon: -123.1207, label: '温哥华港 / 加拿大' },
  'Port of Rotterdam': { lat: 51.9244, lon: 4.4777, label: '鹿特丹港 / 荷兰' },
  'Port of Singapore': { lat: 1.2644, lon: 103.8222, label: '新加坡港 / 新加坡' },
};

function getPortCoord(name) {
  if (!name) return null;
  if (PORT_COORDS[name]) return { name, ...PORT_COORDS[name] };
  const key = Object.keys(PORT_COORDS).find((k) => name.includes(k) || k.includes(name));
  if (key) return { name, ...PORT_COORDS[key] };
  return { name, lat: null, lon: null, label: name };
}

module.exports = { PORT_COORDS, getPortCoord };
