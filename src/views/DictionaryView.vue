<script setup>
import { computed, inject, ref } from 'vue';
import { useUiStore } from '../stores/ui.js';
import { useWordsStore } from '../stores/words.js';

const ui = useUiStore();
const wordsStore = useWordsStore();
const openFilePicker = inject('openFilePicker');

const searchQuery = ref('');
const filteredWords = computed(() => {
    const q = searchQuery.value.toLowerCase();
    return wordsStore.words.filter(w => w.word.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q));
});
</script>

<template>
    <!-- DICTIONARY & VOCABULARY MANAGEMENT -->
    <div class="w-full flex-1 flex flex-col my-2">

        <!-- Controls & Search Bar -->
        <div class="glass-card p-4 rounded-2xl mb-4 border border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-center">

            <div class="relative w-full sm:w-80">
                <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Пошук слова або перекладу..."
                        class="w-full bg-slate-900/90 border border-slate-700/80 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-sky-500 transition-all">
            </div>

            <p v-if="wordsStore.canModerate" class="text-xs text-amber-300 w-full sm:w-auto text-center sm:text-right">
                <i class="fa-solid fa-shield-halved mr-1"></i>Загальний словник · модерація: видалення прибирає слово в усіх користувачів
            </p>
            <p v-else-if="wordsStore.readOnly" class="text-xs text-slate-400 w-full sm:w-auto text-center sm:text-right">
                <i class="fa-solid fa-globe text-sky-400 mr-1"></i>Загальний словник · лише перегляд
            </p>
            <div v-else class="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                        @click="openFilePicker()"
                        class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5">
                    <i class="fa-solid fa-file-arrow-up"></i>
                    <span>Завантажити файл</span>
                </button>

                <button
                        @click="ui.openAddModal()"
                        class="px-3 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5">
                    <i class="fa-solid fa-plus"></i>
                    <span>Одне слово</span>
                </button>

                <button
                        @click="ui.openBulkModal()"
                        class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5">
                    <i class="fa-solid fa-file-import"></i>
                    <span>Вставити текст</span>
                </button>
            </div>
        </div>

        <!-- Dictionary List -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
            <div
                    v-for="item in filteredWords"
                    :key="item.id"
                    class="glass-card p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between">

                <div class="flex-1 pr-3">
                    <h3 class="font-extrabold text-base text-white mb-0.5">
                        {{ item.word }}
                        <span v-if="item.transcription" class="font-normal text-sm text-slate-400 ml-1">[{{ item.transcription }}]</span>
                    </h3>
                    <p class="text-emerald-400 font-semibold text-sm">{{ item.translation }}</p>
                </div>

                <div class="flex items-center gap-2.5">
                    <span class="text-[10px] font-mono font-bold px-2 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                        Box {{ item.box }}
                    </span>
                    <button v-if="!wordsStore.readOnly" @click="ui.editWord(item)" class="text-slate-400 hover:text-sky-400 text-xs p-1.5 rounded-lg hover:bg-slate-800 transition-all">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button v-if="!wordsStore.readOnly" @click="wordsStore.deleteWord(item.id)" class="text-slate-400 hover:text-rose-400 text-xs p-1.5 rounded-lg hover:bg-slate-800 transition-all">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    <button v-else-if="wordsStore.canModerate" @click="wordsStore.adminDeleteWord(item)" title="Видалити в усіх користувачів"
                            class="text-amber-400/80 hover:text-rose-400 text-xs p-1.5 rounded-lg hover:bg-slate-800 transition-all">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>

            <div v-if="filteredWords.length === 0" class="col-span-full text-center py-12 text-slate-500">
                <i class="fa-solid fa-book-open text-3xl mb-2 block"></i>
                <p>Слів не знайдено за вашим запитом.</p>
            </div>
        </div>
    </div>
</template>
