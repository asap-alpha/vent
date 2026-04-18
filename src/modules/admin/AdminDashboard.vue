<template>
  <div>
    <PageHeader title="Super Admin" subtitle="Platform-wide overview of all organizations and users" />

    <!-- Stats -->
    <v-row class="mb-4">
      <v-col cols="12" md="3">
        <v-card class="kpi-card kpi-blue">
          <v-card-text class="pa-4">
            <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Organizations</div>
            <div class="text-h4 font-weight-bold mt-1">{{ adminStore.organizations.length }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="kpi-card kpi-green">
          <v-card-text class="pa-4">
            <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Users</div>
            <div class="text-h4 font-weight-bold mt-1">{{ adminStore.users.length }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="kpi-card kpi-orange">
          <v-card-text class="pa-4">
            <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Super Admins</div>
            <div class="text-h4 font-weight-bold mt-1">
              {{ adminStore.users.filter(u => u.platformRole === 'super_admin').length }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="pa-4">
            <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Total Members</div>
            <div class="text-h4 font-weight-bold mt-1">
              {{ adminStore.organizations.reduce((s, o) => s + o.memberCount, 0) }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-tabs v-model="tab" color="primary" class="mb-4">
      <v-tab value="pending">
        Pending Review
        <v-badge v-if="pendingOrgs.length > 0" :content="pendingOrgs.length" color="error" class="ml-2" />
      </v-tab>
      <v-tab value="orgs">All Organizations</v-tab>
      <v-tab value="users">Users</v-tab>
    </v-tabs>

    <!-- Pending Review Tab -->
    <v-card v-if="tab === 'pending'">
      <v-data-table
        :headers="pendingHeaders"
        :items="pendingOrgs"
        :items-per-page="25"
        :loading="adminStore.loading"
      >
        <template #item.createdAt="{ item }">{{ formatDate(item.createdAt) }}</template>
        <template #item.createdBy="{ item }">{{ getUserEmail(item.createdBy) }}</template>
        <template #item.actions="{ item }">
          <v-btn
            size="small"
            color="success"
            variant="flat"
            prepend-icon="mdi-check"
            class="mr-2"
            @click="approveOrg(item.id)"
          >Approve</v-btn>
          <v-btn
            size="small"
            color="error"
            variant="outlined"
            prepend-icon="mdi-close"
            @click="openRejectDialog(item)"
          >Reject</v-btn>
        </template>
        <template #no-data>
          <div class="text-center pa-8 text-medium-emphasis">
            <v-icon size="48" class="mb-2" style="opacity: 0.3">mdi-check-circle-outline</v-icon>
            <div>No pending organizations. All caught up.</div>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Organizations Tab -->
    <v-card v-if="tab === 'orgs'">
      <div class="d-flex align-center flex-wrap ga-2 pa-4 pb-0">
        <v-spacer />
        <v-text-field
          v-model="orgSearch"
          placeholder="Search organizations..."
          prepend-inner-icon="mdi-magnify"
          hide-details
          density="compact"
          style="max-width: 280px"
        />
      </div>
      <v-data-table
        :headers="orgHeaders"
        :items="adminStore.organizations"
        :search="orgSearch"
        :items-per-page="25"
        :loading="adminStore.loading"
        @click:row="onOrgClick"
      >
        <template #item.status="{ item }">
          <v-chip :color="orgStatusColor(item.status)" size="x-small">
            {{ item.status || 'approved' }}
          </v-chip>
        </template>
        <template #item.createdAt="{ item }">{{ formatDate(item.createdAt) }}</template>
        <template #item.createdBy="{ item }">
          {{ getUserEmail(item.createdBy) }}
        </template>
        <template #item.actions="{ item }">
          <v-btn v-if="item.status === 'pending'" icon="mdi-check" size="x-small" variant="text" color="success" title="Approve" @click.stop="approveOrg(item.id)" />
          <v-btn v-if="item.status === 'approved'" icon="mdi-pause-circle-outline" size="x-small" variant="text" color="warning" title="Suspend" @click.stop="suspendOrg(item.id)" />
          <v-btn v-if="item.status === 'suspended'" icon="mdi-play-circle-outline" size="x-small" variant="text" color="success" title="Re-activate" @click.stop="approveOrg(item.id)" />
          <v-btn icon="mdi-eye" size="x-small" variant="text" @click.stop="viewOrg(item)" />
          <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click.stop="confirmDeleteOrg(item)" />
        </template>
      </v-data-table>
    </v-card>

    <!-- Users Tab -->
    <v-card v-if="tab === 'users'">
      <div class="d-flex align-center flex-wrap ga-2 pa-4 pb-0">
        <v-spacer />
        <v-text-field
          v-model="userSearch"
          placeholder="Search users..."
          prepend-inner-icon="mdi-magnify"
          hide-details
          density="compact"
          style="max-width: 280px"
        />
      </div>
      <v-data-table
        :headers="userHeaders"
        :items="adminStore.users"
        :search="userSearch"
        :items-per-page="25"
        :loading="adminStore.loading"
      >
        <template #item.displayName="{ item }">
          <div class="d-flex align-center">
            <v-avatar size="28" color="primary" class="mr-2">
              <span class="text-white text-caption">{{ initials(item.displayName) }}</span>
            </v-avatar>
            {{ item.displayName || '—' }}
          </div>
        </template>
        <template #item.platformRole="{ item }">
          <v-chip
            :color="item.platformRole === 'super_admin' ? 'error' : 'grey'"
            size="x-small"
          >
            {{ item.platformRole === 'super_admin' ? 'Super Admin' : 'User' }}
          </v-chip>
        </template>
        <template #item.orgCount="{ item }">{{ item.orgCount }}</template>
        <template #item.createdAt="{ item }">{{ formatDate(item.createdAt) }}</template>
      </v-data-table>
    </v-card>

    <!-- Org Detail Dialog -->
    <v-dialog v-model="orgDetailDialog" max-width="800">
      <v-card v-if="adminStore.selectedOrg">
        <v-card-title class="d-flex align-center">
          {{ adminStore.selectedOrg.name }}
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" @click="orgDetailDialog = false" />
        </v-card-title>
        <v-card-text>
          <!-- Org info -->
          <v-row class="mb-4">
            <v-col cols="6" md="3">
              <div class="text-caption text-medium-emphasis">Currency</div>
              <div class="font-weight-medium">{{ adminStore.selectedOrg.currency }}</div>
            </v-col>
            <v-col cols="6" md="3">
              <div class="text-caption text-medium-emphasis">Fiscal Year</div>
              <div class="font-weight-medium">Starts month {{ adminStore.selectedOrg.fiscalYearStart }}</div>
            </v-col>
            <v-col cols="6" md="3">
              <div class="text-caption text-medium-emphasis">Members</div>
              <div class="font-weight-medium">{{ adminStore.selectedOrg.memberCount }}</div>
            </v-col>
            <v-col cols="6" md="3">
              <div class="text-caption text-medium-emphasis">Created</div>
              <div class="font-weight-medium">{{ formatDate(adminStore.selectedOrg.createdAt) }}</div>
            </v-col>
          </v-row>

          <!-- Members -->
          <div class="text-subtitle-2 font-weight-bold mb-2">Members</div>
          <v-table density="compact" class="mb-4">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in adminStore.selectedOrgMembers" :key="m.userId">
                <td>{{ m.displayName || '—' }}</td>
                <td>{{ m.email }}</td>
                <td>
                  <v-chip :color="roleColor(m.role)" size="x-small">{{ roleLabel(m.role) }}</v-chip>
                </td>
                <td>{{ formatDate(m.joinedAt) }}</td>
              </tr>
            </tbody>
          </v-table>

          <!-- Collection counts -->
          <div class="text-subtitle-2 font-weight-bold mb-2">Data Counts</div>
          <v-row>
            <v-col
              v-for="(count, name) in adminStore.selectedOrg.collections"
              :key="name"
              cols="6"
              md="3"
            >
              <div class="d-flex align-center justify-space-between pa-2 rounded" style="background: rgb(var(--v-theme-surface-variant))">
                <span class="text-caption">{{ name }}</span>
                <span class="font-weight-bold">{{ count === -1 ? '?' : count }}</span>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Reject Dialog -->
    <v-dialog v-model="rejectDialog" max-width="480">
      <v-card v-if="rejectingOrg">
        <v-card-title>Reject Organization</v-card-title>
        <v-card-subtitle>{{ rejectingOrg.name }}</v-card-subtitle>
        <v-card-text>
          <v-textarea
            v-model="rejectReason"
            label="Reason for rejection (visible to the org creator)"
            rows="3"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="rejectDialog = false">Cancel</v-btn>
          <v-btn color="error" :loading="rejecting" @click="doReject">Reject</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog ref="confirmRef" title="Delete Organization" message="This will permanently delete this organization and all its data. This cannot be undone." confirm-text="Delete" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAdminStore, type AdminOrg } from '@/stores/admin'
import { formatDate } from '@/utils/date'
import { roleLabel, roleColor } from '@/utils/permissions'
import PageHeader from '@/components/common/PageHeader.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const adminStore = useAdminStore()

const tab = ref('pending')
const orgSearch = ref('')
const userSearch = ref('')
const orgDetailDialog = ref(false)

const pendingOrgs = computed(() =>
  adminStore.organizations.filter((o) => (o as any).status === 'pending')
)

const pendingHeaders = [
  { title: 'Name', key: 'name' },
  { title: 'Currency', key: 'currency', width: 100 },
  { title: 'Created By', key: 'createdBy', width: 200 },
  { title: 'Submitted', key: 'createdAt', width: 130 },
  { title: '', key: 'actions', sortable: false, width: 220, align: 'end' as const },
]

const orgHeaders = [
  { title: 'Name', key: 'name' },
  { title: 'Status', key: 'status', width: 120 },
  { title: 'Currency', key: 'currency', width: 100 },
  { title: 'Members', key: 'memberCount', align: 'end' as const, width: 100 },
  { title: 'Created By', key: 'createdBy', width: 200 },
  { title: 'Created', key: 'createdAt', width: 130 },
  { title: '', key: 'actions', sortable: false, width: 180, align: 'end' as const },
]

const userHeaders = [
  { title: 'Name', key: 'displayName' },
  { title: 'Email', key: 'email' },
  { title: 'Role', key: 'platformRole', width: 130 },
  { title: 'Orgs', key: 'orgCount', align: 'end' as const, width: 80 },
  { title: 'Joined', key: 'createdAt', width: 130 },
]

function initials(name: string): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function getUserEmail(uid: string): string {
  return adminStore.users.find((u) => u.uid === uid)?.email || uid.slice(0, 8) + '...'
}

function onOrgClick(_: any, row: { item: AdminOrg }) {
  viewOrg(row.item)
}

async function viewOrg(org: AdminOrg) {
  await adminStore.fetchOrgDetails(org.id)
  orgDetailDialog.value = true
}

// Approve / Suspend
async function approveOrg(orgId: string) {
  await adminStore.updateOrgStatus(orgId, 'approved')
}

async function suspendOrg(orgId: string) {
  await adminStore.updateOrgStatus(orgId, 'suspended')
}

// Reject
const rejectDialog = ref(false)
const rejectingOrg = ref<AdminOrg | null>(null)
const rejectReason = ref('')
const rejecting = ref(false)

function openRejectDialog(org: AdminOrg) {
  rejectingOrg.value = org
  rejectReason.value = ''
  rejectDialog.value = true
}

async function doReject() {
  if (!rejectingOrg.value) return
  rejecting.value = true
  try {
    await adminStore.updateOrgStatus(rejectingOrg.value.id, 'rejected', rejectReason.value)
    rejectDialog.value = false
  } finally {
    rejecting.value = false
  }
}

function orgStatusColor(status: string): string {
  return { pending: 'warning', approved: 'success', rejected: 'error', suspended: 'grey' }[status] || 'grey'
}

const confirmRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
async function confirmDeleteOrg(org: AdminOrg) {
  const ok = await confirmRef.value?.open()
  if (ok) await adminStore.deleteOrganization(org.id)
}

onMounted(() => {
  adminStore.fetchAllOrganizations()
  adminStore.fetchAllUsers()
})
</script>

<style scoped>
.kpi-card { border-left: 4px solid transparent !important; }
.kpi-blue { border-left-color: #2563EB !important; }
.kpi-green { border-left-color: #16A34A !important; }
.kpi-orange { border-left-color: #D97706 !important; }
</style>
