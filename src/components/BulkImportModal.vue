<script setup>
import { computed, ref } from 'vue';
import { useUiStore } from '../stores/ui.js';
import { useWordsStore } from '../stores/words.js';
import { useStudentsStore } from '../stores/students.js';

const ui = useUiStore();
const wordsStore = useWordsStore();
const studentsStore = useStudentsStore();
const bulkText = ref('');

// Свій словник або словник студента: обидва стори мають однаковий importText(text, label)
const forStudent = computed(() => ui.modalTarget === 'student' && studentsStore.student);
const target = computed(() => forStudent.value ? studentsStore : wordsStore);

async function processBulkImport() {
    if (!bulkText.value.trim()) return;
    if (await target.value.importText(bulkText.value, 'Текст')) ui.bulkModalOpen = false;
}
</script>

<template>
    <!-- BULK TEXT IMPORT MODAL -->
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <div class="glass-card w-full max-w-lg p-6 rounded-3xl border border-slate-700 shadow-2xl relative">

            <button
                    @click="ui.bulkModalOpen = false"
                    class="absolute top-4 right-4 text-slate-400 hover:text-white w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                <i class="fa-solid fa-xmark"></i>
            </button>

            <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <i class="fa-solid fa-file-import text-sky-400"></i>
                Масове завантаження слів з тексту
            </h3>
            <p v-if="forStudent" class="text-xs text-amber-300 mb-2">
                <i class="fa-solid fa-user-graduate mr-1"></i>Словник студента: {{ studentsStore.student.email }}
            </p>

            <p class="text-xs text-slate-400 mb-4">
                Вставте список слів у форматі: <code class="text-sky-300 font-mono">Слово, Переклад</code> або <code class="text-sky-300 font-mono">Слово - Переклад</code>.
                Транскрипцію можна додати другою колонкою в квадратних дужках: <code class="text-sky-300 font-mono">Слово, [транскрипція], Переклад</code>.
                Слова, які вже є у {{ forStudent ? 'словнику студента' : 'вашій колекції' }}, буде пропущено.
            </p>

            <textarea
                    v-model="bulkText"
                    rows="8"
                    placeholder="reluctant, [rɪˈlʌktənt], неохочий&#10;persistent, [], наполегливий&#10;comprehensive, всебічний"
                    class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-sky-500 mb-4">
            </textarea>

            <div class="flex justify-end gap-2">
                <button @click="ui.bulkModalOpen = false" class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800">
                    Скасувати
                </button>
                <button @click="processBulkImport" class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-400 shadow-md">
                    Додати слова
                </button>
            </div>
        </div>
    </div>
</template>
