-- Clear cover art fields that point to video files.

update public.tracks
set cover_art_url = null
where cover_art_url ~* '\\.(mp4|webm|ogg|mov)$';

update public.albums
set cover_art_url = null
where cover_art_url ~* '\\.(mp4|webm|ogg|mov)$';

update public.playlists
set cover_art_url = null
where cover_art_url ~* '\\.(mp4|webm|ogg|mov)$';
