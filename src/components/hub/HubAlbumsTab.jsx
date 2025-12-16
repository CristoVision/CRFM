import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { PlusCircle, Disc, List, LayoutGrid, Search } from 'lucide-react';
    import HubItemCard from './HubItemCard';
    import HubItemRow from './HubItemRow';
    import EditAlbumModal from './EditAlbumModal'; 
    import CreateAlbumModal from './CreateAlbumModal';
    import ContributionModal from './ContributionModal';
    import ConfirmationDialog from '@/components/common/ConfirmationDialog';
    import { Input } from '@/components/ui/input';
    import { motion, AnimatePresence } from 'framer-motion';

    const HubAlbumsTab = ({ uploadGate }) => {
      const { user } = useAuth();
      const [albums, setAlbums] = useState([]);
      const [loading, setLoading] = useState(true);
      const [viewMode, setViewMode] = useState('grid');
      const [searchQuery, setSearchQuery] = useState('');

      const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
      const [isEditModalOpen, setIsEditModalOpen] = useState(false);
      const [selectedAlbum, setSelectedAlbum] = useState(null);
      
      const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
      const [itemToDelete, setItemToDelete] = useState(null);
      const [isDeleting, setIsDeleting] = useState(false);
      
      const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
      const [selectedItemForContribution, setSelectedItemForContribution] = useState(null);

      const fetchAlbums = useCallback(async () => {
        if (!user) {
           setLoading(false);
           setAlbums([]);
           return;
        }
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('albums')
            .select('id, title, cover_art_url, video_cover_art_url, uploader_id, genre, release_date, languages, is_public, created_at, updated_at, total_royalty_percentage_allocated')
            .eq('uploader_id', user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          setAlbums(data || []);
        } catch (error) {
          toast({ title: 'Error fetching your albums', description: error.message, variant: 'error' });
          setAlbums([]);
        } finally {
          setLoading(false);
        }
      }, [user]);

      useEffect(() => {
        fetchAlbums();
      }, [fetchAlbums]);
      
      const handleUploadAlbum = () => {
        if (uploadGate?.guard) {
          uploadGate.guard('album', () => setIsCreateModalOpen(true));
          return;
        }
        setIsCreateModalOpen(true);
      };
      
      const handleEdit = (album) => {
        setSelectedAlbum(album);
        setIsEditModalOpen(true);
      };

      const handleDelete = (album) => {
        setItemToDelete(album);
        setIsConfirmModalOpen(true);
      };

      const handleConfirmDelete = async () => {
        if (!itemToDelete || !user) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('albums')
                .delete()
                .eq('id', itemToDelete.id)
                .eq('uploader_id', user.id);

            if (error) throw error;

            toast({
                title: 'Album Deleted',
                description: `"${itemToDelete.title}" has been successfully deleted.`,
                variant: 'success',
            });
            setAlbums(prevAlbums => prevAlbums.filter(a => a.id !== itemToDelete.id));
            setIsConfirmModalOpen(false);
        } catch (error) {
            toast({
                title: 'Error Deleting Album',
                description: error.message,
                variant: 'error',
            });
        } finally {
            setIsDeleting(false);
            setItemToDelete(null);
        }
      };

      const handleManageContributors = (album) => {
        setSelectedItemForContribution(album);
        setIsContributionModalOpen(true);
      };

      const handleAlbumUpdated = (updatedAlbum) => {
        setAlbums(prevAlbums => prevAlbums.map(a => a.id === updatedAlbum.id ? updatedAlbum : a));
        fetchAlbums(); 
      };
      
      const handleAlbumCreated = () => {
        fetchAlbums();
      };

      const handleContributionsUpdated = () => {
        fetchAlbums(); 
      };

      const filteredAlbums = albums.filter(album =>
        (album.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (album.genre?.toLowerCase() || '').includes(searchQuery.toLowerCase())
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
                placeholder="Search your albums..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 focus:border-yellow-400 text-white placeholder-gray-500"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
             <div className="flex items-center gap-2">
              <Button variant={viewMode === 'grid' ? 'default' : 'outline'} onClick={() => setViewMode('grid')} className={`${viewMode === 'grid' ? 'golden-gradient text-black' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-yellow-300'}`} size="sm"><LayoutGrid className="w-4 h-4"/></Button>
              <Button variant={viewMode === 'list' ? 'default' : 'outline'} onClick={() => setViewMode('list')} className={`${viewMode === 'list' ? 'golden-gradient text-black' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-yellow-300'}`} size="sm"><List className="w-4 h-4"/></Button>
              <Button onClick={handleUploadAlbum} className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button" size="sm">
                <PlusCircle className="w-4 h-4 mr-2" />Create Album
              </Button>
            </div>
          </div>

          {filteredAlbums.length === 0 ? (
            <div className="text-center py-12 glass-effect rounded-xl">
              <Disc className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-300 text-lg mb-2">No albums found.</p>
              <p className="text-gray-400 text-sm mb-6">
                 {searchQuery ? "Try adjusting your search query." : "You haven't created any albums yet."}
              </p>
              {!searchQuery &&
                <Button onClick={handleUploadAlbum} className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity">
                  <PlusCircle className="w-5 h-5 mr-2" />Create Your First Album
                </Button>
              }
            </div>
          ) : (
            <motion.div layout className={`gap-6 ${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'space-y-0'}`}>
              <AnimatePresence>
                {filteredAlbums.map(album => (
                  viewMode === 'grid' ? (
                    <HubItemCard 
                      key={album.id} 
                      item={album} 
                      itemType="album" 
                      onEdit={handleEdit} 
                      onDelete={handleDelete} 
                      onManageContributors={handleManageContributors} 
                    />
                  ) : (
                    <HubItemRow 
                      key={album.id} 
                      item={album} 
                      itemType="album" 
                      onEdit={handleEdit} 
                      onDelete={handleDelete} 
                      onManageContributors={handleManageContributors} 
                    />
                  )
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          <ConfirmationDialog
            isOpen={isConfirmModalOpen}
            onOpenChange={setIsConfirmModalOpen}
            onConfirm={handleConfirmDelete}
            title="Confirm Deletion"
            description={`Are you sure you want to delete the album "${itemToDelete?.title}"? This action cannot be undone.`}
            confirmText="Delete"
            isConfirming={isDeleting}
          />

          <CreateAlbumModal 
            isOpen={isCreateModalOpen}
            onOpenChange={setIsCreateModalOpen}
            onAlbumCreated={handleAlbumCreated}
          />

          {selectedAlbum && (
            <EditAlbumModal
              isOpen={isEditModalOpen}
              onOpenChange={setIsEditModalOpen}
              album={selectedAlbum}
              onAlbumUpdated={handleAlbumUpdated}
            />
          )}
          {selectedItemForContribution && (
            <ContributionModal
              isOpen={isContributionModalOpen}
              onOpenChange={setIsContributionModalOpen}
              contentItem={selectedItemForContribution}
              contentType="album"
              onContributionsUpdated={handleContributionsUpdated}
            />
          )}
        </div>
      );
    };
    export default HubAlbumsTab;
