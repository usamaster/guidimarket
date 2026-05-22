-- ============================================================================
-- WK 2026 Voorspelpool — Group chat
-- ============================================================================
-- Re-adds the messages table that was dropped during the pivot.
-- ============================================================================

begin;

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  content      text not null check (length(content) between 1 and 500),
  created_at   timestamptz not null default now()
);

create index if not exists messages_created_at_idx on public.messages (created_at desc);

alter table public.messages enable row level security;

drop policy if exists "read all"     on public.messages;
drop policy if exists "self insert"  on public.messages;
drop policy if exists "self delete"  on public.messages;

create policy "read all"
  on public.messages for select using (true);

create policy "self insert"
  on public.messages for insert with check (auth.uid() = user_id);

create policy "self delete"
  on public.messages for delete using (auth.uid() = user_id or public.is_admin());

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  end if;
end $$;

commit;
