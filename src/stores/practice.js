import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import confetti from 'canvas-confetti';
import {
    isDue, knowStep, dueInDays, pluralDays, progressOf, setProgress, nextReview as findNextReview, PRACTICE_MODES
} from '../lib/srs.js';
import { readStored, writeStored, STORAGE_KEYS } from '../lib/storage.js';
import { useWordsStore } from './words.js';

// Сесія тренування: черга карток, перевертання і рахунок «знаю / не знаю».
// Картка — це слово + напрямок: 'forward' (EN → UA) або 'reverse' (UA → EN), у кожного свій прогрес.
// У сесію потрапляють лише картки, яким настав час повторення (lib/srs.js → isDue).
// «Знаю» піднімає рівень і відкладає картку на інтервал рівня, «Не знаю» — на рівень 0 і ще раз у цій сесії.
export const usePracticeStore = defineStore('practice', () => {
    const wordsStore = useWordsStore();

    // Черга: [{ id, dir }]
    const activeQueue = ref([]);
    const initialSessionCount = ref(0);
    const isFlipped = ref(false);
    const sessionKnowCount = ref(0);
    const sessionRepeatCount = ref(0);
    // «Повторити наперед»: тренування карток, яким ще не час. «Знаю» тут не зсуває розклад
    const reviewAhead = ref(false);

    // Режим: 'forward' | 'reverse' | 'both'. Без міграції 005 доступний лише EN → UA
    const storedMode = readStored(STORAGE_KEYS.practiceMode);
    const mode = ref(PRACTICE_MODES[storedMode] ? storedMode : 'forward');
    const effectiveMode = computed(() => wordsStore.hasReverse ? mode.value : 'forward');
    const directions = computed(() => PRACTICE_MODES[effectiveMode.value].directions);

    const findWord = id => wordsStore.words.find(w => w.id === id) || null;

    const currentDir = computed(() => activeQueue.value.length > 0 ? activeQueue.value[0].dir : 'forward');
    const currentCard = computed(() => activeQueue.value.length > 0 ? findWord(activeQueue.value[0].id) : null);
    // Текст наступної картки для «стопки» позаду: та сторона, яку покаже наступна картка
    const nextCardText = computed(() => {
        if (activeQueue.value.length < 2) return '';
        const { id, dir } = activeQueue.value[1];
        const word = findWord(id);
        if (!word) return '';
        return dir === 'reverse' ? word.translation : word.word;
    });

    const sessionProgressPercentage = computed(() => {
        if (initialSessionCount.value === 0) return 100;
        const remaining = activeQueue.value.length;
        const done = initialSessionCount.value - remaining;
        return Math.max(0, Math.min(100, Math.round((done / initialSessionCount.value) * 100)));
    });

    const dueCards = dirs => wordsStore.words.reduce((n, w) => n + dirs.filter(dir => isDue(w, dir)).length, 0);
    const dueCount = computed(() => dueCards(directions.value));
    // Скільки карток UA → EN чекає — для пропозиції «тепер у зворотному напрямку» після основної сесії
    const reverseDueCount = computed(() => wordsStore.hasReverse ? dueCards(['reverse']) : 0);
    const nextReview = computed(() => findNextReview(wordsStore.words, directions.value));

    // Підказка під кнопкою «Знаю»: коли картка повернеться
    const knowHint = computed(() => {
        if (!currentCard.value || !wordsStore.hasSchedule) return '';
        if (reviewAhead.value) return 'без змін';
        return '+' + pluralDays(knowStep(progressOf(currentCard.value, currentDir.value).box).days);
    });

    function shuffle(items) {
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
        return items;
    }

    function startSession({ ahead = false } = {}) {
        isFlipped.value = false;
        sessionKnowCount.value = 0;
        sessionRepeatCount.value = 0;
        reviewAhead.value = ahead;

        const cards = [];
        wordsStore.words.forEach(w => directions.value.forEach(dir => {
            if (ahead || isDue(w, dir)) cards.push({ id: w.id, dir });
        }));
        activeQueue.value = shuffle(cards);
        initialSessionCount.value = activeQueue.value.length;
    }

    function setMode(next) {
        if (!PRACTICE_MODES[next] || next === mode.value) return;
        mode.value = next;
        writeStored(STORAGE_KEYS.practiceMode, next);
        startSession();
    }

    function toggleFlip() {
        isFlipped.value = !isFlipped.value;
    }

    function swipe(direction) {
        if (!currentCard.value) return;
        const card = currentCard.value;
        const dir = currentDir.value;

        let changed = true;
        if (direction === 'right') {
            // KNOW -> Advance Box Level, schedule next review & Remove from current session
            if (reviewAhead.value && !isDue(card, dir)) {
                changed = false; // картці ще не час — розклад лишається як був
            } else {
                const step = knowStep(progressOf(card, dir).box);
                // Без колонки due_at (міграцію 004 не виконано) дату не зберегти — не обіцяємо її і в інтерфейсі
                const dueAt = wordsStore.hasSchedule ? dueInDays(step.days) : progressOf(card, dir).due_at;
                setProgress(card, dir, step.box, dueAt);
            }
            sessionKnowCount.value++;
            activeQueue.value.shift();

            if (activeQueue.value.length === 0) {
                confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
            }
        } else {
            // DON'T KNOW -> Reset Box to 0 (due again right away) & Loop back into current session
            setProgress(card, dir, 0, null);
            sessionRepeatCount.value++;

            const current = activeQueue.value.shift();
            // Re-insert 3 cards later into active session queue
            const insertIndex = Math.min(activeQueue.value.length, 3);
            activeQueue.value.splice(insertIndex, 0, current);
        }

        if (changed) wordsStore.persistWord(card, dir);
        isFlipped.value = false;
    }

    // Щойно додане слово — одразу на початок поточної сесії (у кожному напрямку режиму)
    function enqueue(id) {
        directions.value.forEach(dir => activeQueue.value.unshift({ id, dir }));
        initialSessionCount.value += directions.value.length;
    }

    function remove(id) {
        activeQueue.value = activeQueue.value.filter(card => card.id !== id);
    }

    function reset() {
        activeQueue.value = [];
        initialSessionCount.value = 0;
    }

    return {
        activeQueue,
        isFlipped,
        reviewAhead,
        initialSessionCount,
        mode,
        effectiveMode,
        knowHint,
        sessionKnowCount,
        sessionRepeatCount,
        currentCard,
        currentDir,
        nextCardText,
        sessionProgressPercentage,
        dueCount,
        reverseDueCount,
        nextReview,
        startSession,
        setMode,
        toggleFlip,
        swipe,
        enqueue,
        remove,
        reset
    };
});
