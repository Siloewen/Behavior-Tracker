-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Pillars: the character traits Simon wants to embody
create table pillars (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  description text not null default '',
  priority_rank int not null default 1,
  color text not null default '#7c6af7',
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- Behavioral indicators: measurable signals per pillar
create table behavioral_indicators (
  id uuid primary key default uuid_generate_v4(),
  pillar_id uuid not null references pillars(id) on delete cascade,
  label text not null,
  cadence text not null default 'daily' check (cadence in ('daily', 'weekly')),
  created_at timestamptz not null default now()
);

-- Daily logs: 1-5 score per indicator per day
create table daily_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  indicator_id uuid not null references behavioral_indicators(id) on delete cascade,
  score int not null check (score between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  unique(user_id, log_date, indicator_id)
);

-- Weekly summaries: Claude narrative + pillar score snapshots
create table weekly_summaries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  pillar_scores jsonb not null default '{}',
  narrative_text text,
  generated_at timestamptz not null default now(),
  unique(user_id, week_start)
);

-- SMS pending replies: tracks what context an incoming reply should be logged against
create table sms_pending_replies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_number text not null,
  pillar_id uuid not null references pillars(id) on delete cascade,
  indicator_ids uuid[] not null,
  log_date date not null default current_date,
  expires_at timestamptz not null default (now() + interval '12 hours'),
  created_at timestamptz not null default now()
);

-- User settings: phone number, alert thresholds
create table user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  phone_number text,
  alert_threshold numeric not null default 2.5,
  alert_consecutive_weeks int not null default 2,
  sms_alerts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index on pillars(user_id) where archived_at is null;
create index on behavioral_indicators(pillar_id);
create index on daily_logs(user_id, log_date);
create index on daily_logs(indicator_id);
create index on weekly_summaries(user_id, week_start);
create index on sms_pending_replies(phone_number, expires_at);

-- Auto-update user_settings.updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_settings_updated_at
  before update on user_settings
  for each row execute function update_updated_at();
