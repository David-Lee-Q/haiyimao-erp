import { defineStore } from 'pinia';
import api from '../api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('erp_token') || '',
    user: JSON.parse(localStorage.getItem('erp_user') || 'null'),
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    role: (s) => (s.user ? s.user.role : ''),
    permissions: (s) => (s.user && s.user.permissions) || [],
    hasPerm() {
      return (code) => {
        const perms = this.permissions;
        if (perms.includes('*')) return true;
        return perms.includes(code);
      };
    },
  },
  actions: {
    async login(payload) {
      const res = await api.post('/auth/login', payload);
      this.token = res.data.token;
      this.user = res.data.user;
      localStorage.setItem('erp_token', this.token);
      localStorage.setItem('erp_user', JSON.stringify(this.user));
      return res;
    },
    async refreshMe() {
      const res = await api.get('/auth/me');
      this.user = { ...this.user, ...res.data };
      localStorage.setItem('erp_user', JSON.stringify(this.user));
      return res.data;
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('erp_token');
      localStorage.removeItem('erp_user');
    },
  },
});
