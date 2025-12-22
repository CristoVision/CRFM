import React, { useState, useEffect } from 'react';
    import { Card, CardContent } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Badge } from '@/components/ui/badge';
    import { Heart, PlayCircle, Share2, Edit3, Trash2, DollarSign, CalendarDays, Languages, Eye, EyeOff, Loader2, Users } from 'lucide-react';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
    import { motion } from 'framer-motion';
    import { formatDistanceToNowStrict } from 'date-fns';
    import { pickImageFallback } from '@/lib/mediaFallbacks';

    const DEFAULT_VIDEO_COVER_ART = 'https://images.unsplash.com/photo-1516280440614-3793959696b4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fHZpZGVvfGVufDB8fDB8fHww&w=1000&q=80';

    const HubMusicVideoCard = ({ video, onPlay, onShare, onEdit, onDelete, onContributions, isProcessingPlay }) => {
      const { user, favorites, addFavorite, removeFavorite } = useAuth();
      const [isFavorited, setIsFavorited] = useState(false);
      const [loadingFavorite, setLoadingFavorite] = useState(false);

      useEffect(() => {
        if (video?.id && Array.isArray(favorites)) {
          setIsFavorited(favorites.some(fav => fav.content_type === 'video' && fav.content_id === video.id));
        } else {
          setIsFavorited(false);
        }
      }, [favorites, video]);

      const handleToggleFavorite = async (e) => {
        e.stopPropagation();
        if (!user || !video || loadingFavorite) return;
        if (typeof addFavorite !== 'function' || typeof removeFavorite !== 'function') {
          toast({ title: "Feature not available", description: "Favorites functionality is currently unavailable.", variant: "destructive" });
          return;
        }
        setLoadingFavorite(true);
        try {
          if (isFavorited) {
            await removeFavorite('video', video.id);
            toast({ title: "Video removed from favorites", variant: "success" });
          } else {
            await addFavorite('video', video.id);
            toast({ title: "Video added to favorites", variant: "success" });
          }
        } catch (error) {
          toast({ title: "Error updating favorites", description: error.message, variant: "destructive" });
        } finally {
          setLoadingFavorite(false);
        }
      };

      const handleShareClick = (e) => {
        e.stopPropagation();
        if (typeof onShare === 'function') onShare(video);
      };

      const handleEditClick = (e) => {
        e.stopPropagation();
        if (typeof onEdit === 'function') onEdit(video);
      };

      const handleDeleteClick = (e) => {
        e.stopPropagation();
        if (typeof onDelete === 'function') onDelete(video);
      };
      
      const formattedDate = video.created_at ? formatDistanceToNowStrict(new Date(video.created_at), { addSuffix: true }) : 'N/A';

      return (
        <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          <Card className="group bg-gradient-to-br from-gray-900 to-black border-gray-700/50 shadow-xl text-white overflow-hidden transition-all duration-300 hover:shadow-yellow-500/20 hover:border-yellow-500/50">
            <CardContent className="p-0">
              <div className="relative aspect-video w-full">
                <img 
                  src={pickImageFallback([video.cover_art_url], DEFAULT_VIDEO_COVER_ART)}
                  alt={video.title || "Music video cover art"}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                <Badge variant="secondary" className="absolute top-3 left-3 bg-yellow-500 text-black text-xs font-semibold shadow-md">
                  Music Video
                </Badge>
                <div className="absolute top-3 right-3 flex items-center space-x-1.5">
                   <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleFavorite}
                    disabled={loadingFavorite || !user}
                    className={`w-8 h-8 rounded-full ${isFavorited ? 'text-red-500 bg-red-900/50 hover:bg-red-800/60' : 'text-gray-300 bg-black/50 hover:bg-black/70'} backdrop-blur-sm`}
                    title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                  >
                    {loadingFavorite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleShareClick}
                    className="w-8 h-8 rounded-full text-gray-300 bg-black/50 hover:bg-black/70 hover:text-yellow-300 backdrop-blur-sm"
                    title="Share Video"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-3">
                   <h3 className="text-base font-semibold text-white truncate group-hover:text-yellow-400 transition-colors">
                    {video.title || "Untitled Video"}
                  </h3>
                </div>
              </div>

              <div className="p-3 space-y-2">
                <p className="text-xs text-gray-400 line-clamp-2 h-8">
                  {video.description || "No description available."}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center"><CalendarDays className="w-3 h-3 mr-1 text-yellow-500/70"/> {formattedDate}</span>
                    <span className="flex items-center">
                        {video.is_public ? <Eye className="w-3 h-3 mr-1 text-green-500/70"/> : <EyeOff className="w-3 h-3 mr-1 text-red-500/70"/>}
                        {video.is_public ? 'Public' : 'Private'}
                    </span>
                </div>
                {video.language && <p className="text-xs text-gray-500 flex items-center"><Languages className="w-3 h-3 mr-1 text-yellow-500/70"/> {video.language}</p>}


                {video.cost_cc > 0 && (
                  <div className="text-xs text-yellow-400 flex items-center">
                    <DollarSign className="w-3.5 h-3.5 mr-1" />
                    <span>Costs {video.cost_cc} CrossCoin{video.cost_cc > 1 ? 's' : ''}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-700/50">
                  <Button
                    onClick={(e) => { e.stopPropagation(); onPlay(video); }}
                    disabled={isProcessingPlay || !user}
                    className="col-span-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-semibold hover:opacity-90 transition-opacity text-xs py-1.5 px-2 h-auto"
                  >
                    {isProcessingPlay ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <PlayCircle className="w-4 h-4 mr-1.5" />
                    )}
                    Watch
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (typeof onContributions === 'function') {
                        onContributions(video);
                      } else {
                        toast({ title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀" });
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-yellow-300 hover:border-yellow-500/50 text-xs py-1.5 px-2 h-auto"
                  >
                    <Users className="w-3.5 h-3.5 mr-1.5" /> Contrib.
                  </Button>
                  <Button
                    onClick={handleEditClick}
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-yellow-300 hover:border-yellow-500/50 text-xs py-1.5 px-2 h-auto"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Button>
                  <Button
                    onClick={handleDeleteClick}
                    variant="outline"
                    size="sm"
                    className="col-span-2 border-red-700/50 text-red-400 hover:bg-red-700/30 hover:text-red-300 hover:border-red-600/50 text-xs py-1.5 px-2 h-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      );
    };

    export default HubMusicVideoCard;
