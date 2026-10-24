<script setup>
import { computed, onMounted, ref } from 'vue';
import { useProgressStore } from '../stores/progress.js';
import { formatDaysAgo, LEARNED_BOX, PROBLEM_LAPSES } from '../lib/srs.js';

// Один студент в одному топіку: кожне слово з рівнем і кількістю «Не знаю». Проблемні — зверху.
const props = defineProps({
    topicId: { type: [Number, String], required: true },
    topicTitle: { type: String, required: true },
    student: { type: Object, required: true }   // { id, email }
});
const emit = defineEmits(['back']);

const progressStore = useProgressStore();
const words = ref([]);
const loading = ref(true);

const status = w => {
    if (w.lapses >= PROBLEM_LAPSES) return { label: 'проблемне', cls: 'text-rose-300 bg-rose-500/15 border-rose-500/30' };
    if (w.box >= LEARNED_BOX) return { label: 'вивчено', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' };
    if (w.reviews > 0 || w.box > 0) return { label: 'вчить', cls: 'text-sky-300 bg-sky-500/15 border-sky-500/30' };
    return { label: 'не почато', cls: 'text-slate-400 bg-slate-800 border-slate-700' };
};

const counts = computed(() => ({
    problem: words.value.filter(w => w.lapses >= PROBLEM_LAPSES).length,
    learned: words.value.filter(w => w.box >= LEARNED_BOX).length,
    notStarted: words.value.filter(w => !w.reviews && !w.box).length
}));

onMounted(async () => {
    words.value = await progressStore.studentTopicWords(props.topicId, props.student.id);
    loading.value = false;
});
</script>

<template>
    <div class="w-full flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3 px-1">
            <button @click="emit('back')" class="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5">
                <i class="fa-solid fa-arrow-left"></i>Назад
            </button>
            <span class="text-xs text-slate-300 truncate"><i class="fa-solid fa-user-graduate mr-1 text-emerald-400"></i>{{ student.email }} · {{ topicTitle }}</span>
        </div>

        <div v-if="loading" class="flex justify-center py-10 text-slate-500"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>

        <template v-else>
            <div class="grid grid-cols-3 gap-2 text-center">
                <div class="glass-card rounded-2xl p-3 border border-slate-800">
                    <span class="text-xl font-black text-rose-300 block">{{ counts.problem }}</span><span class="text-[10px] text-slate-400">проблемних</span>
                </div>
                <div class="glass-card rounded-2xl p-3 border border-slate-800">
                    <span class="text-xl font-black text-emerald-300 block">{{ counts.learned }}</span><span class="text-[10px] text-slate-400">вивчено</span>
                </div>
                <div class="glass-card rounded-2xl p-3 border border-slate-800">
                    <span class="text-xl font-black text-slate-300 block">{{ counts.notStarted }}</span><span class="text-[10px] text-slate-400">не почато</span>
                </div>
            </div>

            <div class="flex flex-col gap-1.5">
                <div v-for="w in words" :key="w.id" class="glass-card rounded-xl px-3 py-2 border border-slate-800 flex items-center justify-between gap-3">
                    <div class="min-w-0">
                        <p class="text-sm font-bold text-white truncate">{{ w.word }} <span class="font-normal text-emerald-400">— {{ w.translation }}</span></p>
                        <p class="text-[10px] text-slate-500">
                            рівень {{ w.box }} · UA→EN {{ w.reverse_box }} · повторень {{ w.reviews }}
                            <template v-if="w.last_reviewed_at"> · {{ formatDaysAgo(w.last_reviewed_at) }}</template>
                        </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <span v-if="w.lapses" class="text-[11px] font-bold text-rose-300" title="Скільки разів «Не знаю»"><i class="fa-solid fa-xmark mr-0.5"></i>{{ w.lapses }}</span>
                        <span class="text-[10px] font-semibold border px-1.5 py-0.5 rounded-md" :class="status(w).cls">{{ status(w).label }}</span>
                    </div>
                </div>
                <p v-if="!words.length" class="text-center text-xs text-slate-500 py-6">У топіку ще немає слів.</p>
            </div>
        </template>
    </div>
</template>
