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
