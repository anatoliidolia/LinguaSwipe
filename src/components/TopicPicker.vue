<script setup>
import { computed } from 'vue';
import { useWordsStore } from '../stores/words.js';
import { pluralWords } from '../lib/srs.js';

const wordsStore = useWordsStore();

const isMine = computed(() => wordsStore.wordSource === 'my_topics');
const formatDate = value => new Date(value).toLocaleDateString('uk-UA');
const percent = t => t.word_count ? Math.round(t.studied_count / t.word_count * 100) : 0;
</script>

<template>
    <!-- Список топіків студента: «Мої» — призначені особисто, «Публічні» — для всіх студентів викладача -->
    <div class="w-full flex-1 flex flex-col my-2 max-w-2xl">
        <p class="text-[11px] text-slate-500 mb-3 px-1">
            <i class="fa-solid fa-circle-info mr-1"></i>
            {{ isMine ? 'Топіки, які викладач призначив особисто вам.' : 'Топіки, які ваші викладачі відкрили для всіх своїх студентів.' }}
            Нові — зверху.
        </p>

        <div v-if="wordsStore.topicListLoading" class="flex-1 flex items-center justify-center py-12 text-slate-500">
            <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
        </div>

        <div v-else-if="wordsStore.topicList.length === 0" class="glass-card rounded-3xl p-8 text-center border border-slate-700/60 my-auto">
            <div class="w-16 h-16 mx-auto rounded-full bg-violet-500/15 text-violet-300 flex items-center justify-center text-3xl mb-4 border border-violet-500/30">
                <i class="fa-solid fa-layer-group"></i>
            </div>
            <h2 class="text-xl font-extrabold text-white mb-2">{{ isMine ? 'Поки немає топіків' : 'Поки немає публічних топіків' }}</h2>
            <p class="text-slate-400 text-sm">Коли викладач {{ isMine ? 'призначить вам топік' : 'відкриє топік для своїх студентів' }}, він з'явиться тут.</p>
        </div>

        <div v-else class="flex flex-col gap-2">
            <button
                    v-for="t in wordsStore.topicList"
                    :key="t.id"
                    @click="wordsStore.openTopic(t)"
                    class="glass-card text-left p-4 rounded-2xl border border-slate-800 hover:border-violet-500/50 transition-all">
                <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                        <h3 class="font-extrabold text-base text-white truncate">{{ t.title }}</h3>
                        <p class="text-[11px] text-slate-500 mt-0.5">
                            від {{ t.owner_name }} · {{ pluralWords(Number(t.word_count)) }} · додано {{ formatDate(t.added_at) }}
                        </p>
                    </div>
                    <i class="fa-solid fa-chevron-right text-slate-500"></i>
                </div>
                <div class="mt-3 flex items-center gap-2">
                    <div class="flex-1 bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-violet-400 h-full transition-all" :style="{ width: percent(t) + '%' }"></div>
                    </div>
                    <span class="text-[10px] text-slate-400 font-mono">{{ t.studied_count }}/{{ t.word_count }}</span>
                </div>
            </button>
        </div>
    </div>
</template>
