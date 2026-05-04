-- Row-level security: users only see their own data

alter table pillars enable row level security;
alter table behavioral_indicators enable row level security;
alter table daily_logs enable row level security;
alter table weekly_summaries enable row level security;
alter table user_settings enable row level security;
alter table sms_pending_replies enable row level security;

-- Pillars
create policy "users own pillars" on pillars
  for all using (auth.uid() = user_id);

-- Behavioral indicators: visible if you own the parent pillar
create policy "users own indicators" on behavioral_indicators
  for all using (
    exists (
      select 1 from pillars
      where pillars.id = behavioral_indicators.pillar_id
        and pillars.user_id = auth.uid()
    )
  );

-- Daily logs
create policy "users own daily_logs" on daily_logs
  for all using (auth.uid() = user_id);

-- Weekly summaries
create policy "users own weekly_summaries" on weekly_summaries
  for all using (auth.uid() = user_id);

-- User settings
create policy "users own settings" on user_settings
  for all using (auth.uid() = user_id);

-- SMS pending replies
create policy "users own sms_pending_replies" on sms_pending_replies
  for all using (auth.uid() = user_id);
