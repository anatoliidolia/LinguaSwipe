<script setup>
import { computed, ref } from 'vue';
import { installPrompt, isIos, isStandalone } from '../lib/pwa.js';
import { readStored, writeStored, STORAGE_KEYS } from '../lib/storage.js';

const installDismissed = ref(readStored(STORAGE_KEYS.installDismissed) === '1');
const showInstallBanner = computed(() =>
    !isStandalone && !installDismissed.value && (installPrompt.value !== null || isIos));

async function installApp() {
    if (!installPrompt.value) return;
    installPrompt.value.prompt();
    await installPrompt.value.userChoice;
    installPrompt.value = null;
}

// Файл з public/: шлях будуємо від BASE_URL, щоб Vite не намагався імпортувати його як модуль
const iconUrl = import.meta.env.BASE_URL + 'icons/icon-192.png';

function dismissInstall() {
    installDismissed.value = true;
    writeStored(STORAGE_KEYS.installDismissed, '1');
}
</script>

<template>
    <!-- INSTALL APP BANNER (Android: real button, iPhone: instructions) -->
    <div v-if="showInstallBanner" class="bg-indigo-950/90 border-b border-indigo-800 px-4 py-2.5 text-xs text-indigo-200 flex items-center justify-center gap-3">
        <img :src="iconUrl" alt="" class="w-7 h-7 rounded-lg">
        <span v-if="installPrompt">Встановіть LinguaSwipe як додаток на телефон</span>
        <span v-else>Щоб встановити: натисніть <i class="fa-solid fa-arrow-up-from-bracket mx-0.5"></i> «Поділитися» → «На початковий екран»</span>
        <button v-if="installPrompt" @click="installApp()" class="bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-3 py-1.5 rounded-lg whitespace-nowrap">Встановити</button>
        <button @click="dismissInstall()" title="Закрити" class="text-indigo-300 hover:text-white px-1"><i class="fa-solid fa-xmark"></i></button>
    </div>
</template>
