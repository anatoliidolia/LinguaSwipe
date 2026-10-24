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
    // Word source: 'mine' = own collection (editable), 'all' = shared dictionary (read-only)
    const wordSource = ref(readStored(STORAGE_KEYS.wordSource) === 'all' ? 'all' : 'mine');

    const readOnly = computed(() => auth.isGuest || wordSource.value === 'all');
    const canModerate = computed(() => auth.isAdmin && !auth.isGuest && wordSource.value === 'all');

    // Колонку due_at додає migrations/004_review_schedule.sql, reverse_* — 005_reverse_direction.sql.
    // Поки міграції немає, працюємо без відповідної функції: без розкладу слова показуються щоразу всі,
    // без reverse_* немає режиму UA → EN.
    const hasSchedule = ref(true);
    const hasReverse = ref(true);

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

    // Поля прогресу напрямку для запису в базу (лише ті колонки, що вже є)
    function progressFields(card, dir) {
        if (dir === 'reverse') return { reverse_box: card.reverse_box || 0, reverse_due_at: card.reverse_due_at || null };
        return hasSchedule.value ? { box: card.box, due_at: card.due_at || null } : { box: card.box };
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
            if (auth.isGuest) {
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
    }

    return {
        words,
        wordSource,
        readOnly,
        canModerate,
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
