import React, { useState, useEffect } from 'react';
    import { Button } from '@/components/ui/button';
    import { usePlayer } from '@/contexts/PlayerContext';
    import { useAuth } from '@/contexts/AuthContext';
import { Play, Pause, SkipBack, SkipForward, Star, Shuffle, Repeat, Repeat1, Loader2 } from 'lucide-react';
    import { toast } from '@/components/ui/use-toast';

    function CollapsedPlayerControls() {
      const { 
        currentTrack, 
        isPlaying, 
        togglePlay, 
        playNext, 
        playPrevious,
        shuffleMode,
        cycleShuffleMode,
        repeatMode,
        cycleRepeatMode
      } = usePlayer();
      const { user, favorites, addFavorite, removeFavorite } = useAuth();

      const [isFavorite, setIsFavorite] = useState(false);
      const [loadingFavorite, setLoadingFavorite] = useState(false);

      useEffect(() => {
        if (currentTrack && Array.isArray(favorites)) {
          setIsFavorite(favorites.some(fav => fav.content_type === 'track' && fav.content_id === currentTrack.id));
        } else {
          setIsFavorite(false);
        }
      }, [favorites, currentTrack]);

      const handleToggleFavorite = async (e) => {
        e.stopPropagation(); 
        if (!currentTrack) return;
        if (!user) {
          toast({ title: "Login Required", description: "Please log in to favorite tracks.", variant: "destructive" });
          return;
        }
        if (loadingFavorite) return;

        if (typeof addFavorite !== 'function' || typeof removeFavorite !== 'function') {
            toast({ title: "Feature not available", description: "Favorites functionality is currently unavailable.", variant: "destructive" });
            return;
        }

        setLoadingFavorite(true);
        try {
          if (isFavorite) {
            await removeFavorite('track', currentTrack.id);
            toast({ title: "Removed from favorites", variant: 'success' });
          } else {
            await addFavorite('track', currentTrack.id);
            toast({ title: "Added to favorites", variant: 'success' });
          }
        } catch (error) {
          toast({ title: 'Error updating favorites', description: error.message, variant: 'destructive' });
        } finally {
          setLoadingFavorite(false);
        }
      };
      
      return (
        <div className="flex items-center space-x-1 sm:space-x-2 mx-1 sm:mx-2">
          <Button
            onClick={handleToggleFavorite}
            variant="ghost"
            size="icon"
            className={`player-button hidden xs:flex ${isFavorite ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-300'}`}
            disabled={!currentTrack || !user || loadingFavorite}
            aria-label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          >
            {loadingFavorite ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Star className={`w-4 h-4 sm:w-5 sm:h-5 ${isFavorite ? 'fill-current' : ''}`} />}
          </Button>
          
          <Button
            onClick={(e) => { e.stopPropagation(); cycleShuffleMode(); }}
            variant="ghost"
            size="icon"
            className={`player-button hidden md:flex ${shuffleMode === 'on' ? 'active-icon' : ''}`}
            disabled={!currentTrack}
            aria-label="Shuffle"
          >
            <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>

          <Button
            onClick={(e) => { e.stopPropagation(); playPrevious(); }}
            variant="ghost"
            size="icon"
            className="player-button"
            disabled={!currentTrack}
            aria-label="Previous track"
          >
            <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          
          <Button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            size="icon"
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full golden-gradient text-black hover:opacity-90 disabled:opacity-50 disabled:bg-gray-500"
            disabled={!currentTrack}
            aria-label={isPlaying ? "Pause track" : "Play track"}
          >
            {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5" />}
          </Button>
          
          <Button
            onClick={(e) => { e.stopPropagation(); playNext(); }}
            variant="ghost"
            size="icon"
            className="player-button"
            disabled={!currentTrack}
            aria-label="Next track"
          >
            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>

          <Button
            onClick={(e) => { e.stopPropagation(); cycleRepeatMode(); }}
            variant="ghost"
            size="icon"
            className={`player-button hidden md:flex ${repeatMode !== 'off' ? 'active-icon' : ''}`}
            disabled={!currentTrack}
            aria-label="Repeat"
          >
            {repeatMode === 'one' ? <Repeat1 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Repeat className="w-4 h-4 sm:w-5 sm:h-5" />}
          </Button>
        </div>
      );
    }

    export default CollapsedPlayerControls;
