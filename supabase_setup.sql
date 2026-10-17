-- LinguaSwipe: таблиця слів у Supabase.
-- Вставте весь цей текст у Supabase → SQL Editor → New query і натисніть Run.

create table if not exists public.words (
    id bigint generated always as identity primary key,
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    word text not null check (char_length(word) between 1 and 200),
    translation text not null check (char_length(translation) between 1 and 500),
    box smallint not null default 0 check (box between 0 and 5),
    created_at timestamptz not null default now()
);

create index if not exists words_user_id_idx on public.words (user_id);
create unique index if not exists words_user_word_unique on public.words (user_id, lower(word));

-- Кожен користувач бачить і змінює тільки свої слова
alter table public.words enable row level security;

drop policy if exists "Users read own words" on public.words;
drop policy if exists "Users add own words" on public.words;
drop policy if exists "Users update own words" on public.words;
drop policy if exists "Users delete own words" on public.words;

create policy "Users read own words" on public.words
    for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add own words" on public.words
    for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own words" on public.words
    for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own words" on public.words
    for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.words from anon;
grant select, insert, update, delete on public.words to authenticated;

-- ===== Загальний словник (гості та режим «Усі слова») =====
-- Повертає слова всіх користувачів без дублікатів, лише слово і переклад:
-- без user_id, email і прогресу. Таблиця words для гостей лишається закритою.
create or replace function public.public_words()
returns table (word text, translation text)
language sql
stable
security definer
set search_path = ''
as $$
    select distinct on (lower(w.word)) w.word, w.translation
    from public.words w
    order by lower(w.word), w.created_at
$$;

revoke all on function public.public_words() from public;
grant execute on function public.public_words() to anon, authenticated;

-- Прогрес SRS користувача у загальному словнику (окремо від прогресу власних слів)
create table if not exists public.word_progress (
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    word_key text not null check (char_length(word_key) between 1 and 200),
    box smallint not null default 0 check (box between 0 and 5),
    updated_at timestamptz not null default now(),
    primary key (user_id, word_key)
);

alter table public.word_progress enable row level security;

drop policy if exists "Users read own progress" on public.word_progress;
drop policy if exists "Users add own progress" on public.word_progress;
drop policy if exists "Users update own progress" on public.word_progress;
drop policy if exists "Users delete own progress" on public.word_progress;

create policy "Users read own progress" on public.word_progress
    for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add own progress" on public.word_progress
    for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own progress" on public.word_progress
    for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own progress" on public.word_progress
    for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.word_progress from anon;
grant select, insert, update, delete on public.word_progress to authenticated;
