import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { registerServiceWorker } from './lib/pwa.js';
import './assets/main.css';

registerServiceWorker();

createApp(App).use(createPinia()).mount('#app');
