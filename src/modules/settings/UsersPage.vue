<template>
  <div>
    <div class="d-flex align-center mb-6">
      <h1 class="text-h4 font-weight-bold">Users &amp; Roles</h1>
      <v-spacer />
      <v-btn
        v-if="orgStore.can('users:manage')"
        color="primary"
        prepend-icon="mdi-account-plus"
        @click="openInvite"
      >
        Invite User
      </v-btn>
    </div>

    <v-alert
      v-if="!orgStore.can('users:manage')"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      You have <strong>{{ roleLabel(orgStore.myRole || 'viewer') }}</strong> access. Only Owners and Admins can manage users.
    </v-alert>

    <!-- Members -->
    <v-card elevation="1" class="mb-4">
      <v-card-title>Team Members ({{ members.length }})</v-card-title>
      <v-data-table
        :headers="memberHeaders"
        :items="members"
        :items-per-page="-1"
        hide-default-footer
      >
        <template #item.displayName="{ item }">
          <div class="d-flex align-center">
            <v-avatar size="32" color="primary" class="mr-3">
              <span class="text-white text-body-2">{{ initials(item.displayName) }}</span>
            </v-avatar>
            <div>
              <div>{{ item.displayName || item.email }}</div>
              <div v-if="item.userId === currentUserId" class="text-caption text-grey">You</div>
            </div>
          </div>
        </template>
        <template #item.role="{ item }">
          <v-chip :color="roleColor(item.role)" size="small" variant="tonal">
            {{ roleLabel(item.role) }}
          </v-chip>
        </template>
        <template #item.joinedAt="{ item }">{{ formatDate(item.joinedAt) }}</template>
        <template #item.actions="{ item }">
          <template v-if="orgStore.can('users:manage') && item.role !== 'owner' && item.userId !== currentUserId">
            <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEditRole(item)" />
            <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmRemove(item)" />
          </template>
        </template>
      </v-data-table>
    </v-card>

    <!-- Pending Invitations -->
    <v-card v-if="orgStore.can('users:manage')" elevation="1">
      <v-card-title>Pending Invitations ({{ invitations.length }})</v-card-title>
      <v-data-table
        :headers="invHeaders"
        :items="invitations"
        :items-per-page="-1"
        hide-default-footer
      >
        <template #item.role="{ item }">
          <v-chip :color="roleColor(item.role)" size="small" variant="tonal">
            {{ roleLabel(item.role) }}
          </v-chip>
        </template>
        <template #item.createdAt="{ item }">{{ formatDate(item.createdAt) }}</template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-close" size="small" variant="text" color="error" @click="confirmCancel(item)" />
        </template>
        <template #no-data>
          <div class="text-center pa-4 text-grey">No pending invitations.</div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Invite Dialog -->
    <v-dialog v-model="inviteDialog" max-width="500" persistent>
      <v-card>
        <v-card-title>Invite User</v-card-title>
        <v-card-text>
          <v-form ref="inviteFormRef" @submit.prevent="sendInvite">
            <v-text-field
              v-model="inviteForm.email"
              label="Email Address"
              type="email"
              :rules="emailRules"
              class="mb-2"
            />
            <v-select
              v-model="inviteForm.role"
              label="Role"
              :items="roleOptions"
              item-title="label"
              item-value="value"
              :rules="[required]"
            >
              <template #item="{ item, props }">
                <v-list-item v-bind="props" :subtitle="describeRole((item as any).value)" />
              </template>
            </v-select>
            <v-alert v-if="inviteError" type="error" variant="tonal" class="mt-2">{{ inviteError }}</v-alert>
            <v-alert type="info" variant="tonal" class="mt-2" density="compact">
              The user will see the invitation when they sign in with this email.
            </v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="inviteDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="inviting" @click="sendInvite">Send Invitation</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit Role Dialog -->
    <v-dialog v-model="roleDialog" max-width="500" persistent>
      <v-card v-if="editingMember">
        <v-card-title>Edit Role</v-card-title>
        <v-card-subtitle>{{ editingMember.displayName || editingMember.email }}</v-card-subtitle>
        <v-card-text>
          <v-select
            v-model="editingRole"
            label="Role"
            :items="roleOptions.filter(r => r.value !== 'owner')"
            item-title="label"
            item-value="value"
          >
            <template #item="{ item, props }">
              <v-list-item v-bind="props" :subtitle="describeRole((item as any).value)" />
            </template>
          </v-select>
          <v-alert v-if="roleError" type="error" variant="tonal" class="mt-2">{{ roleError }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="roleDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="savingRole" @click="saveRole">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog ref="confirmRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationStore } from '@/stores/organization'
import { required, emailRules } from '@/utils/validation'
import { formatDate } from '@/utils/date'
import { roleLabel, roleColor, ALL_ROLES } from '@/utils/permissions'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { OrgMember, Invitation, UserRole } from '@/types/auth'

const authStore = useAuthStore()
const orgStore = useOrganizationStore()

const members = computed(() => orgStore.members)
const invitations = computed(() => orgStore.invitations)
const currentUserId = computed(() => authStore.user?.uid || '')

function initials(name: string): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

const memberHeaders = [
  { title: 'Member', key: 'displayName' },
  { title: 'Email', key: 'email' },
  { title: 'Role', key: 'role', width: 140 },
  { title: 'Joined', key: 'joinedAt', width: 140 },
  { title: '', key: 'actions', sortable: false, width: 100, align: 'end' as const },
]

const invHeaders = [
  { title: 'Email', key: 'email' },
  { title: 'Role', key: 'role', width: 140 },
  { title: 'Sent', key: 'createdAt', width: 140 },
  { title: '', key: 'actions', sortable: false, width: 60, align: 'end' as const },
]

const roleOptions = ALL_ROLES

function describeRole(value: UserRole): string {
  return ALL_ROLES.find((r) => r.value === value)?.description || ''
}

// Invite dialog
const inviteDialog = ref(false)
const inviteFormRef = ref()
const inviting = ref(false)
const inviteError = ref('')
const inviteForm = ref({ email: '', role: 'clerk' as UserRole })

function openInvite() {
  inviteForm.value = { email: '', role: 'clerk' }
  inviteError.value = ''
  inviteDialog.value = true
}

async function sendInvite() {
  const { valid } = await inviteFormRef.value.validate()
  if (!valid) return
  inviting.value = true
  inviteError.value = ''
  try {
    await orgStore.inviteMember(inviteForm.value.email, inviteForm.value.role)
    inviteDialog.value = false
  } catch (e: any) {
    inviteError.value = e.message
  } finally {
    inviting.value = false
  }
}

// Edit role
const roleDialog = ref(false)
const editingMember = ref<OrgMember | null>(null)
const editingRole = ref<UserRole>('clerk')
const savingRole = ref(false)
const roleError = ref('')

function openEditRole(m: OrgMember) {
  editingMember.value = m
  editingRole.value = m.role === 'owner' ? 'admin' : m.role
  roleError.value = ''
  roleDialog.value = true
}

async function saveRole() {
  if (!editingMember.value) return
  savingRole.value = true
  roleError.value = ''
  try {
    await orgStore.updateMemberRole(editingMember.value.userId, editingRole.value)
    roleDialog.value = false
  } catch (e: any) {
    roleError.value = e.message
  } finally {
    savingRole.value = false
  }
}

// Remove
const confirmRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
async function confirmRemove(m: OrgMember) {
  const ok = await confirmRef.value?.open()
  if (ok) {
    try {
      await orgStore.removeMember(m.userId)
    } catch (e: any) {
      alert(e.message)
    }
  }
}

async function confirmCancel(inv: Invitation) {
  const ok = await confirmRef.value?.open()
  if (ok) await orgStore.cancelInvitation(inv.id)
}

onMounted(() => {
  if (orgStore.orgId) {
    orgStore.subscribeMembers()
    orgStore.subscribeInvitations()
  }
})

watch(() => orgStore.orgId, (id) => {
  if (id) {
    orgStore.subscribeMembers()
    orgStore.subscribeInvitations()
  }
})
</script>
