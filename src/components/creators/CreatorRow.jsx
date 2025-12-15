import React, { useState, useEffect } from 'react';
    import { Button } from '@/components/ui/button';
    import { supabase } from '@/lib/supabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
    import { Users, ChevronRight, Music, Disc, ListMusic, Film, Flag, Share2, Heart, Loader2 } from 'lucide-react';
    import { motion } from 'framer-motion';
    import { useNavigate } from 'react-router-dom';
    import { useAuth } from '@/contexts/AuthContext';

    const DEFAULT_AVATAR = 'https://avatar.vercel.sh/creator.png?text=CR';

    const CreatorRow = ({ item, onFlag, onShare }) => {
        const navigate = useNavigate();
        const { user, favorites, addFavorite, removeFavorite } = useAuth();
        const { id, username, full_name, avatar_url, track_count = 0, album_count = 0, playlist_count = 0, video_count = 0, creator_tags } = item;
        const [isFavorited, setIsFavorited] = useState(false);
        const [loadingFavorite, setLoadingFavorite] = useState(false);

        useEffect(() => {
          setIsFavorited(favorites.some(fav => fav.content_type === 'creator' && fav.content_id === id));
        }, [favorites, id]);

        const handleToggleFavorite = async (e) => {
          e.stopPropagation();
          if (!user || loadingFavorite) return;
          setLoadingFavorite(true);
          try {
            if (isFavorited) {
              await removeFavorite('creator', id);
              toast({ title: "Removed from favorites", description: `${username} removed from your favorites.`, variant: "success" });
            } else {
              await addFavorite('creator', id);
              toast({ title: "Added to favorites", description: `${username} added to your favorites.`, variant: "success" });
            }
          } catch (error) {
            console.error('Error toggling favorite:', error);
            toast({ title: "Error", description: "Could not update favorites.", variant: "destructive" });
          } finally {
            setLoadingFavorite(false);
          }
        };

        const handleRowClick = (e) => {
          const target = e.target.closest('button');
          if (target && (target.classList.contains('flag-button-creator') || target.classList.contains('favorite-creator-button') || target.classList.contains('share-button'))) {
            e.stopPropagation();
            if (target.classList.contains('flag-button-creator')) {
              onFlag(item);
            } else if (target.classList.contains('favorite-creator-button')) {
              handleToggleFavorite(e);
            } else if (target.classList.contains('share-button')) {
              onShare(item);
            }
          } else {
            navigate(`/creator/${id}`);
          }
        };

        return (
          <motion.div 
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center space-x-4 p-3 hover:bg-white/10 rounded-lg cursor-pointer group transition-colors duration-200"
            onClick={handleRowClick}
          >
            <Avatar className="w-12 h-12 border-2 border-transparent group-hover:border-yellow-400 transition-colors">
              <AvatarImage src={avatar_url || DEFAULT_AVATAR} alt={username} />
              <AvatarFallback className="bg-gray-700 text-white">
                {username ? username.charAt(0).toUpperCase() : <Users />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-white truncate group-hover:text-yellow-400 transition-colors">{username || 'Unknown Creator'}</h3>
              {full_name && <p className="text-sm text-gray-500 truncate">{full_name}</p>}
            </div>
            <div className="hidden md:flex items-center space-x-2 text-xs text-yellow-400">
                {(creator_tags || []).slice(0, 2).map(tag => (
                  <span key={tag} className="bg-yellow-500/10 px-2 py-0.5 rounded-full">{tag}</span>
                ))}
            </div>
            <div className="hidden sm:flex items-center space-x-2 text-xs text-gray-400 flex-wrap justify-end col-span-2" style={{ minWidth: '200px' }}>
              <span className="flex items-center whitespace-nowrap" title="Tracks"><Music className="w-3 h-3 mr-0.5"/>{track_count}</span>
              <span className="flex items-center whitespace-nowrap" title="Albums"><Disc className="w-3 h-3 mr-0.5"/>{album_count}</span>
              <span className="flex items-center whitespace-nowrap" title="Playlists"><ListMusic className="w-3 h-3 mr-0.5"/>{playlist_count}</span>
              <span className="flex items-center whitespace-nowrap" title="Videos"><Film className="w-3 h-3 mr-0.5"/>{video_count}</span>
            </div>
            <div className="flex items-center space-x-1">
               <Button 
                variant="ghost" 
                size="icon" 
                className={`favorite-creator-button w-8 h-8 ${isFavorited ? 'text-red-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'} hover:bg-red-500/10`}
                title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                onClick={handleToggleFavorite}
                disabled={loadingFavorite || !user}
              >
                {loadingFavorite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e)=>{e.stopPropagation(); onShare(item);}}
                className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 share-button w-8 h-8"
                title="Share Creator"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e)=>{e.stopPropagation(); onFlag(item);}}
                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 flag-button-creator w-8 h-8"
                title="Flag Creator"
              >
                <Flag className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 group-hover:text-yellow-400 w-8 h-8" title="View Profile">
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        );
    };
    export default CreatorRow;
