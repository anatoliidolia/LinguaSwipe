<script setup>
import { onMounted, provide, ref, watch } from 'vue';
import { useAuthStore } from './stores/auth.js';
import { useUiStore } from './stores/ui.js';
import { useWordsStore } from './stores/words.js';
import { useStudentsStore } from './stores/students.js';
import { useTopicsStore } from './stores/topics.js';
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
import UsersView from './views/UsersView.vue';
import TopicsView from './views/TopicsView.vue';
import TopicPicker from './components/TopicPicker.vue';

const auth = useAuthStore();
const ui = useUiStore();
const wordsStore = useWordsStore();
const studentsStore = useStudentsStore();
const topicsStore = useTopicsStore();

// Вкладки керування (не тренування): без перемикача словника
const MANAGE_TABS = ['users', 'topics'];

// Hidden file input for importing words into the user's collection.
// Кнопки імпорту в різних компонентах відкривають його через inject('openFilePicker'):
// openFilePicker() — у свій словник, openFilePicker('student') — у словник відкритого студента,
// openFilePicker('topic') — у топік, відкритий у вкладці «Топіки».
const fileInputRef = ref(null);
let fileTarget = 'own';
provide('openFilePicker', (target = 'own') => {
    fileTarget = target;
    if (fileInputRef.value) fileInputRef.value.click();
});

async function onFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const target = fileTarget === 'student' && studentsStore.student ? studentsStore
        : fileTarget === 'topic' && topicsStore.topic ? topicsStore
        : wordsStore;
    await target.importText(await file.text(), `Файл «${file.name}»`);
}

// Роль могли забрати (перемикання словника перечитує її) — не лишати користувача на закритій вкладці
watch(() => auth.canManageUsers, can => {
    if (!can && MANAGE_TABS.includes(ui.currentTab)) ui.currentTab = 'practice';
});

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
        <WordSourceSwitch v-if="!MANAGE_TABS.includes(ui.currentTab)" />

        <main class="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col justify-center items-center">
            <UsersView v-if="ui.currentTab === 'users' && auth.canManageUsers" />
            <TopicsView v-else-if="ui.currentTab === 'topics' && auth.canManageUsers" />
            <!-- «Мої топіки» / «Публічні топіки»: спершу вибір топіку, потім звичайні вкладки з його словами -->
            <TopicPicker v-else-if="wordsStore.isTopicSource && !wordsStore.selectedTopic" />
            <PracticeView v-else-if="ui.currentTab === 'practice'" />
            <DictionaryView v-else-if="ui.currentTab === 'dictionary'" />
            <StatsView v-else-if="ui.currentTab === 'stats'" />
        </main>

        <WordFormModal v-if="ui.singleModalOpen" />
        <BulkImportModal v-if="ui.bulkModalOpen" />
    </template>
</template>
