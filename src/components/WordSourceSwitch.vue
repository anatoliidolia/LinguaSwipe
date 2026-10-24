<script setup>
import { useAuthStore } from '../stores/auth.js';
import { useWordsStore } from '../stores/words.js';

const auth = useAuthStore();
const wordsStore = useWordsStore();
</script>

<template>
    <!-- WORD SOURCE: own collection or shared dictionary -->
    <div class="max-w-4xl w-full mx-auto px-4 pt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
        <template v-if="auth.isGuest">
            <span class="text-slate-400"><i class="fa-solid fa-globe text-sky-400 mr-1.5"></i>Гостьовий режим · загальний словник</span>
        </template>
        <template v-else>
            <span class="text-slate-500">Словник:</span>
            <div class="flex bg-slate-800/60 p-1 rounded-xl border border-slate-700/50">
                <button @click="wordsStore.setWordSource('mine')"
                        :class="wordsStore.wordSource === 'mine' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                        class="px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5">
                    <i class="fa-solid fa-user"></i>Мої слова
                </button>
                <button @click="wordsStore.setWordSource('all')"
                        :class="wordsStore.wordSource === 'all' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                        class="px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5">
                    <i class="fa-solid fa-globe"></i>Усі слова
                </button>
            </div>
        </template>
    </div>
</template>
