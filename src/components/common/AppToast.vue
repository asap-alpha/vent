<template>
  <v-snackbar
    v-model="active"
    :color="current.color"
    :timeout="current.timeout || 4000"
    location="bottom end"
    rounded="lg"
  >
    {{ current.message }}
    <template #actions>
      <v-btn variant="text" @click="active = false">Close</v-btn>
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { active, current } = useToast()
</script>
