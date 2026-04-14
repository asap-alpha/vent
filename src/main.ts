import { createApp } from 'vue'
import { createPinia } from 'pinia'
import vuetify from './plugins/vuetify'
import router from './plugins/router'
import App from './App.vue'

// Initialize Firebase (side effect import)
import './plugins/firebase'

const app = createApp(App)

app.use(createPinia())
app.use(vuetify)
app.use(router)

app.mount('#app')
