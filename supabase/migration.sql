create table if not exists public.bets (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  amount numeric(10, 2) not null check (amount > 0),
  creator text not null check (creator in ('Us', 'Victor', 'Fons', 'Yit', 'Aris')),
  creator_position text not null check (creator_position in ('yes', 'no')),
  status text not null default 'open' check (status in ('open', 'taken', 'resolved')),
  taker text check (taker in ('Us', 'Victor', 'Fons', 'Yit', 'Aris')),
  taker_position text check (taker_position in ('yes', 'no')),
  winner text check (winner in ('Us', 'Victor', 'Fons', 'Yit', 'Aris')),
  created_at timestamptz default now() not null,
  resolved_at timestamptz
);

alter table public.bets enable row level security;

create policy "Allow public read" on public.bets for select using (true);
create policy "Allow public insert" on public.bets for insert with check (true);
create policy "Allow public update" on public.bets for update using (true);
