<template>
  <div v-if="createdBy || createdAt" class="text-caption text-grey">
    <v-icon size="x-small" class="mr-1">mdi-history</v-icon>
    Created by <strong>{{ creatorName }}</strong>
    <span v-if="createdAt"> on {{ formatDate(createdAt, 'dd MMM yyyy HH:mm') }}</span>
    <template v-if="updatedAt && updatedAt.getTime() > (createdAt?.getTime() || 0) + 1000">
      · Updated {{ formatDate(updatedAt, 'dd MMM yyyy HH:mm') }}
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOrganizationStore } from '@/stores/organization'
import { formatDate } from '@/utils/date'

const props = defineProps<{
  createdBy?: string
  createdAt?: Date
  updatedAt?: Date
}>()

const orgStore = useOrganizationStore()

const creatorName = computed(() => {
  if (!props.createdBy) return 'Unknown'
  const member = orgStore.members.find((m) => m.userId === props.createdBy)
  return member?.displayName || member?.email || 'Unknown'
})
</script>
