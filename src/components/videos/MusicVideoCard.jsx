import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, PlayCircle, Share2, AlertTriangle, Loader2, Expand, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { useVideoPlayer } from '@/contexts/VideoPlayerContext';
import { toast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DEFAULT_COVER_ART = 'https://images.unsplash.com/photo-1516280440614-3793959696b4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fHZpZGVvfGVufDB8fDB8fHww&w=1000&q=80';

const MusicVideoCard = ({ video, onPlay, onShare }) => {
  const navigate = useNavigate();
  const { user, favorites, addFavorite, removeFavorite, spendCrossCoinsForVideo } = useAuth();
  const { pause } = usePlayer();
  const { playVideo } = useVideoPlayer();
  const [isFavorited, setIsFavorited] = useState(false);
  const [loadingFavorite, setLoadingFavorite] = useState(false);
  const [loadingPlay, setLoadingPlay] = useState(false);

  useEffect(() => {
    if (video?.id && Array.isArray(favorites)) {
      setIsFavorited(favorites.some(fav => fav.content_type === 'video' && fav.content_id === video.id));
    } else {
      setIsFavorited(false);
    }
  }, [favorites, video]);

  const handleActionClick = (e, action) => {
    e.stopPropagation();
    if (typeof action === 'function') {
      action();
    }
  };

  const handleToggleFavorite = async () => {
    if (!user || !video || loadingFavorite) return;
    if (typeof addFavorite !== 'function' || typeof removeFavorite !== 'function') {
      toast({ title: "Feature not available", description: "Favorites functionality is currently unavailable.", variant: "destructive" });
      return;
    }
    setLoadingFavorite(true);
    try {
      if (isFavorited) {
        await removeFavorite('video', video.id);
        toast({ title: "Removed from favorites", variant: "success" });
      } else {
        await addFavorite('video', video.id);
        toast({ title: "Added to favorites", variant: "success" });
      }
    } catch (error) {
      toast({ title: "Error updating favorites", description: error.message, variant: "destructive" });
    } finally {
      setLoadingFavorite(false);
    }
  };

  const handlePlay = async () => {
    if (!user || loadingPlay || !video) return;
    setLoadingPlay(true);

    // Pause the global music player before starting video
    try { pause?.(); } catch { /* noop */ }
    
    const cost = Number(video.cost_cc ?? 0);
    if (cost > 0 && typeof spendCrossCoinsForVideo === 'function') {
      const { success, error } = await spendCrossCoinsForVideo(video.id, cost);
      if (!success) {
        toast({
          title: "Cannot start playback",
          description: error || `You need ${cost} CrossCoins to watch this video.`,
          variant: "destructive",
        });
        setLoadingPlay(false);
        return;
      }
    }

    playVideo(video);
    setLoadingPlay(false);
  };
  
  const handleCardClick = () => {
    if (video?.id) navigate(`/video/${video.id}`);
  };

  if (!video) {
    return null;
  }

  return (
    <TooltipProvider>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="w-full"
      >
        <Card onClick={handleCardClick} className="group glass-effect-hoverable cursor-pointer overflow-hidden">
          <CardContent className="p-0">
            <div className="relative aspect-video w-full">
              <img 
                src={video.cover_art_url || DEFAULT_COVER_ART}
                alt={video.title || "Music video cover art"}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
              <Badge variant="secondary" className="absolute top-3 left-3 bg-yellow-500 text-black text-xs font-semibold">
                Music Video
              </Badge>
               <div className="absolute top-3 right-3 flex items-center space-x-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, () => onPlay(video))} className="w-8 h-8 rounded-full text-white/80 bg-black/50 hover:bg-black/70 backdrop-blur-sm">
                      <Expand className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Expand Video</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                     <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, handleToggleFavorite)} disabled={loadingFavorite || !user} className={`w-8 h-8 rounded-full ${isFavorited ? 'text-red-500 bg-red-500/20 hover:bg-red-500/30' : 'text-white/80 bg-black/50 hover:bg-black/70'} backdrop-blur-sm`}>
                      {loadingFavorite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{isFavorited ? "Remove from favorites" : "Add to favorites"}</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, () => onShare(video))} className="w-8 h-8 rounded-full text-white/80 bg-black/50 hover:bg-black/70 backdrop-blur-sm">
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Share Video</p></TooltipContent>
                </Tooltip>
                 <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, () => toast({ title: "🚧 Feature available in Creator Hub", description: "You can manage contributions for your content in the Hub." }))} className="w-8 h-8 rounded-full text-white/80 bg-black/50 hover:bg-black/70 backdrop-blur-sm">
                      <Users className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Manage Contributions</p></TooltipContent>
                </Tooltip>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4">
                 <h3 className="text-lg font-bold text-white truncate group-hover:text-yellow-400 transition-colors">
                  {video.title || "Untitled Video"}
                </h3>
                <p className="text-xs text-gray-300 truncate">
                  By: {video.creator_display_name || "Unknown Artist"}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-800/30">
              <p className="text-sm text-gray-400 line-clamp-2 mb-3 h-10">
                {video.description || "No description available."}
              </p>
              <div className="flex items-center justify-between">
                <Button
                  onClick={(e) => handleActionClick(e, handlePlay)}
                  disabled={loadingPlay || !user}
                  className="golden-gradient text-black font-semibold w-full hover:opacity-90 transition-opacity"
                >
                  {loadingPlay ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <PlayCircle className="w-5 h-5 mr-2" />
                  )}
                  Watch Now
                </Button>
              </div>
               {!user && (
                <div className="mt-2 text-xs text-orange-400 flex items-center justify-center p-2 bg-orange-500/10 rounded-md">
                  <AlertTriangle className="w-4 h-4 mr-1.5" />
                  <span>Login required to watch & interact.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </TooltipProvider>
  );
};

export default MusicVideoCard;
