// Система Лейтнера: 6 рівнів (box 0–5). Межі 0–5 також перевіряє база (check box between 0 and 5).
// Розклад: due_at — дата наступного повторення (migrations/004_review_schedule.sql).
export const MAX_BOX = 5;

// Через скільки днів слово повернеться після «Знаю», залежно від рівня, на який воно перейшло
export const INTERVAL_DAYS = [0, 1, 3, 7, 16, 30];
// Повторне «Знаю» на останньому рівні: слово вивчене, перевіряємо рідше
export const MASTERED_INTERVAL_DAYS = 60;
// Розкид ±10% для інтервалів від 3 днів, щоб слова, вивчені в один день, не верталися всі разом
const FUZZ = 0.1;

const DAY_MS = 24 * 60 * 60 * 1000;

// Українські відмінки після числа: 1 день, 2 дні, 5 днів, 21 день
export function plural(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
    return `${n} ${many}`;
}

export const pluralDays = n => plural(n, 'день', 'дні', 'днів');
export const pluralWords = n => plural(n, 'слово', 'слова', 'слів');

export const LEITNER_BOXES = [
    { title: 'Нові / На вивченні', interval: 'Сьогодні' },
    { title: 'Рівень 1', interval: pluralDays(INTERVAL_DAYS[1]) },
    { title: 'Рівень 2', interval: pluralDays(INTERVAL_DAYS[2]) },
    { title: 'Рівень 3', interval: pluralDays(INTERVAL_DAYS[3]) },
    { title: 'Рівень 4', interval: pluralDays(INTERVAL_DAYS[4]) },
    { title: 'Рівень 5 · вивчені', interval: `${pluralDays(INTERVAL_DAYS[5])}, далі ${pluralDays(MASTERED_INTERVAL_DAYS)}` }
];

// «Знаю»: новий рівень і інтервал у днях (без розкиду — для підказки на кнопці)
export function knowStep(box) {
    if (box >= MAX_BOX) return { box: MAX_BOX, days: MASTERED_INTERVAL_DAYS };
    const next = box + 1;
    return { box: next, days: INTERVAL_DAYS[next] };
}

export function dueInDays(days, now = new Date()) {
    const fuzz = days >= 3 ? Math.round(days * FUZZ * (Math.random() * 2 - 1)) : 0;
    return new Date(now.getTime() + (days + fuzz) * DAY_MS).toISOString();
}

function endOfToday(now = new Date()) {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return end;
}

// Слово пора повторити, якщо його дата — сьогодні або раніше (за місцевим часом).
// Тож слово «на завтра» з'явиться зранку, а не лише о тій самій годині, коли його вчили.
export function isDue(word, now = new Date()) {
    return !word.due_at || new Date(word.due_at) <= endOfToday(now);
}

// Кількість календарних днів від сьогодні до дати: 0 — сьогодні, 1 — завтра
export function daysUntil(date, now = new Date()) {
    const start = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.round((start(new Date(date)) - start(now)) / DAY_MS);
}

export function formatDaysFromNow(days) {
    if (days <= 0) return 'сьогодні';
    if (days === 1) return 'завтра';
    if (days === 2) return 'післязавтра';
    return `через ${pluralDays(days)}`;
}
