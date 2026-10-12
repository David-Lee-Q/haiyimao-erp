import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '../router';

const api = axios.create({ baseURL: '/api/v1', timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('erp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (error) => {
    const resp = error.response;
    if (resp) {
      if (resp.status === 401) {
        localStorage.removeItem('erp_token');
        if (router.currentRoute.value.name !== 'login') router.push('/login');
      }
      const data = resp.data || {};
      const err = new Error(data.message || '请求失败');
      err.code = data.code || resp.status;
      err.data = data.data;
      return Promise.reject(err);
    }
    return Promise.reject(new Error('网络异常，请检查后端服务'));
  }
);

export function toastError(err) {
  ElMessage.error(err && err.message ? err.message : '操作失败');
}

export default api;
