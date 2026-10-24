import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import confetti from 'canvas-confetti';
import { MAX_BOX } from '../lib/srs.js';
import { useWordsStore } from './words.js';

// Сесія тренування: черга карток, перевертання і рахунок «знаю / не знаю»
export const usePracticeStore = defineStore('practice', () => {
    const wordsStore = useWordsStore();

    const activeQueue = ref([]);
    const initialSessionCount = ref(0);
    const isFlipped = ref(false);
    const sessionKnowCount = ref(0);
    const sessionRepeatCount = ref(0);

    const findWord = id => wordsStore.words.find(w => w.id === id) || null;

    const currentCard = computed(() => activeQueue.value.length > 0 ? findWord(activeQueue.value[0]) : null);
    const nextCard = computed(() => activeQueue.value.length > 1 ? findWord(activeQueue.value[1]) : null);

    const sessionProgressPercentage = computed(() => {
        if (initialSessionCount.value === 0) return 100;
        const remaining = activeQueue.value.length;
        const done = initialSessionCount.value - remaining;
        return Math.max(0, Math.min(100, Math.round((done / initialSessionCount.value) * 100)));
    });

    function startSession() {
        isFlipped.value = false;
        sessionKnowCount.value = 0;
        sessionRepeatCount.value = 0;

        const dueIds = wordsStore.words.map(w => w.id);
        activeQueue.value = dueIds.sort(() => Math.random() - 0.5);
        initialSessionCount.value = activeQueue.value.length;
    }

    function toggleFlip() {
        isFlipped.value = !isFlipped.value;
    }

    function swipe(direction) {
        if (!currentCard.value) return;
        const card = currentCard.value;

        if (direction === 'right') {
            // KNOW -> Advance Box Level & Remove from current session
            card.box = Math.min(MAX_BOX, card.box + 1);
            sessionKnowCount.value++;
            activeQueue.value.shift();

            if (activeQueue.value.length === 0) {
                confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
            }
        } else {
            // DON'T KNOW -> Reset Box to 0 & Loop back into current session
            card.box = 0;
            sessionRepeatCount.value++;

            const currentId = activeQueue.value.shift();
            // Re-insert 3 cards later into active session queue
            const insertIndex = Math.min(activeQueue.value.length, 3);
            activeQueue.value.splice(insertIndex, 0, currentId);
        }

        wordsStore.persistWord(card);
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
