-- Clear invalid video cover art values stored as bare filenames.
-- Valid URLs must be absolute or include a bucket path with "/" to be normalized by the client.

update public.tracks
set video_cover_art_url = null
where video_cover_art_url is not null
  and video_cover_art_url <> ''
  and video_cover_art_url !~ '^(https?://|data:|blob:)'
  and position('/' in video_cover_art_url) = 0;

update public.albums
set video_cover_art_url = null
where video_cover_art_url is not null
  and video_cover_art_url <> ''
  and video_cover_art_url !~ '^(https?://|data:|blob:)'
  and position('/' in video_cover_art_url) = 0;

update public.playlists
set video_cover_art_url = null
where video_cover_art_url is not null
  and video_cover_art_url <> ''
  and video_cover_art_url !~ '^(https?://|data:|blob:)'
  and position('/' in video_cover_art_url) = 0;
