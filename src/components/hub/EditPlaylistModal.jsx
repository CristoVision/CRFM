import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { useNavigate } from 'react-router-dom';
    import { toast } from '@/components/ui/use-toast';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Progress } from '@/components/ui/progress';
    import ConfirmationDialog from '@/components/common/ConfirmationDialog';
    import PlaylistMetadataForm from '@/components/playlistEdit/PlaylistMetadataForm';
    import PlaylistTrackManager from '@/components/playlistEdit/PlaylistTrackManager';
    import { uploadFileToSupabase } from '@/components/formUtils';
    import { ListMusic, Save, Loader2, Trash2 } from 'lucide-react';

    const EditPlaylistModal = ({ isOpen, onOpenChange, playlist: initialPlaylist, onPlaylistUpdated, onPlaylistDeleted }) => {
      const { user } = useAuth();
      const navigate = useNavigate();
      
    const initialPlaylistDataState = { title: '', description: '', is_public: true, cover_art_url: null, video_cover_art_url: null };
      const [playlistData, setPlaylistData] = useState(initialPlaylistDataState);
      const [newCoverArtFile, setNewCoverArtFile] = useState(null);
      const [coverArtPreview, setCoverArtPreview] = useState(null);
      
      const [currentTracks, setCurrentTracks] = useState([]); 
      const [tracksToAdd, setTracksToAdd] = useState([]); 
      const [tracksToRemove, setTracksToRemove] = useState([]);

      const [isSubmitting, setIsSubmitting] = useState(false);
      const [isDeleting, setIsDeleting] = useState(false);
      const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
      const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
      const [overallProgress, setOverallProgress] = useState(0);

      const resetModalState = useCallback(() => {
        setPlaylistData(initialPlaylistDataState);
        setNewCoverArtFile(null);
        setCoverArtPreview(null);
        setCurrentTracks([]);
        setTracksToAdd([]);
        setTracksToRemove([]);
        setOverallProgress(0);
      }, []);
      
      const fetchPlaylistDetails = useCallback(async () => {
        if (!initialPlaylist || !initialPlaylist.id || !user) {
          resetModalState();
          return;
        }
        setIsLoadingPlaylist(true);
        try {
          const { data: playlistDetails, error: playlistError } = await supabase
            .from('playlists')
            .select('id, title, description, is_public, cover_art_url, video_cover_art_url, creator_id')
            .eq('id', initialPlaylist.id)
            .eq('creator_id', user.id)
            .single();

          if (playlistError) throw playlistError;
          if (!playlistDetails) throw new Error("Playlist not found or access denied.");

          setPlaylistData({
            title: playlistDetails.title || '',
            description: playlistDetails.description || '',
            is_public: playlistDetails.is_public !== undefined ? playlistDetails.is_public : true,
            cover_art_url: playlistDetails.cover_art_url,
            video_cover_art_url: playlistDetails.video_cover_art_url,
          });
          setCoverArtPreview(playlistDetails.cover_art_url);

          const { data: tracksData, error: tracksError } = await supabase
            .from('playlist_tracks')
            .select('id, track_id, order_in_playlist, tracks(id, title, cover_art_url, video_cover_art_url, creator_display_name)')
            .eq('playlist_id', initialPlaylist.id)
            .order('order_in_playlist', { ascending: true });
          
          if (tracksError) throw tracksError;
          setCurrentTracks(tracksData.map(pt => ({ 
            ...pt.tracks, 
            playlist_track_id: pt.id, 
            order_in_playlist: pt.order_in_playlist 
          })) || []);

        } catch (error) {
          toast({ title: 'Error fetching playlist details', description: error.message, variant: 'error' });
          resetModalState();
          onOpenChange(false);
        } finally {
          setIsLoadingPlaylist(false);
        }
      }, [initialPlaylist, user, onOpenChange, resetModalState]);

      useEffect(() => {
        if (isOpen) {
          fetchPlaylistDetails();
        } else {
           resetModalState();
        }
      }, [isOpen, fetchPlaylistDetails, resetModalState]);

      const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setPlaylistData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
      };

      const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
          setNewCoverArtFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setCoverArtPreview(reader.result);
          reader.readAsDataURL(file);
        } else {
          setNewCoverArtFile(null);
          setCoverArtPreview(playlistData.cover_art_url);
        }
      };

      const handleVideoCoverArtChange = (videoUrl) => {
        setPlaylistData(prev => ({ ...prev, video_cover_art_url: videoUrl || null }));
      };
      
      const handleSelectTracksForStaging = (newlySelectedTracks) => {
        setTracksToAdd(newlySelectedTracks);
      };

      const handleRemoveStagedTrack = (trackId) => {
        setTracksToAdd(prev => prev.filter(t => t.id !== trackId));
      };

      const handleRemoveExistingTrack = (track) => {
         setTracksToRemove(prev => [...prev, track.playlist_track_id]);
         setCurrentTracks(prev => prev.filter(t => t.playlist_track_id !== track.playlist_track_id));
      };

      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!initialPlaylist || !user) return;
        if (!playlistData.title.trim()) {
          toast({ title: 'Title Required', description: 'Playlist title cannot be empty.', variant: 'error' });
          return;
        }
        setIsSubmitting(true);
        setOverallProgress(0);

        let finalCoverArtUrl = playlistData.cover_art_url;

        try {
          if (newCoverArtFile) {
            setOverallProgress(10);
            finalCoverArtUrl = await uploadFileToSupabase(newCoverArtFile, 'playlist-covers', user.id, true);
            setOverallProgress(25);
          } else {
            setOverallProgress(25);
          }

          const updatedPlaylistFields = {
            title: playlistData.title,
            description: playlistData.description || null,
            is_public: playlistData.is_public,
            cover_art_url: finalCoverArtUrl,
            video_cover_art_url: playlistData.video_cover_art_url || null,
            updated_at: new Date().toISOString(),
          };
          
          const { data: updatedPlaylist, error: updateError } = await supabase
            .from('playlists')
            .update(updatedPlaylistFields)
            .eq('id', initialPlaylist.id)
            .eq('creator_id', user.id)
            .select()
            .single();

          if (updateError) throw updateError;
          setOverallProgress(50);

          if (tracksToRemove.length > 0) {
            const { error: deleteTracksError } = await supabase
              .from('playlist_tracks')
              .delete()
              .in('id', tracksToRemove);
            if (deleteTracksError) throw deleteTracksError;
          }
          setOverallProgress(75);
          
          if (tracksToAdd.length > 0) {
            let maxOrder = currentTracks.length > 0 ? Math.max(...currentTracks.map(t => t.order_in_playlist || 0), 0) : 0;
            
            const newPlaylistTracksData = tracksToAdd
                .filter(newTrack => !currentTracks.some(ct => ct.id === newTrack.id))
                .map((track, index) => {
                  maxOrder++;
                  return {
                    playlist_id: initialPlaylist.id,
                    track_id: track.id,
                    added_at: new Date().toISOString(),
                    order_in_playlist: maxOrder,
                  };
                });

            if (newPlaylistTracksData.length > 0) {
                const { error: addTracksError } = await supabase
                .from('playlist_tracks')
                .insert(newPlaylistTracksData);
                if (addTracksError) throw addTracksError;
            }
          }
          setOverallProgress(100);

          toast({ title: 'Playlist Updated!', description: `"${updatedPlaylist.title}" has been successfully updated.`, variant: 'success' });
          if (onPlaylistUpdated) onPlaylistUpdated(updatedPlaylist);
          onOpenChange(false);

        } catch (error) {
          console.error('Error updating playlist:', error);
          toast({ title: 'Update Failed', description: error.message || 'Could not update playlist.', variant: 'error' });
          setOverallProgress(0); 
        } finally {
          setIsSubmitting(false);
        }
      };
      
      const handleDeletePlaylist = async () => {
        if (!initialPlaylist || !user) return;
        setIsDeleting(true);
        try {
          await supabase.from('playlist_tracks').delete().eq('playlist_id', initialPlaylist.id);
          
          const { error } = await supabase
            .from('playlists')
            .delete()
            .eq('id', initialPlaylist.id)
            .eq('creator_id', user.id); 
          
          if (error) throw error;

          toast({ title: 'Playlist Deleted', description: `"${initialPlaylist?.title || 'Playlist'}" has been successfully deleted.`, variant: 'success' });
          if (onPlaylistDeleted) onPlaylistDeleted(initialPlaylist.id);
          setIsConfirmDeleteOpen(false);
          onOpenChange(false);
          navigate('/hub', { state: { defaultTab: 'content', defaultContentTab: 'playlists' } });
        } catch (error) {
          console.error('Error deleting playlist:', error);
          toast({ title: 'Deletion Failed', description: error.message || 'Could not delete playlist.', variant: 'error' });
        } finally {
          setIsDeleting(false);
        }
      };

      if (isLoadingPlaylist) {
        return (
          <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl glass-effect-light text-white flex items-center justify-center min-h-[300px]">
              <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
              <p className="ml-4 text-lg">Loading playlist...</p>
            </DialogContent>
          </Dialog>
        );
      }
      if (!initialPlaylist && isOpen) return null;

      const isSubmitDisabled = isSubmitting || !playlistData.title?.trim();

      return (
        <>
          <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl glass-effect-light text-white overflow-y-auto max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center"><ListMusic className="w-6 h-6 mr-3 text-yellow-400" />Edit Playlist: {initialPlaylist?.title}</DialogTitle>
                <DialogDescription className="text-gray-400 pt-2">Modify details and manage tracks for your playlist.</DialogDescription>
              </DialogHeader>

              {isSubmitting && <Progress value={overallProgress} className="w-full h-2 bg-gray-700 [&>div]:bg-yellow-400 mb-4" />}
              
              <form onSubmit={handleSubmit} className="space-y-6 py-4 px-2">
                <PlaylistMetadataForm
                  playlistData={playlistData}
                  onInputChange={handleInputChange}
                  onFileChange={handleFileChange}
                  coverArtPreview={coverArtPreview}
                  isSubmitting={isSubmitting}
                  onVideoCoverArtChange={handleVideoCoverArtChange}
                  videoCoverArtUrl={playlistData.video_cover_art_url}
                  userId={user?.id}
                />
                <PlaylistTrackManager
                  currentTracks={currentTracks}
                  tracksToAdd={tracksToAdd}
                  onRemoveExistingTrack={handleRemoveExistingTrack}
                  onRemoveStagedTrack={handleRemoveStagedTrack}
                  onSelectTracksForStaging={handleSelectTracksForStaging}
                  isSubmitting={isSubmitting}
                />
                <DialogFooter className="sm:justify-between pt-6 border-t border-white/10">
                  <Button type="button" variant="destructive" onClick={() => setIsConfirmDeleteOpen(true)} disabled={isSubmitting || isDeleting}>
                    {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Delete Playlist
                  </Button>
                  <div className="flex space-x-2">
                    <DialogClose asChild>
                      <Button type="button" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmitDisabled} className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button">
                      {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Changes
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <ConfirmationDialog
            isOpen={isConfirmDeleteOpen}
            onOpenChange={setIsConfirmDeleteOpen}
            onConfirm={handleDeletePlaylist}
            title="Confirm Playlist Deletion"
            description={`Are you sure you want to delete the playlist "${initialPlaylist?.title}"? This action cannot be undone.`}
            confirmText="Delete Playlist"
            isConfirming={isDeleting}
          />
        </>
      );
    };

    export default EditPlaylistModal;
