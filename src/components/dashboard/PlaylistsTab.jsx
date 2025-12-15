import React, { useState, useEffect } from 'react';
    import { Button } from '@/components/ui/button';
    import { ListMusic as PlaylistIcon, Calendar, Heart, Lock, Globe, Eye, Flag, Star, Share2 } from 'lucide-react';
    import { supabase } from '@/lib/supabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { Card, CardContent } from '@/components/ui/card';
    import { motion } from 'framer-motion';
    import { useAuth } from '@/contexts/AuthContext';
    import { useNavigate } from 'react-router-dom';
    import FlagFormModal from '@/components/common/FlagFormModal';
    import ShareModal from '@/components/ShareModal';
    import LeaderboardCarousel from './LeaderboardCarousel';

    const DEFAULT_PLAYLIST_COVER = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bXVzaWMlMjBwbGF5bGlzdHxlbnwwfHwwfHx8MA%3D%3D&w=1000&q=80';

const ItemCard = ({ item, onFlag, onShare }) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { id, title, description, cover_art_url, created_at, is_public, is_favorites_playlist } = item;
      
      const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      };

      const handleCardClick = (e) => {
        const target = e.target.closest('button');
        if (target && (target.classList.contains('flag-button') || target.classList.contains('favorite-playlist-button') || target.classList.contains('share-button'))) {
          e.stopPropagation();
          if (target.classList.contains('flag-button')) {
            onFlag(item);
          } else if (target.classList.contains('favorite-playlist-button')) {
            toast({ title: "Coming Soon!", description: "Favoriting playlists will be available soon.", className: "bg-blue-600 border-blue-700 text-white" });
          } else if (target.classList.contains('share-button')) {
            onShare(item);
          }
        } else {
          if (is_favorites_playlist && user && item.creator_id === user.id) {
            navigate('/profile?tab=favorites');
          } else {
            navigate(`/playlist/${id}`);
          }
        }
      };

      return (
        <Card onClick={handleCardClick} className="w-full group glass-effect-hoverable cursor-pointer">
          <CardContent className="p-0">
            <div className="relative aspect-square w-full">
              <img 
                src={cover_art_url || DEFAULT_PLAYLIST_COVER}
                alt={title}
                className="absolute inset-0 w-full h-full object-cover rounded-t-xl border-b border-white/10"
              />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-2 space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-full golden-gradient text-black hover:opacity-80"
                  onClick={(e) => { e.stopPropagation(); navigate(`/playlist/${id}`);}}
                  title="View Playlist"
                >
                  <Eye className="w-5 h-5" />
                </Button>
                {!is_favorites_playlist && (
                   <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-full bg-yellow-500/80 text-black hover:bg-yellow-600/90 favorite-playlist-button"
                    title="Favorite Playlist (Soon)"
                  >
                    <Star className="w-5 h-5" />
                  </Button>
                )}
                 <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-full bg-blue-500/80 text-white hover:bg-blue-600/90 share-button"
                  title="Share Playlist"
                >
                  <Share2 className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-full bg-red-500/80 text-white hover:bg-red-600/90 flag-button"
                  title="Flag Playlist"
                >
                  <Flag className="w-5 h-5" />
                </Button>
              </div>
              {is_favorites_playlist && (
                <div className="absolute top-3 right-3 w-8 h-8 bg-yellow-500/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
                  <Star className="w-4 h-4 text-black fill-current" />
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white truncate group-hover:text-yellow-400 transition-colors">{title}</h3>
                {profile?.is_admin && is_public === false && (
                  <span className="text-[10px] uppercase tracking-wide bg-red-500/20 text-red-200 border border-red-500/30 px-2 py-0.5 rounded">
                    Hidden
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 line-clamp-2 h-10">{description || 'No description.'}</p>
              <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span className="flex items-center">
                  {is_public ? <Globe className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                  {is_public ? 'Public' : 'Private'}
                </span>
                <span className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" /> {formatDate(created_at)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    };

    const ItemRow = ({ item, onFlag, onShare }) => {
        const navigate = useNavigate();
        const { user, profile } = useAuth();
        const { id, title, description, cover_art_url, created_at, is_public, is_favorites_playlist } = item;
        
        const formatDate = (dateString) => {
            if (!dateString) return 'N/A';
            return new Date(dateString).toLocaleDateString('en-US', {day:'numeric', month: 'short', year: 'numeric' });
        };

        const handleRowClick = (e) => {
          const target = e.target.closest('button');
          if (target && (target.classList.contains('flag-button') || target.classList.contains('favorite-playlist-button') || target.classList.contains('share-button'))) {
            e.stopPropagation();
             if (target.classList.contains('flag-button')) {
                onFlag(item);
             } else if (target.classList.contains('favorite-playlist-button')) {
                toast({ title: "Coming Soon!", description: "Favoriting playlists will be available soon.", className: "bg-blue-600 border-blue-700 text-white" });
             } else if (target.classList.contains('share-button')) {
                onShare(item);
             }
          } else {
             if (is_favorites_playlist && user && item.creator_id === user.id) {
                navigate('/profile?tab=favorites');
             } else {
                navigate(`/playlist/${id}`);
             }
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
            <div className="relative flex-shrink-0">
              <img 
                src={cover_art_url || DEFAULT_PLAYLIST_COVER}
                alt={title}
                className="w-12 h-12 rounded-md object-cover border border-white/10"
              />
              <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 rounded-full golden-gradient text-black hover:opacity-80"
                  onClick={(e) => { e.stopPropagation(); navigate(`/playlist/${id}`);}}
                  title="View Playlist"
                >
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                {!is_favorites_playlist && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 rounded-full bg-yellow-500/80 text-black hover:bg-yellow-600/90 favorite-playlist-button"
                    title="Favorite Playlist (Soon)"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </Button>
                )}
                 <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 rounded-full bg-blue-500/80 text-white hover:bg-blue-600/90 share-button"
                  title="Share Playlist"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 rounded-full bg-red-500/80 text-white hover:bg-red-600/90 flag-button"
                  title="Flag Playlist"
                >
                  <Flag className="w-3.5 h-3.5" />
                </Button>
              </div>
               {is_favorites_playlist && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md">
                  <Star className="w-2.5 h-2.5 text-black fill-current" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 grid grid-cols-4 items-center gap-4">
              <div className="flex items-center gap-2 col-span-2 md:col-span-1 min-w-0">
                <h3 className="font-medium text-white truncate group-hover:text-yellow-400 transition-colors">{title}</h3>
                {profile?.is_admin && is_public === false && (
                  <span className="text-[9px] uppercase tracking-wide bg-red-500/20 text-red-200 border border-red-500/30 px-2 py-0.5 rounded flex-shrink-0">
                    Hidden
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 truncate hidden md:block col-span-2">{description || "No description"}</p>
              <p className="text-sm text-gray-500 truncate text-right">
                {formatDate(created_at)}
              </p>
            </div>
             <div className={`flex items-center text-xs ${is_public ? 'text-green-400' : 'text-gray-500'}`}>
                {is_public ? <Globe className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                {is_public ? 'Public' : 'Private'}
             </div>
          </motion.div>
        );
    };


    function PlaylistsTab({ searchQuery = '', viewMode = 'grid', initialPlaylists, isCreatorPageContext = false, timeRange = 'all' }) {
      const [playlists, setPlaylists] = useState(initialPlaylists || []);
      const [loading, setLoading] = useState(!initialPlaylists);
      const { user } = useAuth();
      const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
      const [selectedContentForFlag, setSelectedContentForFlag] = useState(null);
      const [isShareModalOpen, setIsShareModalOpen] = useState(false);
      const [selectedItemForShare, setSelectedItemForShare] = useState(null);

      const handleOpenFlagModal = (content) => {
        if (!user) {
          toast({ title: "Authentication Required", description: "Please log in to flag content.", variant: "destructive" });
          return;
        }
        setSelectedContentForFlag({
          id: content.id,
          type: 'playlist',
          uploaderId: content.creator_id, 
          title: content.title,
        });
        setIsFlagModalOpen(true);
      };
      
      const handleOpenShareModal = (item) => {
        setSelectedItemForShare(item);
        setIsShareModalOpen(true);
      };

      useEffect(() => {
        if (!initialPlaylists) {
          const fetchPlaylists = async () => {
            setLoading(true);
            let query = supabase
              .from('playlists')
              .select('id, title, creator_id, cover_art_url, description, is_public, created_at, is_favorites_playlist');

            if(!user) { 
               query = query.eq('is_public', true);
            } else { 
               query = query.or(`is_public.eq.true,and(is_public.eq.false,creator_id.eq.${user.id})`);
            }
            query = query.order('created_at', { ascending: false });
            
            const { data, error } = await query;

            if (error) {
              toast({
                title: 'Error fetching playlists',
                description: error.message,
                variant: 'destructive',
              });
              setPlaylists([]);
            } else {
              setPlaylists(data || []);
            }
            setLoading(false);
          };
          fetchPlaylists();
        } else {
          setLoading(false);
          setPlaylists(initialPlaylists);
        }
      }, [initialPlaylists, user]);

      const filterByRange = (itemDate) => {
        if (timeRange === 'all' || !itemDate) return true;
        const now = new Date();
        const date = new Date(itemDate);
        const diffDays = (now - date) / (1000 * 60 * 60 * 24);
        if (timeRange === 'daily') return diffDays <= 1;
        if (timeRange === 'weekly') return diffDays <= 7;
        if (timeRange === 'monthly') return diffDays <= 31;
        if (timeRange === 'yearly') return diffDays <= 365;
        return true;
      };

      const safeSearchQuery = searchQuery || '';
      const filteredPlaylists = playlists.filter(playlist =>
        (playlist.title?.toLowerCase() || '').includes(safeSearchQuery.toLowerCase()) ||
        (playlist.description?.toLowerCase() || '').includes(safeSearchQuery.toLowerCase())
      ).filter(playlist => filterByRange(playlist.created_at));

      if (loading) {
        return (
          <div className="flex justify-center items-center min-h-[40vh]">
            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        );
      }

      return (
        <motion.div layout className="space-y-6">
          {!isCreatorPageContext && <LeaderboardCarousel itemType="playlist" timeframe={timeRange} />}
          {filteredPlaylists.length === 0 && !loading && !isCreatorPageContext && (
            <div className="text-center py-12">
              <PlaylistIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No playlists found</p>
              <p className="text-gray-500">Try adjusting your search or create some playlists!</p>
            </div>
          )}
          {filteredPlaylists.length === 0 && isCreatorPageContext && (
            <div className="text-center py-8 text-gray-400">This creator has no public playlists matching your search.</div>
          )}

          {viewMode === 'grid' ? (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredPlaylists.map((playlist) => (
                <ItemCard 
                  key={playlist.id} 
                  item={playlist}
                  onFlag={handleOpenFlagModal}
                  onShare={handleOpenShareModal}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div layout className="space-y-2 glass-effect p-4 rounded-xl">
              <div className="hidden md:grid grid-cols-4 items-center gap-4 px-3 py-2 border-b border-white/10 text-xs text-gray-500 font-medium">
                  <span className="col-span-2 md:col-span-1">TITLE</span>
                  <span className="hidden md:block col-span-2">DESCRIPTION</span>
                  <span className="text-right">CREATED</span>
              </div>
              {filteredPlaylists.map((playlist) => (
                <ItemRow 
                  key={playlist.id} 
                  item={playlist}
                  onFlag={handleOpenFlagModal}
                  onShare={handleOpenShareModal}
                />
              ))}
            </motion.div>
          )}
          {selectedContentForFlag && (
            <FlagFormModal
              isOpen={isFlagModalOpen}
              onOpenChange={setIsFlagModalOpen}
              contentId={selectedContentForFlag.id}
              contentType={selectedContentForFlag.type}
              originalUploaderId={selectedContentForFlag.uploaderId}
              contentTitle={selectedContentForFlag.title}
            />
          )}
          {selectedItemForShare && (
            <ShareModal
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
              entityType="playlist"
              entityId={selectedItemForShare.id}
            />
          )}
        </motion.div>
      );
    }

    export default PlaylistsTab;
