import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const allowedHosts = ['.cosmoplat.cn', '.cosmoplat.com', '.cosmoplat.net'];
const proxy = {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts,
    proxy,
  },
  // 生产预览（start.sh 使用）：静态服务 dist，根路径 / 返回 index.html，并保留 /api 反向代理
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts,
    proxy,
  },
});
