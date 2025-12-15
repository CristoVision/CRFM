import React, { useState, useEffect } from 'react';
    import { Card, CardContent } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Eye, Edit3, Trash2, Users, Music, Disc, ListMusic, Flag } from 'lucide-react';
    import { useNavigate } from 'react-router-dom';
    import { motion } from 'framer-motion';
    import FlagFormModal from '@/components/common/FlagFormModal';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
    import { logContentView } from '@/lib/analyticsClient';

    const DEFAULT_COVER_ART_TRACK = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXVkaW98ZW58MHx8MHx8fDA%3D&w=1000&q=80';
    const DEFAULT_COVER_ART_ALBUM = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fG11c2ljJTIwYWxidW18ZW58MHx8MHx8fDA%3D&w=1000&q=80';
    const DEFAULT_COVER_ART_PLAYLIST = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bXVzaWMlMjBwbGF5bGlzdHxlbnwwfHwwfHx8MA%3D%3D&w=1000&q=80';

    const HubItemCard = ({ item, itemType, onEdit, onDelete, onManageContributors }) => {
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
      } else { // playlist
        defaultCover = DEFAULT_COVER_ART_PLAYLIST;
        ItemIcon = ListMusic;
        detailPathPrefix = '/playlist/';
      }

      const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      };

      useEffect(() => {
        // log impression of the card
        const resourceType = itemType === 'track' ? 'track_card' : itemType === 'album' ? 'album' : 'playlist';
        logContentView({
          resourceType,
          resourceId: id,
          path: window?.location?.pathname || '/hub',
          userId: user?.id || null,
          source: 'web',
        });
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [id, itemType, user?.id]);
      
      const handleViewDetails = () => {
        const resourceType = itemType === 'track' ? 'track_card' : itemType === 'album' ? 'album' : 'playlist';
        logContentView({
          resourceType,
          resourceId: id,
          path: `${detailPathPrefix}${id}`,
          userId: user?.id || null,
          source: 'web',
        });
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="w-full group glass-effect overflow-hidden">
              <CardContent className="p-0">
                <div className="relative aspect-square w-full">
                  <img
                    src={cover_art_url || defaultCover}
                    alt={title}
                    className="absolute inset-0 w-full h-full object-cover border-b border-white/10"
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-2 space-x-1">
                    <Button variant="ghost" size="sm" onClick={handleViewDetails} className="golden-gradient text-black hover:opacity-80 text-xs px-2 py-1 h-auto"><Eye className="w-3 h-3 mr-1"/>View</Button>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(item)} className="bg-blue-500/80 text-white hover:bg-blue-600/90 text-xs px-2 py-1 h-auto"><Edit3 className="w-3 h-3 mr-1"/>Edit</Button>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-md font-semibold text-white truncate group-hover:text-yellow-400 transition-colors">{title}</h3>
                  
                  {itemType === 'track' && <p className="text-xs text-gray-400 truncate">{genre || 'No genre'}</p>}
                  {itemType === 'album' && <p className="text-xs text-gray-400 truncate">{genre || 'No genre'}</p>}
                  {itemType === 'playlist' && <p className="text-xs text-gray-400 line-clamp-1">{description || 'No description'}</p>}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                    <span>{itemType === 'track' || itemType === 'album' ? formatDate(release_date) : formatDate(created_at)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${is_public ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {is_public ? 'Public' : 'Private'}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                    { (itemType === 'track' || itemType === 'album') &&
                      <Button onClick={() => onManageContributors(item)} variant="outline" size="sm" className="flex-1 min-w-[110px] bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-yellow-300 text-xs">
                        <Users className="w-3 h-3 mr-1.5"/>Contrib.
                      </Button>
                    }
                    <Button onClick={handleOpenFlagModal} variant="outline" size="sm" className="flex-1 min-w-[90px] bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300 text-xs">
                      <Flag className="w-3 h-3 mr-1.5"/>Flag
                    </Button>
                    <Button onClick={() => onDelete(item)} variant="outline" size="sm" className="flex-1 min-w-[90px] bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 text-xs">
                      <Trash2 className="w-3 h-3 mr-1.5"/>Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
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

    export default HubItemCard;
