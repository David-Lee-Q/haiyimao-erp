import { useAuthStore } from './store/auth';

export function hasPerm(code) {
  const auth = useAuthStore();
  const perms = auth.permissions || [];
  if (perms.includes('*')) return true;
  return perms.includes(code);
}

export function hasAnyPerm(codes) {
  if (!codes || codes.length === 0) return true;
  return codes.some((c) => hasPerm(c));
}

export const permissionDirective = {
  mounted(el, binding) {
    const codes = Array.isArray(binding.value) ? binding.value : [binding.value];
    if (!hasAnyPerm(codes)) {
      el.parentNode && el.parentNode.removeChild(el);
    }
  },
};
