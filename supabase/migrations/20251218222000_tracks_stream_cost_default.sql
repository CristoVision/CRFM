-- Default cost per play should be 0.5 CC (platform standard).

alter table public.tracks
  alter column stream_cost set default 0.5;

