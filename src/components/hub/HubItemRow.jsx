import React, { useState } from 'react';
    import { Button } from '@/components/ui/button';
    import { Eye, Edit3, Trash2, Users, Music, Disc, ListMusic, Flag, Film, PlayCircle, Share2, Loader2 } from 'lucide-react';
    import { useNavigate } from 'react-router-dom';
    import { motion } from 'framer-motion';
    import FlagFormModal from '@/components/common/FlagFormModal';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';

    const DEFAULT_COVER_ART_TRACK = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXVkaW98ZW58MHx8MHx8fDA%3D&w=1000&q=80';
    const DEFAULT_COVER_ART_ALBUM = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fG11c2ljJTIwYWxidW18ZW58MHx8MHx8fDA%3D&w=1000&q=80';
    const DEFAULT_COVER_ART_PLAYLIST = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bXVzaWMlMjBwbGF5bGlzdHxlbnwwfHwwfHx8MA%3D%3D&w=1000&q=80';
    const DEFAULT_COVER_ART_VIDEO = 'https://images.unsplash.com/photo-1516280440614-3793959696b4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fHZpZGVvfGVufDB8fDB8fHww&w=1000&q=80';

    const HubItemRow = ({ item, itemType, onEdit, onDelete, onManageContributors, onPlay, onShare, isProcessingPlay }) => {
      const navigate = useNavigate();
      const { user } = useAuth();
      const { id, title, cover_art_url, genre, release_date, description, is_public, created_at, uploader_id, creator_id } = item;

      const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
      const [selectedContentForFlag, setSelectedContentForFlag] = useState(null);

      let defaultCover, ItemIcon, detailPathPrefix;
      if (itemType === 'track') {
        defaultCover = DEFAULT_COVER_ART_TRACK;
        ItemIcon = Music;
        detailPathPrefix = '/track/';
      } else if (itemType === 'album') {
        defaultCover = DEFAULT_COVER_ART_ALBUM;
        ItemIcon = Disc;
        detailPathPrefix = '/album/';
      } else if (itemType === 'video') {
        defaultCover = DEFAULT_COVER_ART_VIDEO;
        ItemIcon = Film;
        detailPathPrefix = '/video/';
      } else { // playlist
        defaultCover = DEFAULT_COVER_ART_PLAYLIST;
        ItemIcon = ListMusic;
        detailPathPrefix = '/playlist/';
      }
      
      const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      };

      const handleViewDetails = (e) => {
        e.stopPropagation();
        navigate(`${detailPathPrefix}${id}`);
      };

      const handleOpenFlagModal = (e) => {
        e.stopPropagation();
        if (!user) {
          toast({ title: "Authentication Required", description: "Please log in to flag content.", variant: "destructive" });
          return;
        }
        setSelectedContentForFlag({
          id: item.id,
          type: itemType,
          uploaderId: itemType === 'playlist' ? item.creator_id : item.uploader_id,
          title: item.title,
        });
        setIsFlagModalOpen(true);
      };

      return (
        <>
          <motion.div 
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center space-x-3 p-3 hover:bg-white/5 rounded-lg group transition-colors duration-200 glass-effect-hoverable mb-2"
          >
            <img
              src={cover_art_url || defaultCover}
              alt={title}
              className="w-12 h-12 rounded-md object-cover border border-white/10 flex-shrink-0"
            />
            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-x-4 items-center">
              <div className="md:col-span-1">
                <h3 className="font-medium text-white truncate group-hover:text-yellow-400 transition-colors text-sm">{title}</h3>
                <p className="text-xs text-gray-400 truncate">
                  {(itemType === 'track' || itemType === 'album') && (genre || 'No genre')}
                  {(itemType === 'playlist' || itemType === 'video') && (description || 'No description')}
                </p>
              </div>
              <div className="hidden md:flex md:col-span-1 items-center text-xs text-gray-500 space-x-4">
                  <span>{itemType === 'track' || itemType === 'album' ? `Released: ${formatDate(release_date)}` : `Created: ${formatDate(created_at)}`}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${is_public ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>
                    {is_public ? 'Public' : 'Private'}
                  </span>
              </div>
              <div className="md:col-span-1 flex items-center justify-start md:justify-end flex-wrap gap-1 mt-2 md:mt-0">
                {onPlay ? (
                    <Button onClick={() => onPlay(item)} variant="ghost" size="sm" className="text-gray-400 hover:text-yellow-400 px-2 py-1 h-auto" disabled={isProcessingPlay}>
                        {isProcessingPlay ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5 mr-1"/>}
                        Watch
                    </Button>
                ) : (
                    <Button onClick={handleViewDetails} variant="ghost" size="sm" className="text-gray-400 hover:text-yellow-400 px-2 py-1 h-auto"><Eye className="w-3.5 h-3.5 mr-1"/>View</Button>
                )}
                {onShare && (
                     <Button onClick={() => onShare(item)} variant="ghost" size="sm" className="text-gray-400 hover:text-green-400 px-2 py-1 h-auto"><Share2 className="w-3.5 h-3.5 mr-1"/>Share</Button>
                )}
                <Button onClick={() => onEdit(item)} variant="ghost" size="sm" className="text-gray-400 hover:text-blue-400 px-2 py-1 h-auto"><Edit3 className="w-3.5 h-3.5 mr-1"/>Edit</Button>
                {onManageContributors && (itemType === 'track' || itemType === 'album' || itemType === 'video') &&
                  <Button onClick={() => onManageContributors(item)} variant="ghost" size="sm" className="text-gray-400 hover:text-purple-400 px-2 py-1 h-auto"><Users className="w-3.5 h-3.5 mr-1"/>Contrib.</Button>
                }
                <Button onClick={handleOpenFlagModal} variant="ghost" size="sm" className="text-gray-400 hover:text-yellow-300 px-2 py-1 h-auto"><Flag className="w-3.5 h-3.5 mr-1"/>Flag</Button>
                <Button onClick={() => onDelete(item)} variant="ghost" size="sm" className="text-gray-400 hover:text-red-400 px-2 py-1 h-auto"><Trash2 className="w-3.5 h-3.5 mr-1"/>Delete</Button>
              </div>
            </div>
          </motion.div>
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
        </>
      );
    };

    export default HubItemRow;
