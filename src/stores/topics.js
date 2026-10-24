import { defineStore } from 'pinia';
import { ref } from 'vue';
import { sb, check, fetchAllRows } from '../lib/supabase.js';
import { parseCSVContent } from '../lib/csv.js';
import { prepareFormWord, prepareImport, hasWord, importSummary, emptyImportMessage } from '../lib/wordEditing.js';
import { useAuthStore } from './auth.js';
import { useUiStore } from './ui.js';

// Вкладка «Топіки» викладача й адміна: створення топіків, слова топіку, призначення студентам.
// Усі виклики — RPC з migrations/006_topics.sql, права перевіряє база.
export const useTopicsStore = defineStore('topics', () => {
    const auth = useAuthStore();
    const ui = useUiStore();

    // Список: 'authored' — мої топіки, 'all' — усі
    const scope = ref('authored');
    const topics = ref([]);
    const loading = ref(false);

    // Відкритий топік
    const topic = ref(null);
    const topicWords = ref([]);
    const topicStudents = ref([]);
    const topicLoading = ref(false);

    const canEdit = t => !!t && (auth.isAdmin || (auth.isTeacher && auth.user && t.owner_id === auth.user.id));

    let loadCounter = 0;
    async function loadTopics() {
        const loadId = ++loadCounter;
        loading.value = true;
        try {
            const rows = check(await sb.rpc('list_topics', { p_scope: scope.value }));
            if (loadId === loadCounter) topics.value = rows;
        } catch (err) {
            if (loadId === loadCounter) ui.statusMessage = err.message;
        } finally {
            if (loadId === loadCounter) loading.value = false;
        }
    }

    function setScope(next) {
        if (scope.value === next) return;
        scope.value = next;
        loadTopics();
    }

    async function createTopic(title, isPublic) {
        try {
            const id = check(await sb.rpc('create_topic', { p_title: title.trim(), p_is_public: isPublic }));
            scope.value = 'authored';
            await loadTopics();
            const created = topics.value.find(t => t.id === id);
            if (created) await openTopic(created);
            return true;
        } catch (err) {
            ui.statusMessage = err.message;
            return false;
        }
    }

    async function openTopic(t) {
        topic.value = { ...t };
        topicWords.value = [];
        topicStudents.value = [];
        topicLoading.value = true;
        try {
            const [rows, students] = await Promise.all([
                fetchAllRows(() => sb.rpc('topic_words', { p_topic: t.id })),
                canEdit(t) ? sb.rpc('topic_students', { p_topic: t.id }).then(check) : Promise.resolve([])
            ]);
            if (topic.value && topic.value.id === t.id) {
                topicWords.value = rows;
                topicStudents.value = students;
            }
        } catch (err) {
            ui.statusMessage = err.message;
        } finally {
            topicLoading.value = false;
        }
    }

    function closeTopic() {
        topic.value = null;
        topicWords.value = [];
        topicStudents.value = [];
        loadTopics();
    }

    // Перейменувати і/або відкрити всім студентам автора («для всіх» не вимикається — це перевіряє і база)
    async function updateTopic(title, isPublic) {
        try {
            check(await sb.rpc('update_topic', { p_topic: topic.value.id, p_title: title.trim(), p_is_public: isPublic }));
            topic.value.title = title.trim();
            topic.value.is_public = topic.value.is_public || isPublic;
            return true;
        } catch (err) {
            ui.statusMessage = err.message;
            return false;
        }
    }

    // Модерація (лише адмін): топік зникає разом зі словами і прогресом студентів
    async function deleteTopic() {
        if (!confirm(`Видалити топік «${topic.value.title}» разом зі словами і прогресом студентів? Це не можна скасувати.`)) return;
        try {
            check(await sb.rpc('delete_topic', { p_topic: topic.value.id }));
            closeTopic();
        } catch (err) {
            ui.statusMessage = err.message;
        }
    }

    // Той самий контракт, що й у words.saveWord: модалка викликає будь-який із них
    async function saveWord(form) {
        if (!topic.value) return false;
        const prepared = prepareFormWord(form);
        if (prepared.skip) return false;
        if (prepared.error) {
            ui.statusMessage = prepared.error;
            return false;
        }
        const { word, transcription, translation } = prepared;

        try {
            if (form.id) {
                const [updated] = check(await sb.rpc('topic_update_word', {
                    p_id: form.id, p_word: word, p_transcription: transcription, p_translation: translation
                }));
                const idx = topicWords.value.findIndex(w => w.id === updated.id);
                if (idx !== -1) topicWords.value[idx] = { ...topicWords.value[idx], ...updated };
            } else {
                if (hasWord(topicWords.value, word)) {
                    ui.statusMessage = `Слово «${word}» вже є в топіку.`;
                    return false;
                }
                const added = check(await sb.rpc('topic_add_words', {
                    p_topic: topic.value.id, p_words: [{ word, transcription, translation }]
                }));
                topicWords.value.unshift(...added);
            }
            return true;
        } catch (err) {
            ui.statusMessage = err.message;
            return false;
        }
    }

    async function importText(text, sourceLabel) {
        if (!topic.value) return false;
        const items = parseCSVContent(text);
        if (items.length === 0) {
            ui.statusMessage = emptyImportMessage(sourceLabel);
            return false;
        }
        const fresh = prepareImport(items, topicWords.value);

        try {
            const added = fresh.length
                ? check(await sb.rpc('topic_add_words', { p_topic: topic.value.id, p_words: fresh }))
                : [];
            topicWords.value.unshift(...added);
            ui.statusMessage = importSummary(sourceLabel, added.length, items.length - added.length);
            return true;
        } catch (err) {
            ui.statusMessage = err.message;
            return false;
        }
    }

    async function deleteWord(item) {
        if (!confirm(`Видалити «${item.word}» з топіку? Слово зникне в усіх студентів разом із прогресом по ньому.`)) return;
        try {
            check(await sb.rpc('topic_delete_word', { p_id: item.id }));
            topicWords.value = topicWords.value.filter(w => w.id !== item.id);
        } catch (err) {
            ui.statusMessage = err.message;
        }
    }

    // Кандидати для призначення: викладачу — його студенти, адміну — пошук серед усіх користувачів
    async function searchAssignable(search) {
        try {
            return check(await sb.rpc('list_users', {
                p_search: (search || '').trim() || null,
                p_only_my_students: !auth.isAdmin,
                p_limit: 50,
                p_offset: 0
            })).filter(u => u.id !== auth.user.id);
        } catch (err) {
            ui.statusMessage = err.message;
            return [];
        }
    }

    // Призначення не знімається — тому перед ним питаємо підтвердження
    async function assign(students) {
        if (!students.length) return false;
        const names = students.map(s => s.email).join(', ');
        if (!confirm(`Призначити топік «${topic.value.title}»: ${names}?\nСкасувати призначення потім не можна.`)) return false;
        try {
            const added = check(await sb.rpc('assign_topic', { p_topic: topic.value.id, p_students: students.map(s => s.id) }));
            topicStudents.value = check(await sb.rpc('topic_students', { p_topic: topic.value.id }));
            ui.statusMessage = added ? `Топік призначено. Нових студентів: ${added}.` : 'Цим студентам топік уже призначено.';
            return true;
        } catch (err) {
            ui.statusMessage = err.message;
            return false;
        }
    }

    function reset() {
        topics.value = [];
        scope.value = 'authored';
        topic.value = null;
        topicWords.value = [];
        topicStudents.value = [];
    }

    return {
        scope,
        topics,
        loading,
        topic,
        topicWords,
        topicStudents,
        topicLoading,
        canEdit,
        loadTopics,
        setScope,
        createTopic,
        openTopic,
        closeTopic,
        updateTopic,
        deleteTopic,
        saveWord,
        importText,
        deleteWord,
        searchAssignable,
        assign,
        reset
    };
});
