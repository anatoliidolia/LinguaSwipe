// Дозволені символи — ті самі правила, що й у базі (supabase_setup.sql, migrations/)
// і в розширенні (chrome-extension/background.js). Змінюєте тут — змінюйте всюди.
// Слово: латиниця, цифри, пробіл, апостроф, дефіс, крапка. Переклад: кирилиця/латиниця,
// цифри і звичайна пунктуація. Тож HTML/JS (< > & { } ` = тощо) у словник не потрапить.
export const WORD_PATTERN = /^[A-Za-z][A-Za-z0-9 '’ʼ.-]*$/;
export const TRANSLATION_PATTERN = /^[A-Za-zА-яЁёЄєІіЇїҐґ0-9«"(][A-Za-zА-яЁёЄєІіЇїҐґ0-9 ,;:.!?()'’ʼ"«»\/–—-]*$/;
// Транскрипція (IPA): будь-які символи, крім < > & { } ` = $ \ " і дужок [ ]
export const TRANSCRIPTION_PATTERN = /^[^<>&{}`=$\\"\[\]]+$/;

export const MAX_WORD_LENGTH = 200;
export const MAX_TRANSLATION_LENGTH = 500;
export const MAX_TRANSCRIPTION_LENGTH = 200;

// "[ˈwɜːd]", "/ˈwɜːd/" або "ˈwɜːd" → "ˈwɜːd"; "[]" → ''
export function normalizeTranscription(value) {
    const t = String(value || '').replace(/\s+/g, ' ').trim();
    const m = t.match(/^\[(.*)\]$/) || t.match(/^\/(.*)\/$/);
    return (m ? m[1] : t).trim();
}

// Повертає текст помилки або '' якщо пара коректна (транскрипція — уже нормалізована)
export function validateWord(word, translation, transcription = '') {
    if (!word || !translation) return 'Введіть слово і переклад';
    if (transcription && (transcription.length > MAX_TRANSCRIPTION_LENGTH || !TRANSCRIPTION_PATTERN.test(transcription))) {
        return 'Транскрипція містить недозволені символи: < > & { } ` = $ \\ " [ ]';
    }
    if (word.length > MAX_WORD_LENGTH || !WORD_PATTERN.test(word)) {
        return `Слово «${word.slice(0, 40)}» містить недозволені символи: лише англійські літери, цифри, пробіл, апостроф, дефіс і крапка`;
    }
    if (translation.length > MAX_TRANSLATION_LENGTH || !TRANSLATION_PATTERN.test(translation)) {
        return 'Переклад містить недозволені символи: лише літери, цифри і пунктуація , ; : . ! ? ( ) « » " \' - /';
    }
    return '';
}
