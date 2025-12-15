import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import MultiSelectTrackPicker from '@/components/ui/MultiSelectTrackPicker';
import { uploadFileToSupabase } from '@/components/formUtils';
import VideoCoverArtSelector from '@/components/formElements/VideoCoverArtSelector';
import { ListMusic, PlusCircle, Loader2, Image as ImageIcon } from 'lucide-react';

    const CreatePlaylistModal = ({ isOpen, onOpenChange, onPlaylistCreated }) => {
      const { user } = useAuth();
      const initialFormData = {
        title: '',
        description: '',
        is_public: true,
        coverArtFile: null,
        video_cover_art_url: '',
      };
      const [formData, setFormData] = useState(initialFormData);
      const [selectedTracks, setSelectedTracks] = useState([]);
      const [coverArtPreview, setCoverArtPreview] = useState(null);
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [uploadProgress, setUploadProgress] = useState(0);

      useEffect(() => {
        if (!isOpen) {
          setFormData(initialFormData);
          setSelectedTracks([]);
          setCoverArtPreview(null);
          setUploadProgress(0);
        }
      }, [isOpen]);

      const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
      };

      const handleVideoCoverArtChange = (videoUrl) => {
        setFormData(prev => ({ ...prev, video_cover_art_url: videoUrl || '' }));
      };

      const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
          setFormData(prev => ({ ...prev, coverArtFile: file }));
          const reader = new FileReader();
          reader.onloadend = () => setCoverArtPreview(reader.result);
          reader.readAsDataURL(file);
        } else {
          setFormData(prev => ({ ...prev, coverArtFile: null }));
          setCoverArtPreview(null);
        }
      };
      
      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) return;
        if (!formData.title.trim()) {
          toast({ title: 'Title Required', description: 'Please enter a title for your playlist.', variant: 'error' });
          return;
        }
        setIsSubmitting(true);
        setUploadProgress(0);

        let coverArtUrl = null;
        try {
          // Step 1: Upload cover art if provided
          if (formData.coverArtFile) {
            setUploadProgress(25);
            coverArtUrl = await uploadFileToSupabase(formData.coverArtFile, 'playlist-covers', user.id, true);
            setUploadProgress(50);
          } else {
            setUploadProgress(50); // Skip to 50 if no cover art
          }

          // Step 2: Create playlist row
          const playlistData = {
            creator_id: user.id,
            title: formData.title,
            description: formData.description || null,
            cover_art_url: coverArtUrl,
            video_cover_art_url: formData.video_cover_art_url || null,
            is_public: formData.is_public,
            is_favorites_playlist: false, // Default, not exposed in form
            languages: null, // Default, not exposed in form
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { data: newPlaylist, error: playlistError } = await supabase
            .from('playlists')
            .insert(playlistData)
            .select('id, title') 
            .single();

          if (playlistError) throw playlistError;
          setUploadProgress(75);

          // Step 3: Insert playlist_tracks rows
          if (selectedTracks.length > 0) {
            const playlistTracksData = selectedTracks.map((track, index) => ({
              playlist_id: newPlaylist.id,
              track_id: track.id,
              added_at: new Date().toISOString(),
              order_in_playlist: index + 1, // Basic ordering
            }));
            const { error: tracksError } = await supabase
              .from('playlist_tracks')
              .insert(playlistTracksData);
            if (tracksError) throw tracksError;
          }
          setUploadProgress(100);

          toast({ title: 'Playlist Created!', description: `"${newPlaylist.title}" has been successfully created.`, variant: 'success' });
          if (onPlaylistCreated) onPlaylistCreated({...newPlaylist, cover_art_url: coverArtUrl, video_cover_art_url: formData.video_cover_art_url || null, description: formData.description, is_public: formData.is_public}); // Pass more complete data back
          onOpenChange(false);

        } catch (error) {
          console.error('Error creating playlist:', error);
          toast({ title: 'Creation Failed', description: error.message || 'Could not create playlist.', variant: 'error' });
          setUploadProgress(0); // Reset progress on error
        } finally {
          setIsSubmitting(false);
        }
      };
      
      const isSubmitDisabled = isSubmitting || !formData.title.trim();

      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-2xl glass-effect-light text-white overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center"><ListMusic className="w-6 h-6 mr-3 text-yellow-400" />Create New Playlist</DialogTitle>
              <DialogDescription className="text-gray-400 pt-2">Fill in the details and add tracks to your new playlist.</DialogDescription>
            </DialogHeader>
            
            {isSubmitting && <Progress value={uploadProgress} className="w-full h-2 bg-gray-700 [&>div]:bg-yellow-400 mb-4" />}

            <form onSubmit={handleSubmit} className="space-y-6 py-4 px-2">
              <div className="space-y-2">
                <Label htmlFor="create_playlist_title" className="text-gray-300">Title <span className="text-red-500">*</span></Label>
                <Input id="create_playlist_title" name="title" value={formData.title} onChange={handleInputChange} required className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_playlist_description" className="text-gray-300">Description (Optional)</Label>
                <Textarea id="create_playlist_description" name="description" value={formData.description} onChange={handleInputChange} rows={3} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_playlist_cover_art" className="text-gray-300">Cover Art (Optional)</Label>
                <div className="flex items-center gap-4">
                  {coverArtPreview ? (
                    <img-replace src={coverArtPreview} alt="Cover art preview" className="w-24 h-24 object-cover rounded-md border border-white/20" />
                  ) : (
                    <div className="w-24 h-24 bg-white/5 rounded-md flex items-center justify-center border border-dashed border-white/20">
                      <ImageIcon className="w-10 h-10 text-gray-500" />
                    </div>
                  )}
                  <Input id="create_playlist_cover_art" type="file" accept="image/*" onChange={handleFileChange} className="bg-white/5 border-white/10 text-gray-400 file:text-yellow-400 hover:file:bg-yellow-400/10 flex-1" />
                </div>
                 <p className="text-xs text-gray-500">Upload to bucket: playlist-covers.</p>
              </div>
              
              <div className="space-y-2">
                <VideoCoverArtSelector
                  userId={user?.id}
                  value={formData.video_cover_art_url}
                  onChange={handleVideoCoverArtChange}
                  disabled={isSubmitting}
                  label="Video Cover Art (5s loop for playlist)"
                  note="If set, tracks in this playlist will show this video cover art when they do not have their own."
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox id="create_playlist_is_public" name="is_public" checked={formData.is_public} onCheckedChange={(checked) => handleInputChange({ target: { name: 'is_public', checked, type: 'checkbox' }})} className="border-gray-500 data-[state=checked]:bg-yellow-400 data-[state=checked]:border-yellow-500" />
                <Label htmlFor="create_playlist_is_public" className="text-gray-300 cursor-pointer">Publicly Visible</Label>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Add Tracks</Label>
                <MultiSelectTrackPicker 
                  selectedTracks={selectedTracks} 
                  onSelectedTracksChange={setSelectedTracks}
                  placeholder="Search and select tracks..."
                />
              </div>

              <DialogFooter className="sm:justify-end pt-6 border-t border-white/10">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitDisabled} className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                  Create Playlist
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      );
    };

    export default CreatePlaylistModal;
