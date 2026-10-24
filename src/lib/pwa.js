import { ref } from 'vue';

export function registerServiceWorker() {
    // У dev-режимі SW не потрібен: він кешував би файли Vite і заважав гарячому оновленню
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// Android/Chrome fires this when the app can be installed; keep it for our own button.
// Слухач стоїть на рівні модуля, бо подія може прийти ще до монтування компонентів.
export const installPrompt = ref(null);
window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt.value = e;
});
window.addEventListener('appinstalled', () => { installPrompt.value = null; });

export const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
