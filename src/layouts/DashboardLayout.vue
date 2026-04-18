<template>
  <v-app>
    <AppSidebar v-model="drawer" />
    <AppBar @toggle-drawer="drawer = !drawer" @create-org="createOrgDialog.open()" />
    <v-main>
      <div class="main-container">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </v-main>
    <ConnectionStatus />

    <!-- Global Create Organization Dialog -->
    <v-dialog v-model="createOrgDialog.showDialog.value" max-width="480">
      <v-card class="pa-6">
        <div class="text-center mb-4">
          <v-icon size="48" color="primary">mdi-plus-circle-outline</v-icon>
          <h2 class="text-h5 font-weight-bold mt-2">New Organization</h2>
          <p class="text-body-2 text-medium-emphasis mt-1">Create an additional organization. You can switch between them anytime.</p>
        </div>
        <v-form ref="orgFormRef" @submit.prevent="createOrg">
          <v-text-field v-model="orgForm.name" label="Organization Name" :rules="[required]" class="mb-3" />
          <v-select
            v-model="orgForm.currency"
            label="Currency"
            :items="currencies"
            item-title="label"
            item-value="value"
            :rules="[required]"
            class="mb-3"
          />
          <v-select
            v-model="orgForm.fiscalYearStart"
            label="Fiscal Year Start"
            :items="months"
            item-title="label"
            item-value="value"
            :rules="[required]"
          />
          <v-btn type="submit" color="primary" block size="large" :loading="creatingOrg" class="mt-4">
            Create Organization
          </v-btn>
        </v-form>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppBar from '@/components/layout/AppBar.vue'
import ConnectionStatus from '@/components/layout/ConnectionStatus.vue'
import { useOrganizationStore } from '@/stores/organization'
import { subscribeAll } from '@/composables/useAppInit'
import { useCreateOrg } from '@/composables/useCreateOrg'

const drawer = ref(true)

// ---- Create Org Dialog ----
const createOrgDialog = useCreateOrg()
const orgStore = useOrganizationStore()
const orgFormRef = ref()
const creatingOrg = ref(false)
const orgForm = ref({ name: '', currency: 'GHS', fiscalYearStart: 1 })

const required = (v: any) => !!v || 'Required'

const currencies = [
  { label: 'Ghana Cedi (GHS)', value: 'GHS' },
  { label: 'US Dollar (USD)', value: 'USD' },
  { label: 'Euro (EUR)', value: 'EUR' },
  { label: 'British Pound (GBP)', value: 'GBP' },
  { label: 'Nigerian Naira (NGN)', value: 'NGN' },
]
const months = [
  { label: 'January', value: 1 }, { label: 'February', value: 2 },
  { label: 'March', value: 3 }, { label: 'April', value: 4 },
  { label: 'May', value: 5 }, { label: 'June', value: 6 },
  { label: 'July', value: 7 }, { label: 'August', value: 8 },
  { label: 'September', value: 9 }, { label: 'October', value: 10 },
  { label: 'November', value: 11 }, { label: 'December', value: 12 },
]

async function createOrg() {
  const { valid } = await orgFormRef.value.validate()
  if (!valid) return
  creatingOrg.value = true
  try {
    await orgStore.createOrganization(orgForm.value.name, orgForm.value.currency, orgForm.value.fiscalYearStart)
    createOrgDialog.showDialog.value = false
    orgForm.value = { name: '', currency: 'GHS', fiscalYearStart: 1 }
    subscribeAll()
  } finally {
    creatingOrg.value = false
  }
}
</script>

<style scoped>
.main-container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px;
}

@media (max-width: 960px) {
  .main-container {
    padding: 16px;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
