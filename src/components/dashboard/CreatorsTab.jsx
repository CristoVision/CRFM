import React, { useState, useEffect } from 'react';
    import { Button } from '@/components/ui/button';
    import { supabase } from '@/lib/supabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { motion } from 'framer-motion';
    import { Users, Loader2 } from 'lucide-react';
    import CreatorCard from '@/components/creators/CreatorCard';
    import CreatorRow from '@/components/creators/CreatorRow';
    import FlagFormModal from '@/components/common/FlagFormModal';
    import ShareModal from '@/components/ShareModal';
    import { useAuth } from '@/contexts/AuthContext';
    import LeaderboardCarousel from './LeaderboardCarousel';

    const fetchAllCreatorsWithContentCounts = async () => {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, avatar_url, username, full_name, bio, creator_tags, social_link_1, social_link_2, is_public, is_verified_creator')
        .eq('is_public', true); 

      if (profilesError) throw profilesError;

      if (!profilesData) return [];

      const creatorsWithContentCounts = await Promise.all(profilesData.map(async (profile) => {
        const [
          { count: trackCount, error: trackError },
          { count: albumCount, error: albumError },
          { count: playlistCount, error: playlistError },
          { count: videoCount, error: videoError } 
        ] = await Promise.all([
          supabase.from('tracks').select('id', { count: 'exact', head: true }).eq('uploader_id', profile.id).eq('is_public', true),
          supabase.from('albums').select('id', { count: 'exact', head: true }).eq('uploader_id', profile.id).eq('is_public', true),
          supabase.from('playlists').select('id', { count: 'exact', head: true }).eq('creator_id', profile.id).eq('is_public', true),
          supabase.from('videos').select('id', { count: 'exact', head: true }).eq('uploader_id', profile.id).eq('is_public', true).eq('video_type', 'music_video')
        ]);

        if (trackError || albumError || playlistError || videoError) {
          console.warn(`Error fetching content counts for ${profile.username}`, trackError, albumError, playlistError, videoError);
        }
        
        return {
          ...profile,
          track_count: trackCount || 0,
          album_count: albumCount || 0,
          playlist_count: playlistCount || 0,
          video_count: videoCount || 0,
        };
      }));
      
      return creatorsWithContentCounts.filter(
        p => p.is_public && (p.track_count > 0 || p.album_count > 0 || p.playlist_count > 0 || p.video_count > 0)
      );
    };


    function CreatorsTab({ searchQuery, viewMode = 'grid', isCreatorPageContext = false }) {
      const [creators, setCreators] = useState([]);
      const [loading, setLoading] = useState(true);
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
          type: 'creator',
          uploaderId: content.id, 
          title: content.username,
        });
        setIsFlagModalOpen(true);
      };

      const handleOpenShareModal = (item) => {
        setSelectedItemForShare(item);
        setIsShareModalOpen(true);
      };

      useEffect(() => {
        const loadCreators = async () => {
          setLoading(true);
          try {
            const data = await fetchAllCreatorsWithContentCounts();
            setCreators(data);
          } catch (error) {
            toast({
              title: 'Error fetching creators',
              description: error.message,
              variant: 'destructive',
            });
            setCreators([]);
          } finally {
            setLoading(false);
          }
        };
        loadCreators();
      }, []);

      const filteredCreators = creators.filter(creator =>
        (creator.username?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (creator.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (creator.bio?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (creator.creator_tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
      );

      if (loading) {
        return (
          <div className="flex justify-center items-center min-h-[40vh]">
            <Loader2 className="w-16 h-16 text-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        );
      }

      return (
        <motion.div layout className="space-y-6">
          {!isCreatorPageContext && <LeaderboardCarousel itemType="creator" />}
          {filteredCreators.length === 0 && !loading && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No creators found</p>
              <p className="text-gray-500">Try adjusting your search or check back later!</p>
            </div>
          )}

          {viewMode === 'grid' ? (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredCreators.map((creator) => (
                <CreatorCard 
                  key={creator.id} 
                  item={creator}
                  onFlag={handleOpenFlagModal}
                  onShare={handleOpenShareModal}
                />
              ))}
            </motion.div>
          ) : (
             <motion.div layout className="space-y-2 glass-effect p-4 rounded-xl">
               <div className="hidden md:grid grid-cols-5 items-center gap-4 px-3 py-2 border-b border-white/10 text-xs text-gray-500 font-medium">
                  <span className="col-span-1">CREATOR</span>
                  <span className="hidden md:block col-span-1">TAGS</span>
                  <span className="hidden sm:block text-center col-span-2">CONTENT (Tracks/Albums/Playlists/Videos)</span>
                  <span className="text-right col-span-1">ACTIONS</span>
               </div>
              {filteredCreators.map((creator) => (
                <CreatorRow 
                  key={creator.id}
                  item={creator}
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
              entityType="creator"
              entityId={selectedItemForShare.id}
            />
          )}
        </motion.div>
      );
    }

    export default CreatorsTab;
