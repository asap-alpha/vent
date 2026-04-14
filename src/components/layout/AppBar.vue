<template>
  <v-app-bar flat density="comfortable" color="primary">
    <v-app-bar-title>
      <v-breadcrumbs :items="breadcrumbs" class="pa-0">
        <template #divider>
          <v-icon icon="mdi-chevron-right" size="small" />
        </template>
      </v-breadcrumbs>
    </v-app-bar-title>

    <template #append>
      <GlobalSearch class="mr-3" />

      <!-- Org Switcher -->
      <v-menu v-if="organizations.length > 1">
        <template #activator="{ props }">
          <v-btn v-bind="props" variant="text" class="text-none mr-2">
            <v-icon start>mdi-office-building</v-icon>
            {{ orgName }}
            <v-icon end>mdi-chevron-down</v-icon>
          </v-btn>
        </template>
        <v-list>
          <v-list-item
            v-for="org in organizations"
            :key="org.id"
            :active="org.id === currentOrgId"
            @click="switchOrg(org.id)"
          >
            <v-list-item-title>{{ org.name }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <!-- User Menu -->
      <v-menu>
        <template #activator="{ props }">
          <v-btn v-bind="props" icon variant="text">
            <v-avatar color="surface" size="32">
              <span class="text-primary text-body-2">{{ initials }}</span>
            </v-avatar>
          </v-btn>
        </template>
        <v-list>
          <v-list-item>
            <v-list-item-title>{{ displayName }}</v-list-item-title>
            <v-list-item-subtitle>{{ email }}</v-list-item-subtitle>
          </v-list-item>
          <v-divider />
          <v-list-item prepend-icon="mdi-cog" title="Settings" :to="{ name: 'settings' }" />
          <v-list-item prepend-icon="mdi-logout" title="Logout" @click="logout" />
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

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const orgStore = useOrganizationStore()

const displayName = computed(() => authStore.displayName)
const email = computed(() => authStore.user?.email || '')
const initials = computed(() => {
  const name = displayName.value
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const orgName = computed(() => orgStore.orgName)
const organizations = computed(() => orgStore.organizations)
const currentOrgId = computed(() => orgStore.orgId)

const breadcrumbs = computed(() => {
  const items: { title: string; to?: string; disabled?: boolean }[] = []
  const matched = route.matched
  for (const record of matched) {
    const name = record.name as string
    if (name) {
      items.push({
        title: name
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        disabled: true,
      })
    }
  }
  return items
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
