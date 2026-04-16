<template>
  <!-- No layout wrapper for pages that render their own v-app (landing) -->
  <template v-if="isNoLayout">
    <router-view />
  </template>
  <template v-else>
    <component :is="layout">
      <router-view />
    </component>
  </template>
  <AppToast />
</template>

<script setup lang="ts">
import { computed, markRaw } from 'vue'
import { useRoute } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppToast from '@/components/common/AppToast.vue'

const route = useRoute()

const isNoLayout = computed(() => (route.meta.layout as string) === 'none')

const layouts: Record<string, any> = {
  auth: markRaw(AuthLayout),
  dashboard: markRaw(DashboardLayout),
}

const layout = computed(() => {
  const name = (route.meta.layout as string) || 'dashboard'
  return layouts[name] || layouts.dashboard
})
</script>
