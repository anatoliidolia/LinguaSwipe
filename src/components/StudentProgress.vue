<script setup>
import { onMounted, ref } from 'vue';
import { useProgressStore } from '../stores/progress.js';
import { formatDaysAgo } from '../lib/srs.js';
import ProgressBar from './ProgressBar.vue';
import StudentTopicWords from './StudentTopicWords.vue';

// Прогрес одного студента: усі мої топіки, які йому відкрито (клік — слова цього топіку)
const props = defineProps({
    student: { type: Object, required: true }   // { id, email }
});
const emit = defineEmits(['back']);

const progressStore = useProgressStore();
const topics = ref([]);
const loading = ref(true);
const openedTopic = ref(null);

onMounted(async () => {
    topics.value = await progressStore.studentTopics(props.student.id);
    loading.value = false;
});
</script>

<template>
    <StudentTopicWords v-if="openedTopic" :topic-id="openedTopic.topic_id" :topic-title="openedTopic.title" :student="student" @back="openedTopic = null" />

    <div v-else class="w-full flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3 px-1">
            <button @click="emit('back')" class="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5">
                <i class="fa-solid fa-arrow-left"></i>До списку
            </button>
            <span class="text-xs text-slate-300 truncate"><i class="fa-solid fa-chart-line mr-1 text-emerald-400"></i>Прогрес: {{ student.email }}</span>
        </div>

        <div v-if="loading" class="flex justify-center py-10 text-slate-500"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>

        <template v-else>
            <button v-for="t in topics" :key="t.topic_id"
                    @click="openedTopic = t"
                    class="glass-card text-left p-3 rounded-2xl border border-slate-800 hover:border-violet-500/40 transition-all flex flex-col gap-2">
                <div class="flex items-center justify-between gap-2">
                    <span class="font-bold text-sm text-white truncate"><i class="fa-solid fa-layer-group mr-1.5 text-violet-300"></i>{{ t.title }}</span>
                    <span class="text-[10px] text-slate-500 shrink-0">{{ formatDaysAgo(t.last_activity) }}</span>
                </div>
                <ProgressBar :learned="t.learned" :started="t.started" :total="t.word_count" />
                <p v-if="Number(t.problem_words)" class="text-[11px] text-rose-300"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Проблемних слів: {{ t.problem_words }} · «Не знаю» всього: {{ t.lapses }}</p>
            </button>
            <p v-if="!topics.length" class="text-center text-xs text-slate-500 py-8">
                Цьому студенту ще не відкрито жодного вашого топіку.
            </p>
        </template>
    </div>
</template>
