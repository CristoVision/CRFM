import React, { useMemo } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import CoverArtMedia from '@/components/common/CoverArtMedia';

const FALLBACK_ART = '/favicon-32x32.png';

function ExpandedPlayerArtwork() {
  const { currentTrack } = usePlayer();

  const { videoUrl, imageUrl } = useMemo(() => {
    const videoCandidate = currentTrack?.video_cover_art_url || currentTrack?.playlist_video_cover_art_url || currentTrack?.album_video_cover_art_url;
    const imageCandidate = currentTrack?.cover_art_url || FALLBACK_ART;
    return { videoUrl: videoCandidate, imageUrl: imageCandidate };
  }, [currentTrack]);

  return (
    <CoverArtMedia
      videoUrl={videoUrl}
      imageUrl={imageUrl}
      className="w-full aspect-square shadow-2xl mb-6 md:mb-8 border-2 border-yellow-400/30"
      roundedClass="rounded-2xl"
      showBadge={!!videoUrl}
    />
  );
}

export default ExpandedPlayerArtwork;
