<script setup>
import { onMounted, provide, ref } from 'vue';
import { useAuthStore } from './stores/auth.js';
import { useUiStore } from './stores/ui.js';
import { useWordsStore } from './stores/words.js';
import InstallBanner from './components/InstallBanner.vue';
import AuthScreen from './components/AuthScreen.vue';
import AppHeader from './components/AppHeader.vue';
import StatusBanner from './components/StatusBanner.vue';
import WordSourceSwitch from './components/WordSourceSwitch.vue';
import WordFormModal from './components/WordFormModal.vue';
import BulkImportModal from './components/BulkImportModal.vue';
import PracticeView from './views/PracticeView.vue';
import DictionaryView from './views/DictionaryView.vue';
import StatsView from './views/StatsView.vue';

const auth = useAuthStore();
const ui = useUiStore();
const wordsStore = useWordsStore();

// Hidden file input for importing words into the user's collection.
// Кнопки імпорту в різних компонентах відкривають його через inject('openFilePicker').
const fileInputRef = ref(null);
provide('openFilePicker', () => fileInputRef.value && fileInputRef.value.click());

async function onFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    await wordsStore.importText(await file.text(), `Файл «${file.name}»`);
}

onMounted(() => auth.init());
</script>

<template>
    <input ref="fileInputRef" type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" class="hidden" @change="onFileSelected">

    <InstallBanner />

    <!-- LOADING (checking session) -->
    <div v-if="!auth.authReady" class="flex-1 flex items-center justify-center text-slate-500">
        <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
    </div>

    <AuthScreen v-else-if="!auth.user" />

    <template v-else>
        <AppHeader />
        <StatusBanner />
        <WordSourceSwitch />

        <main class="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col justify-center items-center">
            <PracticeView v-if="ui.currentTab === 'practice'" />
            <DictionaryView v-else-if="ui.currentTab === 'dictionary'" />
            <StatsView v-else-if="ui.currentTab === 'stats'" />
        </main>

        <WordFormModal v-if="ui.singleModalOpen" />
        <BulkImportModal v-if="ui.bulkModalOpen" />
    </template>
</template>
