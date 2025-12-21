import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Loader2, Star, Share2, Flag, Eye, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { toast } from '@/components/ui/use-toast';
import { CROSSCOIN_ICON_URL } from '@/lib/brandAssets';
import CoverArtMedia from '@/components/common/CoverArtMedia';

const DEFAULT_COVER_ART = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXVkaW98ZW58MHx8MHx8fDA%3D&w=1000&q=80';

    const TrackRow = ({ item, onPlay, isPlaying, currentTrackId, onFlag, onShare }) => {
      const navigate = useNavigate();
      const { user, favorites, addFavorite, removeFavorite } = useAuth();
      const { isProcessingPayment, currentTrack: playerCurrentTrack } = usePlayer();
      const { 
        id,
        title,
        creator_display_name,
        cover_art_url,
        video_cover_art_url,
        genre,
        release_date,
        stream_cost,
        lrc_file_path,
        is_instrumental,
        albums,
        profiles
      } = item;

      const [isFavorite, setIsFavorite] = useState(false);
      const [loadingFavorite, setLoadingFavorite] = useState(false);

      useEffect(() => {
        if (Array.isArray(favorites)) {
          setIsFavorite(favorites.some(fav => fav.content_type === 'track' && fav.content_id === id));
        }
      }, [favorites, id]);

      const isCurrentPlayingTrack = currentTrackId === id;
      const isPaymentProcessingForThisTrack = isProcessingPayment && playerCurrentTrack?.id === id;

      const handleToggleFavorite = async (e) => {
        e.stopPropagation();
        if (!user) {
          toast({ title: "Login Required", description: "Please log in to add to favorites.", variant: "destructive" });
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
            await removeFavorite('track', id);
            toast({ title: "Removed from favorites", variant: 'success' });
          } else {
            await addFavorite('track', id);
            toast({ title: "Added to favorites", variant: 'success' });
          }
        } catch (error) {
          toast({ title: 'Error updating favorites', description: error.message, variant: 'destructive' });
        } finally {
          setLoadingFavorite(false);
        }
      };

      const handlePlayClick = (e) => {
        e.stopPropagation();
        if (isPaymentProcessingForThisTrack) return;
        onPlay(item);
      };

      const handleRowClick = (e) => {
        const target = e.target.closest('button');
        if (target && (target.classList.contains('play-pause-button') || target.classList.contains('flag-button') || target.classList.contains('favorite-button') || target.classList.contains('share-button') || target.classList.contains('view-track-button'))) {
        } else {
          navigate(`/track/${id}`);
        }
      };

      const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      };

      const hasSyncedLyrics = lrc_file_path && lrc_file_path.trim() !== '';

      const imageFallback =
        cover_art_url ||
        albums?.cover_art_url ||
        profiles?.avatar_url ||
        DEFAULT_COVER_ART;

      const videoFallback = video_cover_art_url || albums?.video_cover_art_url || null;

      return (
        <TooltipProvider delayDuration={100}>
          <motion.div 
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center space-x-4 p-3 hover:bg-white/10 rounded-lg cursor-pointer group transition-colors duration-200"
            onClick={handleRowClick}
          >
            <div className="relative flex-shrink-0">
              <CoverArtMedia
                videoUrl={videoFallback}
                imageUrl={imageFallback}
                className="w-12 h-12 border border-white/10"
                objectFitClass="object-cover"
                roundedClass="rounded-md"
              />
              <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full golden-gradient text-black hover:opacity-80 play-pause-button"
                  onClick={handlePlayClick}
                  disabled={isPaymentProcessingForThisTrack}
                >
                  {isPaymentProcessingForThisTrack ? <Loader2 className="w-4 h-4 animate-spin" /> : (isCurrentPlayingTrack && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />)}
                </Button>
              </div>
            </div>
            <div className="flex-1 min-w-0 grid grid-cols-6 items-center gap-4">
              <h3 className="font-medium text-white truncate col-span-2 group-hover:text-yellow-400 transition-colors">{title}</h3>
              <p className="text-sm text-gray-400 truncate hidden md:block">{creator_display_name}</p>
              <div className="text-sm text-gray-500 truncate hidden lg:block">
                {genre}
                {is_instrumental && <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded-full">Instrumental</span>}
                {hasSyncedLyrics && !is_instrumental && 
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <FileText className="w-3.5 h-3.5 ml-1.5 inline-block text-green-400 cursor-default" onClick={(e) => e.stopPropagation()} />
                    </TooltipTrigger>
                    <TooltipContent><p>Synced Lyrics Available</p></TooltipContent>
                  </Tooltip>
                }
              </div>
              {stream_cost > 0 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center text-xs text-yellow-400 cursor-default" onClick={(e) => e.stopPropagation()}>
                          <img
                            src={CROSSCOIN_ICON_URL}
                            alt="CrossCoin"
                            className="w-3.5 h-3.5 mr-1"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/favicon-32x32.png';
                            }}
                          />
                          <span>{stream_cost} CC</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                    <p>Cost per play: {stream_cost} CrossCoins</p>
                  </TooltipContent>
                </Tooltip>
              ) : <span className="text-xs text-gray-500 text-center">Free</span> }
              <p className="text-sm text-gray-500 truncate text-right hidden sm:block">
                {formatDate(release_date)}
              </p>
            </div>
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Button 
                variant="ghost" 
                size="icon" 
                className={`w-7 h-7 favorite-button ${isFavorite ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-400 hover:text-yellow-400'}`}
                onClick={handleToggleFavorite}
                title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                disabled={loadingFavorite}
              >
                {loadingFavorite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />}
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-yellow-400 w-7 h-7 share-button" onClick={(e) => {e.stopPropagation(); onShare(item);}} title="Share Track">
                <Share2 className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-400 w-7 h-7 flag-button" onClick={(e) => {e.stopPropagation(); onFlag(item);}} title="Flag Track">
                <Flag className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-yellow-400 w-7 h-7 view-track-button" onClick={(e) => {e.stopPropagation(); navigate(`/track/${id}`)}} title="View Track">
                <Eye className="w-3 h-3" />
              </Button>
            </div>
          </motion.div>
        </TooltipProvider>
      );
    };

    export default TrackRow;
