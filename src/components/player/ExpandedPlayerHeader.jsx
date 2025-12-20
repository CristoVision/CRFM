import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { X, Star, MoreHorizontal, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

    function ExpandedPlayerHeader() {
      const { currentTrack, setPlayerState } = usePlayer();
      const { user, favorites, addFavorite, removeFavorite } = useAuth();
      const { t } = useLanguage();

      const [isFavorite, setIsFavorite] = useState(false);
      const [loadingFavorite, setLoadingFavorite] = useState(false);

      useEffect(() => {
        if (currentTrack && Array.isArray(favorites)) {
          setIsFavorite(favorites.some(fav => fav.content_type === 'track' && fav.content_id === currentTrack.id));
        } else {
          setIsFavorite(false);
        }
      }, [favorites, currentTrack]);

      const handleToggleFavorite = async () => {
        if (!currentTrack) return;
        if (!user) {
          toast({ title: t('player.controls.loginRequired'), description: t('player.controls.loginToFavorite'), variant: "destructive" });
          return;
        }
        if (loadingFavorite) return;

        if (typeof addFavorite !== 'function' || typeof removeFavorite !== 'function') {
            toast({ title: t('player.controls.unavailableTitle'), description: t('player.controls.unavailableDescription'), variant: "destructive" });
            return;
        }

        setLoadingFavorite(true);
        try {
          if (isFavorite) {
            await removeFavorite('track', currentTrack.id);
            toast({ title: t('player.controls.removedFavorite'), variant: 'success' });
          } else {
            await addFavorite('track', currentTrack.id);
            toast({ title: t('player.controls.addedFavorite'), variant: 'success' });
          }
        } catch (error) {
          toast({ title: t('player.controls.updateError'), description: error.message, variant: 'destructive' });
        } finally {
          setLoadingFavorite(false);
        }
      };

      return (
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => setPlayerState('collapsed')}
              variant="ghost"
              size="icon"
              className="player-button"
              aria-label={t('player.expanded.collapse')}
            >
              <X className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold text-white">{t('player.expanded.nowPlaying')}</h2>
          </div>
          
          <div className="flex items-center space-x-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`player-button ${isFavorite ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-300'}`} 
              aria-label={isFavorite ? t('player.controls.removeFavorite') : t('player.controls.addFavorite')}
              onClick={handleToggleFavorite}
              disabled={!currentTrack || !user || loadingFavorite}
            >
              {loadingFavorite ? <Loader2 className="w-5 h-5 animate-spin" /> : <Star className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />}
            </Button>
            <Button variant="ghost" size="icon" className="player-button" aria-label={t('player.expanded.moreOptions')}>
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </div>
        </div>
      );
    }

    export default ExpandedPlayerHeader;
