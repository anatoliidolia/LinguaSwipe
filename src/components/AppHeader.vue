<script setup>
import { computed, inject } from 'vue';
import { useAuthStore } from '../stores/auth.js';
import { useUiStore } from '../stores/ui.js';
import { useWordsStore } from '../stores/words.js';

const auth = useAuthStore();
const ui = useUiStore();
const wordsStore = useWordsStore();
const openFilePicker = inject('openFilePicker');

const tabs = computed(() => [
    { id: 'practice', icon: 'fa-clone', label: 'Тренування' },
    { id: 'dictionary', icon: 'fa-book', label: 'Словник', showCount: true },
    { id: 'stats', icon: 'fa-chart-line', label: 'SRS Прогрес' },
    // Адмінка: список користувачів і словники студентів
    ...(auth.canManageUsers ? [
        { id: 'users', icon: 'fa-users', label: auth.isAdmin ? 'Користувачі' : 'Студенти' },
        { id: 'topics', icon: 'fa-layer-group', label: 'Топіки' }
    ] : [])
]);
</script>

<template>
    <!-- HEADER BAR -->
    <header class="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div class="max-w-4xl mx-auto flex items-center justify-between gap-2">

            <!-- Navigation Tabs -->
            <nav class="flex items-center gap-1 sm:gap-2 bg-slate-800/60 p-1 rounded-2xl border border-slate-700/50">
                <button
                        v-for="tab in tabs"
                        :key="tab.id"
                        @click="ui.currentTab = tab.id"
                        :class="ui.currentTab === tab.id ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                        class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5">
                    <i class="fa-solid" :class="tab.icon"></i>
                    <span class="hidden md:inline">{{ tab.label }}</span>
                    <span v-if="tab.showCount" class="bg-slate-900/50 text-slate-300 px-1.5 py-0.2 text-[10px] rounded-full font-mono">{{ wordsStore.words.length }}</span>
                </button>
            </nav>

            <!-- Quick Actions / Import / User -->
            <div class="flex items-center gap-2">
                <button
                        v-if="auth.isGuest"
                        @click="auth.goToRegister()"
                        class="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                    <i class="fa-solid fa-user-plus"></i>
                    <span class="hidden sm:inline">Створити акаунт</span>
                </button>

                <button
                        v-if="!wordsStore.readOnly"
                        @click="openFilePicker()"
                        title="Завантажити слова з файлу (CSV / TXT) у свою колекцію"
                        class="bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                    <i class="fa-solid fa-file-csv"></i>
                    <span class="hidden sm:inline">Імпорт файлу</span>
                </button>

                <button
                        v-if="!wordsStore.readOnly"
                        @click="ui.openAddModal()"
                        class="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5">
                    <i class="fa-solid fa-plus"></i>
                    <span class="hidden sm:inline">Додати слово</span>
                </button>

                <div class="flex items-center gap-1 bg-slate-800/60 border border-slate-700/50 rounded-xl pl-2.5 pr-1 py-1">
                    <i class="fa-solid text-slate-400 text-[10px]" :class="auth.isGuest ? 'fa-user-secret' : 'fa-user'"></i>
                    <span class="text-xs font-semibold text-slate-200 max-w-[90px] truncate">{{ auth.user.username }}</span>
                    <span v-if="auth.isAdmin" title="Супер-адмін: може видаляти слова в загальному словнику"
                          class="text-[9px] font-bold uppercase text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md">Адмін</span>
                    <span v-else-if="auth.isTeacher" title="Викладач: редагує словники своїх студентів"
                          class="text-[9px] font-bold uppercase text-violet-300 bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.5 rounded-md">Викладач</span>
                    <button @click="auth.logout()" title="Вийти"
                            class="text-slate-400 hover:text-rose-400 text-xs px-1.5 py-0.5 rounded-lg hover:bg-slate-700 transition-all">
                        <i class="fa-solid fa-right-from-bracket"></i>
                    </button>
                </div>
            </div>
        </div>
    </header>
</template>
