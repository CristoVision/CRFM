import React from 'react';
import { Slider } from '@/components/ui/slider';
import { usePlayer } from '@/contexts/PlayerContext';

function ExpandedPlayerProgressBar() {
  const { currentTime, duration, seekTo } = usePlayer();

  const formatTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (value) => {
    seekTo(value[0]);
  };

  return (
    <div className="mb-4 md:mb-6">
      <Slider
        value={[currentTime]}
        max={duration || 100}
        step={1}
        onValueChange={handleSeek}
        className="w-full mb-2 player-slider"
        aria-label="Track progress"
      />
      <div className="flex justify-between text-sm text-gray-400 font-medium">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration || 0)}</span>
      </div>
    </div>
  );
}

export default ExpandedPlayerProgressBar;
