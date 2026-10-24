<script setup>
import { inject } from 'vue';
import { useUiStore } from '../stores/ui.js';
import { useStudentsStore } from '../stores/students.js';
import WordList from './WordList.vue';

const ui = useUiStore();
const studentsStore = useStudentsStore();
const openFilePicker = inject('openFilePicker');
</script>

<template>
    <!-- Словник студента: викладач (або адмін) додає, змінює і видаляє його слова -->
    <div class="w-full flex-1 flex flex-col">
        <div class="flex items-center justify-between gap-3 mb-3 px-1">
            <button @click="studentsStore.closeStudent()"
                    class="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5">
                <i class="fa-solid fa-arrow-left"></i>До списку
            </button>
            <span class="text-xs text-amber-300 truncate">
                <i class="fa-solid fa-user-graduate mr-1"></i>{{ studentsStore.student.email }} · {{ studentsStore.studentWords.length }} слів
            </span>
        </div>

        <div v-if="studentsStore.studentLoading" class="flex-1 flex items-center justify-center py-12 text-slate-500">
            <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
        </div>

        <WordList v-else :words="studentsStore.studentWords" empty-text="У словнику студента немає слів.">
            <template #toolbar>
                <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                            @click="openFilePicker('student')"
                            class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5">
                        <i class="fa-solid fa-file-arrow-up"></i>
                        <span>Файл</span>
                    </button>

                    <button
                            @click="ui.openAddModal('student')"
                            class="px-3 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5">
                        <i class="fa-solid fa-plus"></i>
                        <span>Одне слово</span>
                    </button>

                    <button
                            @click="ui.openBulkModal('student')"
                            class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5">
                        <i class="fa-solid fa-file-import"></i>
                        <span>Вставити текст</span>
                    </button>
                </div>
            </template>

            <template #actions="{ item }">
                <button @click="ui.editWord(item, 'student')" class="text-slate-400 hover:text-sky-400 text-xs p-1.5 rounded-lg hover:bg-slate-800 transition-all">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button @click="studentsStore.deleteWord(item)" class="text-slate-400 hover:text-rose-400 text-xs p-1.5 rounded-lg hover:bg-slate-800 transition-all">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </template>
        </WordList>
    </div>
</template>
