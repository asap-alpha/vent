<template>
  <v-app>
    <!-- Navbar -->
    <header class="landing-nav">
      <div class="landing-container d-flex align-center" style="height: 64px">
        <div class="d-flex align-center">
          <v-icon color="primary" size="28" class="mr-2">mdi-finance</v-icon>
          <span class="text-h6 font-weight-bold">Vent</span>
        </div>
        <v-spacer />
        <v-btn variant="text" class="text-none mr-2" :to="{ name: 'login' }">Sign In</v-btn>
        <v-btn color="primary" class="text-none" :to="{ name: 'register' }">Get Started</v-btn>
      </div>
    </header>

    <!-- Hero -->
    <section class="hero-section">
      <div class="landing-container">
        <v-row align="center">
          <v-col cols="12" md="6">
            <div class="hero-badge mb-4">
              <v-chip color="primary" variant="tonal" size="small" prepend-icon="mdi-sparkles">
                Professional Accounting Software
              </v-chip>
            </div>
            <h1 class="hero-title">
              Accounting<br/>made <span class="text-primary">simple.</span>
            </h1>
            <p class="hero-subtitle">
              Manage invoices, track expenses, reconcile bank accounts, and generate financial reports — all in one place. Built for small businesses and growing teams.
            </p>
            <div class="d-flex flex-wrap ga-3 mt-6">
              <v-btn color="primary" size="large" class="text-none" :to="{ name: 'register' }" rounded="lg">
                Start Free
                <v-icon end>mdi-arrow-right</v-icon>
              </v-btn>
              <v-btn variant="outlined" size="large" class="text-none" href="#features" rounded="lg">
                See Features
              </v-btn>
            </div>
          </v-col>
          <v-col cols="12" md="6" class="d-none d-md-block">
            <div class="hero-visual">
              <v-card class="hero-card card-1" elevation="8">
                <v-card-text class="pa-4">
                  <div class="text-caption text-medium-emphasis">Revenue (MTD)</div>
                  <div class="text-h5 font-weight-bold text-success">GHS 48,250.00</div>
                </v-card-text>
              </v-card>
              <v-card class="hero-card card-2" elevation="6">
                <v-card-text class="pa-4">
                  <div class="text-caption text-medium-emphasis">INV-0042</div>
                  <div class="text-body-2 font-weight-medium">Mustapha Abdallah</div>
                  <div class="d-flex align-center mt-1">
                    <span class="text-body-2 font-weight-bold">GHS 21,780.00</span>
                    <v-spacer />
                    <v-chip color="success" size="x-small">Paid</v-chip>
                  </div>
                </v-card-text>
              </v-card>
              <v-card class="hero-card card-3" elevation="4">
                <v-card-text class="pa-4">
                  <div class="text-caption text-medium-emphasis">Balance Sheet</div>
                  <div class="text-body-2 mt-1">Assets = Liabilities + Equity</div>
                  <v-chip color="success" size="x-small" class="mt-1">Balanced</v-chip>
                </v-card-text>
              </v-card>
            </div>
          </v-col>
        </v-row>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="features-section">
      <div class="landing-container">
        <div class="text-center mb-10">
          <h2 class="text-h4 font-weight-bold mb-2">Everything you need</h2>
          <p class="text-body-1 text-medium-emphasis" style="max-width: 560px; margin: 0 auto">
            From invoicing to financial reporting, Vent covers the full accounting workflow for your business.
          </p>
        </div>

        <v-row>
          <v-col v-for="feature in features" :key="feature.title" cols="12" md="4">
            <v-card class="pa-5 h-100" variant="flat" style="background: transparent">
              <div class="feature-icon mb-3">
                <v-icon :icon="feature.icon" size="28" color="primary" />
              </div>
              <h3 class="text-subtitle-1 font-weight-bold mb-2">{{ feature.title }}</h3>
              <p class="text-body-2 text-medium-emphasis">{{ feature.description }}</p>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </section>

    <!-- How it works -->
    <section class="how-section">
      <div class="landing-container">
        <div class="text-center mb-10">
          <h2 class="text-h4 font-weight-bold mb-2">Get started in minutes</h2>
        </div>
        <v-row justify="center">
          <v-col v-for="(step, i) in steps" :key="i" cols="12" md="3">
            <div class="text-center">
              <v-avatar color="primary" size="48" class="mb-3">
                <span class="text-h6 font-weight-bold text-white">{{ i + 1 }}</span>
              </v-avatar>
              <h4 class="text-subtitle-1 font-weight-bold mb-1">{{ step.title }}</h4>
              <p class="text-body-2 text-medium-emphasis">{{ step.description }}</p>
            </div>
          </v-col>
        </v-row>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta-section">
      <div class="landing-container text-center">
        <h2 class="text-h4 font-weight-bold text-white mb-3">Ready to simplify your accounting?</h2>
        <p class="text-body-1 text-white mb-6" style="opacity: 0.85">
          Join businesses already using Vent to manage their finances.
        </p>
        <v-btn size="large" color="white" class="text-none text-primary" :to="{ name: 'register' }" rounded="lg">
          Create Free Account
          <v-icon end>mdi-arrow-right</v-icon>
        </v-btn>
      </div>
    </section>

    <!-- Footer -->
    <footer class="landing-footer">
      <div class="landing-container d-flex align-center flex-wrap" style="min-height: 64px">
        <div class="d-flex align-center">
          <v-icon color="primary" size="20" class="mr-2">mdi-finance</v-icon>
          <span class="text-body-2 font-weight-medium">Vent Accounting</span>
        </div>
        <v-spacer />
        <span class="text-caption text-medium-emphasis">&copy; {{ year }} Vent. All rights reserved.</span>
      </div>
    </footer>
  </v-app>
</template>

<script setup lang="ts">
const year = new Date().getFullYear()

const features = [
  {
    icon: 'mdi-receipt-text-outline',
    title: 'Invoicing & Billing',
    description: 'Create professional invoices, track payments, manage quotes, and send receipts — with PDF export and email delivery.',
  },
  {
    icon: 'mdi-book-open-page-variant-outline',
    title: 'Double-Entry Accounting',
    description: 'Full chart of accounts, journal entries, and general ledger with automatic debit/credit balance validation.',
  },
  {
    icon: 'mdi-bank-outline',
    title: 'Bank Reconciliation',
    description: 'Connect your bank accounts, import CSV statements, and reconcile transactions to keep your books accurate.',
  },
  {
    icon: 'mdi-chart-box-outline',
    title: 'Financial Reports',
    description: 'Profit & Loss, Balance Sheet, Trial Balance, and Aging Reports — with date range filters and print support.',
  },
  {
    icon: 'mdi-account-group-outline',
    title: 'Multi-User & Roles',
    description: 'Invite your team with role-based access — Owner, Admin, Accountant, Clerk, or Viewer. Each role sees only what they need.',
  },
  {
    icon: 'mdi-office-building-outline',
    title: 'Multi-Organization',
    description: 'Manage multiple businesses from one account. Switch between organizations instantly with fully isolated data.',
  },
]

const steps = [
  { title: 'Sign Up', description: 'Create your account with email or Google in seconds.' },
  { title: 'Set Up Your Org', description: 'Name your organization, pick your currency and fiscal year.' },
  { title: 'Add Your Data', description: 'Seed default accounts, add customers, and create your first invoice.' },
  { title: 'Track & Report', description: 'Monitor cash flow, reconcile banks, and generate reports.' },
]
</script>

<style scoped>
.landing-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.landing-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.hero-section {
  padding: 120px 0 80px;
  background: linear-gradient(180deg, #F8FAFC 0%, #EFF6FF 100%);
}

.hero-title {
  font-size: 3.2rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #0F172A;
}

.hero-subtitle {
  font-size: 1.15rem;
  line-height: 1.7;
  color: #64748B;
  max-width: 480px;
  margin-top: 16px;
}

.hero-visual {
  position: relative;
  height: 380px;
}

.hero-card {
  position: absolute;
  border-radius: 16px !important;
  border: none !important;
}

.card-1 {
  top: 20px;
  left: 40px;
  width: 260px;
  transform: rotate(-3deg);
}

.card-2 {
  top: 100px;
  right: 20px;
  width: 280px;
  transform: rotate(2deg);
}

.card-3 {
  bottom: 20px;
  left: 60px;
  width: 240px;
  transform: rotate(-1deg);
}

.features-section {
  padding: 80px 0;
  background: #FFFFFF;
}

.feature-icon {
  width: 48px;
  height: 48px;
  background: #EFF6FF;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.how-section {
  padding: 80px 0;
  background: #F8FAFC;
}

.cta-section {
  padding: 80px 0;
  background: linear-gradient(135deg, #1E40AF 0%, #2563EB 50%, #3B82F6 100%);
}

.landing-footer {
  padding: 0 0;
  background: #FFFFFF;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

@media (max-width: 960px) {
  .hero-title {
    font-size: 2.2rem;
  }
  .hero-section {
    padding: 100px 0 60px;
  }
}
</style>
