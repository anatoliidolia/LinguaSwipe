// LinguaSwipe extension: service worker.
// Тут єдине місце, яке говорить із Supabase (Auth + REST) і зберігає токени сесії.
// Popup і content script лише надсилають сюди повідомлення.

try {
    importScripts('config.js');
} catch (e) {
    // config.js немає — розширення покаже підказку замість форми входу
}

const CONFIG = self.LINGUASWIPE_CONFIG || {};
const SUPABASE_URL = (CONFIG.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = CONFIG.SUPABASE_KEY || '';
const TRANSLATE_TO = CONFIG.TRANSLATE_TO || 'uk';
const CONFIGURED = SUPABASE_URL.startsWith('https://') && !!SUPABASE_KEY && !SUPABASE_KEY.startsWith('YOUR-');

// ===== ERRORS =====
function translateError(message) {
    const known = {
        'Invalid login credentials': 'Невірний email або пароль',
        'Email not confirmed': 'Email не підтверджено. Перевірте пошту.',
        'Failed to fetch': 'Немає з’єднання з сервером'
    };
    if (/duplicate key/i.test(message)) return 'Таке слово вже є у вашій колекції';
    if (/JWT expired|invalid JWT|Refresh Token/i.test(message)) return 'Сесія закінчилась — увійдіть знову';
    return known[message] || message;
}

async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
    const res = await fetch(SUPABASE_URL + path, {
        method,
        headers: {
            apikey: SUPABASE_KEY,
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
        const message = (data && (data.error_description || data.msg || data.message || data.error)) || `HTTP ${res.status}`;
        const err = new Error(translateError(message));
        err.status = res.status;
        throw err;
    }
    return data;
}

// ===== SESSION =====
async function saveSession(data) {
    const session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600)
    };
    const user = { id: data.user.id, email: data.user.email };
    await chrome.storage.local.set({ session, user });
    return user;
}

async function clearSession() {
    await chrome.storage.local.remove(['session', 'user']);
}

let refreshing = null;

// Повертає дійсний access token, оновлюючи його за потреби (один запит на всіх)
async function getAccessToken() {
    const { session } = await chrome.storage.local.get('session');
    if (!session) throw new Error('Увійдіть у LinguaSwipe через іконку розширення');
    if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;

    if (!refreshing) {
        refreshing = request('/auth/v1/token?grant_type=refresh_token', {
            method: 'POST',
            body: { refresh_token: session.refresh_token }
        })
            .then(saveSession)
            .catch(async err => {
                if (err.status && err.status < 500) await clearSession();
                throw new Error(translateError(err.message));
            })
            .finally(() => { refreshing = null; });
    }
    await refreshing;
    const { session: fresh } = await chrome.storage.local.get('session');
    return fresh.access_token;
}

async function login(email, password) {
    const data = await request('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: { email: email.trim(), password }
    });
    return saveSession(data);
}

async function logout() {
    const { session } = await chrome.storage.local.get('session');
    if (session) {
        try {
            await request('/auth/v1/logout', { method: 'POST', token: session.access_token });
        } catch (e) { /* токен міг уже закінчитись — це не завадить вийти */ }
    }
    await clearSession();
}

// ===== WORDS =====
// Дозволені символи — ті самі правила, що й у базі (supabase_setup.sql) і на сайті (index.html)
const WORD_PATTERN = /^[A-Za-z][A-Za-z0-9 '’ʼ.-]*$/;
const TRANSLATION_PATTERN = /^[A-Za-zА-яЁёЄєІіЇїҐґ0-9«"(][A-Za-zА-яЁёЄєІіЇїҐґ0-9 ,;:.!?()'’ʼ"«»\/–—-]*$/;
const TRANSCRIPTION_PATTERN = /^[^<>&{}`=$\\"\[\]]+$/;

// "[ˈwɜːd]", "/ˈwɜːd/" або "ˈwɜːd" → "ˈwɜːd"
function normalizeTranscription(value) {
    const t = String(value || '').replace(/\s+/g, ' ').trim();
    const m = t.match(/^\[(.*)\]$/) || t.match(/^\/(.*)\/$/);
    return (m ? m[1] : t).trim();
}

function validateWord(word, translation, transcription = '') {
    if (!word || !translation) return 'Введіть слово і переклад';
    if (transcription && (transcription.length > 200 || !TRANSCRIPTION_PATTERN.test(transcription))) {
        return 'Транскрипція: недозволені символи < > & { } ` = $ \\ " [ ]';
    }
    if (word.length > 200 || !WORD_PATTERN.test(word)) {
        return 'Слово: лише англійські літери, цифри, пробіл, апостроф, дефіс і крапка';
    }
    if (translation.length > 500 || !TRANSLATION_PATTERN.test(translation)) {
        return 'Переклад: лише літери, цифри і пунктуація , ; : . ! ? ( ) « » " \' - /';
    }
    return '';
}

// Для ilike: без шаблонів, тобто регістронезалежне «дорівнює»
function exactIlike(value) {
    return encodeURIComponent(value.replace(/[\\%_]/g, '\\$&').replace(/\*/g, ''));
}

async function findOwnWord(word, token) {
    const rows = await request(`/rest/v1/words?select=id,word,transcription,translation&word=ilike.${exactIlike(word)}&limit=1`, { token });
    return rows[0] || null;
}

async function findSharedWord(word, token) {
    const rows = await request(`/rest/v1/rpc/public_words?select=translation,transcription&word=ilike.${exactIlike(word)}&limit=1`, { token });
    return rows[0] || null;
}

async function machineTranslation(word) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto' +
        `&tl=${encodeURIComponent(TRANSLATE_TO)}&q=${encodeURIComponent(word)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data[0] || []).map(part => part[0]).join('').trim();
    return text && text.toLowerCase() !== word.toLowerCase() ? text : null;
}

// Що вже відомо про слово: чи є воно у користувача і який переклад запропонувати
async function lookup(word) {
    word = String(word || '').trim();
    if (!WORD_PATTERN.test(word) || word.length > 200) return { existing: null, suggestion: null, transcription: null, source: null };
    const token = await getAccessToken();
    const own = await findOwnWord(word, token);
    if (own) return { existing: own, suggestion: own.translation, transcription: own.transcription, source: 'own' };

    const shared = await findSharedWord(word, token).catch(() => null);
    if (shared) return { existing: null, suggestion: shared.translation, transcription: shared.transcription, source: 'shared' };

    const machine = await machineTranslation(word).catch(() => null);
    return { existing: null, suggestion: machine, transcription: null, source: machine ? 'machine' : null };
}

async function saveWord({ word, transcription, translation, id }) {
    word = String(word || '').replace(/\s+/g, ' ').trim();
    transcription = normalizeTranscription(transcription);
    translation = String(translation || '').replace(/\s+/g, ' ').trim();
    const invalid = validateWord(word, translation, transcription);
    if (invalid) throw new Error(invalid);

    const token = await getAccessToken();
    const prefer = { Prefer: 'return=representation' };
    const body = { word, transcription: transcription || null, translation };

    if (!id) {
        const own = await findOwnWord(word, token);
        if (own) id = own.id;
    }
    if (id) {
        const rows = await request(`/rest/v1/words?id=eq.${encodeURIComponent(id)}&select=id,word,transcription,translation`, {
            method: 'PATCH', token, headers: prefer, body
        });
        return { action: 'updated', word: rows[0] };
    }
    const rows = await request('/rest/v1/words?select=id,word,transcription,translation', {
        method: 'POST', token, headers: prefer, body
    });
    return { action: 'added', word: rows[0] };
}

async function recentWords() {
    const token = await getAccessToken();
    return request('/rest/v1/words?select=id,word,transcription,translation&order=id.desc&limit=5', { token });
}

// ===== MESSAGES =====
const handlers = {
    async getState() {
        const { user } = await chrome.storage.local.get('user');
        return { configured: CONFIGURED, user: user || null };
    },
    login: msg => login(msg.email, msg.password),
    logout,
    lookup: msg => lookup(msg.word),
    saveWord: msg => saveWord(msg),
    recentWords
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const handler = handlers[msg && msg.type];
    if (!handler) return false;
    if (!CONFIGURED && msg.type !== 'getState') {
        sendResponse({ error: 'Розширення не налаштоване: створіть config.js (див. config.example.js)' });
        return false;
    }
    Promise.resolve()
        .then(() => handler(msg))
        .then(data => sendResponse({ data }))
        .catch(err => sendResponse({ error: err.message || String(err) }));
    return true; // відповідь буде асинхронною
});

// ===== CONTEXT MENU =====
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'linguaswipe-add',
        title: 'Додати «%s» у LinguaSwipe',
        contexts: ['selection']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'linguaswipe-add' || !tab || tab.id === undefined) return;
    chrome.tabs.sendMessage(tab.id, { type: 'openPopover', text: info.selectionText || '' }).catch(() => {});
});
