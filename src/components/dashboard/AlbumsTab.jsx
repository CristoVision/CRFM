import React, { useState, useEffect } from 'react';
    import { Button } from '@/components/ui/button';
    import { Disc as DiscIcon, Calendar, Eye, Flag, Star, Share2 } from 'lucide-react';
    import { supabase } from '@/lib/supabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { Card, CardContent } from '@/components/ui/card';
    import { motion } from 'framer-motion';
    import { useNavigate } from 'react-router-dom';
    import FlagFormModal from '@/components/common/FlagFormModal';
    import ShareModal from '@/components/ShareModal';
    import { useAuth } from '@/contexts/AuthContext';
    import LeaderboardCarousel from './LeaderboardCarousel';
    import { pickImageFallback } from '@/lib/mediaFallbacks';

    const DEFAULT_ALBUM_COVER = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fG11c2ljJTIwYWxidW18ZW58MHx8MHx8fDA%3D&w=1000&q=80';

const ItemCard = ({ item, onFlag, onShare }) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth(); 
  const { id, title, creator_display_name, cover_art_url, genre, release_date, is_public } = item;
      
      const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      };

      const handleCardClick = (e) => {
        const target = e.target.closest('button');
         if (target && (target.classList.contains('flag-button') || target.classList.contains('favorite-album-button') || target.classList.contains('share-button'))) {
          e.stopPropagation();
          if (target.classList.contains('flag-button')) {
            onFlag(item);
          } else if (target.classList.contains('favorite-album-button')) {
             toast({ title: "Coming Soon!", description: "Favoriting albums will be available soon.", className: "bg-blue-600 border-blue-700 text-white" });
          } else if (target.classList.contains('share-button')) {
            onShare(item);
          }
        } else {
          navigate(`/album/${id}`);
        }
      };

      return (
        <Card onClick={handleCardClick} className="w-full group glass-effect-hoverable cursor-pointer">
          <CardContent className="p-0">
            <div className="relative aspect-square w-full">
              <img 
                src={pickImageFallback([cover_art_url], DEFAULT_ALBUM_COVER)}
                alt={title}
                className="absolute inset-0 w-full h-full object-cover rounded-t-xl border-b border-white/10"
               />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-2 space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-full golden-gradient text-black hover:opacity-80"
                  onClick={(e) => { e.stopPropagation(); navigate(`/album/${id}`);}}
                  title="View Album"
                >
                  <Eye className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-full bg-yellow-500/80 text-black hover:bg-yellow-600/90 favorite-album-button"
                  title="Favorite Album (Soon)"
                >
                  <Star className="w-5 h-5" />
                </Button>
                 <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-full bg-blue-500/80 text-white hover:bg-blue-600/90 share-button"
                  title="Share Album"
                >
                  <Share2 className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-full bg-red-500/80 text-white hover:bg-red-600/90 flag-button"
                  title="Flag Album"
                >
                  <Flag className="w-5 h-5" />
                </Button>
              </div>
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
              <p className="text-sm text-gray-400 truncate">{creator_display_name}</p>
              <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                <span className="truncate max-w-[100px]">{genre}</span>
                <span className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" /> {formatDate(release_date)}
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
        const { id, title, creator_display_name, cover_art_url, genre, release_date, is_public } = item;
        
        const formatDate = (dateString) => {
            if (!dateString) return 'N/A';
            return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        };

        const handleRowClick = (e) => {
          const target = e.target.closest('button');
          if (target && (target.classList.contains('flag-button') || target.classList.contains('favorite-album-button') || target.classList.contains('share-button'))) {
            e.stopPropagation();
            if (target.classList.contains('flag-button')) {
              onFlag(item);
            } else if (target.classList.contains('favorite-album-button')) {
               toast({ title: "Coming Soon!", description: "Favoriting albums will be available soon.", className: "bg-blue-600 border-blue-700 text-white" });
            } else if (target.classList.contains('share-button')) {
              onShare(item);
            }
          } else {
            navigate(`/album/${id}`);
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
                src={pickImageFallback([cover_art_url], DEFAULT_ALBUM_COVER)}
                alt={title}
                className="w-12 h-12 rounded-md object-cover border border-white/10"
               />
              <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 rounded-full golden-gradient text-black hover:opacity-80"
                  onClick={(e) => { e.stopPropagation(); navigate(`/album/${id}`);}}
                  title="View Album"
                >
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 rounded-full bg-yellow-500/80 text-black hover:bg-yellow-600/90 favorite-album-button"
                  title="Favorite Album (Soon)"
                >
                  <Star className="w-3.5 h-3.5" />
                </Button>
                 <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 rounded-full bg-blue-500/80 text-white hover:bg-blue-600/90 share-button"
                  title="Share Album"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 rounded-full bg-red-500/80 text-white hover:bg-red-600/90 flag-button"
                  title="Flag Album"
                >
                  <Flag className="w-3.5 h-3.5" />
                </Button>
              </div>
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
              <p className="text-sm text-gray-400 truncate hidden md:block">{creator_display_name}</p>
              <p className="text-sm text-gray-500 truncate hidden lg:block">{genre}</p>
              <p className="text-sm text-gray-500 truncate text-right">
                {formatDate(release_date)}
              </p>
            </div>
          </motion.div>
        );
    };

function AlbumsTab({ searchQuery = '', viewMode = 'grid', initialAlbums, isCreatorPageContext = false, timeRange = 'all' }) {
      const [albums, setAlbums] = useState(initialAlbums || []);
      const [loading, setLoading] = useState(!initialAlbums);
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
          type: 'album',
          uploaderId: content.uploader_id,
          title: content.title,
        });
        setIsFlagModalOpen(true);
      };

      const handleOpenShareModal = (item) => {
        setSelectedItemForShare(item);
        setIsShareModalOpen(true);
      };
      
      useEffect(() => {
        if (!initialAlbums) {
          const fetchAlbums = async () => {
            setLoading(true);
            const { data, error } = await supabase
              .from('albums')
              .select('id, title, creator_display_name, uploader_id, cover_art_url, genre, release_date, created_at, is_public')
              .eq('is_public', true)
              .order('created_at', { ascending: false });
            
            if (error) {
              toast({
                title: 'Error fetching albums',
                description: error.message,
                variant: 'destructive',
              });
              setAlbums([]);
            } else {
              setAlbums(data || []);
            }
            setLoading(false);
          };
          fetchAlbums();
        } else {
          setLoading(false);
          setAlbums(initialAlbums);
        }
      }, [initialAlbums]);

      const safeSearchQuery = searchQuery || '';
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

      const filteredAlbums = albums
      .filter(album =>
        (album.title?.toLowerCase() || '').includes(safeSearchQuery.toLowerCase()) ||
        (album.creator_display_name?.toLowerCase() || '').includes(safeSearchQuery.toLowerCase()) ||
        (album.genre?.toLowerCase() || '').includes(safeSearchQuery.toLowerCase())
      )
      .filter(album => filterByRange(album.created_at || album.release_date));

      if (loading) {
        return (
          <div className="flex justify-center items-center min-h-[40vh]">
            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        );
      }

      return (
        <motion.div layout className="space-y-6">
          {!isCreatorPageContext && <LeaderboardCarousel itemType="album" timeframe={timeRange} />}
          {filteredAlbums.length === 0 && !loading && !isCreatorPageContext && (
            <div className="text-center py-12">
              <DiscIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No albums found</p>
              <p className="text-gray-500">Try adjusting your search or check back later!</p>
            </div>
          )}
          {filteredAlbums.length === 0 && isCreatorPageContext && (
            <div className="text-center py-8 text-gray-400">This creator has no public albums matching your search.</div>
          )}

          {viewMode === 'grid' ? (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredAlbums.map((album) => (
                <ItemCard 
                  key={album.id} 
                  item={album}
                  onFlag={handleOpenFlagModal}
                  onShare={handleOpenShareModal}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div layout className="space-y-2 glass-effect p-4 rounded-xl">
              <div className="hidden md:grid grid-cols-4 items-center gap-4 px-3 py-2 border-b border-white/10 text-xs text-gray-500 font-medium">
                  <span className="col-span-2 md:col-span-1">TITLE</span>
                  <span className="hidden md:block">ARTIST</span>
                  <span className="hidden lg:block">GENRE</span>
                  <span className="text-right">RELEASE DATE</span>
               </div>
              {filteredAlbums.map((album) => (
                <ItemRow 
                  key={album.id} 
                  item={album}
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
              entityType="album"
              entityId={selectedItemForShare.id}
            />
          )}
        </motion.div>
      );
    }

    export default AlbumsTab;
