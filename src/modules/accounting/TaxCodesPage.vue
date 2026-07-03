<template>
  <div>
    <PageHeader title="Tax Codes">
      <template #actions>
        <v-btn
          v-if="taxStore.taxCodes.length === 0"
          variant="outlined"
          prepend-icon="mdi-database-import"
          size="small"
          class="mr-2"
          :loading="seeding"
          @click="seedDefaults"
        >
          Seed Defaults
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreate">
          New Tax Code
        </v-btn>
      </template>
    </PageHeader>

    <v-card>
      <v-data-table
        :headers="headers"
        :items="taxStore.taxCodes"
        :loading="taxStore.loading"
        :items-per-page="25"
      >
        <template #item.rate="{ item }">{{ item.rate }}%</template>
        <template #item.components="{ item }">
          <span class="text-body-2">{{ componentSummary(item) }}</span>
        </template>
        <template #item.isActive="{ item }">
          <v-chip :color="item.isActive ? 'success' : 'grey'" size="x-small" variant="tonal">
            {{ item.isActive ? 'Active' : 'Inactive' }}
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-pencil" size="x-small" variant="text" @click="openEdit(item)" />
          <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="confirmDelete(item)" />
        </template>
        <template #no-data>
          <EmptyState
            icon="mdi-percent-outline"
            title="No tax codes yet"
            description="Click 'Seed Defaults' for the standard Ghana VAT + levies codes, or create your own."
            action-label="New Tax Code"
            action-icon="mdi-plus"
            @action="openCreate"
          />
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="760" persistent>
      <v-card>
        <v-card-title>{{ editing ? 'Edit Tax Code' : 'New Tax Code' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef" @submit.prevent="save">
            <v-row>
              <v-col cols="12" md="8">
                <v-text-field v-model="form.name" label="Name" :rules="[required]" placeholder="Standard Rate (VAT + Levies)" />
              </v-col>
              <v-col cols="12" md="4" class="d-flex align-center">
                <v-switch v-model="form.isActive" label="Active" color="primary" hide-details />
              </v-col>
            </v-row>

            <div class="d-flex align-center mb-2 mt-2">
              <div class="text-subtitle-2 font-weight-bold">Components</div>
              <v-spacer />
              <div class="text-body-2 text-medium-emphasis mr-3">
                Effective rate: <strong>{{ previewRate }}%</strong>
              </div>
              <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="addComponent">Add</v-btn>
            </div>

            <v-table density="comfortable">
              <thead>
                <tr>
                  <th style="width: 22%">Name</th>
                  <th style="width: 14%" class="text-end">Rate %</th>
                  <th>Tax Account</th>
                  <th style="width: 16%" class="text-center">Compound</th>
                  <th style="width: 40px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(c, idx) in form.components" :key="idx">
                  <td>
                    <v-text-field v-model="c.name" density="compact" variant="outlined" hide-details placeholder="VAT" />
                  </td>
                  <td>
                    <v-text-field
                      v-model.number="c.rate"
                      type="number"
                      density="compact"
                      variant="outlined"
                      hide-details
                      min="0"
                      step="0.01"
                      class="text-end-input"
                    />
                  </td>
                  <td>
                    <v-select
                      v-model="c.accountId"
                      :items="taxAccountOptions"
                      item-title="title"
                      item-value="value"
                      density="compact"
                      variant="outlined"
                      hide-details
                      placeholder="Tax liability account"
                    />
                  </td>
                  <td class="text-center">
                    <v-switch
                      v-model="c.compound"
                      color="primary"
                      hide-details
                      density="compact"
                      class="d-inline-flex"
                    />
                  </td>
                  <td class="text-center">
                    <v-btn icon="mdi-close" size="x-small" variant="text" @click="form.components.splice(idx, 1)" />
                  </td>
                </tr>
                <tr v-if="form.components.length === 0">
                  <td colspan="5" class="text-center text-grey py-4">
                    No components — this code applies 0% tax. Add one for VAT / a levy.
                  </td>
                </tr>
              </tbody>
            </v-table>
            <p class="text-caption text-medium-emphasis mt-2">
              Components are applied top to bottom. Mark a component <strong>Compound</strong> when it's charged on the
              base <em>plus</em> the components above it (e.g. Ghana VAT is compound on top of the NHIL/GETFund/COVID levies).
            </p>

            <v-alert v-if="error" type="error" variant="tonal" class="mt-2">{{ error }}</v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      ref="confirmRef"
      title="Delete Tax Code"
      message="Delete this tax code? Documents already using it keep their stored tax."
      confirm-text="Delete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTaxStore } from '@/stores/tax'
import { useAccountsStore } from '@/stores/accounts'
import { useOrganizationStore } from '@/stores/organization'
import { required } from '@/utils/validation'
import { effectiveTaxRate } from '@/utils/tax'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { TaxCode, TaxComponent } from '@/types/tax'

const taxStore = useTaxStore()
const accountsStore = useAccountsStore()
const orgStore = useOrganizationStore()

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Rate', key: 'rate', width: 90, align: 'end' as const },
  { title: 'Components', key: 'components' },
  { title: 'Status', key: 'isActive', width: 100, align: 'center' as const },
  { title: '', key: 'actions', sortable: false, width: 100, align: 'end' as const },
]

// Tax liability accounts a component can post to.
const taxAccountOptions = computed(() =>
  accountsStore.activeAccounts
    .filter((a) => a.type === 'liability')
    .map((a) => ({ title: `${a.code} — ${a.name}`, value: a.id }))
)

function componentSummary(code: TaxCode): string {
  if (!code.components.length) return 'No tax'
  return code.components.map((c) => `${c.name} ${c.rate}%${c.compound ? ' (compound)' : ''}`).join(' + ')
}

const dialog = ref(false)
const editing = ref<TaxCode | null>(null)
const formRef = ref()
const saving = ref(false)
const error = ref('')
const form = ref<{ name: string; isActive: boolean; components: TaxComponent[] }>({
  name: '',
  isActive: true,
  components: [],
})

const previewRate = computed(() => effectiveTaxRate(form.value.components))

function addComponent() {
  form.value.components.push({ name: '', rate: 0, accountId: '', compound: false })
}

function openCreate() {
  editing.value = null
  form.value = { name: '', isActive: true, components: [] }
  error.value = ''
  dialog.value = true
}

function openEdit(code: TaxCode) {
  editing.value = code
  form.value = {
    name: code.name,
    isActive: code.isActive,
    components: code.components.map((c) => ({ ...c })),
  }
  error.value = ''
  dialog.value = true
}

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid) return
  // Every component must map to a tax account.
  if (form.value.components.some((c) => !c.accountId || !c.name)) {
    error.value = 'Each component needs a name and a tax account.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    if (editing.value) {
      await taxStore.updateTaxCode(editing.value.id, {
        name: form.value.name,
        isActive: form.value.isActive,
        components: form.value.components,
      })
    } else {
      await taxStore.createTaxCode({
        name: form.value.name,
        isActive: form.value.isActive,
        components: form.value.components,
      })
    }
    dialog.value = false
  } catch (e: any) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

const confirmRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
async function confirmDelete(code: TaxCode) {
  const ok = await confirmRef.value?.open()
  if (ok) await taxStore.deleteTaxCode(code.id)
}

const seeding = ref(false)
async function seedDefaults() {
  seeding.value = true
  error.value = ''
  try {
    await taxStore.seedDefaultTaxCodes()
  } catch (e: any) {
    alert(e.message)
  } finally {
    seeding.value = false
  }
}

function subscribeAll() {
  if (!orgStore.orgId) return
  taxStore.subscribe()
  accountsStore.subscribe()
}

onMounted(subscribeAll)
watch(() => orgStore.orgId, (id) => id && subscribeAll())
</script>
