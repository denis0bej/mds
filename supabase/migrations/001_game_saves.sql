-- Account-bound game saves (run in Supabase SQL Editor or via CLI)
create table if not exists public.game_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  character jsonb not null,
  save_data jsonb not null default '{}'::jsonb,
  character_name text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists game_saves_user_id_idx on public.game_saves (user_id);
create index if not exists game_saves_user_updated_idx on public.game_saves (user_id, updated_at desc);

alter table public.game_saves enable row level security;

create policy "Users can view own saves"
  on public.game_saves for select
  using (auth.uid() = user_id);

create policy "Users can insert own saves"
  on public.game_saves for insert
  with check (auth.uid() = user_id);

create policy "Users can update own saves"
  on public.game_saves for update
  using (auth.uid() = user_id);

create policy "Users can delete own saves"
  on public.game_saves for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists game_saves_set_updated_at on public.game_saves;
create trigger game_saves_set_updated_at
  before update on public.game_saves
  for each row execute function public.set_updated_at();
