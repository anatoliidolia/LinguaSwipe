<script setup>
import { computed, inject, onMounted, onUnmounted } from 'vue';
import { formatDaysFromNow, pluralWords, PRACTICE_MODES } from '../lib/srs.js';
import { usePracticeStore } from '../stores/practice.js';
import { useUiStore } from '../stores/ui.js';
import { useWordsStore } from '../stores/words.js';
import SwipeCard from '../components/SwipeCard.vue';

const practice = usePracticeStore();
const ui = useUiStore();
const wordsStore = useWordsStore();
const openFilePicker = inject('openFilePicker');

// «Наступне повторення: завтра · 5 слів»
const nextReviewText = computed(() => {
    const next = practice.nextReview;
    if (!next) return '';
    return `${formatDaysFromNow(next.days)} · ${pluralWords(next.count)}`;
});

// Скільки карток буде в «Повторити наперед»: у режимі «Обидва» кожне слово двічі
const aheadCount = computed(() => wordsStore.words.length * PRACTICE_MODES[practice.effectiveMode].directions.length);

// Гарячі клавіші працюють, лише поки відкрита вкладка тренування і немає модальних вікон
function handleKeydown(e) {
    if (ui.anyModalOpen()) return;

    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
        practice.toggleFlip();
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        practice.swipe('left');
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        practice.swipe('right');
    }
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
</script>

<template>
    <!-- PRACTICE DECK (TINDER SWIPE + 3D FLIP CARD) -->
    <div class="w-full flex-1 flex flex-col items-center justify-between max-w-md my-auto py-2">

        <!-- Напрямок тренування (з'являється після міграції 005) -->
        <div v-if="wordsStore.hasReverse && wordsStore.words.length > 0" class="flex bg-slate-800/60 p-1 rounded-xl border border-slate-700/50 text-xs mb-3">
            <button v-for="(item, key) in PRACTICE_MODES" :key="key"
                    @click="practice.setMode(key)"
                    :class="practice.effectiveMode === key ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                    class="px-3 py-1 rounded-lg font-semibold transition-all">
                {{ item.label }}
            </button>
        </div>

        <!-- Top Session Indicator & Progress -->
        <div class="w-full mb-3 flex items-center justify-between text-xs text-slate-400 px-1">
            <div class="flex items-center gap-2 font-medium">
                <span class="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse"></span>
                <span>Залишилось у сесії: <strong class="text-white font-bold">{{ practice.activeQueue.length }}</strong></span>
                <span v-if="practice.reviewAhead" class="text-[10px] font-bold uppercase text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md"
                      title="Слова, яким ще не час: «Знаю» не змінює розклад">Наперед</span>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-emerald-400 font-semibold"><i class="fa-solid fa-circle-check mr-1"></i>{{ practice.sessionKnowCount }}</span>
                <span class="text-rose-400 font-semibold"><i class="fa-solid fa-arrows-rotate mr-1"></i>{{ practice.sessionRepeatCount }}</span>
            </div>
        </div>

        <!-- Progress bar -->
        <div class="w-full bg-slate-800/80 rounded-full h-2 mb-4 overflow-hidden border border-slate-700/50">
            <div
                    class="bg-gradient-to-r from-sky-500 to-emerald-400 h-full transition-all duration-300"
                    :style="{ width: practice.sessionProgressPercentage + '%' }">
            </div>
        </div>

        <!-- CARD STACK CONTAINER -->
        <div v-if="practice.currentCard" class="relative w-full aspect-[4/5] max-h-[460px] perspective-1000 my-auto">

            <!-- Background Card Preview (Stack effect) -->
            <div
                    v-if="practice.nextCardText"
                    class="absolute inset-0 rounded-3xl bg-slate-900/90 border border-slate-700/40 p-8 shadow-2xl flex flex-col items-center justify-center opacity-40 scale-95 translate-y-4 pointer-events-none transition-all duration-300">
                <span class="text-xs text-slate-500 font-mono mb-2">НАСТУПНЕ СЛОВО</span>
                <h3 class="text-3xl font-black text-slate-300 text-center">{{ practice.nextCardText }}</h3>
            </div>

            <SwipeCard />
        </div>

        <!-- EMPTY COLLECTION STATE -->
        <div v-else-if="wordsStore.words.length === 0" class="w-full glass-card rounded-3xl p-8 text-center shadow-2xl border border-slate-700/60 my-auto flex flex-col items-center">
            <div class="w-20 h-20 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-4xl mb-4 border border-sky-500/40">
                <i class="fa-solid fa-box-open"></i>
            </div>
            <h2 class="text-2xl font-extrabold text-white mb-2">{{ wordsStore.isTopicSource ? 'У топіку ще немає слів' : wordsStore.readOnly ? 'Загальний словник порожній' : 'Ваша колекція порожня' }}</h2>
            <p v-if="wordsStore.isTopicSource" class="text-slate-400 text-sm max-w-xs">Викладач ще не додав слова в цей топік.</p>
            <p v-else-if="wordsStore.readOnly" class="text-slate-400 text-sm max-w-xs">Поки що ніхто не додав слів. Зареєструйтесь і додайте перші!</p>
            <p v-else class="text-slate-400 text-sm max-w-xs mb-6">Додайте слова вручну, вставте список текстом або завантажте CSV-файл.</p>
            <div v-if="!wordsStore.readOnly" class="flex flex-col gap-2 w-full">
                <button @click="openFilePicker()" class="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2">
                    <i class="fa-solid fa-file-arrow-up"></i><span>Завантажити файл</span>
                </button>
                <button @click="ui.openBulkModal()" class="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2">
                    <i class="fa-solid fa-file-import"></i><span>Вставити текст</span>
                </button>
                <button @click="ui.openAddModal()" class="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2">
                    <i class="fa-solid fa-plus"></i><span>Додати одне слово</span>
                </button>
            </div>
        </div>

        <!-- SESSION COMPLETED / NOTHING DUE STATE -->
        <div v-else class="w-full glass-card rounded-3xl p-8 text-center shadow-2xl border border-slate-700/60 my-auto flex flex-col items-center">
            <div class="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-4xl mb-4 border border-emerald-500/40 shadow-lg shadow-emerald-500/20 animate-bounce">
                <i class="fa-solid" :class="practice.initialSessionCount > 0 ? 'fa-trophy' : 'fa-mug-hot'"></i>
            </div>
            <template v-if="practice.initialSessionCount > 0">
                <h2 class="text-3xl font-extrabold text-white mb-2">Сесію завершено!</h2>
                <p class="text-slate-400 text-sm max-w-xs mb-4">Кожне слово повернеться саме тоді, коли його час повторити: чим краще ви його знаєте, тим рідше.</p>
            </template>
            <template v-else>
                <h2 class="text-2xl font-extrabold text-white mb-2">На сьогодні все повторено</h2>
                <p class="text-slate-400 text-sm max-w-xs mb-4">Слова з'являться знову, коли настане їхній час. Можна додати нові слова або повторити наперед.</p>
            </template>

            <p v-if="nextReviewText" class="text-sm text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-xl px-4 py-2 mb-6">
                <i class="fa-solid fa-calendar-day mr-1.5"></i>Наступне повторення: <strong>{{ nextReviewText }}</strong>
            </p>

            <div v-if="practice.initialSessionCount > 0" class="grid grid-cols-2 gap-3 w-full mb-6">
                <div class="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                    <span class="text-xs text-slate-400 block mb-1">Вивчено в сесії</span>
                    <span class="text-2xl font-black text-emerald-400">{{ practice.sessionKnowCount }}</span>
                </div>
                <div class="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                    <span class="text-xs text-slate-400 block mb-1">Повторів зроблено</span>
                    <span class="text-2xl font-black text-amber-400">{{ practice.sessionRepeatCount }}</span>
                </div>
            </div>

            <!-- Після основного напрямку — запропонувати зворотний: UA → EN -->
            <button
                    v-if="practice.effectiveMode === 'forward' && practice.reverseDueCount > 0"
                    @click="practice.setMode('reverse')"
                    class="w-full py-3.5 px-6 mb-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-violet-500/25 transition-all flex items-center justify-center gap-2">
                <i class="fa-solid fa-right-left"></i>
                <span>Тепер навпаки: UA → EN ({{ practice.reverseDueCount }})</span>
            </button>
            <button
                    v-if="practice.dueCount > 0"
                    @click="practice.startSession()"
                    class="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-sky-500/25 transition-all flex items-center justify-center gap-2">
                <i class="fa-solid fa-rotate-right"></i>
                <span>{{ wordsStore.hasSchedule ? `Повторити ще ${practice.dueCount}` : 'Почати нову сесію' }}</span>
            </button>
            <button
                    v-else
                    @click="practice.startSession({ ahead: true })"
                    title="«Знаю» не змінює розклад, «Не знаю» повертає слово на рівень 0"
                    class="w-full py-3 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2">
                <i class="fa-solid fa-forward"></i>
                <span>Повторити наперед ({{ aheadCount }})</span>
            </button>
        </div>

        <!-- ACTION BUTTONS BAR -->
        <div v-if="practice.activeQueue.length > 0" class="w-full mt-4 mb-4 flex items-center justify-center gap-6">
            <button
                    @click="practice.swipe('left')"
                    class="w-16 h-16 rounded-full bg-slate-900 border-2 border-rose-500/60 text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-lg shadow-rose-500/10 flex flex-col items-center justify-center active:scale-90"
                    title="Не знаю [← / A]">
                <i class="fa-solid fa-xmark text-2xl"></i>
                <span class="text-[9px] font-bold mt-0.5 uppercase">Не знаю</span>
            </button>

            <button
                    @click="practice.toggleFlip()"
                    class="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 text-amber-400 hover:bg-amber-500 hover:text-white transition-all shadow-md flex flex-col items-center justify-center active:scale-90"
                    title="Перевернути [Пробіл]">
                <i class="fa-solid fa-rotate text-lg"></i>
                <span class="text-[8px] font-bold mt-0.5 uppercase">Переворот</span>
            </button>

            <button
                    @click="practice.swipe('right')"
                    class="relative w-16 h-16 rounded-full bg-slate-900 border-2 border-emerald-500/60 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10 flex flex-col items-center justify-center active:scale-90"
                    title="Знаю [→ / D]">
                <i class="fa-solid fa-check text-2xl"></i>
                <span class="text-[9px] font-bold mt-0.5 uppercase">Знаю</span>
                <span v-if="practice.knowHint" class="absolute -bottom-5 text-[10px] font-semibold text-emerald-300/80 whitespace-nowrap">{{ practice.knowHint }}</span>
            </button>
        </div>

        <!-- Hotkeys Footer Hint -->
        <div class="hidden sm:flex items-center justify-center gap-4 mt-3 text-[11px] text-slate-500 font-medium">
            <span><kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">←</kbd> / <kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">A</kbd> Не знаю</span>
            <span><kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">Space</kbd> Переворот</span>
            <span><kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">→</kbd> / <kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300">D</kbd> Знаю</span>
        </div>
    </div>
</template>
