import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { Volume2, VolumeX } from 'lucide-react';

function ExpandedPlayerVolumeControl() {
  const { volume, setVolumeLevel, isMuted, toggleMute } = usePlayer();

  const handleVolumeChange = (value) => {
    setVolumeLevel(value[0]);
  };

  return (
    <div className="flex items-center justify-center space-x-3">
      <Button
        onClick={toggleMute}
        variant="ghost"
        size="icon"
        className="player-button"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-gray-400" /> : <Volume2 className="w-5 h-5 text-gray-400" />}
      </Button>
      <Slider
        value={[isMuted ? 0 : volume]}
        max={1}
        step={0.01}
        onValueChange={handleVolumeChange}
        className="w-32 player-slider"
        aria-label="Volume control"
      />
    </div>
  );
}

export default ExpandedPlayerVolumeControl;
