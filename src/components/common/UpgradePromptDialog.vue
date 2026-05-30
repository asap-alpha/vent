<template>
  <v-dialog v-model="visible" max-width="460" persistent>
    <v-card v-if="payload" rounded="lg">
      <v-card-text class="pa-6">
        <div class="d-flex align-center mb-4">
          <v-avatar color="warning" variant="tonal" size="44" class="mr-3">
            <v-icon size="24">mdi-lock-outline</v-icon>
          </v-avatar>
          <div>
            <div class="text-h6 font-weight-bold">{{ payload.title }}</div>
          </div>
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ payload.message }}
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions class="px-4 py-3">
        <v-spacer />
        <v-btn variant="text" @click="onClose">Not now</v-btn>
        <v-btn color="primary" variant="flat" @click="onUpgrade">
          {{ payload.ctaLabel || 'View plans' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useUpgradePromptStore } from '@/stores/upgradePrompt'

const router = useRouter()
const store = useUpgradePromptStore()
const { visible, payload } = storeToRefs(store)

function onClose() {
  store.close()
}

function onUpgrade() {
  store.close()
  router.push({ name: 'billing' })
}
</script>
