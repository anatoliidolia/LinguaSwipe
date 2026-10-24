<script setup>
import { computed, ref } from 'vue';
import { usePracticeStore } from '../stores/practice.js';

const practice = usePracticeStore();

// Drag Gesture State
const SWIPE_THRESHOLD = 100;
const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);
const dragX = ref(0);
const dragY = ref(0);
const hasMoved = ref(false);

const card = computed(() => practice.currentCard);

const knowOverlayOpacity = computed(() => dragX.value <= 0 ? 0 : Math.min(1, dragX.value / 100));
const dontKnowOverlayOpacity = computed(() => dragX.value >= 0 ? 0 : Math.min(1, Math.abs(dragX.value) / 100));

const cardTransformStyle = computed(() => {
    if (!isDragging.value && dragX.value === 0 && dragY.value === 0) {
        return {
            transform: 'translate3d(0, 0, 0) rotate(0deg)',
            transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        };
    }
    const rotate = dragX.value * 0.08;
    return {
        transform: `translate3d(${dragX.value}px, ${dragY.value}px, 0px) rotate(${rotate}deg)`,
        transition: isDragging.value ? 'none' : 'transform 0.3s ease-out'
    };
});

function pointerPosition(e) {
    return {
        x: e.clientX || (e.touches && e.touches[0].clientX) || 0,
        y: e.clientY || (e.touches && e.touches[0].clientY) || 0
    };
}

function onPointerDown(e) {
    isDragging.value = true;
    hasMoved.value = false;
    const { x, y } = pointerPosition(e);
    startX.value = x;
    startY.value = y;
}

function onPointerMove(e) {
    if (!isDragging.value) return;
    const { x, y } = pointerPosition(e);
    const deltaX = x - startX.value;
    const deltaY = y - startY.value;

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasMoved.value = true;
    }

    dragX.value = deltaX;
    dragY.value = deltaY;
}

function onPointerUp() {
    if (!isDragging.value) return;
    isDragging.value = false;

    if (dragX.value > SWIPE_THRESHOLD) {
        practice.swipe('right');
    } else if (dragX.value < -SWIPE_THRESHOLD) {
        practice.swipe('left');
    } else if (!hasMoved.value) {
        practice.toggleFlip();
    }
    dragX.value = 0;
    dragY.value = 0;
}
</script>

<template>
    <!-- TOP ACTIVE CARD WITH DRAG & 3D FLIP -->
    <div
            class="absolute inset-0 rounded-3xl cursor-grab active:cursor-grabbing touch-none select-none transition-transform duration-100"
            :style="cardTransformStyle"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointerleave="onPointerUp">

        <!-- SWIPE OVERLAY INDICATORS -->
        <div
                class="absolute top-6 left-6 z-30 border-4 border-emerald-400 text-emerald-400 font-black text-2xl tracking-wider uppercase px-4 py-1 rounded-2xl rotate-[-15deg] pointer-events-none transition-opacity"
                :style="{ opacity: knowOverlayOpacity }">
            ЗНАЮ
        </div>
        <div
                class="absolute top-6 right-6 z-30 border-4 border-rose-500 text-rose-500 font-black text-2xl tracking-wider uppercase px-4 py-1 rounded-2xl rotate-[15deg] pointer-events-none transition-opacity"
                :style="{ opacity: dontKnowOverlayOpacity }">
            НЕ ЗНАЮ
        </div>

        <!-- FLIP CONTAINER -->
        <div
                class="w-full h-full transform-style-3d relative rounded-3xl"
                :class="{ 'rotate-y-180': practice.isFlipped }">

            <!-- FRONT SIDE: ENGLISH WORD -->
            <div class="card-front-face absolute inset-0 w-full h-full rounded-3xl p-8 flex flex-col justify-between items-center backface-hidden bg-slate-900 border border-slate-700/80 shadow-2xl">

                <div class="w-full flex justify-between items-center">
                    <span class="text-[11px] uppercase tracking-widest font-bold text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full border border-sky-500/20">
                        ENGLISH
                    </span>
                    <span class="text-xs text-slate-400 font-mono bg-slate-800 px-2.5 py-1 rounded-lg">
                        SRS Box {{ card.box }}
                    </span>
                </div>

                <div class="text-center my-auto px-2">
                    <h2 class="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                        {{ card.word }}
                    </h2>
                    <p v-if="card.transcription" class="mt-3 text-lg text-slate-400 font-medium">[{{ card.transcription }}]</p>
                </div>

                <div class="text-center text-xs text-slate-400 flex items-center justify-center gap-2 font-medium bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/50">
                    <i class="fa-solid fa-hand-pointer text-sky-400 animate-bounce"></i>
                    <span>Натисніть на картку, щоб показати переклад</span>
                </div>
            </div>

            <!-- BACK SIDE: UKRAINIAN TRANSLATION -->
            <div class="card-back-face absolute inset-0 w-full h-full rounded-3xl p-8 flex flex-col justify-between items-center backface-hidden bg-slate-900 border-2 border-emerald-500/50 shadow-2xl">

                <div class="w-full flex justify-between items-center border-b border-slate-800 pb-3">
                    <span class="text-[11px] uppercase tracking-widest font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        ПЕРЕКЛАД (УКР)
                    </span>
                    <span class="text-xs text-slate-400 font-mono bg-slate-800 px-2.5 py-1 rounded-lg">
                        SRS Box {{ card.box }}
                    </span>
                </div>

                <div class="text-center my-auto px-2">
                    <p v-if="card.transcription" class="text-sm text-slate-500 mb-3">{{ card.word }} [{{ card.transcription }}]</p>
                    <span class="text-xs text-slate-500 uppercase font-semibold tracking-widest block mb-3">Українською:</span>
                    <h3 class="text-3xl sm:text-4xl font-black text-emerald-400 leading-snug">
                        {{ card.translation }}
                    </h3>
                </div>

                <div class="text-center text-xs text-slate-400 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/50">
                    <span>Свайпніть <strong class="text-rose-400">Вліво (Не знаю)</strong> або <strong class="text-emerald-400">Вправо (Знаю)</strong></span>
                </div>
            </div>
        </div>
    </div>
</template>
