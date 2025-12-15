import React, { useState, useEffect } from 'react';
    import { Button } from '@/components/ui/button';
    import { supabase } from '@/lib/supabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { Card, CardContent } from '@/components/ui/card';
    import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
    import { Users, ChevronRight, Music, Disc, ListMusic, Film, Flag, Share2, Heart, Loader2 } from 'lucide-react';
    import { useNavigate } from 'react-router-dom';
    import { useAuth } from '@/contexts/AuthContext';

    const DEFAULT_AVATAR = 'https://avatar.vercel.sh/creator.png?text=CR';

    const CreatorCard = ({ item, onFlag, onShare }) => {
      const navigate = useNavigate();
      const { user, favorites, addFavorite, removeFavorite } = useAuth();
      const { id, username, full_name, avatar_url, bio, creator_tags, track_count = 0, album_count = 0, playlist_count = 0, video_count = 0 } = item;
      const [isFavorited, setIsFavorited] = useState(false);
      const [loadingFavorite, setLoadingFavorite] = useState(false);

      useEffect(() => {
        if (Array.isArray(favorites)) {
          setIsFavorited(favorites.some(fav => fav.content_type === 'creator' && fav.content_id === id));
        } else {
          setIsFavorited(false);
        }
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

      const handleCardClick = (e) => {
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
        <Card onClick={handleCardClick} className="w-full group glass-effect-hoverable cursor-pointer">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Avatar className="w-24 h-24 mb-4 border-2 border-transparent group-hover:border-yellow-400 transition-colors duration-300 shadow-lg">
              <AvatarImage src={avatar_url || DEFAULT_AVATAR} alt={username} />
              <AvatarFallback className="text-2xl bg-gray-700 text-white">
                {username ? username.charAt(0).toUpperCase() : <Users />}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-semibold text-white truncate group-hover:text-yellow-400 transition-colors w-full">{username || 'Unknown Creator'}</h3>
            {full_name && <p className="text-sm text-gray-400 truncate w-full">{full_name}</p>}
            <p className="text-xs text-gray-500 line-clamp-2 mt-1 h-8">{bio || "No bio available."}</p>
            
            <div className="flex flex-wrap justify-center gap-1 text-xs text-yellow-400 mt-2">
              {(creator_tags || []).slice(0, 2).map(tag => (
                <span key={tag} className="bg-yellow-500/10 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-400 mt-3">
              <span className="flex items-center" title="Tracks"><Music className="w-3 h-3 mr-1"/> {track_count}</span>
              <span className="flex items-center" title="Albums"><Disc className="w-3 h-3 mr-1"/> {album_count}</span>
              <span className="flex items-center" title="Playlists"><ListMusic className="w-3 h-3 mr-1"/> {playlist_count}</span>
              <span className="flex items-center" title="Videos"><Film className="w-3 h-3 mr-1"/> {video_count}</span>
            </div>
            <div className="flex space-x-1 w-full mt-3">
              <Button variant="ghost" size="sm" className="flex-1 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10">
                View Profile <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
               <Button 
                variant="ghost" 
                size="icon" 
                className={`favorite-creator-button w-9 h-9 ${isFavorited ? 'text-red-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'} hover:bg-red-500/10`}
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
                className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 share-button w-9 h-9"
                title="Share Creator"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e)=>{e.stopPropagation(); onFlag(item);}}
                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 flag-button-creator w-9 h-9"
                title="Flag Creator"
              >
                <Flag className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    };

    export default CreatorCard;
