import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Loader2, Star, Share2, Flag, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { toast } from '@/components/ui/use-toast';
import { CROSSCOIN_ICON_URL } from '@/lib/brandAssets';
import CoverArtMedia from '@/components/common/CoverArtMedia';

const DEFAULT_COVER_ART = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXVkaW98ZW58MHx8MHx8fDA%3D&w=1000&q=80';
const isLikelyVideoUrl = (value) => typeof value === 'string' && /\.(mp4|webm|ogg|mov)$/i.test(value);

    const TrackCard = ({ item, onPlay, isPlaying, currentTrackId, onFlag, onShare }) => {
      const navigate = useNavigate();
  const { user, profile, favorites, addFavorite, removeFavorite } = useAuth();
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
    is_public,
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
      
      const handleCardClick = (e) => {
        const target = e.target.closest('button');
        if (target && (target.classList.contains('play-pause-button') || target.classList.contains('flag-button') || target.classList.contains('favorite-button') || target.classList.contains('share-button'))) {
        } else {
          navigate(`/track/${id}`);
        }
      };
      
      const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      };

      const hasSyncedLyrics = lrc_file_path && lrc_file_path.trim() !== '';

      const imageFallback = [
        cover_art_url,
        albums?.cover_art_url,
        profiles?.avatar_url,
        DEFAULT_COVER_ART,
      ].find((url) => url && !isLikelyVideoUrl(url));

      const videoFallback = video_cover_art_url || albums?.video_cover_art_url || null;

      return (
        <TooltipProvider delayDuration={100}>
          <Card onClick={handleCardClick} className="w-full group glass-effect-hoverable cursor-pointer relative overflow-hidden">
            {hasSyncedLyrics && !is_instrumental && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="absolute top-2 right-2 bg-green-500 text-white text-xs font-medium rounded-full px-2 py-1 flex items-center z-10 cursor-default"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Synced Lyrics
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This track has synchronized lyrics available.</p>
                </TooltipContent>
              </Tooltip>
            )}
            {is_instrumental && (
               <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="absolute top-2 right-2 bg-blue-500 text-white text-xs font-medium rounded-full px-2 py-1 flex items-center z-10 cursor-default"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Instrumental
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This track is instrumental.</p>
                </TooltipContent>
              </Tooltip>
            )}
            <CardContent className="p-0">
              <div className="flex items-center space-x-4 p-4">
                <div className="relative flex-shrink-0">
                  <CoverArtMedia
                    videoUrl={videoFallback}
                    imageUrl={imageFallback}
                    className="w-20 h-20 shadow-md border border-white/10"
                    objectFitClass="object-cover"
                    roundedClass="rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-10 h-10 rounded-full golden-gradient text-black hover:opacity-80 play-pause-button"
                      onClick={handlePlayClick}
                      disabled={isPaymentProcessingForThisTrack}
                    >
                      {isPaymentProcessingForThisTrack ? <Loader2 className="w-5 h-5 animate-spin" /> : (isCurrentPlayingTrack && isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />)}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white truncate group-hover:text-yellow-400 transition-colors">{title}</h3>
                    {profile?.is_admin && is_public === false && (
                      <span className="text-[10px] uppercase tracking-wide bg-red-500/20 text-red-200 border border-red-500/30 px-2 py-0.5 rounded">
                        Hidden
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 truncate">{creator_display_name}</p>
                  <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                    {genre && <span className="truncate max-w-[80px]">{genre}</span>}
                    {release_date && <span className="hidden sm:inline">{formatDate(release_date)}</span>}
                  </div>
                  {stream_cost > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center text-xs text-yellow-400 mt-1 cursor-default" onClick={(e) => e.stopPropagation()}>
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
                  )}
                </div>
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`w-8 h-8 favorite-button ${isFavorite ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-400 hover:text-yellow-400'}`}
                      onClick={handleToggleFavorite}
                      title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                      disabled={loadingFavorite}
                  >
                    {loadingFavorite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-yellow-400 w-8 h-8 share-button" onClick={(e) => {e.stopPropagation(); onShare(item);}} title="Share Track">
                    <Share2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-400 w-8 h-8 flag-button" onClick={(e) => {e.stopPropagation(); onFlag(item);}} title="Flag Track">
                    <Flag className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TooltipProvider>
      );
    };

    export default TrackCard;
