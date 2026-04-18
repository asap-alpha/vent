<template>
  <div>
    <v-card class="pa-6" rounded="lg">
      <div class="text-h6 font-weight-bold mb-1">Create Account</div>
      <p class="text-body-2 text-medium-emphasis mb-5">Get started with your free account.</p>

      <!-- Google Sign Up -->
      <v-btn
        block
        size="large"
        variant="outlined"
        class="mb-4 text-none"
        :loading="googleLoading"
        @click="handleGoogleSignup"
      >
        <template #prepend>
          <svg width="20" height="20" viewBox="0 0 48 48" class="mr-2">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
        </template>
        Sign up with Google
      </v-btn>

      <div class="d-flex align-center mb-4">
        <v-divider />
        <span class="mx-4 text-caption text-grey">or</span>
        <v-divider />
      </div>

      <!-- Email/Password -->
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { required, emailRules, passwordRules } from '@/utils/validation'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref()
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const loading = ref(false)
const googleLoading = ref(false)
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

async function handleGoogleSignup() {
  googleLoading.value = true
  error.value = ''
  try {
    await authStore.loginWithGoogle()
    if (authStore.user) {
      router.push({ name: 'dashboard' })
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    googleLoading.value = false
  }
}
</script>
