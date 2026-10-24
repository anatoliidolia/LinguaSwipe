# LinguaSwipe — правила для Claude

LinguaSwipe — PWA для вивчення англійських слів (свайп-картки + інтервальні повторення Лейтнера).
**У продакшені вже тисячі користувачів.** Будь-яка помилка в базі, у схемі чи в деплої б'є по реальних людях і їхніх даних, тож обережність важливіша за швидкість.

## 1. Git: нічого не комітити і не пушити

- **Ніколи не роби `git commit`, `git push`, `git merge`, `git rebase`, `git reset --hard`, `git stash drop`, `git tag`** і не створюй PR без прямого прохання користувача в цьому повідомленні. Дозвіл в одній задачі не поширюється на наступну.
- Push у `main` одразу деплоїть сайт на GitHub Pages для всіх користувачів (`.github/workflows/pages.yml`).
- Можна: `git status`, `git diff`, `git log`, `git show` і створення нової гілки, якщо про це просять.
- Зміни лишай у робочій директорії, щоб користувач сам переглянув їх і закомітив.
- Ніколи не комітити секрети: `.env.local`, `chrome-extension/config.js`, `data/`, CSV зі словами користувачів.

## 2. База даних: лише міграції, дані користувачів недоторканні

База — Supabase (Postgres). Схема: `supabase_setup.sql` (початкова) + `migrations/NNN_*.sql` (усі зміни після запуску).

- **Будь-яка зміна схеми — це новий файл** `migrations/NNN_short_name.sql` з наступним номером (`003_…`, `004_…`). Додай рядок про нього в таблицю «Міграції бази даних» у `README.md`.
- **Не редагуй** `supabase_setup.sql` і вже наявні міграції: їх уже виконано в продакшені.
- Міграція має бути **ідемпотентною** (безпечно запускати повторно): `create table if not exists`, `add column if not exists`, `create or replace function`, `drop policy if exists` перед `create policy`, `drop constraint if exists` перед `add constraint`.
- **Заборонено** все, що видаляє або псує дані: `drop table`, `drop column`, `truncate`, `delete`/`update` без жорсткого `where`, зміна типу колонки зі втратою даних, `not null` без `default` на наявних рядках. Якщо без цього ніяк — зупинись і спитай користувача, запропонувавши план з резервною копією.
- Нові `check`-обмеження на наявних таблицях додавай з `not valid`, щоб старі рядки не зламали міграцію.
- Нові таблиці — одразу з `enable row level security` і політиками `(select auth.uid()) = user_id`; `revoke all … from anon`, якщо гостям доступ не потрібен.
- Функції `security definer` — завжди з `set search_path = ''`, `revoke all … from public`, а потім `grant execute` лише потрібним ролям.
- **Зворотна сумісність:** старі версії сайту (закешовані через service worker) і розширення Chrome продовжують працювати після міграції. Не перейменовуй і не видаляй колонки, таблиці, RPC-функції (`public_words`, `is_admin`, `admin_delete_word`) і не змінюй їхні аргументи. Додавай нове поруч.
- Міграцію виконує користувач вручну в Supabase → SQL Editor **до** деплою коду, що на неї спирається. Нагадуй про це. Сам SQL на продакшен не запускай.
- Код має переживати ситуацію, коли міграцію ще не виконано (див. `loadAdminFlag` в `src/stores/auth.js`: помилка RPC означає просто «немає прав»).

## 3. Екранування і захист від XSS / ін'єкцій

Слова, переклади й транскрипції пишуть користувачі, а потім їх бачать **усі** (загальний словник, гості). Тому:

- **Ніколи не використовуй `v-html`**, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` з даними користувача. У Vue — лише `{{ }}` і прив'язки атрибутів, вони екранують автоматично. У розширенні (`chrome-extension/`) — `textContent` і `value`; `innerHTML` там допустимий лише для статичної розмітки без жодних змінних.
- Не підставляй дані користувача в `:href`, `:src`, `:style`, обробники подій чи `new Function` / `eval`.
- **Перевірка символів — у трьох місцях, і вони мають збігатися:**
  1. `src/lib/validation.js` (сайт);
  2. `chrome-extension/background.js` (розширення);
  3. `check`-обмеження в базі (`supabase_setup.sql`, `migrations/001_transcription.sql`).
  Змінюєш правило в одному місці — змінюй у всіх трьох (у базі через нову міграцію). Головний захист — у базі, клієнтські перевірки лише для зручності.
- Запити до Supabase — лише через supabase-js (параметризовані). Не збирай SQL рядками; у `plpgsql` — лише параметри, без `execute` з конкатенацією.
- У клієнті тільки публічний `anon`/`publishable` ключ. **`service_role` / `secret` ключ ніколи не потрапляє** в код, `.env*`, workflow чи розширення. Доступ до даних обмежує RLS, а не інтерфейс: права адміна завжди перевіряються в базі (`is_admin()`), а не лише через `v-if`.

## 4. Не ламати користувачів, які вже є

- Ключі `localStorage` (`src/lib/storage.js`, `STORAGE_KEYS`) уже збережені в браузерах. Не перейменовуй їх; для нового формату додай новий ключ і читай старий.
- `public/sw.js`: версію кешу і список файлів підставляє збірка (`vite.config.js`). Не змінюй вручну `BUILD_VERSION` / `BUILD_ASSETS` і стратегію «network first» для сторінок, інакше користувачі застрягнуть на старій версії.
- `public/manifest.json`: не змінюй `id`, `start_url`, `scope`, бо встановлені PWA на телефонах перестануть працювати.
- Розширення Chrome ходить у ту саму базу напряму (REST). Будь-яка зміна таблиці `words` має лишатися сумісною з ним.

## Структура

```
index.html                 точка входу Vite
src/
  main.js                  createApp + Pinia + реєстрація service worker
  App.vue                  каркас: екран входу / шапка / вкладки / модалки
  assets/main.css          Tailwind + власні стилі (3D-перевертання карток тощо)
  lib/                     чиста логіка без Vue-компонентів
    supabase.js            клієнт, check(), translateError(), fetchAllRows()
    validation.js          дозволені символи (дзеркало правил у базі)
    csv.js                 розбір CSV / тексту для імпорту
    storage.js             безпечний localStorage + ключі
    srs.js                 рівні Лейтнера
    pwa.js                 service worker, банер встановлення
  stores/                  Pinia: auth, words, practice (сесія), ui (вкладка, модалки)
  components/              AppHeader, AuthScreen, SwipeCard, модалки…
  views/                   PracticeView, DictionaryView, StatsView (вкладки)
public/                    manifest.json, sw.js, icons/ (копіюються як є)
migrations/                зміни схеми БД (див. розділ 2)
chrome-extension/          розширення Chrome (Manifest V3, без збірки)
```

## Команди

- `npm install` → `npm run dev` (локально; потрібен `.env.local`, див. `.env.example`)
- `npm run build` → `dist/`; `npm run preview`, щоб перевірити збірку
- Деплой: push у `main` → GitHub Actions збирає і публікує `dist/`. **Пушить лише користувач.**

## Стиль

- Інтерфейс і коментарі українською, код (імена змінних, функцій) англійською.
- Vue 3 `<script setup>`, Pinia setup-стори, Tailwind-класи прямо в шаблонах.
- Шляхи до файлів з `public/` у компонентах: `import.meta.env.BASE_URL + 'icons/…'` (сайт живе на підшляху `/LinguaSwipe/`).
- Без `vue-router`: вкладки — це стан `ui.currentTab`. Якщо роутер знадобиться, то лише `createWebHashHistory()` (GitHub Pages не має SPA-fallback).
