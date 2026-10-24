import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import confetti from 'canvas-confetti';
import { isDue, knowStep, dueInDays, pluralDays } from '../lib/srs.js';
import { useWordsStore } from './words.js';

// Сесія тренування: черга карток, перевертання і рахунок «знаю / не знаю».
// У сесію потрапляють лише слова, яким настав час повторення (lib/srs.js → isDue).
// «Знаю» піднімає рівень і відкладає слово на інтервал рівня, «Не знаю» — на рівень 0 і ще раз у цій сесії.
export const usePracticeStore = defineStore('practice', () => {
    const wordsStore = useWordsStore();

    const activeQueue = ref([]);
    const initialSessionCount = ref(0);
    const isFlipped = ref(false);
    const sessionKnowCount = ref(0);
    const sessionRepeatCount = ref(0);
    // «Повторити наперед»: тренування слів, яким ще не час. «Знаю» тут не зсуває розклад
    const reviewAhead = ref(false);

    const findWord = id => wordsStore.words.find(w => w.id === id) || null;

    const currentCard = computed(() => activeQueue.value.length > 0 ? findWord(activeQueue.value[0]) : null);
    const nextCard = computed(() => activeQueue.value.length > 1 ? findWord(activeQueue.value[1]) : null);

    const sessionProgressPercentage = computed(() => {
        if (initialSessionCount.value === 0) return 100;
        const remaining = activeQueue.value.length;
        const done = initialSessionCount.value - remaining;
        return Math.max(0, Math.min(100, Math.round((done / initialSessionCount.value) * 100)));
    });

    // Підказка під кнопкою «Знаю»: коли слово повернеться
    const knowHint = computed(() => {
        if (!currentCard.value || !wordsStore.hasSchedule) return '';
        if (reviewAhead.value) return 'без змін';
        return '+' + pluralDays(knowStep(currentCard.value.box).days);
    });

    function startSession({ ahead = false } = {}) {
        isFlipped.value = false;
        sessionKnowCount.value = 0;
        sessionRepeatCount.value = 0;
        reviewAhead.value = ahead;

        const ids = wordsStore.words.filter(w => ahead || isDue(w)).map(w => w.id);
        activeQueue.value = ids.sort(() => Math.random() - 0.5);
        initialSessionCount.value = activeQueue.value.length;
    }

    function toggleFlip() {
        isFlipped.value = !isFlipped.value;
    }

    function swipe(direction) {
        if (!currentCard.value) return;
        const card = currentCard.value;

        let changed = true;
        if (direction === 'right') {
            // KNOW -> Advance Box Level, schedule next review & Remove from current session
            if (reviewAhead.value && !isDue(card)) {
                changed = false; // слову ще не час — розклад лишається як був
            } else {
                const step = knowStep(card.box);
                card.box = step.box;
                // Без колонки due_at (міграцію 004 не виконано) дату не зберегти — не обіцяємо її і в інтерфейсі
                if (wordsStore.hasSchedule) card.due_at = dueInDays(step.days);
            }
            sessionKnowCount.value++;
            activeQueue.value.shift();

            if (activeQueue.value.length === 0) {
                confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
            }
        } else {
            // DON'T KNOW -> Reset Box to 0 (due again right away) & Loop back into current session
            card.box = 0;
            card.due_at = null;
            sessionRepeatCount.value++;

            const currentId = activeQueue.value.shift();
            // Re-insert 3 cards later into active session queue
            const insertIndex = Math.min(activeQueue.value.length, 3);
            activeQueue.value.splice(insertIndex, 0, currentId);
        }

        if (changed) wordsStore.persistWord(card);
        isFlipped.value = false;
    }

    // Щойно додане слово — одразу на початок поточної сесії
    function enqueue(id) {
        activeQueue.value.unshift(id);
        initialSessionCount.value++;
    }

    function remove(id) {
        activeQueue.value = activeQueue.value.filter(qId => qId !== id);
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
        knowHint,
        sessionKnowCount,
        sessionRepeatCount,
        currentCard,
        nextCard,
        sessionProgressPercentage,
        startSession,
        toggleFlip,
        swipe,
        enqueue,
        remove,
        reset
    };
});
