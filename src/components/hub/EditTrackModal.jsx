import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Music, Save, Loader2 } from 'lucide-react';
import { uploadFileToSupabase } from '@/components/formUtils'; 
import VideoCoverArtSelector from '@/components/formElements/VideoCoverArtSelector';

    const EditTrackModal = ({ isOpen, onOpenChange, track, onTrackUpdated }) => {
      const { user, profile } = useAuth(); 
      const [formData, setFormData] = useState({});
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [coverArtFile, setCoverArtFile] = useState(null);
      const [audioFile, setAudioFile] = useState(null);
      const [coverArtPreview, setCoverArtPreview] = useState(null);

      useEffect(() => {
        if (track) {
          setFormData({
            title: track.title || '',
            genre: track.genre || '',
            release_date: track.release_date ? track.release_date.split('T')[0] : '',
            languages: track.languages ? track.languages.join(', ') : '',
            lyrics_text: track.lyrics_text || '',
            lrc_file_path: track.lrc_file_path || '',
            is_public: track.is_public !== undefined ? track.is_public : true,
            is_christian_nature: track.is_christian_nature !== undefined ? track.is_christian_nature : false,
            is_instrumental: track.is_instrumental !== undefined ? track.is_instrumental : false,
            ai_in_artwork: track.ai_in_artwork !== undefined ? track.ai_in_artwork : false,
            ai_in_production: track.ai_in_production !== undefined ? track.ai_in_production : false,
            ai_in_lyrics: track.ai_in_lyrics !== undefined ? track.ai_in_lyrics : false,
            track_number_on_album: track.track_number_on_album || 1,
            video_cover_art_url: track.video_cover_art_url || '',
          });
          setCoverArtPreview(track.cover_art_url);
        } else {
          setFormData({ is_public: true, track_number_on_album: 1, is_instrumental: false, video_cover_art_url: '' }); 
          setCoverArtPreview(null);
        }
        setCoverArtFile(null);
        setAudioFile(null);
      }, [track, isOpen]);

      const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
      };

      const handleFileChange = (e, fileType) => {
        const file = e.target.files[0];
        if (file) {
          if (fileType === 'coverArt') {
            setCoverArtFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setCoverArtPreview(reader.result);
            reader.readAsDataURL(file);
          } else if (fileType === 'audio') {
            setAudioFile(file);
          }
        } else {
          if (fileType === 'coverArt') {
            setCoverArtFile(null);
            setCoverArtPreview(track?.cover_art_url || null); 
          } else if (fileType === 'audio') {
            setAudioFile(null);
          }
        }
      };

      const handleVideoCoverArtChange = (videoUrl) => {
        setFormData(prev => ({ ...prev, video_cover_art_url: videoUrl || '' }));
      };

      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!track || !user || !profile) {
            toast({ title: 'Error', description: 'User or track data missing.', variant: 'error' });
            return;
        }
        setIsSubmitting(true);

        let updatedFields = {};
        const currentTrack = track;

        Object.keys(formData).forEach(key => {
          let formValue = formData[key];
          let trackValue = currentTrack[key];

          if (key === 'languages' && typeof formValue === 'string') {
            formValue = formValue.split(',').map(lang => lang.trim()).filter(Boolean);
          }
          if (key === 'track_number_on_album') {
            formValue = parseInt(formValue, 10);
            if (isNaN(formValue)) formValue = currentTrack.track_number_on_album; 
          }

          if (key === 'languages' && Array.isArray(trackValue) && Array.isArray(formValue)) {
             if (JSON.stringify(formValue.sort()) !== JSON.stringify(trackValue.sort())) {
                updatedFields[key] = formValue;
             }
          } else if (formValue !== trackValue) {
            updatedFields[key] = formValue;
          }
        });

        const normalizedFormVideo = formData.video_cover_art_url || null;
        const normalizedTrackVideo = track.video_cover_art_url || null;
        if (normalizedFormVideo !== normalizedTrackVideo) {
          updatedFields.video_cover_art_url = normalizedFormVideo;
        }
        
        try {
          if (coverArtFile) {
            const newCoverArtUrl = await uploadFileToSupabase(coverArtFile, 'track-cover', user.id, true);
            if (newCoverArtUrl) updatedFields.cover_art_url = newCoverArtUrl;
          }
          if (audioFile) {
            const newAudioFileUrl = await uploadFileToSupabase(audioFile, 'track-audio', user.id, false);
            if (newAudioFileUrl) updatedFields.audio_file_url = newAudioFileUrl;
          }
          
          if (Object.keys(updatedFields).length > 0) {
            updatedFields.updated_at = new Date().toISOString();

            const { data, error } = await supabase
              .from('tracks')
              .update(updatedFields)
              .eq('id', track.id)
              .eq('uploader_id', user.id)
              .select()
              .single();

            if (error) throw error;
            
            toast({ title: 'Track Updated!', description: `"${data.title}" has been successfully updated.`, variant: 'success' });
            if (onTrackUpdated) onTrackUpdated(data); 
          } else {
            toast({ title: 'No Changes Detected', description: 'No fields were modified.', variant: 'info' });
          }
          onOpenChange(false); 
        } catch (error) {
          console.error('Error updating track:', error);
          toast({ title: 'Update Failed', description: error.message || 'Could not update track.', variant: 'error' });
        } finally {
          setIsSubmitting(false);
        }
      };
      
      if (!track) return null;

      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-2xl glass-effect-light text-white overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center"><Music className="w-6 h-6 mr-3 text-yellow-400" />Edit Track: {track.title}</DialogTitle>
              <DialogDescription className="text-gray-400 pt-2">Modify the details of your track. Only changed fields will be updated.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 py-4 px-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit_track_title" className="text-gray-300">Title</Label>
                  <Input id="edit_track_title" name="title" value={formData.title || ''} onChange={handleInputChange} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_track_genre" className="text-gray-300">Genre</Label>
                  <Input id="edit_track_genre" name="genre" value={formData.genre || ''} onChange={handleInputChange} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit_track_release_date" className="text-gray-300">Release Date</Label>
                  <Input id="edit_track_release_date" name="release_date" type="date" value={formData.release_date || ''} onChange={handleInputChange} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_track_languages" className="text-gray-300">Languages (comma-separated)</Label>
                  <Input id="edit_track_languages" name="languages" value={formData.languages || ''} onChange={handleInputChange} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit_track_number_on_album" className="text-gray-300">Track Number on Album</Label>
                  <Input id="edit_track_number_on_album" name="track_number_on_album" type="number" min="1" value={formData.track_number_on_album || ''} onChange={handleInputChange} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_lrc_file_path" className="text-gray-300">LRC File Path (Optional)</Label>
                  <Input id="edit_lrc_file_path" name="lrc_file_path" value={formData.lrc_file_path || ''} onChange={handleInputChange} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" placeholder="e.g., /lyrics/track-title.lrc"/>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit_track_lyrics_text" className="text-gray-300">Lyrics</Label>
                <Textarea id="edit_track_lyrics_text" name="lyrics_text" value={formData.lyrics_text || ''} onChange={handleInputChange} rows={6} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-3">
                  <Label className="text-gray-300">Cover Art</Label>
                  {coverArtPreview && <img-replace src={coverArtPreview} alt="Cover art preview" className="w-32 h-32 object-cover rounded-md border border-white/20" />}
                  <Input id="edit_track_cover_art_url" type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'coverArt')} className="bg-white/5 border-white/10 text-gray-400 file:text-yellow-400 hover:file:bg-yellow-400/10" />
                  <p className="text-xs text-gray-500">Upload new to replace. Bucket: track-cover.</p>
                </div>
              <div className="space-y-3">
                <Label className="text-gray-300">Audio File</Label>
                {track.audio_file_url && !audioFile && <p className="text-xs text-green-400 truncate">Current: {track.audio_file_url.split('/').pop()}</p>}
                {audioFile && <p className="text-xs text-yellow-400 truncate">New: {audioFile.name}</p>}
                <Input id="edit_track_audio_file_url" type="file" accept="audio/*" onChange={(e) => handleFileChange(e, 'audio')} className="bg-white/5 border-white/10 text-gray-400 file:text-yellow-400 hover:file:bg-yellow-400/10" />
                <p className="text-xs text-gray-500">Upload new to replace. Bucket: track-audio.</p>
              </div>
            </div>
              
              <div className="space-y-2">
                <VideoCoverArtSelector
                  userId={user?.id}
                  value={formData.video_cover_art_url}
                  onChange={handleVideoCoverArtChange}
                  disabled={isSubmitting}
                  label="Video Cover Art (up to 20s loop, optional)"
                  note="If empty, the album/playlist or static cover art will be shown."
                />
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <h4 className="text-md font-semibold text-yellow-400">Content Declarations</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { id: 'is_public', label: 'Publicly Visible' },
                    { id: 'is_christian_nature', label: 'Christian Nature' },
                    { id: 'is_instrumental', label: 'Instrumental' },
                    { id: 'ai_in_artwork', label: 'AI in Artwork' },
                    { id: 'ai_in_production', label: 'AI in Production' },
                    { id: 'ai_in_lyrics', label: 'AI in Lyrics' },
                  ].map(cb => (
                    <div key={cb.id} className="flex items-center space-x-2">
                      <Checkbox id={`edit_track_${cb.id}`} name={cb.id} checked={!!formData[cb.id]} onCheckedChange={(checked) => handleInputChange({ target: { name: cb.id, checked, type: 'checkbox' }})} className="border-gray-500 data-[state=checked]:bg-yellow-400 data-[state=checked]:border-yellow-500" />
                      <Label htmlFor={`edit_track_${cb.id}`} className="text-gray-300 cursor-pointer">{cb.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="sm:justify-end pt-6">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting} className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      );
    };

    export default EditTrackModal;
