import React from 'react';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ListPlus } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

function ExpandedPlayerControls() {
  const { 
    isPlaying, 
    togglePlay, 
    playNext, 
    playPrevious,
    shuffleMode,
    cycleShuffleMode,
    repeatMode,
    cycleRepeatMode
  } = usePlayer();
  const { t } = useLanguage();

  const handleAddToPlaylist = () => {
    toast({
      title: t('player.controls.comingSoonTitle'),
      description: t('player.controls.addToPlaylistDescription'),
      className: "bg-blue-600 text-white border-blue-700"
    });
  };

  return (
    <div className="flex items-center justify-center space-x-3 sm:space-x-4 mb-4 md:mb-6">
      <Button 
        variant="ghost" 
        size="icon" 
        className={`player-button ${shuffleMode ? 'active-icon' : ''}`} 
        aria-label={t('player.controls.shuffle')}
        onClick={cycleShuffleMode}
      >
        <Shuffle className="w-5 h-5" />
      </Button>
      
      <Button
        onClick={playPrevious}
        variant="ghost"
        size="icon"
        className="player-button"
        aria-label={t('player.controls.previous')}
      >
        <SkipBack className="w-6 h-6" />
      </Button>
      
      <Button
        onClick={togglePlay}
        size="icon"
        className="w-14 h-14 rounded-full golden-gradient text-black hover:opacity-90"
        aria-label={isPlaying ? t('player.controls.pause') : t('player.controls.play')}
      >
        {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7" />}
      </Button>
      
      <Button
        onClick={playNext}
        variant="ghost"
        size="icon"
        className="player-button"
        aria-label={t('player.controls.next')}
      >
        <SkipForward className="w-6 h-6" />
      </Button>
      
      <Button 
        variant="ghost" 
        size="icon" 
        className={`player-button ${repeatMode ? 'active-icon' : ''}`} 
        aria-label={t('player.controls.repeat')}
        onClick={cycleRepeatMode}
      >
        {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="player-button" 
        aria-label={t('player.controls.addToPlaylist')}
        onClick={handleAddToPlaylist}
      >
        <ListPlus className="w-5 h-5" />
      </Button>
    </div>
  );
}

export default ExpandedPlayerControls;
