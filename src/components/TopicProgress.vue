<script setup>
import { computed, onMounted, ref } from 'vue';
import { useProgressStore } from '../stores/progress.js';
import { formatDaysAgo, LEARNED_BOX, PROBLEM_LAPSES } from '../lib/srs.js';
import ProgressBar from './ProgressBar.vue';
import StudentTopicWords from './StudentTopicWords.vue';

// Прогрес по топіку: кожен студент (клік — його слова) і проблемні слова всієї групи
const props = defineProps({
    topicId: { type: [Number, String], required: true },
    topicTitle: { type: String, required: true }
});

const progressStore = useProgressStore();
const students = ref([]);
const wordStats = ref([]);
const loading = ref(true);
const openedStudent = ref(null);

const problemWords = computed(() => wordStats.value.filter(w => Number(w.lapses) > 0).slice(0, 10));

async function load() {
    loading.value = true;
    [students.value, wordStats.value] = await Promise.all([
        progressStore.topicSummary(props.topicId),
        progressStore.topicWordStats(props.topicId)
    ]);
    loading.value = false;
}

onMounted(load);
</script>

<template>
    <StudentTopicWords v-if="openedStudent" :topic-id="topicId" :topic-title="topicTitle" :student="openedStudent" @back="openedStudent = null" />

    <div v-else class="w-full flex flex-col gap-4">
        <div v-if="loading" class="flex justify-center py-10 text-slate-500"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>

        <template v-else>
            <p class="text-[11px] text-slate-500 px-1">
                <i class="fa-solid fa-circle-info mr-1"></i>Вивчено — слово на рівні {{ LEARNED_BOX }}+ (повтор раз на тиждень і рідше).
                Проблемне — {{ PROBLEM_LAPSES }}+ рази «Не знаю». Помилки рахуються з моменту появи звітів.
            </p>

            <!-- Студенти -->
            <div class="flex flex-col gap-2">
                <h3 class="text-sm font-bold text-white px-1"><i class="fa-solid fa-user-graduate mr-1.5 text-emerald-400"></i>Студенти: {{ students.length }}</h3>
                <button v-for="s in students" :key="s.student_id"
                        @click="openedStudent = { id: s.student_id, email: s.email }"
                        class="glass-card text-left p-3 rounded-2xl border border-slate-800 hover:border-emerald-500/40 transition-all flex flex-col gap-2">
                    <div class="flex items-center justify-between gap-2">
                        <div class="min-w-0 flex items-center gap-2">
                            <span class="font-bold text-sm text-white truncate">{{ s.email }}</span>
                            <span class="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md border"
                                  :class="s.via === 'assigned' ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' : 'text-violet-300 bg-violet-500/15 border-violet-500/30'">
                                {{ s.via === 'assigned' ? 'особисто' : 'для всіх' }}
                            </span>
                        </div>
                        <span class="text-[10px] text-slate-500 shrink-0">{{ formatDaysAgo(s.last_activity) }}</span>
                    </div>
                    <ProgressBar :learned="s.learned" :started="s.started" :total="s.word_count" />
                    <p v-if="Number(s.problem_words)" class="text-[11px] text-rose-300"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Проблемних слів: {{ s.problem_words }} · «Не знаю» всього: {{ s.lapses }}</p>
                </button>
                <p v-if="!students.length" class="text-xs text-slate-500 px-1">Топік ще нікому не відкрито: призначте його студентам або відкрийте для всіх своїх студентів.</p>
            </div>

            <!-- Проблемні слова групи -->
            <div class="flex flex-col gap-1.5">
                <h3 class="text-sm font-bold text-white px-1"><i class="fa-solid fa-triangle-exclamation mr-1.5 text-rose-300"></i>Найважчі слова</h3>
                <div v-for="w in problemWords" :key="w.id" class="glass-card rounded-xl px-3 py-2 border border-slate-800 flex items-center justify-between gap-3">
                    <p class="text-sm font-bold text-white truncate min-w-0">{{ w.word }} <span class="font-normal text-emerald-400">— {{ w.translation }}</span></p>
                    <p class="text-[11px] text-slate-400 shrink-0">
                        <span class="text-rose-300 font-bold"><i class="fa-solid fa-xmark mr-0.5"></i>{{ w.lapses }}</span>
                        · важко {{ w.students_struggling }} з {{ w.students_started }}
                    </p>
                </div>
                <p v-if="!problemWords.length" class="text-xs text-slate-500 px-1">Поки жодного «Не знаю» — або студенти ще не тренувались.</p>
            </div>
        </template>
    </div>
</template>
