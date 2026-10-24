import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { sb, check, fetchAllRows, isMissingColumn, WORD_COLUMNS } from '../lib/supabase.js';
import {
    readStored, writeStored, readGuestProgress, writeGuestProgress, readGuestSchedule, writeGuestSchedule, STORAGE_KEYS
} from '../lib/storage.js';
import { isDue, daysUntil } from '../lib/srs.js';
import { parseCSVContent } from '../lib/csv.js';
import { prepareFormWord, prepareImport, hasWord, importSummary, emptyImportMessage } from '../lib/wordEditing.js';
import { useAuthStore } from './auth.js';
import { useUiStore } from './ui.js';
import { usePracticeStore } from './practice.js';

export const useWordsStore = defineStore('words', () => {
    const auth = useAuthStore();
    const ui = useUiStore();

    const words = ref([]);
    // Word source: 'mine' = own collection (editable), 'all' = shared dictionary (read-only)
    const wordSource = ref(readStored(STORAGE_KEYS.wordSource) === 'all' ? 'all' : 'mine');

    const readOnly = computed(() => auth.isGuest || wordSource.value === 'all');
    const canModerate = computed(() => auth.isAdmin && !auth.isGuest && wordSource.value === 'all');

    // Колонку due_at додає migrations/004_review_schedule.sql. Поки її немає в базі,
    // слова показуються щоразу всі, як до появи розкладу, а дата повторення не зберігається.
    const hasSchedule = ref(true);

    const dueCount = computed(() => words.value.filter(w => isDue(w)).length);

    // Найближчий день, коли з'являться нові слова для повторення, і скільки їх буде
    const nextReview = computed(() => {
        let days = Infinity;
        let count = 0;
        words.value.forEach(w => {
            if (isDue(w)) return;
            const d = daysUntil(w.due_at);
            if (d < days) { days = d; count = 1; } else if (d === days) count++;
        });
        return count ? { days, count } : null;
    });

    // Скільки слів чекає на повторення: сьогодні, завтра і протягом тижня
    const forecast = computed(() => {
        const result = { today: 0, tomorrow: 0, week: 0 };
        words.value.forEach(w => {
            const d = isDue(w) ? 0 : daysUntil(w.due_at);
            if (d <= 0) result.today++;
            else if (d === 1) result.tomorrow++;
            if (d <= 7) result.week++;
        });
        return result;
    });

    // Запит із due_at, а якщо міграції ще немає — той самий запит без неї
    async function fetchWithSchedule(makeQuery) {
        try {
            const rows = await fetchAllRows(() => makeQuery(true));
            hasSchedule.value = true;
            return rows;
        } catch (err) {
            if (!isMissingColumn(err)) throw err;
            hasSchedule.value = false;
            return fetchAllRows(() => makeQuery(false));
        }
    }

    // Shared dictionary: words of all users (deduplicated), progress kept separately
    async function loadSharedWords() {
        const shared = await fetchAllRows(() => sb.rpc('public_words'));
        let progress = {};
        let schedule = {};
        if (auth.isGuest) {
            progress = readGuestProgress();
            schedule = readGuestSchedule();
        } else {
            const rows = await fetchWithSchedule(withDue =>
                sb.from('word_progress').select(withDue ? 'word_key, box, due_at' : 'word_key, box'));
            rows.forEach(r => {
                progress[r.word_key] = r.box;
                if (r.due_at) schedule[r.word_key] = r.due_at;
            });
        }
        return shared.map((w, i) => {
            const key = w.word.toLowerCase();
            return {
                id: `shared-${i}`, key, word: w.word, transcription: w.transcription, translation: w.translation,
                box: progress[key] || 0, due_at: schedule[key] || null
            };
        });
    }

    function loadOwnWords() {
        return fetchWithSchedule(withDue => sb.from('words')
            .select(withDue ? WORD_COLUMNS + ', due_at' : WORD_COLUMNS)
            .order('id', { ascending: false }));
    }

    let loadCounter = 0;
    async function loadWords() {
        const loadId = ++loadCounter;
        auth.loadRole();
        let loaded = [];
        try {
            loaded = readOnly.value ? await loadSharedWords() : await loadOwnWords();
        } catch (err) {
            ui.statusMessage = err.message;
        }
        if (loadId !== loadCounter) return; // a newer load (e.g. source switch) has started
        words.value = loaded;
        usePracticeStore().startSession();
    }

    function setWordSource(source) {
        if (wordSource.value === source) return;
        wordSource.value = source;
        writeStored(STORAGE_KEYS.wordSource, source);
        ui.statusMessage = '';
        loadWords();
    }

    // Зберігає рівень і дату наступного повторення
    async function persistWord(card) {
        const schedule = hasSchedule.value ? { due_at: card.due_at } : {};
        try {
            if (auth.isGuest) {
                const progress = readGuestProgress();
                progress[card.key] = card.box;
                writeGuestProgress(progress);
                const guestSchedule = readGuestSchedule();
                if (card.due_at) guestSchedule[card.key] = card.due_at;
                else delete guestSchedule[card.key];
                writeGuestSchedule(guestSchedule);
            } else if (card.key) {
                check(await sb.from('word_progress').upsert(
                    { user_id: auth.user.id, word_key: card.key, box: card.box, ...schedule },
                    { onConflict: 'user_id,word_key' }));
            } else {
                check(await sb.from('words').update({ box: card.box, ...schedule }).eq('id', card.id));
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
    }

    return {
        words,
        wordSource,
        readOnly,
        canModerate,
        hasSchedule,
        dueCount,
        nextReview,
        forecast,
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
