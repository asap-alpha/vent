import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

export default createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1565C0',
          secondary: '#424242',
          accent: '#2196F3',
          success: '#4CAF50',
          warning: '#FB8C00',
          error: '#E53935',
          info: '#2196F3',
          background: '#F5F5F5',
          surface: '#FFFFFF',
        },
      },
      dark: {
        colors: {
          primary: '#42A5F5',
          secondary: '#616161',
          accent: '#64B5F6',
          success: '#66BB6A',
          warning: '#FFA726',
          error: '#EF5350',
          info: '#42A5F5',
          background: '#121212',
          surface: '#1E1E1E',
        },
      },
    },
  },
  defaults: {
    VBtn: { variant: 'flat' },
    VTextField: { variant: 'outlined', density: 'comfortable' },
    VSelect: { variant: 'outlined', density: 'comfortable' },
    VDataTable: { hover: true },
  },
})
