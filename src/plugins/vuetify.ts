import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

export default createVuetify({
  theme: {
    defaultTheme: 'ventLight',
    themes: {
      ventLight: {
        dark: false,
        colors: {
          primary: '#2563EB',
          'primary-darken-1': '#1D4ED8',
          'primary-lighten-1': '#3B82F6',
          secondary: '#64748B',
          accent: '#0EA5E9',
          success: '#16A34A',
          warning: '#D97706',
          error: '#DC2626',
          info: '#0EA5E9',
          background: '#F8FAFC',
          surface: '#FFFFFF',
          'on-background': '#0F172A',
          'on-surface': '#0F172A',
          'surface-variant': '#EDF2F7',
        },
        variables: {
          'border-color': '#E2E8F0',
          'border-opacity': 1,
          'high-emphasis-opacity': 0.87,
          'medium-emphasis-opacity': 0.6,
          'disabled-opacity': 0.38,
        },
      },
      ventDark: {
        dark: true,
        colors: {
          primary: '#3B82F6',
          'primary-darken-1': '#2563EB',
          'primary-lighten-1': '#60A5FA',
          secondary: '#94A3B8',
          accent: '#38BDF8',
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#38BDF8',
          background: '#0F172A',
          surface: '#1E293B',
          'on-background': '#E2E8F0',
          'on-surface': '#E2E8F0',
          'surface-variant': '#334155',
        },
      },
    },
  },
  defaults: {
    global: {
      style: { fontFamily: "'Inter', sans-serif" },
    },
    VApp: {
      style: { fontFamily: "'Inter', sans-serif" },
    },
    VCard: {
      rounded: 'lg',
      elevation: 0,
      border: true,
    },
    VBtn: {
      variant: 'flat',
      rounded: 'lg',
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
      rounded: 'lg',
      hideDetails: 'auto',
    },
    VTextarea: {
      variant: 'outlined',
      density: 'comfortable',
      rounded: 'lg',
      hideDetails: 'auto',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
      rounded: 'lg',
      hideDetails: 'auto',
    },
    VFileInput: {
      variant: 'outlined',
      density: 'comfortable',
      rounded: 'lg',
    },
    VDataTable: {
      hover: true,
      density: 'comfortable',
    },
    VChip: {
      rounded: 'lg',
      size: 'small',
      variant: 'tonal',
    },
    VAlert: {
      rounded: 'lg',
      variant: 'tonal',
      border: 'start',
    },
    VDialog: {
      maxWidth: 600,
    },
    VListItem: {
      rounded: 'lg',
    },
    VTab: {
      rounded: 'lg',
    },
    VSwitch: {
      color: 'primary',
      hideDetails: 'auto',
    },
  },
})
