import { normalizeTranscription, validateWord, MAX_WORD_LENGTH, MAX_TRANSLATION_LENGTH } from './validation.js';

// Спільна підготовка слів для власного словника і словника студента

// Форма «одне слово» → { error } або { word, transcription, translation }.
// Порожні поля (вони required у формі) → { skip: true }.
export function prepareFormWord(form) {
    const word = form.word.trim();
    const translation = form.translation.trim();
    const transcription = normalizeTranscription(form.transcription);
    if (!word || !translation) return { skip: true };
    const error = validateWord(word, translation, transcription);
    if (error) return { error };
    return { word, transcription: transcription || null, translation };
}

export function hasWord(words, word) {
    return words.some(w => w.word.toLowerCase() === word.toLowerCase());
}

// Імпорт: відкидає некоректні рядки і слова, які вже є у словнику
export function prepareImport(items, existingWords) {
    const seen = new Set(existingWords.map(w => w.word.toLowerCase()));
    const fresh = [];
    items.forEach(({ word, transcription, translation }) => {
        const w = word.trim().slice(0, MAX_WORD_LENGTH);
        const tr = normalizeTranscription(transcription);
        const t = translation.trim().slice(0, MAX_TRANSLATION_LENGTH);
        if (validateWord(w, t, tr) || seen.has(w.toLowerCase())) return;
        seen.add(w.toLowerCase());
        fresh.push({ word: w, transcription: tr || null, translation: t });
    });
    return fresh;
}

export function importSummary(sourceLabel, addedCount, skippedCount) {
    return `${sourceLabel}: додано ${addedCount} слів` +
        (skippedCount ? `, пропущено ${skippedCount} (дублікати, порожні або з недозволеними символами)` : '');
}

export function emptyImportMessage(sourceLabel) {
    return `${sourceLabel}: не знайдено жодного рядка у форматі «слово, переклад».`;
}
