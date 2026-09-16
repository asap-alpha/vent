<template>
  <div>
    <PageHeader
      title="Settings"
      subtitle="Business profile — the logo, location and bank details printed on your invoices"
    />

    <v-alert v-if="!isOwner" type="info" variant="tonal" class="mb-4">
      Only the organization owner can edit the business profile.
    </v-alert>

    <v-form ref="formRef" @submit.prevent="save">
      <!-- ===== Logo + identity ===== -->
      <v-card class="mb-4">
        <v-card-text class="pa-5">
          <div class="text-subtitle-2 font-weight-bold mb-1">Logo</div>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Appears at the top of every invoice and bill. A wide, transparent PNG works best.
          </p>

          <div class="d-flex align-center flex-wrap ga-4">
            <div class="logo-preview d-flex align-center justify-center">
              <img v-if="form.logo" :src="form.logo" alt="Organization logo" />
              <v-icon v-else icon="mdi-image-outline" size="32" class="text-medium-emphasis" />
            </div>

            <div class="flex-grow-1" style="min-width: 240px">
              <v-file-input
                label="Upload logo"
                accept="image/png,image/jpeg,image/webp"
                prepend-icon=""
                prepend-inner-icon="mdi-tray-arrow-up"
                density="comfortable"
                hide-details="auto"
                :disabled="!isOwner"
                :loading="processingLogo"
                :error-messages="logoError"
                @update:model-value="onLogoSelected"
              />
              <v-btn
                v-if="form.logo"
                variant="text"
                size="small"
                color="error"
                class="mt-2"
                :disabled="!isOwner"
                @click="form.logo = ''"
              >
                Remove logo
              </v-btn>
            </div>
          </div>
        </v-card-text>

        <v-divider />

        <v-card-text class="pa-5">
          <div class="text-subtitle-2 font-weight-bold mb-3">Business Details</div>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.name"
                label="Business name"
                :rules="[required]"
                :disabled="!isOwner"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-textarea
                v-model="form.address"
                label="Business location / address"
                rows="3"
                hint="Printed in the invoice header, beside the invoice details"
                persistent-hint
                :disabled="!isOwner"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.email" label="Email" :disabled="!isOwner" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.phone" label="Phone" :disabled="!isOwner" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.taxId" label="TIN" :disabled="!isOwner" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="form.vatNumber"
                label="VAT number"
                :disabled="!isOwner"
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- ===== Bank details ===== -->
      <v-card class="mb-4">
        <v-card-text class="pa-5">
          <div class="text-subtitle-2 font-weight-bold mb-1">Bank Details</div>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Printed in a payment block below the body of every invoice and bill.
            Leave a field blank to keep it off the document.
          </p>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.bankDetails.accountName" label="Account name" :disabled="!isOwner" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.bankDetails.accountNumber" label="Account number" :disabled="!isOwner" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.bankDetails.bankName" label="Bank name" :disabled="!isOwner" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.bankDetails.branch" label="Branch" :disabled="!isOwner" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.bankDetails.bankCode" label="Bank code" :disabled="!isOwner" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="form.bankDetails.swift" label="SWIFT / BIC" :disabled="!isOwner" />
            </v-col>
          </v-row>

          <v-alert v-if="error" type="error" variant="tonal" class="mt-4">{{ error }}</v-alert>
        </v-card-text>

        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn variant="text" :disabled="!isOwner || saving" @click="reset">Reset</v-btn>
          <v-btn color="primary" type="submit" :loading="saving" :disabled="!isOwner">
            Save Changes
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useOrganizationStore } from '@/stores/organization'
import { useToast } from '@/composables/useToast'
import { required } from '@/utils/validation'
import { fileToLogoDataUrl, ImageError } from '@/utils/image'
import PageHeader from '@/components/common/PageHeader.vue'
import type { BankDetails } from '@/types/auth'

const orgStore = useOrganizationStore()
const toast = useToast()

const formRef = ref()
const saving = ref(false)
const processingLogo = ref(false)
const error = ref('')
const logoError = ref('')

const isOwner = computed(() => orgStore.myRole === 'owner')

function emptyBank(): BankDetails {
  return { bankName: '', branch: '', bankCode: '', accountName: '', accountNumber: '', swift: '' }
}

const form = ref({
  name: '',
  logo: '',
  address: '',
  email: '',
  phone: '',
  taxId: '',
  vatNumber: '',
  bankDetails: emptyBank(),
})

function reset() {
  const org = orgStore.currentOrg
  error.value = ''
  logoError.value = ''
  form.value = {
    name: org?.name || '',
    logo: org?.logo || '',
    address: org?.address || '',
    email: org?.email || '',
    phone: org?.phone || '',
    taxId: org?.taxId || '',
    vatNumber: org?.vatNumber || '',
    bankDetails: { ...emptyBank(), ...(org?.bankDetails || {}) },
  }
}

onMounted(reset)
// Re-seed the form when the user switches organization
watch(() => orgStore.currentOrg?.id, reset)

async function onLogoSelected(value: File | File[] | null) {
  const file = Array.isArray(value) ? value[0] : value
  logoError.value = ''
  if (!file) return

  processingLogo.value = true
  try {
    form.value.logo = await fileToLogoDataUrl(file)
  } catch (e: any) {
    logoError.value = e instanceof ImageError ? e.message : 'Could not process that image'
  } finally {
    processingLogo.value = false
  }
}

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  saving.value = true
  error.value = ''
  try {
    await orgStore.updateOrgProfile({ ...form.value })
    toast.success('Business profile saved')
  } catch (e: any) {
    error.value = e.message || 'Could not save the business profile'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.logo-preview {
  width: 160px;
  height: 80px;
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.25);
  border-radius: 8px;
  padding: 8px;
}

.logo-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
