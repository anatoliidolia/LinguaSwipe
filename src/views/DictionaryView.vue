<script setup>
import { inject } from 'vue';
import { useUiStore } from '../stores/ui.js';
import { useWordsStore } from '../stores/words.js';
import WordList from '../components/WordList.vue';

const ui = useUiStore();
const wordsStore = useWordsStore();
const openFilePicker = inject('openFilePicker');
</script>

<template>
    <!-- DICTIONARY & VOCABULARY MANAGEMENT -->
    <div class="w-full flex-1 flex flex-col my-2">
        <WordList :words="wordsStore.words">
            <template #toolbar>
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
            </template>

            <template #actions="{ item }">
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
            </template>
        </WordList>
    </div>
</template>
