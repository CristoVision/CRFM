import React from 'react';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { Maximize2, Minimize2, Baseline, Text } from 'lucide-react';

function CollapsedPlayerActions() {
  const { 
    currentTrack, 
    setPlayerState, 
    showCollapsedLyrics, 
    toggleCollapsedLyrics,
    currentLyrics,
    lrcError
  } = usePlayer();

  const hasLrc = currentTrack && (currentTrack.lrc_file_path || currentTrack.lyrics_text) && !lrcError && currentLyrics.length > 0;

  return (
    <div className="flex items-center space-x-1 sm:space-x-3">
      {hasLrc && (
        <Button
          onClick={(e) => { e.stopPropagation(); toggleCollapsedLyrics(); }}
          variant="ghost"
          size="icon"
          className={`player-button ${showCollapsedLyrics ? 'active-icon' : ''}`}
          aria-label={showCollapsedLyrics ? "Hide lyrics" : "Show lyrics"}
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
        aria-label="Minimize player"
      >
        <Minimize2 className="w-4 h-4" />
      </Button>
      
      <Button
        onClick={(e) => { e.stopPropagation(); setPlayerState('expanded'); }}
        variant="ghost"
        size="icon"
        className="player-button"
        disabled={!currentTrack}
        aria-label="Expand player"
      >
        <Maximize2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default CollapsedPlayerActions;
