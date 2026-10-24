<script setup>
import { computed, ref } from 'vue';

// Пошук + сітка карток слів. Кнопки біля слова — слот #actions, праворуч від пошуку — слот #toolbar.
const props = defineProps({
    words: { type: Array, required: true },
    emptyText: { type: String, default: 'Слів не знайдено за вашим запитом.' }
});

const searchQuery = ref('');
const filteredWords = computed(() => {
    const q = searchQuery.value.toLowerCase();
    return props.words.filter(w => w.word.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q));
});
</script>

<template>
    <div class="w-full flex-1 flex flex-col">
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
            <slot name="toolbar"></slot>
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
                    <slot name="actions" :item="item"></slot>
                </div>
            </div>

            <div v-if="filteredWords.length === 0" class="col-span-full text-center py-12 text-slate-500">
                <i class="fa-solid fa-book-open text-3xl mb-2 block"></i>
                <p>{{ emptyText }}</p>
            </div>
        </div>
    </div>
</template>
