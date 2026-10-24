<script setup>
import { computed, inject, onUnmounted, ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth.js';
import { useUiStore } from '../stores/ui.js';
import { useTopicsStore } from '../stores/topics.js';
import { pluralWords } from '../lib/srs.js';
import WordList from './WordList.vue';

const auth = useAuthStore();
const ui = useUiStore();
const topicsStore = useTopicsStore();
const openFilePicker = inject('openFilePicker');

const editable = computed(() => topicsStore.canEdit(topicsStore.topic));
// Адмін може відкрити чужий топік: тоді «студенти автора», а не «мої»
const studentsLabel = computed(() => topicsStore.topic.owner_id === auth.user.id ? 'моїх студентів' : 'студентів автора');

// Назва
const title = ref(topicsStore.topic.title);
const titleChanged = computed(() => title.value.trim() && title.value.trim() !== topicsStore.topic.title);
const saveTitle = () => topicsStore.updateTopic(title.value, false);

function makePublic() {
    if (!confirm(`Відкрити топік для всіх ${studentsLabel.value}? Вимкнути це потім не можна.`)) return;
    topicsStore.updateTopic(topicsStore.topic.title, true);
}

// Призначення: викладач обирає зі своїх студентів, адмін шукає серед усіх
const assignOpen = ref(false);
const assignSearch = ref('');
const candidates = ref([]);
const selected = ref(new Set());
const assignedIds = computed(() => new Set(topicsStore.topicStudents.map(s => s.id)));

async function loadCandidates() {
    candidates.value = await topicsStore.searchAssignable(assignSearch.value);
}

function toggleAssign() {
    assignOpen.value = !assignOpen.value;
    selected.value = new Set();
    if (assignOpen.value) loadCandidates();
}

function toggleCandidate(id) {
    const next = new Set(selected.value);
    if (next.has(id)) next.delete(id); else next.add(id);
    selected.value = next;
}

async function assignSelected() {
    const students = candidates.value.filter(c => selected.value.has(c.id));
    if (await topicsStore.assign(students)) {
        selected.value = new Set();
        assignOpen.value = false;
    }
}

let searchTimer = null;
watch(assignSearch, () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadCandidates, 300);
});
onUnmounted(() => clearTimeout(searchTimer));

const formatDate = value => new Date(value).toLocaleDateString('uk-UA');
</script>

<template>
    <div class="w-full flex-1 flex flex-col gap-4">
        <div class="flex items-center justify-between gap-3 px-1">
            <button @click="topicsStore.closeTopic()" class="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5">
                <i class="fa-solid fa-arrow-left"></i>До топіків
            </button>
            <button v-if="auth.isAdmin" @click="topicsStore.deleteTopic()" title="Модерація: видалити топік разом зі словами і прогресом"
                    class="text-[11px] font-semibold text-rose-400/80 hover:text-rose-400 flex items-center gap-1.5">
                <i class="fa-solid fa-trash"></i>Видалити топік
            </button>
        </div>

        <!-- Назва і видимість -->
        <div class="glass-card p-4 rounded-2xl border border-violet-500/30 flex flex-col gap-3">
            <div v-if="editable" class="flex gap-2">
                <input v-model="title" maxlength="100" type="text"
                       class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-violet-500">
                <button v-if="titleChanged" @click="saveTitle" class="px-3 py-2 rounded-xl text-xs font-bold text-white bg-violet-500 hover:bg-violet-400">Зберегти</button>
            </div>
            <h2 v-else class="text-lg font-extrabold text-white">{{ topicsStore.topic.title }}</h2>

            <div class="flex items-center gap-2 flex-wrap text-xs">
                <span v-if="topicsStore.topic.is_public" class="text-violet-300 bg-violet-500/15 border border-violet-500/30 px-2 py-1 rounded-lg font-semibold">
                    <i class="fa-solid fa-users-rectangle mr-1"></i>Для всіх {{ studentsLabel }}
                </span>
                <button v-else-if="editable" @click="makePublic" class="text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1 rounded-lg font-semibold">
                    <i class="fa-solid fa-users-rectangle mr-1"></i>Відкрити для всіх {{ studentsLabel }}
                </button>
                <span class="text-slate-500">{{ pluralWords(topicsStore.topicWords.length) }}</span>
                <span v-if="topicsStore.topic.owner_email && topicsStore.topic.owner_id !== auth.user.id" class="text-slate-500">· автор {{ topicsStore.topic.owner_email }}</span>
            </div>
            <p v-if="!editable" class="text-[11px] text-slate-500"><i class="fa-solid fa-eye mr-1"></i>Чужий топік — лише перегляд.</p>
        </div>

        <!-- Студенти -->
        <div v-if="editable" class="glass-card p-4 rounded-2xl border border-slate-800 flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-bold text-white"><i class="fa-solid fa-user-graduate mr-1.5 text-emerald-400"></i>Призначено особисто: {{ topicsStore.topicStudents.length }}</h3>
                <button @click="toggleAssign" class="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500">
                    <i class="fa-solid" :class="assignOpen ? 'fa-xmark' : 'fa-plus'"></i> {{ assignOpen ? 'Закрити' : 'Призначити студентам' }}
                </button>
            </div>

            <div v-if="topicsStore.topicStudents.length" class="flex flex-wrap gap-1.5">
                <span v-for="s in topicsStore.topicStudents" :key="s.id" :title="'Призначено ' + formatDate(s.assigned_at)"
                      class="text-[11px] text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg">{{ s.email }}</span>
            </div>

            <div v-if="assignOpen" class="flex flex-col gap-2 border-t border-slate-800 pt-3">
                <input v-if="auth.isAdmin" v-model="assignSearch" type="text" placeholder="Пошук користувача за email..."
                       class="w-full bg-slate-900/90 border border-slate-700/80 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500">
                <p v-if="!candidates.length" class="text-xs text-slate-500">
                    {{ auth.isAdmin ? 'Нікого не знайдено.' : 'У вас ще немає студентів — додайте їх у вкладці «Студенти».' }}
                </p>
                <div class="flex flex-col gap-1 max-h-60 overflow-y-auto">
                    <label v-for="c in candidates" :key="c.id"
                           class="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg"
                           :class="assignedIds.has(c.id) ? 'text-slate-500' : 'text-slate-200 hover:bg-slate-800 cursor-pointer'">
                        <input type="checkbox" class="accent-emerald-500"
                               :checked="assignedIds.has(c.id) || selected.has(c.id)"
                               :disabled="assignedIds.has(c.id)"
                               @change="toggleCandidate(c.id)">
                        <span class="truncate">{{ c.email }}</span>
                        <span v-if="assignedIds.has(c.id)" class="text-[10px] ml-auto">вже призначено</span>
                    </label>
                </div>
                <button :disabled="!selected.size" @click="assignSelected"
                        class="self-end px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40">
                    Призначити обраним ({{ selected.size }})
                </button>
                <p class="text-[11px] text-slate-500"><i class="fa-solid fa-circle-info mr-1"></i>Призначений топік лишається в студента назавжди.</p>
            </div>
        </div>

        <!-- Слова топіку -->
        <div v-if="topicsStore.topicLoading" class="flex items-center justify-center py-12 text-slate-500">
            <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
        </div>
        <WordList v-else :words="topicsStore.topicWords" :show-box="false" empty-text="У топіку ще немає слів.">
            <template #toolbar>
                <div v-if="editable" class="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button @click="openFilePicker('topic')"
                            class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5">
                        <i class="fa-solid fa-file-arrow-up"></i><span>Файл</span>
                    </button>
                    <button @click="ui.openAddModal('topic')"
                            class="px-3 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5">
                        <i class="fa-solid fa-plus"></i><span>Одне слово</span>
                    </button>
                    <button @click="ui.openBulkModal('topic')"
                            class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5">
                        <i class="fa-solid fa-file-import"></i><span>Вставити текст</span>
                    </button>
                </div>
            </template>
            <template #actions="{ item }">
                <template v-if="editable">
                    <button @click="ui.editWord(item, 'topic')" class="text-slate-400 hover:text-sky-400 text-xs p-1.5 rounded-lg hover:bg-slate-800 transition-all">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button @click="topicsStore.deleteWord(item)" class="text-slate-400 hover:text-rose-400 text-xs p-1.5 rounded-lg hover:bg-slate-800 transition-all">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </template>
            </template>
        </WordList>
    </div>
</template>
