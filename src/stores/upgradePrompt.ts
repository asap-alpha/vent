import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlanId } from '@/types/subscription'

export interface UpgradePromptPayload {
  title: string
  message: string
  requiredPlan?: PlanId
  ctaLabel?: string
}

export const useUpgradePromptStore = defineStore('upgradePrompt', () => {
  const visible = ref(false)
  const payload = ref<UpgradePromptPayload | null>(null)

  function open(p: UpgradePromptPayload) {
    payload.value = p
    visible.value = true
  }

  function close() {
    visible.value = false
  }

  return { visible, payload, open, close }
})
