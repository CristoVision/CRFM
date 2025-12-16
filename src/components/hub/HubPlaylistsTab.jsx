import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { PlusCircle, ListMusic, List, LayoutGrid, Search } from 'lucide-react';
    import HubItemCard from './HubItemCard';
    import HubItemRow from './HubItemRow';
    import EditPlaylistModal from './EditPlaylistModal';
    import CreatePlaylistModal from './CreatePlaylistModal';
    import { Input } from '@/components/ui/input';
    import { motion, AnimatePresence } from 'framer-motion';
    import { useNavigate } from 'react-router-dom';

    const HubPlaylistsTab = ({ uploadGate }) => {
      const { user } = useAuth();
      const navigate = useNavigate();
      const [playlists, setPlaylists] = useState([]);
      const [loading, setLoading] = useState(true);
      const [viewMode, setViewMode] = useState('grid');
      const [searchQuery, setSearchQuery] = useState('');

      const [isEditModalOpen, setIsEditModalOpen] = useState(false);
      const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
      const [selectedPlaylist, setSelectedPlaylist] = useState(null);

      const fetchPlaylists = useCallback(async () => {
        if (!user) {
          setLoading(false);
          setPlaylists([]);
          return;
        }
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('playlists')
            .select('id, title, description, is_public, cover_art_url, video_cover_art_url, created_at, creator_id, languages') 
            .eq('creator_id', user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          setPlaylists(data || []); 
        } catch (error) {
          toast({ title: 'Error fetching your playlists', description: error.message, variant: 'error' });
          setPlaylists([]);
        } finally {
          setLoading(false);
        }
      }, [user]);
      
      useEffect(() => {
        fetchPlaylists();
      }, [fetchPlaylists]);

      const handleCreatePlaylist = () => {
        const open = () => {
          setSelectedPlaylist(null); // Ensure no playlist is selected for create
          setIsCreateModalOpen(true);
        };

        if (uploadGate?.guard) {
          uploadGate.guard('playlist', open);
          return;
        }

        open();
      };
      
      const handleEdit = (playlist) => {
        setSelectedPlaylist(playlist);
        setIsEditModalOpen(true);
      };

      const handleDeleteRequest = (playlist) => {
        // This will be called by HubItemCard/Row. We then open EditPlaylistModal.
        // The actual deletion logic is inside EditPlaylistModal.
        setSelectedPlaylist(playlist);
        setIsEditModalOpen(true); 
        // Consider adding a state to EditPlaylistModal to open directly to confirm delete,
        // or just let the user click the delete button within the modal.
        // For now, this opens the edit modal, and user can click delete there.
         toast({
          title: "Delete Playlist",
          description: `To delete "${playlist.title}", please use the delete button within the edit playlist screen.`,
          variant: "default"
        });
      };
      
      const handlePlaylistCreated = (newPlaylist) => {
        // Optimistically add or re-fetch
        setPlaylists(prev => [newPlaylist, ...prev.filter(p => p.id !== newPlaylist.id)].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        // fetchPlaylists(); // Or re-fetch for full consistency
      };
      
      const handlePlaylistUpdated = (updatedPlaylist) => {
        setPlaylists(prevPlaylists => prevPlaylists.map(p => p.id === updatedPlaylist.id ? { ...p, ...updatedPlaylist } : p));
        // fetchPlaylists(); // Or re-fetch
      };

      const handlePlaylistDeleted = (deletedPlaylistId) => {
        setPlaylists(prevPlaylists => prevPlaylists.filter(p => p.id !== deletedPlaylistId));
      };
      
      const filteredPlaylists = playlists.filter(playlist =>
        (playlist.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (playlist.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      );

      if (loading) {
        return <div className="flex justify-center items-center min-h-[40vh]"><div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div></div>;
      }

      return (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:max-w-xs">
              <Input 
                type="search" 
                placeholder="Search your playlists..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 focus:border-yellow-400 text-white placeholder-gray-500"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant={viewMode === 'grid' ? 'default' : 'outline'} onClick={() => setViewMode('grid')} className={`${viewMode === 'grid' ? 'golden-gradient text-black' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-yellow-300'}`} size="sm"><LayoutGrid className="w-4 h-4"/></Button>
              <Button variant={viewMode === 'list' ? 'default' : 'outline'} onClick={() => setViewMode('list')} className={`${viewMode === 'list' ? 'golden-gradient text-black' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-yellow-300'}`} size="sm"><List className="w-4 h-4"/></Button>
              <Button onClick={handleCreatePlaylist} className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button" size="sm">
                <PlusCircle className="w-4 h-4 mr-2" />Create Playlist
              </Button>
            </div>
          </div>

          {filteredPlaylists.length === 0 ? (
            <div className="text-center py-12 glass-effect rounded-xl">
              <ListMusic className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-300 text-lg mb-2">No playlists found.</p>
              <p className="text-gray-400 text-sm mb-6">
                {searchQuery ? "Try adjusting your search query." : "You haven't created any playlists yet."}
              </p>
              {!searchQuery &&
                <Button onClick={handleCreatePlaylist} className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity">
                  <PlusCircle className="w-5 h-5 mr-2" />Create Your First Playlist
                </Button>
              }
            </div>
          ) : (
            <motion.div layout className={`gap-6 ${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'space-y-0'}`}>
              <AnimatePresence>
                {filteredPlaylists.map(playlist => (
                  viewMode === 'grid' ? (
                    <HubItemCard 
                      key={playlist.id} 
                      item={playlist} 
                      itemType="playlist" 
                      onEdit={() => handleEdit(playlist)} 
                      onDelete={() => handleDeleteRequest(playlist)}
                    />
                  ) : (
                    <HubItemRow 
                      key={playlist.id} 
                      item={playlist} 
                      itemType="playlist" 
                      onEdit={() => handleEdit(playlist)}
                      onDelete={() => handleDeleteRequest(playlist)}
                    />
                  )
                ))}
              </AnimatePresence>
            </motion.div>
          )}
          
          {isEditModalOpen && selectedPlaylist && (
            <EditPlaylistModal
              isOpen={isEditModalOpen}
              onOpenChange={setIsEditModalOpen}
              playlist={selectedPlaylist}
              onPlaylistUpdated={handlePlaylistUpdated}
              onPlaylistDeleted={handlePlaylistDeleted}
            />
          )}
          {isCreateModalOpen && (
            <CreatePlaylistModal
                isOpen={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                onPlaylistCreated={handlePlaylistCreated}
            />
          )}
        </div>
      );
    };

    export default HubPlaylistsTab;
