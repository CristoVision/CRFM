import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { formatTime } from '../lrcEditorUtils.js';

function PlayerControls({
  audioRef, trackAudioUrl, isPlaying, togglePlayPause,
  currentTime, duration, handleSeek,
  currentLineIndex, setCurrentLineIndex, lyricsLength
}) {
  return (
    <div className="bg-black/20 p-3 rounded-md border border-white/10">
      <audio ref={audioRef} src={trackAudioUrl} className="w-full hidden" controlsList="nodownload noplaybackrate"></audio>
      <div className="flex items-center justify-center space-x-3 mb-3">
        <Button onClick={() => setCurrentLineIndex(prev => Math.max(0, prev - 1))} size="icon" variant="ghost" disabled={currentLineIndex === 0}><SkipBack /></Button>
        <Button onClick={togglePlayPause} size="lg" variant="outline" className="w-16 h-16 rounded-full golden-gradient text-black text-2xl">
          {isPlaying ? <Pause size={30}/> : <Play size={30}/>}
        </Button>
        <Button onClick={() => setCurrentLineIndex(prev => Math.min(lyricsLength - 1, prev + 1))} size="icon" variant="ghost" disabled={currentLineIndex === lyricsLength - 1 || lyricsLength === 0}><SkipForward /></Button>
      </div>
      <div className="flex items-center space-x-2 text-sm">
        <span className="font-mono text-gray-400">{formatTime(currentTime)}</span>
        <Slider
          value={[currentTime]}
          max={duration || 0}
          step={0.01}
          onValueChange={handleSeek}
          className="w-full"
        />
        <span className="font-mono text-gray-400">{formatTime(duration)}</span>
      </div>
    </div>
  );
}

export default PlayerControls;
