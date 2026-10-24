// Система Лейтнера: 6 рівнів (box 0–5). Межі 0–5 також перевіряє база (check box between 0 and 5).
export const MAX_BOX = 5;

export const LEITNER_BOXES = [
    { title: 'Нові / На вивченні', interval: 'Сьогодні' },
    { title: 'Рівень 1', interval: '1 день' },
    { title: 'Рівень 2', interval: '3 дні' },
    { title: 'Рівень 3', interval: '7 днів' },
    { title: 'Рівень 4', interval: '16 днів' },
    { title: 'Рівень 5', interval: '30 днів' }
];
