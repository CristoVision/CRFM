import React, { useState, useEffect, useContext, useRef } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { motion } from 'framer-motion';
    import { Headphones, Loader2 } from 'lucide-react';
    import FlagFormModal from '@/components/common/FlagFormModal';
    import ShareModal from '@/components/ShareModal';
    import TrackCard from '@/components/tracks/TrackCard';
    import TrackRow from '@/components/tracks/TrackRow';
    import { usePlayer } from '@/contexts/PlayerContext.jsx';
    import { useAuth } from '@/contexts/AuthContext';
    import { QueueContext } from '@/contexts/QueueContext.jsx';
    import LeaderboardCarousel from './LeaderboardCarousel';

function TracksTab({ searchQuery = '', viewMode = 'grid', initialTracks, isCreatorPageContext = false, timeRange = 'all' }) {
      const [tracks, setTracks] = useState(initialTracks || []);
      const [loading, setLoading] = useState(!initialTracks);
      const [populatingTrackId, setPopulatingTrackId] = useState(null);
      const playerContext = usePlayer();
      const queueContext = useContext(QueueContext);
      const { user } = useAuth();

      const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
      const [selectedContentForFlag, setSelectedContentForFlag] = useState(null);
      const [isShareModalOpen, setIsShareModalOpen] = useState(false);
      const [selectedItemForShare, setSelectedItemForShare] = useState(null);
      
      const playButtonRefs = useRef({});

      const handleOpenFlagModal = (content) => {
        if (!user) {
          toast({ title: "Authentication Required", description: "Please log in to flag content.", variant: "destructive" });
          return;
        }
        setSelectedContentForFlag({
          id: content.id,
          type: 'track',
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
        if (!initialTracks) {
          const fetchTracks = async () => {
            setLoading(true);
            const { data, error } = await supabase
              .from('tracks')
              .select(
                'id, title, creator_display_name, uploader_id, audio_file_url, genre, cover_art_url, video_cover_art_url, album_id, release_date, created_at, stream_cost, is_public, albums(cover_art_url, video_cover_art_url), profiles!tracks_uploader_id_profiles_fkey(avatar_url)'
              )
              .eq('is_public', true)
              .order('created_at', { ascending: false });

            if (error) {
              toast({
                title: 'Error fetching tracks',
                description: error.message,
                variant: 'destructive',
              });
              setTracks([]);
            } else {
              setTracks(data || []);
            }
            setLoading(false);
          };
          fetchTracks();
        } else {
          setLoading(false);
          setTracks(initialTracks);
        }
      }, [initialTracks]);

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

      const filteredTracks = tracks
        .filter(track =>
          (track.title?.toLowerCase() || '').includes(safeSearchQuery.toLowerCase()) ||
          (track.creator_display_name?.toLowerCase() || '').includes(safeSearchQuery.toLowerCase()) ||
          (track.genre?.toLowerCase() || '').includes(safeSearchQuery.toLowerCase())
        )
        .filter(track => filterByRange(track.created_at || track.release_date));

      const handleInitiatePlay = (trackItem, index) => {
        if (!trackItem || !trackItem.id || !playerContext || !queueContext) return;

        setPopulatingTrackId(trackItem.id);

        queueContext.setPlaybackQueue(filteredTracks, index);

        setPopulatingTrackId(null);

        const ref = playButtonRefs.current?.[trackItem.id];
        if (ref && typeof ref.focus === 'function') {
          ref.focus();
        }
      };

      if (loading) {
        return (
          <div className="flex justify-center items-center min-h-[40vh]">
            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        );
      }

      return (
        <motion.div layout className="space-y-6">
          {!isCreatorPageContext && <LeaderboardCarousel itemType="track" timeframe={timeRange} />}
          <style>{`
            .glass-effect-hoverable:hover {
              background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 255, 255, 0.07) 100%);
              border-color: rgba(255, 215, 0, 0.4);
              box-shadow: 0 0 20px rgba(255, 215, 0, 0.2);
            }
          `}</style>
          {filteredTracks.length === 0 && !loading && !isCreatorPageContext && (
            <div className="text-center py-12">
              <Headphones className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No tracks found</p>
              <p className="text-gray-500">Try adjusting your search or check back later!</p>
            </div>
          )}
           {filteredTracks.length === 0 && isCreatorPageContext && (
            <div className="text-center py-8 text-gray-400">This creator has no public tracks matching your search.</div>
          )}


          {viewMode === 'grid' ? (
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTracks.map((track, idx) => (
                <TrackCard 
                  key={track.id} 
                  item={track} 
                  onPlay={(buttonRef) => {
                    playButtonRefs.current[track.id] = buttonRef;
                    handleInitiatePlay(track, idx);
                  }}
                  isPlaying={playerContext.isPlaying && playerContext.currentTrack?.id === track.id} 
                  currentTrackId={playerContext.currentTrack?.id}
                  onFlag={handleOpenFlagModal}
                  onShare={handleOpenShareModal}
                  isPopulating={populatingTrackId === track.id}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div layout className="space-y-2 glass-effect p-4 rounded-xl">
               <div className="hidden md:grid grid-cols-6 items-center gap-4 px-3 py-2 border-b border-white/10 text-xs text-gray-500 font-medium">
                  <span className="col-span-2">TITLE</span>
                  <span className="hidden md:block">ARTIST</span>
                  <span className="hidden lg:block">GENRE</span>
                  <span className="text-center">COST</span>
                  <span className="text-right hidden sm:block">RELEASE DATE</span>
               </div>
              {filteredTracks.map((track, idx) => (
                <TrackRow 
                  key={track.id} 
                  item={track} 
                  onPlay={(buttonRef) => {
                    playButtonRefs.current[track.id] = buttonRef;
                    handleInitiatePlay(track, idx);
                  }}
                  isPlaying={playerContext.isPlaying && playerContext.currentTrack?.id === track.id} 
                  currentTrackId={playerContext.currentTrack?.id}
                  onFlag={handleOpenFlagModal}
                  onShare={handleOpenShareModal}
                  isPopulating={populatingTrackId === track.id}
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
              entityType="track"
              entityId={selectedItemForShare.id}
            />
          )}
        </motion.div>
      );
    }

    export default TracksTab;
