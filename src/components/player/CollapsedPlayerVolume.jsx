import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { Volume2, VolumeX } from 'lucide-react';

function CollapsedPlayerVolume() {
  const { currentTrack, volume, setVolumeLevel, isMuted, toggleMute } = usePlayer();

  const handleVolumeChange = (value) => {
    setVolumeLevel(value[0]);
  };

  return (
    <div className="flex items-center space-x-1 sm:space-x-2">
      <Button
        onClick={(e) => { e.stopPropagation(); toggleMute(); }}
        variant="ghost"
        size="icon"
        className="player-button"
        disabled={!currentTrack}
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-gray-400" /> : <Volume2 className="w-4 h-4 text-gray-400" />}
      </Button>
      <div className="hidden sm:block">
        <Slider
          value={[isMuted ? 0 : volume]}
          max={1}
          step={0.01}
          onValueChange={handleVolumeChange}
          className="w-20 player-slider"
          disabled={!currentTrack}
          aria-label="Volume control"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

export default CollapsedPlayerVolume;
