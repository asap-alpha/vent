<template>
  <AuthLayout>
    <v-card class="pa-6" elevation="2" rounded="lg">
      <v-card-title class="text-h5 mb-4">Create Account</v-card-title>
      <v-form ref="formRef" @submit.prevent="handleRegister">
        <v-text-field
          v-model="name"
          label="Full Name"
          prepend-inner-icon="mdi-account"
          :rules="[required]"
          class="mb-2"
        />
        <v-text-field
          v-model="email"
          label="Email"
          type="email"
          prepend-inner-icon="mdi-email"
          :rules="emailRules"
          class="mb-2"
        />
        <v-text-field
          v-model="password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          prepend-inner-icon="mdi-lock"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showPassword = !showPassword"
          :rules="passwordRules"
          class="mb-2"
        />
        <v-text-field
          v-model="confirmPassword"
          label="Confirm Password"
          :type="showPassword ? 'text' : 'password'"
          prepend-inner-icon="mdi-lock-check"
          :rules="[required, matchPassword]"
          class="mb-2"
        />
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
          {{ error }}
        </v-alert>
        <v-btn type="submit" color="primary" block size="large" :loading="loading">
          Create Account
        </v-btn>
      </v-form>
      <div class="text-center mt-4">
        <span class="text-body-2">Already have an account? </span>
        <router-link :to="{ name: 'login' }" class="text-primary text-body-2">Sign In</router-link>
      </div>
    </v-card>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { required, emailRules, passwordRules } from '@/utils/validation'
import AuthLayout from '@/layouts/AuthLayout.vue'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref()
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

const matchPassword = (v: string) => v === password.value || 'Passwords do not match'

async function handleRegister() {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true
  error.value = ''
  try {
    await authStore.register(name.value, email.value, password.value)
    router.push({ name: 'dashboard' })
  } catch (e: any) {
    if (e.code === 'auth/email-already-in-use') {
      error.value = 'An account with this email already exists'
    } else if (e.code === 'auth/weak-password') {
      error.value = 'Password is too weak. Use at least 8 characters'
    } else {
      error.value = e.message
    }
  } finally {
    loading.value = false
  }
}
</script>
