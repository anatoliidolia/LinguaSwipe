import { defineStore } from 'pinia';
import { ref } from 'vue';
import { sb, check, fetchAllRows } from '../lib/supabase.js';
import { parseCSVContent } from '../lib/csv.js';
import { prepareFormWord, prepareImport, hasWord, importSummary, emptyImportMessage } from '../lib/wordEditing.js';
import { useAuthStore } from './auth.js';
import { useUiStore } from './ui.js';

const PAGE_SIZE = 50;

// Адмінка: список користувачів, «мої студенти», ролі і словник вибраного студента.
// Усі виклики йдуть через RPC з migrations/003_teachers.sql — права перевіряє база.
export const useStudentsStore = defineStore('students', () => {
    const auth = useAuthStore();
    const ui = useUiStore();

    // Список користувачів
    const users = ref([]);
    const search = ref('');
    const onlyMyStudents = ref(false);
    const hasMore = ref(false);
    const loading = ref(false);

    // Відкритий словник студента
    const student = ref(null);
    const studentWords = ref([]);
    const studentLoading = ref(false);

    let loadCounter = 0;
    async function loadUsers({ append = false } = {}) {
        const loadId = ++loadCounter;
        loading.value = true;
        try {
            const page = check(await sb.rpc('list_users', {
                p_search: search.value.trim() || null,
                p_only_my_students: onlyMyStudents.value,
                p_limit: PAGE_SIZE,
                p_offset: append ? users.value.length : 0
            }));
            if (loadId !== loadCounter) return; // пошук змінився, поки йшов запит
            users.value = append ? users.value.concat(page) : page;
            hasMore.value = page.length === PAGE_SIZE;
        } catch (err) {
            if (loadId === loadCounter) ui.statusMessage = err.message;
        } finally {
            if (loadId === loadCounter) loading.value = false;
        }
    }

    // Чи може поточний користувач відкрити словник цього користувача (остаточно вирішує база)
    function canEditDictionary(user) {
        if (!auth.user || user.id === auth.user.id) return false;
        return auth.isAdmin || (auth.isTeacher && user.is_my_student);
    }

    async function setStudent(user, isStudent) {
        try {
            check(await sb.rpc('set_student', { p_student: user.id, p_is_student: isStudent }));
            user.is_my_student = isStudent;
            if (!isStudent && onlyMyStudents.value) users.value = users.value.filter(u => u.id !== user.id);
        } catch (err) {
            ui.statusMessage = err.message;
        }
    }

    async function setTeacher(user, isTeacher) {
        try {
            check(await sb.rpc('set_teacher', { p_user: user.id, p_is_teacher: isTeacher }));
            user.is_teacher = isTeacher;
        } catch (err) {
            ui.statusMessage = err.message;
        }
    }

    async function openStudent(user) {
        student.value = { id: user.id, email: user.email };
        studentWords.value = [];
        studentLoading.value = true;
        try {
            const rows = await fetchAllRows(() => sb.rpc('student_words', { p_student: user.id }));
            if (student.value && student.value.id === user.id) studentWords.value = rows;
        } catch (err) {
            ui.statusMessage = err.message;
        } finally {
            studentLoading.value = false;
        }
    }

    function closeStudent() {
        student.value = null;
        studentWords.value = [];
    }

    function updateWordCount(delta) {
        const row = users.value.find(u => student.value && u.id === student.value.id);
        if (row) row.word_count = Number(row.word_count) + delta;
    }

    // Той самий контракт, що й у words.saveWord: модалка викликає будь-який із них
    async function saveWord(form) {
        if (!student.value) return false;
        const prepared = prepareFormWord(form);
        if (prepared.skip) return false;
        if (prepared.error) {
            ui.statusMessage = prepared.error;
            return false;
        }
        const { word, transcription, translation } = prepared;

        try {
            if (form.id) {
                const [updated] = check(await sb.rpc('student_update_word', {
                    p_id: form.id, p_word: word, p_transcription: transcription, p_translation: translation
                }));
                const idx = studentWords.value.findIndex(w => w.id === updated.id);
                if (idx !== -1) studentWords.value[idx] = updated;
            } else {
                if (hasWord(studentWords.value, word)) {
                    ui.statusMessage = `Слово «${word}» вже є у словнику студента.`;
                    return false;
                }
                const added = check(await sb.rpc('student_add_words', {
                    p_student: student.value.id, p_words: [{ word, transcription, translation }]
                }));
                studentWords.value.unshift(...added);
                updateWordCount(added.length);
            }
            return true;
        } catch (err) {
            ui.statusMessage = err.message;
            return false;
        }
    }

    async function importText(text, sourceLabel) {
        if (!student.value) return false;
        const items = parseCSVContent(text);
        if (items.length === 0) {
            ui.statusMessage = emptyImportMessage(sourceLabel);
            return false;
        }
        const fresh = prepareImport(items, studentWords.value);

        try {
            const added = fresh.length
                ? check(await sb.rpc('student_add_words', { p_student: student.value.id, p_words: fresh }))
                : [];
            studentWords.value.unshift(...added);
            updateWordCount(added.length);
            ui.statusMessage = importSummary(sourceLabel, added.length, items.length - added.length);
            return true;
        } catch (err) {
            ui.statusMessage = err.message;
            return false;
        }
    }

    async function deleteWord(item) {
        if (!confirm(`Видалити «${item.word}» зі словника ${student.value.email}?`)) return;
        try {
            check(await sb.rpc('student_delete_word', { p_id: item.id }));
            studentWords.value = studentWords.value.filter(w => w.id !== item.id);
            updateWordCount(-1);
        } catch (err) {
            ui.statusMessage = err.message;
        }
    }

    function reset() {
        users.value = [];
        search.value = '';
        onlyMyStudents.value = false;
        hasMore.value = false;
        closeStudent();
    }

    return {
        users,
        search,
        onlyMyStudents,
        hasMore,
        loading,
        student,
        studentWords,
        studentLoading,
        loadUsers,
        canEditDictionary,
        setStudent,
        setTeacher,
        openStudent,
        closeStudent,
        saveWord,
        importText,
        deleteWord,
        reset
    };
});
