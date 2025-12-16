import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { PlusCircle, Music, List, LayoutGrid, Search } from 'lucide-react';
    import HubItemCard from './HubItemCard';
    import HubItemRow from './HubItemRow';
    import EditTrackModal from './EditTrackModal';
    import CreateTrackModal from './CreateTrackModal';
    import ConfirmationDialog from '@/components/common/ConfirmationDialog';
    import ContributionModal from './ContributionModal'; 
    import { Input } from '@/components/ui/input';
    import { motion, AnimatePresence } from 'framer-motion';
    import { useLocation, useNavigate } from 'react-router-dom';

    const HubTracksTab = ({ uploadGate }) => {
      const { user } = useAuth();
      const location = useLocation();
      const navigate = useNavigate();
      const [tracks, setTracks] = useState([]);
      const [loading, setLoading] = useState(true);
      const [viewMode, setViewMode] = useState('grid');
      const [searchQuery, setSearchQuery] = useState('');
      
      const [isEditModalOpen, setIsEditModalOpen] = useState(false);
      const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
      const [selectedTrack, setSelectedTrack] = useState(null);

      const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
      const [itemToDelete, setItemToDelete] = useState(null);
      const [isDeleting, setIsDeleting] = useState(false);
      
      const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
      const [selectedItemForContribution, setSelectedItemForContribution] = useState(null);


      const fetchTracks = useCallback(async () => {
        if (!user) {
          setLoading(false);
          setTracks([]);
          return;
        }
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('tracks')
            .select('id, title, cover_art_url, video_cover_art_url, album_id, uploader_id, genre, release_date, languages, is_public, created_at, audio_file_url, lyrics_text, is_christian_nature, is_instrumental, ai_in_artwork, ai_in_production, ai_in_lyrics, stream_cost, total_royalty_percentage_allocated')
            .eq('uploader_id', user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          setTracks(data || []);
        } catch (error) {
          toast({ title: 'Error fetching your tracks', description: error.message, variant: 'error' });
          setTracks([]);
        } finally {
          setLoading(false);
        }
      }, [user]);

      useEffect(() => {
        fetchTracks();
      }, [fetchTracks]);

      useEffect(() => {
        if (location.state?.triggerCreateTrackModal) {
          setIsCreateModalOpen(true);
          navigate(location.pathname, { replace: true, state: {} }); 
        }
      }, [location.state, navigate, location.pathname]);
      
      const handleUploadTrack = () => {
        if (uploadGate?.guard) {
          uploadGate.guard('track', () => setIsCreateModalOpen(true));
          return;
        }
        setIsCreateModalOpen(true);
      };
      
      const handleEdit = (track) => {
        setSelectedTrack(track);
        setIsEditModalOpen(true);
      };

      const handleDelete = (track) => {
        setItemToDelete(track);
        setIsConfirmModalOpen(true);
      };

      const handleConfirmDelete = async () => {
        if (!itemToDelete || !user) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('tracks')
                .delete()
                .eq('id', itemToDelete.id)
                .eq('uploader_id', user.id);

            if (error) throw error;

            toast({
                title: 'Track Deleted',
                description: `"${itemToDelete.title}" has been successfully deleted.`,
                variant: 'success',
            });
            setTracks(prevTracks => prevTracks.filter(t => t.id !== itemToDelete.id));
            setIsConfirmModalOpen(false);
        } catch (error) {
            toast({
                title: 'Error Deleting Track',
                description: error.message,
                variant: 'error',
            });
        } finally {
            setIsDeleting(false);
            setItemToDelete(null);
        }
      };

      const handleManageContributors = (track) => {
        setSelectedItemForContribution(track);
        setIsContributionModalOpen(true);
      };
      
      const handleTrackUpdated = (updatedTrack) => {
        setTracks(prevTracks => prevTracks.map(t => t.id === updatedTrack.id ? updatedTrack : t));
        fetchTracks(); 
      };

      const handleTrackCreated = () => {
        fetchTracks();
      };

      const handleContributionsUpdated = () => {
        fetchTracks(); // Re-fetch tracks to get updated total_royalty_percentage_allocated
      };


      const filteredTracks = tracks.filter(track =>
        (track.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (track.genre?.toLowerCase() || '').includes(searchQuery.toLowerCase())
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
                placeholder="Search your tracks..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 focus:border-yellow-400 text-white placeholder-gray-500"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant={viewMode === 'grid' ? 'default' : 'outline'} onClick={() => setViewMode('grid')} className={`${viewMode === 'grid' ? 'golden-gradient text-black' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-yellow-300'}`} size="sm"><LayoutGrid className="w-4 h-4"/></Button>
              <Button variant={viewMode === 'list' ? 'default' : 'outline'} onClick={() => setViewMode('list')} className={`${viewMode === 'list' ? 'golden-gradient text-black' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-yellow-300'}`} size="sm"><List className="w-4 h-4"/></Button>
              <Button onClick={handleUploadTrack} className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button" size="sm">
                <PlusCircle className="w-4 h-4 mr-2" />Upload Track
              </Button>
            </div>
          </div>

          {filteredTracks.length === 0 ? (
            <div className="text-center py-12 glass-effect rounded-xl">
              <Music className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-300 text-lg mb-2">No tracks found.</p>
              <p className="text-gray-400 text-sm mb-6">
                {searchQuery ? "Try adjusting your search query." : "You haven't uploaded any tracks yet."}
              </p>
              {!searchQuery && 
                <Button onClick={handleUploadTrack} className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity">
                  <PlusCircle className="w-5 h-5 mr-2" />Upload Your First Track
                </Button>
              }
            </div>
          ) : (
            <motion.div layout className={`gap-6 ${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'space-y-0'}`}>
              <AnimatePresence>
                {filteredTracks.map(track => (
                  viewMode === 'grid' ? (
                    <HubItemCard 
                      key={track.id} 
                      item={track} 
                      itemType="track" 
                      onEdit={handleEdit} 
                      onDelete={handleDelete} 
                      onManageContributors={handleManageContributors} 
                    />
                  ) : (
                    <HubItemRow 
                      key={track.id} 
                      item={track} 
                      itemType="track" 
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
            description={`Are you sure you want to delete the track "${itemToDelete?.title}"? This action cannot be undone.`}
            confirmText="Delete"
            isConfirming={isDeleting}
          />
          
          <CreateTrackModal 
            isOpen={isCreateModalOpen}
            onOpenChange={setIsCreateModalOpen}
            onTrackCreated={handleTrackCreated}
          />

          {selectedTrack && (
            <EditTrackModal
              isOpen={isEditModalOpen}
              onOpenChange={setIsEditModalOpen}
              track={selectedTrack}
              onTrackUpdated={handleTrackUpdated}
            />
          )}
          {selectedItemForContribution && (
            <ContributionModal
              isOpen={isContributionModalOpen}
              onOpenChange={setIsContributionModalOpen}
              contentItem={selectedItemForContribution}
              contentType="track"
              onContributionsUpdated={handleContributionsUpdated}
            />
          )}
        </div>
      );
    };

    export default HubTracksTab;
