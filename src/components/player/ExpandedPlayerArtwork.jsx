import React, { useMemo } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import CoverArtMedia from '@/components/common/CoverArtMedia';

const FALLBACK_ART = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXVkaW98ZW58MHx8MHx8fDA%3D&w=1000&q=80';

const isUsableMediaUrl = (value) =>
  typeof value === 'string' &&
  (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:') || value.includes('/'));
const isLikelyVideoUrl = (value) => typeof value === 'string' && /\.(mp4|webm|ogg|mov)$/i.test(value);

function ExpandedPlayerArtwork() {
  const { currentTrack } = usePlayer();

  const { videoUrl, imageUrl } = useMemo(() => {
    const videoCandidate =
      currentTrack?.video_cover_art_url ||
      currentTrack?.playlist_video_cover_art_url ||
      currentTrack?.album_video_cover_art_url;
    const imageCandidate = [
      currentTrack?.cover_art_url,
      currentTrack?.album_cover_art_url,
      currentTrack?.creator_avatar_url,
      FALLBACK_ART,
    ].find((url) => url && !isLikelyVideoUrl(url));
    return { videoUrl: isUsableMediaUrl(videoCandidate) ? videoCandidate : null, imageUrl: imageCandidate };
  }, [currentTrack]);

  return (
    <CoverArtMedia
      videoUrl={videoUrl}
      imageUrl={imageUrl}
      className="w-full aspect-square max-h-[38vh] md:max-h-none shadow-2xl mb-6 md:mb-8 border-2 border-yellow-400/30"
      roundedClass="rounded-2xl"
      showBadge={!!videoUrl}
    />
  );
}

export default ExpandedPlayerArtwork;
