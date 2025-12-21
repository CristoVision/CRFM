-- Add daily/yearly handling to leaderboard timeframe helper.

create or replace function public._lb_from_date(p_timeframe text)
returns timestamptz
language sql
stable
as $$
  select case lower(coalesce(p_timeframe, 'weekly'))
    when 'daily' then now() - interval '1 day'
    when 'weekly' then now() - interval '7 days'
    when 'month' then now() - interval '30 days'
    when 'monthly' then now() - interval '30 days'
    when 'yearly' then now() - interval '365 days'
    when 'all' then null
    else now() - interval '7 days'
  end;
$$;
