<script setup>
import { computed } from 'vue';
import { pluralWords } from '../lib/srs.js';

// Смужка прогресу: вивчено (зелене) і почато (синє) з усіх слів топіку
const props = defineProps({
    learned: { type: [Number, String], required: true },
    started: { type: [Number, String], required: true },
    total: { type: [Number, String], required: true }
});

const totalCount = computed(() => Number(props.total));
const pct = value => totalCount.value ? Math.round(Number(value) / totalCount.value * 100) : 0;
</script>

<template>
    <div class="flex flex-col gap-1">
        <div class="w-full bg-slate-900 rounded-full h-2 overflow-hidden relative">
            <div class="absolute inset-y-0 left-0 bg-sky-500/40" :style="{ width: pct(started) + '%' }"></div>
            <div class="absolute inset-y-0 left-0 bg-emerald-400" :style="{ width: pct(learned) + '%' }"></div>
        </div>
        <div class="flex justify-between text-[10px] text-slate-400">
            <span><span class="text-emerald-300 font-semibold">{{ learned }}</span> вивчено · <span class="text-sky-300">{{ started }}</span> почато</span>
            <span>з {{ pluralWords(totalCount) }}</span>
        </div>
    </div>
</template>
