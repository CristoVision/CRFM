import React from 'react';
import { usePlayer } from '@/contexts/PlayerContext';

function ExpandedPlayerTrackDetails() {
  const { currentTrack } = usePlayer();

  return (
    <div className="text-center mb-6 md:mb-8">
      <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1 truncate">{currentTrack?.title || 'CRFM'}</h1>
      <p className="text-gray-400 text-base lg:text-lg truncate">{currentTrack?.creator_display_name || 'Christian Radio & Fellowship Ministry'}</p>
    </div>
  );
}

export default ExpandedPlayerTrackDetails;
