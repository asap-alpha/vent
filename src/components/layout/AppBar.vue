<template>
  <v-app-bar flat density="comfortable" color="surface" class="app-bar" :elevation="0">
    <!-- Mobile menu toggle -->
    <v-app-bar-nav-icon class="d-md-none" @click="$emit('toggle-drawer')" />

    <!-- Page title -->
    <v-app-bar-title class="text-subtitle-1 font-weight-bold text-medium-emphasis">
      {{ pageTitle }}
    </v-app-bar-title>

    <template #append>
      <!-- Search -->
      <GlobalSearch class="d-none d-sm-block mr-2" />

      <!-- Org Switcher (always visible) -->
      <v-menu>
        <template #activator="{ props }">
          <v-btn v-bind="props" variant="text" class="text-none" size="small">
            <v-icon start size="18">mdi-office-building-outline</v-icon>
            <span class="d-none d-lg-inline">{{ orgName || 'Organizations' }}</span>
            <v-icon end size="16">mdi-chevron-down</v-icon>
          </v-btn>
        </template>
        <v-list density="compact" min-width="240">
          <v-list-subheader v-if="organizations.length > 0" class="text-uppercase text-caption font-weight-bold">
            Your Organizations
          </v-list-subheader>
          <v-list-item
            v-for="org in organizations"
            :key="org.id"
            :active="org.id === currentOrgId"
            @click="switchOrg(org.id)"
          >
            <template #prepend>
              <v-icon size="18" class="mr-2">mdi-office-building-outline</v-icon>
            </template>
            <v-list-item-title>{{ org.name }}</v-list-item-title>
            <template #append>
              <v-chip
                v-if="org.status && org.status !== 'approved'"
                :color="org.status === 'pending' ? 'warning' : 'error'"
                size="x-small"
              >{{ org.status }}</v-chip>
            </template>
          </v-list-item>
          <v-divider class="my-1" />
          <v-list-item
            prepend-icon="mdi-plus-circle-outline"
            title="Create New Organization"
            @click="$emit('create-org')"
          />
        </v-list>
      </v-menu>

      <!-- User Menu -->
      <v-menu>
        <template #activator="{ props }">
          <v-btn v-bind="props" icon variant="text" size="small" class="ml-1">
            <v-avatar color="primary" size="32">
              <span class="text-white text-body-2 font-weight-medium">{{ initials }}</span>
            </v-avatar>
          </v-btn>
        </template>
        <v-list density="compact" min-width="220">
          <v-list-item class="mb-1">
            <v-list-item-title class="font-weight-medium">{{ displayName }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption">{{ email }}</v-list-item-subtitle>
          </v-list-item>
          <v-divider class="my-1" />
          <v-list-item prepend-icon="mdi-cog-outline" title="Settings" :to="{ name: 'settings' }" />
          <v-list-item prepend-icon="mdi-logout" title="Sign out" @click="logout" />
        </v-list>
      </v-menu>
    </template>
  </v-app-bar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationStore } from '@/stores/organization'
import GlobalSearch from './GlobalSearch.vue'

defineEmits<{ 'toggle-drawer': []; 'create-org': [] }>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const orgStore = useOrganizationStore()

const displayName = computed(() => authStore.displayName)
const email = computed(() => authStore.user?.email || '')
const initials = computed(() => {
  const name = displayName.value
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
})

const orgName = computed(() => orgStore.orgName)
const organizations = computed(() => orgStore.organizations)
const currentOrgId = computed(() => orgStore.orgId)

const pageTitle = computed(() => {
  const name = route.name as string
  if (!name) return 'Dashboard'
  return name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
})

async function switchOrg(orgId: string) {
  await orgStore.setCurrentOrg(orgId)
}

async function logout() {
  await authStore.logout()
  orgStore.$reset()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.app-bar {
  border-bottom: 1px solid rgb(var(--v-theme-on-surface), 0.08) !important;
}
</style>
