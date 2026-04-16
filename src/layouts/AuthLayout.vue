<template>
  <v-app>
    <v-main class="auth-layout">
      <!-- Branding panel (desktop only) -->
      <div class="auth-brand d-none d-md-flex">
        <div class="auth-brand-content">
          <div class="auth-logo mb-6">
            <v-icon size="48" color="white">mdi-finance</v-icon>
          </div>
          <h1 class="text-h3 font-weight-bold text-white mb-3">Vent</h1>
          <p class="text-h6 font-weight-light text-white" style="opacity: 0.85">
            Professional accounting<br/>made simple.
          </p>
          <div class="auth-features mt-10">
            <div v-for="f in features" :key="f" class="d-flex align-center mb-3">
              <v-icon size="20" color="white" class="mr-3" style="opacity: 0.9">mdi-check-circle</v-icon>
              <span class="text-body-1 text-white" style="opacity: 0.85">{{ f }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Form panel -->
      <div class="auth-form">
        <div class="auth-form-inner">
          <!-- Mobile logo -->
          <div class="d-md-none text-center mb-8">
            <v-icon size="40" color="primary">mdi-finance</v-icon>
            <h1 class="text-h5 font-weight-bold mt-2">Vent</h1>
            <p class="text-body-2 text-medium-emphasis">Professional accounting made simple</p>
          </div>
          <slot />
        </div>
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
const features = [
  'Double-entry accounting',
  'Invoicing & bill management',
  'Multi-user with role-based access',
  'Real-time bank reconciliation',
  'Financial reports & PDF export',
]
</script>

<style scoped>
.auth-layout {
  display: flex;
  min-height: 100vh;
}

.auth-brand {
  flex: 0 0 420px;
  background: linear-gradient(135deg, #1E40AF 0%, #2563EB 50%, #3B82F6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  position: relative;
  overflow: hidden;
}

.auth-brand::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -30%;
  width: 80%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%);
  border-radius: 50%;
}

.auth-brand-content {
  position: relative;
  z-index: 1;
}

.auth-logo {
  width: 72px;
  height: 72px;
  background: rgba(255,255,255,0.15);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-form {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: rgb(var(--v-theme-background));
}

.auth-form-inner {
  width: 100%;
  max-width: 440px;
}

@media (max-width: 960px) {
  .auth-form {
    padding: 24px 16px;
  }
}
</style>
