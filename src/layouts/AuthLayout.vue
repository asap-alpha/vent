<template>
  <v-app>
    <v-main class="d-flex align-center justify-center bg-grey-lighten-4" style="min-height: 100vh">
      <v-container style="max-width: 480px">
        <div class="text-center mb-8">
          <v-icon size="64" color="primary">mdi-cash-register</v-icon>
          <h1 class="text-h4 font-weight-bold mt-2">Vent</h1>
          <p class="text-body-2 text-grey">Accounting made simple</p>
        </div>
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>
