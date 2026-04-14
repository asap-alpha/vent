<template>
  <component :is="layout">
    <router-view />
  </component>
</template>

<script setup lang="ts">
import { computed, markRaw } from 'vue'
import { useRoute } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'

const route = useRoute()

const layouts: Record<string, any> = {
  auth: markRaw(AuthLayout),
  dashboard: markRaw(DashboardLayout),
}

const layout = computed(() => {
  const name = (route.meta.layout as string) || 'dashboard'
  return layouts[name] || layouts.dashboard
})
</script>
