alter table daily_logs
  drop constraint if exists daily_logs_score_check;

alter table daily_logs
  alter column score type numeric(2,1)
  using score::numeric(2,1);

alter table daily_logs
  add constraint daily_logs_score_check
  check (score >= 1 and score <= 5 and score * 2 = floor(score * 2));
