<template>
  <v-dialog v-model="show" max-width="420">
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-card-text>{{ message }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="onCancel">{{ cancelText }}</v-btn>
        <v-btn :color="color" @click="onConfirm">{{ confirmText }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  color?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Confirm',
  message: 'Are you sure?',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  color: 'error',
})

const show = ref(false)
let resolver: ((value: boolean) => void) | null = null

function open(): Promise<boolean> {
  show.value = true
  return new Promise((resolve) => {
    resolver = resolve
  })
}

function onConfirm() {
  show.value = false
  resolver?.(true)
  resolver = null
}

function onCancel() {
  show.value = false
  resolver?.(false)
  resolver = null
}

defineExpose({ open })
</script>
