import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { sb, check, fetchAllRows, isMissingColumn, WORD_COLUMNS } from '../lib/supabase.js';
import {
    readStored, writeStored, readGuestProgress, writeGuestProgress, readGuestSchedule, writeGuestSchedule,
    readGuestReverse, writeGuestReverse, STORAGE_KEYS
} from '../lib/storage.js';
import { parseCSVContent } from '../lib/csv.js';
import { prepareFormWord, prepareImport, hasWord, importSummary, emptyImportMessage } from '../lib/wordEditing.js';
import { useAuthStore } from './auth.js';
import { useUiStore } from './ui.js';
import { usePracticeStore } from './practice.js';

export const useWordsStore = defineStore('words', () => {
    const auth = useAuthStore();
    const ui = useUiStore();

    const words = ref([]);
    // Word source: 'mine' = own collection (editable), 'all' = shared dictionary (read-only),
    // 'my_topics' / 'public_topics' — топіки від викладача (migrations/006_topics.sql): спершу список,
    // потім слова вибраного топіку (selectedTopic). Топіки — лише для зареєстрованих, не для гостей.
    const SOURCES = ['mine', 'my_topics', 'public_topics', 'all'];
    const storedSource = readStored(STORAGE_KEYS.wordSource);
    const wordSource = ref(SOURCES.includes(storedSource) ? storedSource : 'mine');

    const isTopicSource = computed(() => !auth.isGuest && (wordSource.value === 'my_topics' || wordSource.value === 'public_topics'));
    const readOnly = computed(() => auth.isGuest || wordSource.value !== 'mine');
    const canModerate = computed(() => auth.isAdmin && !auth.isGuest && wordSource.value === 'all');

    // Топіки студента: список для вибору і відкритий топік
    const topicList = ref([]);
    const topicListLoading = ref(false);
    const selectedTopic = ref(null);

    // Колонку due_at додає migrations/004_review_schedule.sql, reverse_* — 005_reverse_direction.sql.
    // Поки міграції немає, працюємо без відповідної функції: без розкладу слова показуються щоразу всі,
    // без reverse_* немає режиму UA → EN.
    const hasSchedule = ref(true);
    const hasReverse = ref(true);
    // Лічильники reviews / lapses у topic_progress (migrations/007_topic_progress_reports.sql) —
    // для звітів викладача. Без міграції topic_words їх не повертає, і ми їх не пишемо.
    const hasTopicStats = ref(true);

    // Запит із новими колонками, а якщо якоїсь міграції ще немає — з тими колонками, що є.
    // levels: від найповнішого набору до базового; makeQuery(level) будує запит для рівня.
    const SCHEMA_LEVELS = ['reverse', 'schedule', 'base'];
    async function fetchWithFallback(makeQuery) {
        for (const level of SCHEMA_LEVELS) {
            try {
                const rows = await fetchAllRows(() => makeQuery(level));
                hasReverse.value = level === 'reverse';
                hasSchedule.value = level !== 'base';
                return rows;
            } catch (err) {
                if (!isMissingColumn(err) || level === 'base') throw err;
            }
        }
    }

    const PROGRESS_COLUMNS = {
        reverse: ', due_at, reverse_box, reverse_due_at',
        schedule: ', due_at',
        base: ''
    };

    // Shared dictionary: words of all users (deduplicated), progress kept separately
    async function loadSharedWords() {
        const shared = await fetchAllRows(() => sb.rpc('public_words'));
        let progress = {};
        let schedule = {};
        let reverse = {};
        if (auth.isGuest) {
            progress = readGuestProgress();
            schedule = readGuestSchedule();
            reverse = readGuestReverse();
            hasSchedule.value = true;
            hasReverse.value = true;
        } else {
            const rows = await fetchWithFallback(level =>
                sb.from('word_progress').select('word_key, box' + PROGRESS_COLUMNS[level]));
            rows.forEach(r => {
                progress[r.word_key] = r.box;
                if (r.due_at) schedule[r.word_key] = r.due_at;
                if (r.reverse_box || r.reverse_due_at) reverse[r.word_key] = { box: r.reverse_box || 0, due: r.reverse_due_at || null };
            });
        }
        return shared.map((w, i) => {
            const key = w.word.toLowerCase();
            const rev = reverse[key] || {};
            return {
                id: `shared-${i}`, key, word: w.word, transcription: w.transcription, translation: w.translation,
                box: progress[key] || 0, due_at: schedule[key] || null,
                reverse_box: rev.box || 0, reverse_due_at: rev.due || null
            };
        });
    }

    function loadOwnWords() {
        return fetchWithFallback(level => sb.from('words')
            .select(WORD_COLUMNS + PROGRESS_COLUMNS[level])
            .order('id', { ascending: false }));
    }

    // Слова топіку разом із прогресом поточного користувача (у топіків є всі колонки розкладу)
    async function loadTopicWords(topicId) {
        const rows = await fetchAllRows(() => sb.rpc('topic_words', { p_topic: topicId }));
        hasSchedule.value = true;
        hasReverse.value = true;
        hasTopicStats.value = rows.length === 0 || 'lapses' in rows[0];
        return rows.map(w => ({ ...w, topic: true }));
    }

    async function loadTopicList() {
        topicListLoading.value = true;
        try {
            const scope = wordSource.value === 'my_topics' ? 'assigned' : 'public';
            return check(await sb.rpc('list_topics', { p_scope: scope }));
        } finally {
            topicListLoading.value = false;
        }
    }

    let loadCounter = 0;
    async function loadWords() {
        const loadId = ++loadCounter;
        auth.loadRole();
        let loaded = [];
        let topics = null;
        try {
            if (isTopicSource.value && selectedTopic.value) loaded = await loadTopicWords(selectedTopic.value.id);
            else if (isTopicSource.value) topics = await loadTopicList();
            else loaded = readOnly.value ? await loadSharedWords() : await loadOwnWords();
        } catch (err) {
            ui.statusMessage = err.message;
        }
        if (loadId !== loadCounter) return; // a newer load (e.g. source switch) has started
        if (topics) topicList.value = topics;
        words.value = loaded;
        usePracticeStore().startSession();
    }

    function setWordSource(source) {
        if (wordSource.value === source || !SOURCES.includes(source)) return;
        wordSource.value = source;
        writeStored(STORAGE_KEYS.wordSource, source);
        selectedTopic.value = null;
        topicList.value = [];
        ui.statusMessage = '';
        loadWords();
    }

    function openTopic(topic) {
        selectedTopic.value = { id: topic.id, title: topic.title, owner_name: topic.owner_name };
        ui.statusMessage = '';
        loadWords();
    }

    function closeTopic() {
        selectedTopic.value = null;
        loadWords();
    }

    // «★ У мій словник»: копія слова топіку у власну колекцію (розклад починається з нуля)
    async function copyToMine(item) {
        try {
            check(await sb.from('words').insert({
                word: item.word, transcription: item.transcription || null, translation: item.translation
            }));
            ui.statusMessage = `Слово «${item.word}» додано у ваш словник.`;
        } catch (err) {
            ui.statusMessage = err.message;
        }
    }

    // Поля прогресу напрямку для запису в базу (лише ті колонки, що вже є)
    function progressFields(card, dir) {
        const fields = dir === 'reverse'
            ? { reverse_box: card.reverse_box || 0, reverse_due_at: card.reverse_due_at || null }
            : hasSchedule.value ? { box: card.box, due_at: card.due_at || null } : { box: card.box };
        if (card.topic && hasTopicStats.value) {
            Object.assign(fields, { reviews: card.reviews || 0, lapses: card.lapses || 0, last_reviewed_at: card.last_reviewed_at || null });
        }
        return fields;
    }

    function persistGuest(card, dir) {
        if (dir === 'reverse') {
            const reverse = readGuestReverse();
            reverse[card.key] = { box: card.reverse_box || 0, due: card.reverse_due_at || null };
            writeGuestReverse(reverse);
            return;
        }
        const progress = readGuestProgress();
        progress[card.key] = card.box;
        writeGuestProgress(progress);
        const guestSchedule = readGuestSchedule();
        if (card.due_at) guestSchedule[card.key] = card.due_at;
        else delete guestSchedule[card.key];
        writeGuestSchedule(guestSchedule);
    }

    // Зберігає рівень і дату наступного повторення для напрямку dir ('forward' | 'reverse')
    async function persistWord(card, dir = 'forward') {
        try {
            if (card.topic) {
                // Прогрес по слову топіку — свій рядок у topic_progress; інший напрямок не зачіпається
                check(await sb.from('topic_progress').upsert(
                    { user_id: auth.user.id, topic_word_id: card.id, ...progressFields(card, dir), updated_at: new Date().toISOString() },
                    { onConflict: 'user_id,topic_word_id' }));
            } else if (auth.isGuest) {
                persistGuest(card, dir);
            } else if (card.key) {
                // Upsert оновлює лише передані колонки: прогрес іншого напрямку не зачіпається
                check(await sb.from('word_progress').upsert(
                    { user_id: auth.user.id, word_key: card.key, ...progressFields(card, dir) },
                    { onConflict: 'user_id,word_key' }));
            } else {
                check(await sb.from('words').update(progressFields(card, dir)).eq('id', card.id));
            }
        } catch (err) {
            ui.statusMessage = 'Не вдалося зберегти прогрес: ' + err.message;
        }
    }

    function addToCollection(word) {
        words.value.unshift(word);
        usePracticeStore().enqueue(word.id);
    }

    // ADD MANY WORDS TO THE USER'S COLLECTION (skips words already in it)
    async function importText(text, sourceLabel) {
        const items = parseCSVContent(text);
        if (items.length === 0) {
            ui.statusMessage = emptyImportMessage(sourceLabel);
            return false;
        }
        const fresh = prepareImport(items, words.value);

        try {
            const added = fresh.length
                ? check(await sb.from('words').insert(fresh).select(WORD_COLUMNS))
                : [];
            added.forEach(addToCollection);
            ui.statusMessage = importSummary(sourceLabel, added.length, items.length - fresh.length);
            return true;
        } catch (err) {
            ui.statusMessage = err.message;
            return false;
        }
    }

    // Додає нове слово або оновлює існуюче (form.id). Повертає true, якщо збережено.
    async function saveWord(form) {
        const prepared = prepareFormWord(form);
        if (prepared.skip) return false;
        if (prepared.error) {
            ui.statusMessage = prepared.error;
            return false;
        }
        const { word, transcription, translation } = prepared;

        try {
            if (form.id) {
                const updated = check(await sb.from('words')
                    .update({ word, transcription, translation })
                    .eq('id', form.id)
                    .select(WORD_COLUMNS)
                    .single());
                const idx = words.value.findIndex(w => w.id === updated.id);
                // Зміна тексту не чіпає розклад: зберігаємо due_at, якого немає у відповіді
                if (idx !== -1) words.value[idx] = { ...words.value[idx], ...updated };
            } else {
                if (hasWord(words.value, word)) {
                    ui.statusMessage = `Слово «${word}» вже є у вашій колекції.`;
                    return false;
                }
                const newWord = check(await sb.from('words')
                    .insert({ word, transcription, translation })
                    .select(WORD_COLUMNS)
                    .single());
                addToCollection(newWord);
            }
            return true;
        } catch (err) {
            ui.statusMessage = err.message;
            return false;
        }
    }

    async function deleteWord(id) {
        try {
            check(await sb.from('words').delete().eq('id', id));
            words.value = words.value.filter(w => w.id !== id);
            usePracticeStore().remove(id);
        } catch (err) {
            ui.statusMessage = err.message;
        }
    }

    // Супер-адмін: видалити слово в усіх користувачів (напр. нецензурне)
    async function adminDeleteWord(item) {
        if (!canModerate.value) return;
        if (!confirm(`Видалити «${item.word}» у всіх користувачів? Це не можна скасувати.`)) return;
        try {
            const deleted = check(await sb.rpc('admin_delete_word', { p_word: item.word }));
            words.value = words.value.filter(w => w.key !== item.key);
            usePracticeStore().remove(item.id);
            ui.statusMessage = `Слово «${item.word}» видалено (записів: ${deleted}).`;
        } catch (err) {
            ui.statusMessage = err.message;
        }
    }

    function reset() {
        words.value = [];
        topicList.value = [];
        selectedTopic.value = null;
    }

    return {
        words,
        wordSource,
        readOnly,
        canModerate,
        isTopicSource,
        topicList,
        topicListLoading,
        selectedTopic,
        openTopic,
        closeTopic,
        copyToMine,
        hasSchedule,
        hasReverse,
        loadWords,
        setWordSource,
        persistWord,
        importText,
        saveWord,
        deleteWord,
        adminDeleteWord,
        reset
    };
});
