// localStorage can be unavailable (private mode, blocked storage) — never let it break the app.
// Ключі вже збережені в браузерах користувачів — не перейменовуйте їх.
export const STORAGE_KEYS = {
    wordSource: 'linguaswipe_word_source',
    installDismissed: 'linguaswipe_install_dismissed',
    guest: 'linguaswipe_guest',
    guestProgress: 'linguaswipe_guest_progress'
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
