<script setup>
import { computed } from 'vue';
import { useUiStore } from '../stores/ui.js';
import { useWordsStore } from '../stores/words.js';
import { useStudentsStore } from '../stores/students.js';

const ui = useUiStore();
const wordsStore = useWordsStore();
const studentsStore = useStudentsStore();

// Свій словник або словник студента: обидва стори мають однаковий saveWord(form)
const forStudent = computed(() => ui.modalTarget === 'student' && studentsStore.student);
const target = computed(() => forStudent.value ? studentsStore : wordsStore);

async function save() {
    if (await target.value.saveWord(ui.formWord)) ui.singleModalOpen = false;
}
</script>

<template>
    <!-- ADD / EDIT SINGLE WORD MODAL -->
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <div class="glass-card w-full max-w-md p-6 rounded-3xl border border-slate-700 shadow-2xl relative">

            <button
                    @click="ui.singleModalOpen = false"
                    class="absolute top-4 right-4 text-slate-400 hover:text-white w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                <i class="fa-solid fa-xmark"></i>
            </button>

            <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <i class="fa-solid fa-plus-circle text-sky-400"></i>
                {{ ui.formWord.id ? 'Редагувати слово' : 'Додати нове слово' }}
            </h3>
            <p v-if="forStudent" class="text-xs text-amber-300 -mt-2 mb-4">
                <i class="fa-solid fa-user-graduate mr-1"></i>Словник студента: {{ studentsStore.student.email }}
            </p>

            <form @submit.prevent="save" class="space-y-4">
                <div>
                    <label class="block text-xs font-medium text-slate-400 mb-1">Слово англійською *</label>
                    <input
                            v-model="ui.formWord.word"
                            required
                            type="text"
                            placeholder="e.g. reluctant"
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500">
                </div>

                <div>
                    <label class="block text-xs font-medium text-slate-400 mb-1">Транскрипція <span class="text-slate-500">(необов'язково)</span></label>
                    <input
                            v-model="ui.formWord.transcription"
                            type="text"
                            placeholder="e.g. rɪˈlʌktənt"
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500">
                </div>

                <div>
                    <label class="block text-xs font-medium text-slate-400 mb-1">Переклад українською *</label>
                    <input
                            v-model="ui.formWord.translation"
                            required
                            type="text"
                            placeholder="e.g. неохочий, вимушений"
                            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500">
                </div>

                <div class="flex justify-end gap-2 pt-2">
                    <button type="button" @click="ui.singleModalOpen = false" class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800">
                        Скасувати
                    </button>
                    <button type="submit" class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 shadow-md">
                        Зберегти
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
