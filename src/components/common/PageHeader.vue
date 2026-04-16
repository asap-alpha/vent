<template>
  <div class="d-flex align-center flex-wrap ga-3 mb-6">
    <v-btn
      v-if="backTo"
      icon="mdi-arrow-left"
      variant="text"
      size="small"
      :to="backTo"
    />
    <div>
      <h1 class="text-h5 font-weight-bold">{{ title }}</h1>
      <p v-if="subtitle" class="text-body-2 text-medium-emphasis mt-1">{{ subtitle }}</p>
    </div>
    <v-spacer />
    <slot name="actions" />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  backTo?: object
}>()
</script>
