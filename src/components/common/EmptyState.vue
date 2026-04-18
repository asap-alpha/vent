<template>
  <div class="empty-state text-center pa-8">
    <v-icon :icon="icon" size="56" color="secondary" class="mb-4" style="opacity: 0.4" />
    <h3 class="text-h6 font-weight-medium text-medium-emphasis mb-2">{{ title }}</h3>
    <p class="text-body-2 text-medium-emphasis mb-4" style="max-width: 360px; margin: 0 auto">
      {{ description }}
    </p>
    <slot name="action">
      <v-btn
        v-if="actionLabel"
        color="primary"
        :prepend-icon="actionIcon"
        :to="actionTo"
        @click="$emit('action')"
      >
        {{ actionLabel }}
      </v-btn>
    </slot>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
  actionLabel?: string
  actionIcon?: string
  actionTo?: object
}>()

defineEmits<{ action: [] }>()
</script>

<style scoped>
.empty-state {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
