import React from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useLanguage } from '@/contexts/LanguageContext';

function ExpandedPlayerTrackDetails() {
  const { currentTrack } = usePlayer();
  const { t } = useLanguage();

  return (
    <div className="text-center mb-6 md:mb-8">
      <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1 truncate">{currentTrack?.title || t('player.track.fallbackTitle')}</h1>
      <p className="text-gray-400 text-base lg:text-lg truncate">{currentTrack?.creator_display_name || t('player.track.fallbackArtist')}</p>
    </div>
  );
}

export default ExpandedPlayerTrackDetails;
