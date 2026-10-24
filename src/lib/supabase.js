import { createClient } from '@supabase/supabase-js';

// ===== НАЛАШТУВАННЯ SUPABASE =====
// На GitHub Pages значення підставляє GitHub Actions зі змінних репозиторію SUPABASE_URL і SUPABASE_KEY
// (Settings → Secrets and variables → Actions → Variables). Див. .github/workflows/pages.yml.
// Локально — з .env.local (див. .env.example).
// Ключ anon публічний за задумом: доступ до чужих слів закривають правила (RLS) у базі.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || '';

export const sb = SUPABASE_URL.startsWith('https://')
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

export const NOT_CONFIGURED_MESSAGE = 'Supabase не налаштовано: задайте змінні SUPABASE_URL і SUPABASE_KEY у GitHub (Settings → Secrets and variables → Actions → Variables)';

export const WORD_COLUMNS = 'id, word, transcription, translation, box';

export function translateError(message) {
    const known = {
        'Invalid login credentials': 'Невірний email або пароль',
        'User already registered': 'Користувач з таким email вже існує',
        'Email not confirmed': 'Email не підтверджено. Перевірте пошту.',
        'Password should be at least 6 characters.': 'Пароль має містити щонайменше 6 символів'
    };
    if (/duplicate key/i.test(message)) return 'Таке слово вже є у вашій колекції';
    if (/schema cache/i.test(message)) return 'База даних не оновлена: виконайте supabase_setup.sql у Supabase → SQL Editor';
    return known[message] || message;
}

export function check({ data, error }) {
    if (error) throw new Error(translateError(error.message));
    return data;
}

// Supabase returns at most 1000 rows per request — fetch page by page
export async function fetchAllRows(makeQuery) {
    const PAGE = 1000;
    let rows = [];
    for (let from = 0; ; from += PAGE) {
        const page = check(await makeQuery().range(from, from + PAGE - 1));
        rows = rows.concat(page);
        if (page.length < PAGE) return rows;
    }
}
