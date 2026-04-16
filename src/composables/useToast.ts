import { ref } from 'vue'

export interface Toast {
  message: string
  color: 'success' | 'error' | 'warning' | 'info'
  timeout?: number
}

const active = ref(false)
const current = ref<Toast>({ message: '', color: 'info' })

export function useToast() {
  function show(toast: Toast) {
    current.value = toast
    active.value = true
  }

  function success(message: string) {
    show({ message, color: 'success', timeout: 4000 })
  }

  function error(message: string) {
    show({ message, color: 'error', timeout: 6000 })
  }

  function warning(message: string) {
    show({ message, color: 'warning', timeout: 5000 })
  }

  function info(message: string) {
    show({ message, color: 'info', timeout: 4000 })
  }

  return { active, current, show, success, error, warning, info }
}
