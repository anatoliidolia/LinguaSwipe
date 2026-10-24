import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { sb, check, fetchAllRows, WORD_COLUMNS } from '../lib/supabase.js';
import { readStored, writeStored, readGuestProgress, writeGuestProgress, STORAGE_KEYS } from '../lib/storage.js';
import { normalizeTranscription, validateWord, MAX_WORD_LENGTH, MAX_TRANSLATION_LENGTH } from '../lib/validation.js';
import { parseCSVContent } from '../lib/csv.js';
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

    // Shared dictionary: words of all users (deduplicated), progress kept separately
    async function loadSharedWords() {
        const shared = await fetchAllRows(() => sb.rpc('public_words'));
        let progress = {};
        if (auth.isGuest) {
            progress = readGuestProgress();
        } else {
            const rows = await fetchAllRows(() => sb.from('word_progress').select('word_key, box'));
            rows.forEach(r => { progress[r.word_key] = r.box; });
        }
        return shared.map((w, i) => {
            const key = w.word.toLowerCase();
            return { id: `shared-${i}`, key, word: w.word, transcription: w.transcription, translation: w.translation, box: progress[key] || 0 };
        });
    }

    let loadCounter = 0;
    async function loadWords() {
        const loadId = ++loadCounter;
        auth.loadAdminFlag();
        let loaded = [];
        try {
            loaded = readOnly.value
                ? await loadSharedWords()
                : check(await sb.from('words')
                    .select(WORD_COLUMNS)
                    .order('id', { ascending: false }));
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

    async function persistWord(card) {
        try {
            if (auth.isGuest) {
                const progress = readGuestProgress();
                progress[card.key] = card.box;
                writeGuestProgress(progress);
            } else if (card.key) {
                check(await sb.from('word_progress').upsert(
                    { user_id: auth.user.id, word_key: card.key, box: card.box },
                    { onConflict: 'user_id,word_key' }));
            } else {
                check(await sb.from('words').update({ box: card.box }).eq('id', card.id));
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
    async function importItems(items, sourceLabel) {
        if (items.length === 0) {
            ui.statusMessage = `${sourceLabel}: не знайдено жодного рядка у форматі «слово, переклад».`;
            return false;
        }
        const seen = new Set(words.value.map(w => w.word.toLowerCase()));
        const fresh = [];
        items.forEach(({ word, transcription, translation }) => {
            const w = word.trim().slice(0, MAX_WORD_LENGTH);
            const tr = normalizeTranscription(transcription);
            const t = translation.trim().slice(0, MAX_TRANSLATION_LENGTH);
            if (validateWord(w, t, tr) || seen.has(w.toLowerCase())) return;
            seen.add(w.toLowerCase());
            fresh.push({ word: w, transcription: tr || null, translation: t });
        });
        const skipped = items.length - fresh.length;

        try {
            const added = fresh.length
                ? check(await sb.from('words').insert(fresh).select(WORD_COLUMNS))
                : [];
            added.forEach(addToCollection);
            ui.statusMessage = `${sourceLabel}: додано ${added.length} слів` +
                (skipped ? `, пропущено ${skipped} (дублікати, порожні або з недозволеними символами)` : '');
            return true;
        } catch (err) {
            ui.statusMessage = err.message;
            return false;
        }
    }

    function importText(text, sourceLabel) {
        return importItems(parseCSVContent(text), sourceLabel);
    }

    // Додає нове слово або оновлює існуюче (form.id). Повертає true, якщо збережено.
    async function saveWord(form) {
        const word = form.word.trim();
        const translation = form.translation.trim();
        const transcription = normalizeTranscription(form.transcription);
        if (!word || !translation) return false;
        const invalid = validateWord(word, translation, transcription);
        if (invalid) {
            ui.statusMessage = invalid;
            return false;
        }

        try {
            if (form.id) {
                const updated = check(await sb.from('words')
                    .update({ word, transcription: transcription || null, translation })
                    .eq('id', form.id)
                    .select(WORD_COLUMNS)
                    .single());
                const idx = words.value.findIndex(w => w.id === updated.id);
                if (idx !== -1) words.value[idx] = updated;
            } else {
                if (words.value.some(w => w.word.toLowerCase() === word.toLowerCase())) {
                    ui.statusMessage = `Слово «${word}» вже є у вашій колекції.`;
                    return false;
                }
                const newWord = check(await sb.from('words')
                    .insert({ word, transcription: transcription || null, translation })
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
