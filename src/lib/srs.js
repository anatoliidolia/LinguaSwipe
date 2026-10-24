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

// ===== Напрямки тренування =====
// forward: EN → UA (на картці англійське слово) — поля box / due_at;
// reverse: UA → EN (на картці переклад) — окремий прогрес reverse_box / reverse_due_at
// (migrations/005_reverse_direction.sql).
export const DIRECTIONS = {
    forward: { label: 'EN → UA', boxField: 'box', dueField: 'due_at' },
    reverse: { label: 'UA → EN', boxField: 'reverse_box', dueField: 'reverse_due_at' }
};

// Режим тренування → напрямки карток: 'both' дає кожне слово в обох напрямках
export const PRACTICE_MODES = {
    forward: { label: 'EN → UA', directions: ['forward'] },
    reverse: { label: 'UA → EN', directions: ['reverse'] },
    both: { label: 'Обидва', directions: ['forward', 'reverse'] }
};

export function progressOf(word, dir = 'forward') {
    const { boxField, dueField } = DIRECTIONS[dir];
    return { box: word[boxField] || 0, due_at: word[dueField] || null };
}

export function setProgress(word, dir, box, dueAt) {
    const { boxField, dueField } = DIRECTIONS[dir];
    word[boxField] = box;
    word[dueField] = dueAt;
}

// Слово пора повторити, якщо його дата — сьогодні або раніше (за місцевим часом).
// Тож слово «на завтра» з'явиться зранку, а не лише о тій самій годині, коли його вчили.
export function isDue(word, dir = 'forward', now = new Date()) {
    const { due_at } = progressOf(word, dir);
    return !due_at || new Date(due_at) <= endOfToday(now);
}

// Кількість календарних днів від сьогодні до дати: 0 — сьогодні, 1 — завтра
export function daysUntil(date, now = new Date()) {
    const start = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.round((start(new Date(date)) - start(now)) / DAY_MS);
}

// Найближчий день, коли з'являться нові картки для повторення, і скільки їх буде
export function nextReview(words, directions) {
    let days = Infinity;
    let count = 0;
    words.forEach(w => directions.forEach(dir => {
        if (isDue(w, dir)) return;
        const d = daysUntil(progressOf(w, dir).due_at);
        if (d < days) { days = d; count = 1; } else if (d === days) count++;
    }));
    return count ? { days, count } : null;
}

// Скільки карток чекає на повторення: сьогодні, завтра і протягом тижня
export function forecast(words, directions) {
    const result = { today: 0, tomorrow: 0, week: 0 };
    words.forEach(w => directions.forEach(dir => {
        const d = isDue(w, dir) ? 0 : daysUntil(progressOf(w, dir).due_at);
        if (d <= 0) result.today++;
        else if (d === 1) result.tomorrow++;
        if (d <= 7) result.week++;
    }));
    return result;
}

// Звіти викладача (migrations/007_topic_progress_reports.sql рахує так само):
// вивчено — рівень 3+ у напрямку EN → UA (повтор раз на тиждень і рідше); проблемне слово — 2+ «Не знаю»
export const LEARNED_BOX = 3;
export const PROBLEM_LAPSES = 2;

// «сьогодні», «вчора», «5 днів тому»; без дати — «ще не тренувався»
export function formatDaysAgo(date, now = new Date()) {
    if (!date) return 'ще не тренувався';
    const days = -daysUntil(date, now);
    if (days <= 0) return 'сьогодні';
    if (days === 1) return 'вчора';
    return `${pluralDays(days)} тому`;
}

export function formatDaysFromNow(days) {
    if (days <= 0) return 'сьогодні';
    if (days === 1) return 'завтра';
    if (days === 2) return 'післязавтра';
    return `через ${pluralDays(days)}`;
}
