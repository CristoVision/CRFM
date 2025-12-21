-- Remove video cover art paths that do not point to videocoverart or valid URLs.

update public.tracks
set video_cover_art_url = null
where video_cover_art_url is not null
  and video_cover_art_url <> ''
  and video_cover_art_url !~ '^(https?://|data:|blob:)'
  and video_cover_art_url !~ '^/?storage/v1/'
  and video_cover_art_url !~ '^/?videocoverart/';

update public.albums
set video_cover_art_url = null
where video_cover_art_url is not null
  and video_cover_art_url <> ''
  and video_cover_art_url !~ '^(https?://|data:|blob:)'
  and video_cover_art_url !~ '^/?storage/v1/'
  and video_cover_art_url !~ '^/?videocoverart/';

update public.playlists
set video_cover_art_url = null
where video_cover_art_url is not null
  and video_cover_art_url <> ''
  and video_cover_art_url !~ '^(https?://|data:|blob:)'
  and video_cover_art_url !~ '^/?storage/v1/'
  and video_cover_art_url !~ '^/?videocoverart/';
