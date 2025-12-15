import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { PlusCircle, Film, Search, Loader2, List, LayoutGrid } from 'lucide-react';
    import { motion, AnimatePresence } from 'framer-motion';
    import HubMusicVideoCard from './HubMusicVideoCard';
    import HubItemRow from './HubItemRow';
    import VideoPlayerModal from '@/components/videos/VideoPlayerModal';
    import ShareModal from '@/components/ShareModal';
    import MusicVideoUploadModal from './MusicVideoUploadModal';
    import EditMusicVideoModal from './EditMusicVideoModal';
    import ConfirmationDialog from '@/components/common/ConfirmationDialog';
    import ContributionModal from '@/components/hub/ContributionModal';

    const ITEMS_PER_PAGE = 8;

    const HubMusicVideosTab = () => {
      const { user } = useAuth();
      const [videos, setVideos] = useState([]);
      const [loading, setLoading] = useState(true);
      const [page, setPage] = useState(0);
      const [hasMore, setHasMore] = useState(true);
      const [searchQuery, setSearchQuery] = useState('');
      const [viewMode, setViewMode] = useState('grid');

      const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
      const [isEditModalOpen, setIsEditModalOpen] = useState(false);
      const [selectedVideoForEdit, setSelectedVideoForEdit] = useState(null);
      
      const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
      const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState(null);
      
      const [isShareModalOpen, setIsShareModalOpen] = useState(false);
      const [selectedVideoForShare, setSelectedVideoForShare] = useState(null);

      const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
      const [videoToDelete, setVideoToDelete] = useState(null);
      const [isDeleting, setIsDeleting] = useState(false);

      const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
      const [selectedVideoForContrib, setSelectedVideoForContrib] = useState(null);

      const [isProcessingPlay, setIsProcessingPlay] = useState(false);
      const [processingVideoId, setProcessingVideoId] = useState(null);

      const fetchVideos = useCallback(async (currentPage, currentSearchQuery) => {
        if (!user) {
          setLoading(false);
          setVideos([]);
          return;
        }
        setLoading(true);
        try {
          let query = supabase
            .from('videos')
            .select('*, profiles (username)', { count: 'exact' })
            .eq('uploader_id', user.id)
            .eq('video_type', 'music_video')
            .order('created_at', { ascending: false })
            .range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1);

          if (currentSearchQuery) {
            query = query.or(`title.ilike.%${currentSearchQuery}%,description.ilike.%${currentSearchQuery}%`);
          }
          
          const { data, error, count } = await query;
          if (error) throw error;

          const formattedData = data.map(v => ({
            ...v,
            creator_display_name: v.profiles?.username || user.email,
          }));

          setVideos(prev => currentPage === 0 ? formattedData : [...prev, ...formattedData]);
          setHasMore(formattedData.length === ITEMS_PER_PAGE && (currentPage * ITEMS_PER_PAGE + formattedData.length) < count);

        } catch (error) {
          toast({ title: 'Error fetching your music videos', description: error.message, variant: 'destructive' });
          setVideos([]);
        } finally {
          setLoading(false);
        }
      }, [user]);

      useEffect(() => {
        setVideos([]); 
        setPage(0); 
        setHasMore(true);
        fetchVideos(0, searchQuery);
      }, [searchQuery, fetchVideos]);

      const loadMoreVideos = () => {
        if (!loading && hasMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchVideos(nextPage, searchQuery);
        }
      };

      const handleVideoUploaded = (newVideo) => {
        setVideos(prev => [newVideo, ...prev]); 
        fetchVideos(0, searchQuery); 
      };

      const handleVideoUpdated = (updatedVideo) => {
        setVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v));
      };

      const handlePlay = (video) => {
        if (isProcessingPlay) return;
        setIsProcessingPlay(true);
        setProcessingVideoId(video.id);
        
        setTimeout(() => {
          setSelectedVideoForPlayer(video);
          setIsPlayerModalOpen(true);
          setIsProcessingPlay(false);
          setProcessingVideoId(null);
        }, 300);
      };

      const handleShare = (video) => {
        setSelectedVideoForShare(video);
        setIsShareModalOpen(true);
      };

      const handleEdit = (video) => {
        setSelectedVideoForEdit(video);
        setIsEditModalOpen(true);
      };

      const handleDelete = (video) => {
        setVideoToDelete(video);
        setIsConfirmDeleteOpen(true);
      };

      const handleOpenContributions = (video) => {
        setSelectedVideoForContrib(video);
        setIsContributionModalOpen(true);
      };

      const confirmDeleteVideo = async () => {
        if (!videoToDelete || !user) return;
        setIsDeleting(true);
        try {
          const { error } = await supabase
            .from('videos')
            .delete()
            .eq('id', videoToDelete.id)
            .eq('uploader_id', user.id);

          if (error) throw error;
          toast({ title: "Video Deleted", description: `"${videoToDelete.title}" has been removed.`, variant: "success" });
          setVideos(prev => prev.filter(v => v.id !== videoToDelete.id));
          setIsConfirmDeleteOpen(false);
        } catch (error) {
          toast({ title: "Error Deleting Video", description: error.message, variant: "destructive" });
        } finally {
          setIsDeleting(false);
          setVideoToDelete(null);
        }
      };

      if (loading && page === 0 && videos.length === 0) {
        return <div className="flex justify-center items-center min-h-[40vh]"><Loader2 className="w-16 h-16 text-yellow-400 animate-spin" /></div>;
      }

      return (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:max-w-xs">
              <Input 
                type="search" 
                placeholder="Search your music videos..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 focus:border-yellow-400 text-white placeholder-gray-500"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant={viewMode === 'grid' ? 'default' : 'outline'} onClick={() => setViewMode('grid')} className={`${viewMode === 'grid' ? 'golden-gradient text-black' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-yellow-300'}`} size="sm"><LayoutGrid className="w-4 h-4"/></Button>
              <Button variant={viewMode === 'list' ? 'default' : 'outline'} onClick={() => setViewMode('list')} className={`${viewMode === 'list' ? 'golden-gradient text-black' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-yellow-300'}`} size="sm"><List className="w-4 h-4"/></Button>
              <Button onClick={() => setIsUploadModalOpen(true)} className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button" size="sm">
                <PlusCircle className="w-4 h-4 mr-2" />Upload Video
              </Button>
            </div>
          </div>

          {videos.length === 0 && !loading && (
            <div className="text-center py-12 glass-effect rounded-xl">
              <Film className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-300 text-lg mb-2">No music videos found.</p>
              <p className="text-gray-400 text-sm mb-6">
                 {searchQuery ? "Try adjusting your search query." : "You haven't uploaded any music videos yet."}
              </p>
              {!searchQuery &&
                <Button onClick={() => setIsUploadModalOpen(true)} className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity">
                  <PlusCircle className="w-5 h-5 mr-2" />Upload Your First Video
                </Button>
              }
            </div>
          )}

          {viewMode === 'grid' ? (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              <AnimatePresence>
                {videos.map((video) => (
                  <HubMusicVideoCard
                    key={video.id}
                    video={video}
                    onPlay={handlePlay}
                    onShare={handleShare}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onContributions={handleOpenContributions}
                    isProcessingPlay={isProcessingPlay && processingVideoId === video.id}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {videos.map((video) => (
                  <HubItemRow
                    key={video.id}
                    item={video}
                    itemType="video"
                    onPlay={handlePlay}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onShare={handleShare}
                    onManageContributors={handleOpenContributions}
                    isProcessingPlay={isProcessingPlay && processingVideoId === video.id}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {loading && videos.length > 0 && (
            <div className="flex justify-center mt-8">
              <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
            </div>
          )}

          {!loading && hasMore && videos.length > 0 && (
            <div className="text-center mt-8">
              <Button
                onClick={loadMoreVideos}
                className="px-6 py-3 golden-gradient text-black font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Load More Videos
              </Button>
            </div>
          )}
          
          <MusicVideoUploadModal 
            isOpen={isUploadModalOpen}
            onOpenChange={setIsUploadModalOpen}
            onVideoUploaded={handleVideoUploaded}
          />

          {selectedVideoForEdit && (
            <EditMusicVideoModal
              isOpen={isEditModalOpen}
              onOpenChange={setIsEditModalOpen}
              video={selectedVideoForEdit}
              onVideoUpdated={handleVideoUpdated}
            />
          )}

          {selectedVideoForPlayer && (
            <VideoPlayerModal 
              isOpen={isPlayerModalOpen}
              onClose={() => setIsPlayerModalOpen(false)}
              video={selectedVideoForPlayer}
            />
          )}

          {selectedVideoForShare && (
            <ShareModal
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
              entityType="video"
              entityId={selectedVideoForShare.id}
            />
          )}

          <ConfirmationDialog
            isOpen={isConfirmDeleteOpen}
            onOpenChange={setIsConfirmDeleteOpen}
            onConfirm={confirmDeleteVideo}
            title="Confirm Delete Video"
            description={`Are you sure you want to delete "${videoToDelete?.title}"? This action cannot be undone.`}
            confirmText="Delete"
            isConfirming={isDeleting}
          />

          {selectedVideoForContrib && (
            <ContributionModal
              isOpen={isContributionModalOpen}
              onOpenChange={setIsContributionModalOpen}
              contentItem={selectedVideoForContrib}
              contentType="video"
              onContributionsUpdated={() => {
                fetchVideos(0, searchQuery);
              }}
            />
          )}
        </div>
      );
    };

    export default HubMusicVideosTab;
