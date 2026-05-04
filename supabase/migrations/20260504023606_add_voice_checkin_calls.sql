create table if not exists voice_checkin_calls (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  call_date date not null,
  phone_number text not null,
  vapi_call_id text,
  status text not null default 'creating' check (status in ('creating', 'created', 'failed')),
  error text,
  response_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, call_date)
);

alter table voice_checkin_calls enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'voice_checkin_calls'
      and policyname = 'users own voice_checkin_calls'
  ) then
    create policy "users own voice_checkin_calls" on voice_checkin_calls
      for all using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists voice_checkin_calls_user_id_call_date_idx
  on voice_checkin_calls(user_id, call_date);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'voice_checkin_calls_updated_at'
  ) then
    create trigger voice_checkin_calls_updated_at
      before update on voice_checkin_calls
      for each row execute function update_updated_at();
  end if;
end $$;
