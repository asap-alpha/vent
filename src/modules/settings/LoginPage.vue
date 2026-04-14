<template>
  <AuthLayout>
    <v-card class="pa-6" elevation="2" rounded="lg">
      <v-card-title class="text-h5 mb-4">Sign In</v-card-title>
      <v-form ref="formRef" @submit.prevent="handleLogin">
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
          :rules="[required]"
          class="mb-2"
        />
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
          {{ error }}
        </v-alert>
        <v-btn type="submit" color="primary" block size="large" :loading="loading">
          Sign In
        </v-btn>
      </v-form>
      <div class="text-center mt-4">
        <span class="text-body-2">Don't have an account? </span>
        <router-link :to="{ name: 'register' }" class="text-primary text-body-2">Register</router-link>
      </div>
    </v-card>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { required, emailRules } from '@/utils/validation'
import AuthLayout from '@/layouts/AuthLayout.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  loading.value = true
  error.value = ''
  try {
    await authStore.login(email.value, password.value)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (e: any) {
    error.value = e.code === 'auth/invalid-credential'
      ? 'Invalid email or password'
      : e.message
  } finally {
    loading.value = false
  }
}
</script>
