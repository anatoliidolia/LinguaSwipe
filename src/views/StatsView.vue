<script setup>
import { computed, ref } from 'vue';
import { useWordsStore } from '../stores/words.js';
import { usePracticeStore } from '../stores/practice.js';
import { LEITNER_BOXES, DIRECTIONS, forecast, progressOf } from '../lib/srs.js';

const wordsStore = useWordsStore();
const practice = usePracticeStore();

// Статистика окремо для кожного напрямку: у UA → EN свій прогрес
const direction = ref(practice.effectiveMode === 'reverse' ? 'reverse' : 'forward');
const dir = computed(() => wordsStore.hasReverse ? direction.value : 'forward');

const boxCounts = computed(() => LEITNER_BOXES.map((_, box) => wordsStore.words.filter(w => progressOf(w, dir.value).box === box).length));
const forecastItems = computed(() => {
    const f = forecast(wordsStore.words, [dir.value]);
    return [
        { label: 'Повторити сьогодні', value: f.today, color: 'text-sky-400' },
        { label: 'Завтра', value: f.tomorrow, color: 'text-amber-400' },
        { label: 'За 7 днів', value: f.week, color: 'text-emerald-400' }
    ];
});
const boxPercent = box => wordsStore.words.length ? (boxCounts.value[box] / wordsStore.words.length * 100) + '%' : '0%';
</script>

<template>
    <!-- SRS LEITNER MATRIX STATS -->
    <div class="w-full flex-1 flex flex-col my-2 max-w-3xl mx-auto">

        <div class="glass-card p-6 rounded-3xl border border-slate-800 mb-6">
            <h2 class="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <i class="fa-solid fa-brain text-sky-400"></i>
                Матриця повторень Leitner (SRS)
            </h2>
            <p class="text-xs text-slate-400 leading-relaxed">
                Кожне успішне «Знаю» переміщує слово у вищий Box і відкладає його на довший інтервал: слово зникає з тренувань і повертається, коли настане час повторення. Якщо слово свайпнути «Не знаю» — воно повертається в Box 0 і повторюється в цій же сесії.
            </p>
        </div>

        <div v-if="wordsStore.hasReverse" class="flex self-center bg-slate-800/60 p-1 rounded-xl border border-slate-700/50 text-xs mb-4">
            <button v-for="(item, key) in DIRECTIONS" :key="key"
                    @click="direction = key"
                    :class="dir === key ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                    class="px-3 py-1 rounded-lg font-semibold transition-all">
                {{ item.label }}
            </button>
        </div>

        <!-- Прогноз повторень -->
        <div v-if="wordsStore.hasSchedule" class="grid grid-cols-3 gap-3 mb-6">
            <div v-for="item in forecastItems" :key="item.label" class="glass-card p-4 rounded-2xl border border-slate-800 text-center">
                <span class="text-2xl font-black block" :class="item.color">{{ item.value }}</span>
                <span class="text-[11px] text-slate-400">{{ item.label }}</span>
            </div>
        </div>

        <!-- 6 Boxes Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
                    v-for="(boxInfo, index) in LEITNER_BOXES"
                    :key="index"
                    class="glass-card p-4 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">

                <div class="flex items-center justify-between mb-3">
                    <div>
                        <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Рівень {{ index }}</span>
                        <h3 class="text-sm font-extrabold text-white">{{ boxInfo.title }}</h3>
                    </div>
                    <span class="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-sm border border-sky-500/20">
                        {{ boxCounts[index] }}
                    </span>
                </div>

                <div class="text-[11px] text-slate-400 mb-3">
                    <p><i class="fa-solid fa-clock text-amber-400 mr-1.5"></i>Повтор: <strong class="text-slate-200">{{ boxInfo.interval }}</strong></p>
                </div>

                <div class="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div class="bg-sky-500 h-full transition-all" :style="{ width: boxPercent(index) }"></div>
                </div>
            </div>
        </div>
    </div>
</template>
