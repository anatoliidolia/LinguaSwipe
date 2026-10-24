<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth.js';
import { useTopicsStore } from '../stores/topics.js';
import { pluralWords } from '../lib/srs.js';
import TopicEditor from '../components/TopicEditor.vue';

const auth = useAuthStore();
const topicsStore = useTopicsStore();

const creating = ref(false);
const newTitle = ref('');
const newPublic = ref(false);

async function create() {
    if (!newTitle.value.trim()) return;
    if (await topicsStore.createTopic(newTitle.value, newPublic.value)) {
        creating.value = false;
        newTitle.value = '';
        newPublic.value = false;
    }
}

const formatDate = value => new Date(value).toLocaleDateString('uk-UA');

onMounted(() => topicsStore.loadTopics());
</script>

<template>
    <div class="w-full flex-1 flex flex-col my-2">
        <TopicEditor v-if="topicsStore.topic" />

        <template v-else>
            <!-- Controls -->
            <div class="glass-card p-4 rounded-2xl mb-4 border border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div class="flex bg-slate-800/60 p-1 rounded-xl border border-slate-700/50 text-xs">
                    <button @click="topicsStore.setScope('authored')"
                            :class="topicsStore.scope === 'authored' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                            class="px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5">
                        <i class="fa-solid fa-user-pen"></i>Мої топіки
                    </button>
                    <button @click="topicsStore.setScope('all')"
                            :class="topicsStore.scope === 'all' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                            class="px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5">
                        <i class="fa-solid fa-layer-group"></i>Усі топіки
                    </button>
                </div>

                <button v-if="!creating" @click="creating = true"
                        class="px-3 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                    <i class="fa-solid fa-plus"></i>Створити топік
                </button>
            </div>

            <!-- Create form -->
            <form v-if="creating" @submit.prevent="create" class="glass-card p-4 rounded-2xl mb-4 border border-violet-500/40 flex flex-col gap-3">
                <label class="block text-xs font-medium text-slate-400">Назва топіку *</label>
                <input v-model="newTitle" required maxlength="100" type="text" placeholder="напр. Unit 5: Food"
                       class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500">
                <label class="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                    <input v-model="newPublic" type="checkbox" class="mt-0.5 accent-violet-500">
                    <span>Для всіх моїх студентів <span class="text-slate-500">— топік одразу з'явиться в «Публічних топіках» у кожного вашого студента. Вимкнути це потім не можна.</span></span>
                </label>
                <div class="flex justify-end gap-2">
                    <button type="button" @click="creating = false" class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800">Скасувати</button>
                    <button type="submit" class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-violet-500 hover:bg-violet-400">Створити</button>
                </div>
            </form>

            <!-- Topics list -->
            <div class="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
                <button
                        v-for="t in topicsStore.topics"
                        :key="t.id"
                        @click="topicsStore.openTopic(t)"
                        class="glass-card text-left p-4 rounded-2xl border border-slate-800 hover:border-violet-500/50 transition-all flex items-center justify-between gap-3">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-extrabold text-base text-white truncate">{{ t.title }}</span>
                            <span v-if="t.is_public" class="text-[9px] font-bold uppercase text-violet-300 bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.5 rounded-md">Для всіх студентів</span>
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5">
                            <template v-if="topicsStore.scope === 'all'">{{ t.owner_email }} · </template>
                            {{ pluralWords(Number(t.word_count)) }} · призначено: {{ t.assigned_count }} · {{ formatDate(t.created_at) }}
                        </p>
                    </div>
                    <i class="fa-solid fa-chevron-right text-slate-500"></i>
                </button>

                <div v-if="!topicsStore.loading && topicsStore.topics.length === 0" class="text-center py-12 text-slate-500">
                    <i class="fa-solid fa-layer-group text-3xl mb-2 block"></i>
                    <p>{{ topicsStore.scope === 'authored' ? 'У вас ще немає топіків. Створіть перший!' : 'Топіків ще немає.' }}</p>
                </div>
                <div v-if="topicsStore.loading" class="text-center py-2 text-slate-500"><i class="fa-solid fa-spinner fa-spin"></i></div>
            </div>
        </template>
    </div>
</template>
