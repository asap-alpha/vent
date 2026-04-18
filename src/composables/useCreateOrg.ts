import { ref } from 'vue'

const showDialog = ref(false)

export function useCreateOrg() {
  function open() {
    showDialog.value = true
  }

  return { showDialog, open }
}
