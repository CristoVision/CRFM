import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { ShieldAlert, Edit3, Eye, Send, Loader2, CheckCircle, AlertTriangle, Info, RefreshCw, FileText, CircleDot as DiscIcon, Music3 as MusicIcon, ListMusic as ListMusicIcon } from 'lucide-react';
    import { useNavigate } from 'react-router-dom';
    import { motion, AnimatePresence } from 'framer-motion';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
    import { Textarea } from '@/components/ui/textarea';
    import { Label } from '@/components/ui/label';
    import EditTrackModal from './EditTrackModal';
    import EditAlbumModal from './EditAlbumModal';
    // Playlists are not typically flagged for content issues like tracks/albums, but can be added if needed
    // import EditPlaylistModal from './EditPlaylistModal';

    const FlagStatusBadge = ({ status }) => {
      let bgColor, textColor, Icon;
      switch (status) {
        case 'pending_review':
          bgColor = 'bg-yellow-500/20';
          textColor = 'text-yellow-400';
          Icon = Info;
          break;
        case 'action_required':
          bgColor = 'bg-red-500/20';
          textColor = 'text-red-400';
          Icon = AlertTriangle;
          break;
        case 'resolved':
          bgColor = 'bg-green-500/20';
          textColor = 'text-green-400';
          Icon = CheckCircle;
          break;
        case 'awaiting_review': // After user submits correction
          bgColor = 'bg-blue-500/20';
          textColor = 'text-blue-400';
          Icon = RefreshCw;
          break;
        default:
          bgColor = 'bg-gray-500/20';
          textColor = 'text-gray-400';
          Icon = Info;
      }
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
          <Icon className="w-3 h-3 mr-1.5" />
          {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </span>
      );
    };
    
    const ContentIcon = ({ type }) => {
      if (type === 'track') return <MusicIcon className="w-5 h-5 text-purple-400" />;
      if (type === 'album') return <DiscIcon className="w-5 h-5 text-blue-400" />;
      if (type === 'playlist') return <ListMusicIcon className="w-5 h-5 text-green-400" />;
      return <FileText className="w-5 h-5 text-gray-400" />;
    };

    const FlaggedItemCard = ({ flag, onEditContent, onSubmitCorrection }) => {
      const navigate = useNavigate();
      const { content_item, content_type } = flag;

      const handleViewDetails = () => {
        if (!content_item || !content_type) return;
        let path = '';
        if (content_type === 'track') path = `/track/${content_item.id}`;
        else if (content_type === 'album') path = `/album/${content_item.id}`;
        // else if (content_type === 'playlist') path = `/playlist/${content_item.id}`;
        if (path) navigate(path);
      };
      
      return (
        <motion.div 
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="glass-effect p-5 rounded-lg mb-4 border border-yellow-500/30 shadow-lg hover:border-yellow-500/60 transition-all"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
            <div className="flex items-center mb-2 sm:mb-0">
              <ContentIcon type={content_type} />
              <h3 className="text-lg font-semibold text-yellow-400 ml-2 truncate" title={content_item?.title || 'N/A'}>
                {content_item?.title || `Flagged ${content_type || 'Item'}`}
              </h3>
            </div>
            <FlagStatusBadge status={flag.status} />
          </div>

          <div className="space-y-2 text-sm mb-4">
            <p><strong className="text-gray-300">Reason:</strong> <span className="text-gray-400">{flag.flag_reason_category}</span></p>
            {flag.flag_description_text && <p><strong className="text-gray-300">Details:</strong> <span className="text-gray-400">{flag.flag_description_text}</span></p>}
            {flag.admin_feedback_to_uploader && <p className="mt-2 p-2 bg-white/5 rounded"><strong className="text-yellow-300">Admin Feedback:</strong> <span className="text-gray-300">{flag.admin_feedback_to_uploader}</span></p>}
            {flag.uploader_correction_notes && <p className="mt-2 p-2 bg-green-500/10 rounded"><strong className="text-green-300">Your Notes:</strong> <span className="text-gray-300">{flag.uploader_correction_notes}</span></p>}

          </div>
          
          <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
            <Button onClick={handleViewDetails} variant="outline" size="sm" className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-yellow-300 text-xs">
              <Eye className="w-3 h-3 mr-1.5"/>View Details
            </Button>
            { (flag.status === 'action_required' || flag.status === 'pending_review' || flag.status === 'awaiting_review') && content_item &&
              <Button onClick={() => onEditContent(content_item, content_type)} variant="outline" size="sm" className="bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20 hover:text-blue-200 text-xs">
                <Edit3 className="w-3 h-3 mr-1.5"/>Edit Content
              </Button>
            }
            { (flag.status === 'action_required' || flag.status === 'pending_review') &&
              <Button onClick={() => onSubmitCorrection(flag)} variant="default" size="sm" className="golden-gradient text-black hover:opacity-90 text-xs">
                <Send className="w-3 h-3 mr-1.5"/>Submit Correction
              </Button>
            }
          </div>
        </motion.div>
      );
    };
    
    const SubmitCorrectionModal = ({ isOpen, onOpenChange, flag, onSubmit }) => {
      const [correctionNotes, setCorrectionNotes] = useState('');
      const [isSubmitting, setIsSubmitting] = useState(false);

      useEffect(() => {
        if (flag) {
          setCorrectionNotes(flag.uploader_correction_notes || '');
        }
      }, [flag]);

      const handleSubmit = async () => {
        setIsSubmitting(true);
        await onSubmit(correctionNotes);
        setIsSubmitting(false);
        onOpenChange(false);
      };

      if (!flag) return null;

      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-lg glass-effect-light text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center"><Send className="w-5 h-5 mr-2 text-yellow-400"/>Submit Correction for Review</DialogTitle>
              <DialogDescription className="text-gray-400 pt-2">
                Provide notes about the corrections you've made for <strong className="text-yellow-300">{flag.content_item?.title || 'this item'}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <Label htmlFor="correctionNotes" className="text-gray-300">Your Correction Notes:</Label>
              <Textarea 
                id="correctionNotes"
                value={correctionNotes}
                onChange={(e) => setCorrectionNotes(e.target.value)}
                placeholder="E.g., 'Updated the cover art to remove copyrighted material.', 'Adjusted lyrics to meet guidelines.'"
                rows={5}
                className="bg-white/5 border-white/10 focus:border-yellow-400 text-white"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">Cancel</Button></DialogClose>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="golden-gradient text-black font-semibold hover:opacity-90">
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Send className="w-4 h-4 mr-2"/>}
                Submit for Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };


    const HubActionsTab = () => {
      const { user } = useAuth();
      const [flaggedItems, setFlaggedItems] = useState([]);
      const [loading, setLoading] = useState(true);
      
      const [selectedContentForEdit, setSelectedContentForEdit] = useState(null);
      const [editModalType, setEditModalType] = useState(''); // 'track', 'album'
      const [isEditModalOpen, setIsEditModalOpen] = useState(false);

      const [selectedFlagForCorrection, setSelectedFlagForCorrection] = useState(null);
      const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);

      const fetchFlaggedContentDetails = async (flags) => {
        const detailedFlags = await Promise.all(
          flags.map(async (flag) => {
            let contentQuery;
            if (flag.content_type === 'track') {
              contentQuery = supabase.from('tracks').select('id, title, cover_art_url, video_cover_art_url, uploader_id, genre, release_date, languages, is_public, created_at, audio_file_url, lyrics_text, is_christian_nature, is_explicit_content, ai_in_artwork, ai_in_production, ai_in_lyrics, stream_cost').eq('id', flag.content_id).single();
            } else if (flag.content_type === 'album') {
              contentQuery = supabase.from('albums').select('id, title, cover_art_url, video_cover_art_url, uploader_id, genre, release_date, languages, is_public, created_at, updated_at').eq('id', flag.content_id).single();
            } else {
              // Add playlist or other types if needed
              return { ...flag, content_item: null };
            }

            const { data: contentData, error: contentError } = await contentQuery;
            if (contentError) {
              console.warn(`Error fetching ${flag.content_type} ID ${flag.content_id}:`, contentError.message);
              return { ...flag, content_item: null };
            }
            return { ...flag, content_item: contentData };
          })
        );
        return detailedFlags;
      };


      const fetchActions = useCallback(async () => {
        if (!user) {
          setLoading(false);
          setFlaggedItems([]);
          return;
        }
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('content_flags')
            .select('*')
            .eq('original_uploader_id', user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          
          const detailedData = await fetchFlaggedContentDetails(data || []);
          setFlaggedItems(detailedData);

        } catch (error) {
          toast({ title: 'Error fetching your actions', description: error.message, variant: 'destructive' });
          setFlaggedItems([]);
        } finally {
          setLoading(false);
        }
      }, [user]);

      useEffect(() => {
        fetchActions();
      }, [fetchActions]);

      const handleEditContent = (item, type) => {
        setSelectedContentForEdit(item);
        setEditModalType(type);
        setIsEditModalOpen(true);
      };
      
      const handleContentUpdated = () => {
        fetchActions(); // Refresh the list after content is updated
      }

      const handleOpenSubmitCorrectionModal = (flag) => {
        setSelectedFlagForCorrection(flag);
        setIsCorrectionModalOpen(true);
      };

      const handleSubmitCorrectionNotes = async (notes) => {
        if (!selectedFlagForCorrection || !user) return;
        try {
          const { data, error } = await supabase
            .from('content_flags')
            .update({ 
              uploader_correction_notes: notes,
              status: 'awaiting_review', // Update status
              updated_at: new Date().toISOString()
            })
            .eq('id', selectedFlagForCorrection.id)
            .eq('original_uploader_id', user.id)
            .select()
            .single();
          
          if (error) throw error;

          toast({ title: 'Correction Submitted', description: `Your notes for "${selectedFlagForCorrection.content_item?.title || 'item'}" have been submitted for review.` });
          fetchActions(); // Refresh list
        } catch (error) {
          toast({ title: 'Error Submitting Correction', description: error.message, variant: 'destructive' });
        }
      };


      if (loading) {
        return <div className="flex justify-center items-center min-h-[40vh]"><div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div></div>;
      }

      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
            <ShieldAlert className="w-7 h-7 mr-3 text-yellow-400"/>Content Moderation Actions
          </h2>

          {flaggedItems.length === 0 ? (
            <div className="text-center py-12 glass-effect rounded-xl">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-gray-300 text-lg mb-2">All Clear!</p>
              <p className="text-gray-400 text-sm">You have no pending actions or flagged content to review.</p>
            </div>
          ) : (
            <motion.div layout className="space-y-4">
              <AnimatePresence>
                {flaggedItems.map(flag => (
                  <FlaggedItemCard 
                    key={flag.id} 
                    flag={flag} 
                    onEditContent={handleEditContent}
                    onSubmitCorrection={handleOpenSubmitCorrectionModal}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {selectedContentForEdit && editModalType === 'track' && (
            <EditTrackModal 
              isOpen={isEditModalOpen}
              onOpenChange={setIsEditModalOpen}
              track={selectedContentForEdit}
              onTrackUpdated={handleContentUpdated}
            />
          )}
          {selectedContentForEdit && editModalType === 'album' && (
            <EditAlbumModal
              isOpen={isEditModalOpen}
              onOpenChange={setIsEditModalOpen}
              album={selectedContentForEdit}
              onAlbumUpdated={handleContentUpdated}
            />
          )}
          {/* Add EditPlaylistModal if playlists can be flagged and edited similarly */}

          {selectedFlagForCorrection && (
            <SubmitCorrectionModal 
              isOpen={isCorrectionModalOpen}
              onOpenChange={setIsCorrectionModalOpen}
              flag={selectedFlagForCorrection}
              onSubmit={handleSubmitCorrectionNotes}
            />
          )}
        </div>
      );
    };

    export default HubActionsTab;
