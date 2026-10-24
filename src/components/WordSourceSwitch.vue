<script setup>
import { useAuthStore } from '../stores/auth.js';
import { useWordsStore } from '../stores/words.js';

const auth = useAuthStore();
const wordsStore = useWordsStore();

const sources = [
    { id: 'mine', icon: 'fa-user', label: 'Мої слова' },
    { id: 'my_topics', icon: 'fa-layer-group', label: 'Мої топіки' },
    { id: 'public_topics', icon: 'fa-users-rectangle', label: 'Публічні топіки' },
    { id: 'all', icon: 'fa-globe', label: 'Усі слова' }
];
</script>

<template>
    <!-- WORD SOURCE: own collection, topics from a teacher or shared dictionary -->
    <div class="max-w-4xl w-full mx-auto px-4 pt-3 flex flex-col items-center gap-2 text-xs">
        <template v-if="auth.isGuest">
            <span class="text-slate-400"><i class="fa-solid fa-globe text-sky-400 mr-1.5"></i>Гостьовий режим · загальний словник</span>
        </template>
        <div v-else class="flex flex-wrap justify-center bg-slate-800/60 p-1 rounded-xl border border-slate-700/50 gap-0.5">
            <button v-for="source in sources" :key="source.id"
                    @click="wordsStore.setWordSource(source.id)"
                    :class="wordsStore.wordSource === source.id ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                    class="px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5">
                <i class="fa-solid" :class="source.icon"></i>{{ source.label }}
            </button>
        </div>

        <!-- Відкритий топік: назва і повернення до списку -->
        <div v-if="wordsStore.isTopicSource && wordsStore.selectedTopic" class="flex items-center gap-3 text-violet-300">
            <button @click="wordsStore.closeTopic()" class="text-slate-400 hover:text-white font-semibold flex items-center gap-1.5">
                <i class="fa-solid fa-arrow-left"></i>Топіки
            </button>
            <span class="font-bold truncate max-w-[220px]"><i class="fa-solid fa-layer-group mr-1.5"></i>{{ wordsStore.selectedTopic.title }}</span>
            <span class="text-slate-500">від {{ wordsStore.selectedTopic.owner_name }}</span>
        </div>
    </div>
</template>
