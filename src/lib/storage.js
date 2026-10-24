// localStorage can be unavailable (private mode, blocked storage) — never let it break the app.
// Ключі вже збережені в браузерах користувачів — не перейменовуйте їх.
export const STORAGE_KEYS = {
    wordSource: 'linguaswipe_word_source',
    installDismissed: 'linguaswipe_install_dismissed',
    guest: 'linguaswipe_guest',
    guestProgress: 'linguaswipe_guest_progress',
    // Окремий ключ: старі версії сайту читають guestProgress як { слово: box } і мають і далі його розуміти
    guestSchedule: 'linguaswipe_guest_schedule',
    // { слово: { box, due } } — прогрес гостя у зворотному напрямку (UA → EN)
    guestReverse: 'linguaswipe_guest_reverse',
    practiceMode: 'linguaswipe_practice_mode'
};

export function readStored(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

export function writeStored(key, value) {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    } catch (e) { /* ignore */ }
}

export function readGuestProgress() {
    try { return JSON.parse(readStored(STORAGE_KEYS.guestProgress) || '{}'); } catch (e) { return {}; }
}

export function writeGuestProgress(progress) {
    writeStored(STORAGE_KEYS.guestProgress, JSON.stringify(progress));
}

// { слово: due_at (ISO) } — розклад повторень гостя
export function readGuestSchedule() {
    try { return JSON.parse(readStored(STORAGE_KEYS.guestSchedule) || '{}'); } catch (e) { return {}; }
}

export function writeGuestSchedule(schedule) {
    writeStored(STORAGE_KEYS.guestSchedule, JSON.stringify(schedule));
}

export function readGuestReverse() {
    try { return JSON.parse(readStored(STORAGE_KEYS.guestReverse) || '{}'); } catch (e) { return {}; }
}

export function writeGuestReverse(progress) {
    writeStored(STORAGE_KEYS.guestReverse, JSON.stringify(progress));
}
