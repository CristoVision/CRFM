import React from 'react';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { Maximize2, Minimize2, Baseline, Text } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

function CollapsedPlayerActions() {
  const { 
    currentTrack, 
    setPlayerState, 
    showCollapsedLyrics, 
    toggleCollapsedLyrics,
    currentLyrics,
    lrcError
  } = usePlayer();
  const { t } = useLanguage();

  const hasLrc = currentTrack && (currentTrack.lrc_file_path || currentTrack.lyrics_text) && !lrcError && currentLyrics.length > 0;

  return (
    <div className="flex items-center space-x-1 sm:space-x-3">
      {hasLrc && (
        <Button
          onClick={(e) => { e.stopPropagation(); toggleCollapsedLyrics(); }}
          variant="ghost"
          size="icon"
          className={`player-button ${showCollapsedLyrics ? 'active-icon' : ''}`}
          aria-label={showCollapsedLyrics ? t('player.collapsed.hideLyrics') : t('player.collapsed.showLyrics')}
        >
          {showCollapsedLyrics ? <Text className="w-4 h-4" /> : <Baseline className="w-4 h-4" />}
        </Button>
      )}
      <Button
        onClick={(e) => { e.stopPropagation(); setPlayerState('minimized'); }}
        variant="ghost"
        size="icon"
        className="player-button"
        disabled={!currentTrack}
        aria-label={t('player.collapsed.minimize')}
      >
        <Minimize2 className="w-4 h-4" />
      </Button>
      
      <Button
        onClick={(e) => { e.stopPropagation(); setPlayerState('expanded'); }}
        variant="ghost"
        size="icon"
        className="player-button"
        disabled={!currentTrack}
        aria-label={t('player.collapsed.expand')}
      >
        <Maximize2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default CollapsedPlayerActions;
