import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Loader2, PlayCircle, Share2 } from 'lucide-react';
import MusicVideoCard from '@/components/videos/MusicVideoCard';
import ShareModal from '@/components/ShareModal';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { useVideoPlayer } from '@/contexts/VideoPlayerContext';
import { Button } from '@/components/ui/button';
import LeaderboardCarousel from './LeaderboardCarousel';
import { pickImageFallback } from '@/lib/mediaFallbacks';

const ITEMS_PER_PAGE = 12;
const DEFAULT_VIDEO_COVER_ART = 'https://images.unsplash.com/photo-1516280440614-3793959696b4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fHZpZGVvfGVufDB8fDB8fHww&w=1000&q=80';

function MusicVideosTab({ searchQuery = '', viewMode = 'grid', isCreatorPageContext = false, timeRange = 'all' }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedItemForShare, setSelectedItemForShare] = useState(null);
  const { user, spendCrossCoinsForVideo } = useAuth();
  const { pause } = usePlayer();
  const { playVideo } = useVideoPlayer();
  const [isProcessingPlay, setIsProcessingPlay] = useState(null);

  const fetchVideos = useCallback(async (currentPage, currentSearchQuery) => {
    setLoading(true);
    try {
      let query = supabase
        .from('videos')
        .select(`
          id, title, description, cover_art_url, storage_path, uploader_id, created_at, 
          language, cost_cc, creator_display_name, date_published, is_public, video_type
        `, { count: 'exact' })
        .eq('is_public', true)
        .eq('video_type', 'music_video')
        .order('created_at', { ascending: false })
        .range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1);

      if (currentSearchQuery) {
        query = query.or(`title.ilike.%${currentSearchQuery}%,description.ilike.%${currentSearchQuery}%,creator_display_name.ilike.%${currentSearchQuery}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      
      setVideos(prev => currentPage === 0 ? data : [...prev, ...data]);
      setHasMore((currentPage + 1) * ITEMS_PER_PAGE < count);

    } catch (error) {
      toast({
        title: 'Error fetching music videos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

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
  
  const handlePlayVideo = async (video) => {
    if (!user) {
      toast({ title: "Login to Play", description: "You must be logged in to play videos.", variant: "destructive" });
      return;
    }
    if (!video || isProcessingPlay === video.id) return;
    setIsProcessingPlay(video.id);

    try {
      // Pause the music player/queue before opening the video modal
      try { pause?.(); } catch { /* noop */ }

      const cost = Number(video.cost_cc ?? 0);
      if (cost > 0) {
        const { success, error } = await spendCrossCoinsForVideo(video.id, cost);
        if (!success) {
          toast({
            title: "Cannot start playback",
            description: error || `You need ${cost} CrossCoins to watch this video.`,
            variant: "destructive",
          });
          return;
        }
      }
      playVideo(video);
    } catch(error) {
      toast({ title: "Error", description: "An unexpected error occurred during playback.", variant: "destructive" });
    } finally {
      setIsProcessingPlay(null);
    }
  };

  const handleOpenShareModal = (video) => {
    setSelectedItemForShare(video);
    setIsShareModalOpen(true);
  };

  if (loading && page === 0 && videos.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Loader2 className="w-16 h-16 text-yellow-400 animate-spin" />
      </div>
    );
  }
  
  const renderContent = () => {
    const filteredVideos = videos.filter(v => 
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.creator_display_name && v.creator_display_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (filteredVideos.length === 0 && !loading) {
      return (
        <div className="text-center py-12">
          <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No music videos found</p>
          <p className="text-gray-500">Try adjusting your search or check back later!</p>
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <AnimatePresence>
            {filteredVideos.map((video) => (
              <MusicVideoCard
                key={video.id}
                video={video}
                onPlay={handlePlayVideo}
                onShare={handleOpenShareModal}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      );
    } else {
      return (
        <motion.div layout className="space-y-2">
          <AnimatePresence>
            {filteredVideos.map(video => (
              <motion.div
                key={video.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center space-x-4 p-3 hover:bg-white/5 rounded-lg group transition-colors duration-200 glass-effect-hoverable"
              >
                <img
                  src={pickImageFallback([video.cover_art_url], DEFAULT_VIDEO_COVER_ART)}
                  alt={video.title}
                  className="w-14 h-14 rounded-md object-cover border border-white/10 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-white truncate group-hover:text-yellow-400">{video.title}</p>
                  <p className="text-sm text-gray-400 truncate">by {video.creator_display_name}</p>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handlePlayVideo(video)} className="text-gray-400 hover:text-yellow-400" disabled={isProcessingPlay === video.id}>
                    {isProcessingPlay === video.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                    Play
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleOpenShareModal(video)} className="text-gray-400 hover:text-green-400">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      );
    }
  };

  return (
    <motion.div layout className="space-y-6">
      {!isCreatorPageContext && <LeaderboardCarousel itemType="music_video" timeframe={timeRange} />}
      {renderContent()}

      {loading && videos.length > 0 && (
        <div className="flex justify-center mt-8">
          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
        </div>
      )}

      {!loading && hasMore && videos.length > 0 && (
        <div className="text-center mt-8">
          <button
            onClick={loadMoreVideos}
            className="px-6 py-3 golden-gradient text-black font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Load More Videos
          </button>
        </div>
      )}
      
      {selectedItemForShare && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          entityType="video"
          entityId={selectedItemForShare.id}
        />
      )}
    </motion.div>
  );
}

export default MusicVideosTab;
