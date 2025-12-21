-- Set correct video cover art path for the provided album + its tracks.

do $$
begin
  update public.albums
  set video_cover_art_url = 'videocoverart/3f9f84ba-2844-44e9-a02c-d6a00d80e23d/1766099178881_generated-video-cover-art-1765901484191.mp4'
  where id = '9630a7ec-bc94-4e5d-8c18-7f9945d9531c';

  update public.tracks
  set video_cover_art_url = 'videocoverart/3f9f84ba-2844-44e9-a02c-d6a00d80e23d/1766099178881_generated-video-cover-art-1765901484191.mp4'
  where album_id = '9630a7ec-bc94-4e5d-8c18-7f9945d9531c'
    and (video_cover_art_url is null or video_cover_art_url = '' or position('/' in video_cover_art_url) = 0);
end $$;
