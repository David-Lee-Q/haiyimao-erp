<template>
  <el-tag :type="type" size="small" effect="light">{{ label }}</el-tag>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ status: { type: String, default: '' }, map: { type: Object, default: () => ({}) } });

const TYPE_MAP = {
  DRAFT: 'info',
  PENDING_APPROVE: 'warning',
  REJECTED: 'danger',
  CONFIRMED: 'primary',
  IN_TRANSIT: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'info',
  PORT_DEPARTURE: 'warning',
  PORT_ARRIVED: 'primary',
  CUSTOMS_CLEARING: 'warning',
  RELEASED: 'primary',
  WAREHOUSED: 'success',
  OPEN: 'danger',
  RESOLVED: 'success',
  UPLOADED: 'success',
  PENDING: 'info',
  APPROVED: 'success',
};

const label = computed(() => props.map[props.status] || props.status);
const type = computed(() => TYPE_MAP[props.status] || 'info');
</script>
