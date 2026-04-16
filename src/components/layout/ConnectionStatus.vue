<template>
  <v-snackbar
    v-model="showOffline"
    color="warning"
    location="bottom"
    :timeout="-1"
  >
    <v-icon start>mdi-wifi-off</v-icon>
    You're offline — changes will sync when connection returns.
    <template #actions>
      <v-btn variant="text" @click="showOffline = false">Dismiss</v-btn>
    </template>
  </v-snackbar>

  <v-snackbar
    v-model="showReconnected"
    color="success"
    location="bottom"
    :timeout="3000"
  >
    <v-icon start>mdi-wifi</v-icon>
    Back online — syncing data.
  </v-snackbar>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { logger } from '@/utils/logger'

const log = logger('network')
const showOffline = ref(false)
const showReconnected = ref(false)
let wasOffline = false

function onOffline() {
  log.warn('Browser went offline')
  showOffline.value = true
  wasOffline = true
}

function onOnline() {
  log.info('Browser back online')
  showOffline.value = false
  if (wasOffline) {
    showReconnected.value = true
    wasOffline = false
  }
}

onMounted(() => {
  window.addEventListener('offline', onOffline)
  window.addEventListener('online', onOnline)
  if (!navigator.onLine) onOffline()
})

onBeforeUnmount(() => {
  window.removeEventListener('offline', onOffline)
  window.removeEventListener('online', onOnline)
})
</script>
