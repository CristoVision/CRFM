import React, { useMemo } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import CoverArtMedia from '@/components/common/CoverArtMedia';

const FALLBACK_ART = 'https://bcrjrlafzqudmdzbcruz.supabase.co/storage/v1/object/public/logo/crfm-logo-gold.gif';

function CollapsedPlayerTrackInfo() {
  const { currentTrack, setPlayerState } = usePlayer();

  const { videoUrl, imageUrl } = useMemo(() => {
    const videoCandidate = currentTrack?.video_cover_art_url || currentTrack?.playlist_video_cover_art_url || currentTrack?.album_video_cover_art_url;
    const imageCandidate = currentTrack?.cover_art_url || FALLBACK_ART;
    return { videoUrl: videoCandidate, imageUrl: imageCandidate };
  }, [currentTrack]);

  return (
    <div 
      className="flex items-center space-x-3 flex-1 cursor-pointer min-w-0 group"
      onClick={() => setPlayerState('expanded')}
      role="button"
      tabIndex={0}
      aria-label="Expand player to view track details"
    >
      <div className="w-12 h-12">
        <CoverArtMedia
          videoUrl={videoUrl}
          imageUrl={imageUrl}
          className="w-12 h-12 border border-yellow-400/20 group-hover:border-yellow-400/50 transition-all"
          roundedClass="rounded-lg"
          showBadge={false}
          objectFitClass="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-white font-semibold truncate group-hover:golden-text transition-colors">{currentTrack?.title || 'CRFM'}</h4>
        <p className="text-gray-400 text-sm truncate group-hover:text-gray-300 transition-colors">{currentTrack?.creator_display_name || 'Christian Radio & Fellowship Ministry'}</p>
      </div>
    </div>
  );
}

export default CollapsedPlayerTrackInfo;
