import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Disc, Save, Loader2, UploadCloud, Music, PlusCircle, Trash2, GripVertical } from 'lucide-react';
import { uploadFileToSupabase } from '@/components/formUtils';
import { parseBlob } from 'music-metadata-browser';
import VideoCoverArtSelector from '@/components/formElements/VideoCoverArtSelector';

const MAX_BATCH = 25;

const EditAlbumModal = ({ isOpen, onOpenChange, album, onAlbumUpdated }) => {
  const { user, profile } = useAuth();

  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverArtFile, setCoverArtFile] = useState(null);
  const [coverArtPreview, setCoverArtPreview] = useState(null);

  // ==== NUEVO: gestión de “Add tracks to album”
  const [filesQueue, setFilesQueue] = useState([]); // [{file, meta: {...}, progress, status}]
  const [isUploadingTracks, setIsUploadingTracks] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    if (album) {
      setFormData({
        title: album.title || '',
        genre: album.genre || '',
        release_date: album.release_date ? album.release_date.split('T')[0] : '',
        languages: album.languages ? album.languages.join(', ') : '',
        is_public: album.is_public !== undefined ? album.is_public : true,
        artwork_is_not_explicit: album.artwork_is_not_explicit !== undefined ? album.artwork_is_not_explicit : true,
        artwork_ai_generated: album.artwork_ai_generated !== undefined ? album.artwork_ai_generated : false,
        video_cover_art_url: album.video_cover_art_url || '',
      });
      setCoverArtPreview(album.cover_art_url || null);
    } else {
      setFormData({
        is_public: true,
        artwork_is_not_explicit: true,
        artwork_ai_generated: false,
        video_cover_art_url: '',
      });
      setCoverArtPreview(null);
    }
    setCoverArtFile(null);
    setFilesQueue([]); // limpia cola al abrir/cambiar álbum
  }, [album, isOpen]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: (type === 'checkbox' || type === 'switch') ? checked : value }));
  };

  const handleSwitchChange = (name, checked) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverArtFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setCoverArtPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setCoverArtFile(null);
      setCoverArtPreview(album?.cover_art_url || null);
    }
  };

  const handleVideoCoverArtChange = (videoUrl) => {
    setFormData(prev => ({ ...prev, video_cover_art_url: videoUrl || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!album || !user || !profile) {
      toast({ title: 'Error', description: 'User or album data missing.', variant: 'error' });
      return;
    }
    setIsSubmitting(true);

    let updatedFields = {};
    const currentAlbum = album;

    Object.keys(formData).forEach(key => {
      let formValue = formData[key];
      let albumValue = currentAlbum[key];
      if (key === 'languages' && typeof formValue === 'string') {
        formValue = formValue.split(',').map(lang => lang.trim()).filter(Boolean);
      }
      if (key === 'languages' && Array.isArray(albumValue) && Array.isArray(formValue)) {
        if (JSON.stringify([...formValue].sort()) !== JSON.stringify([...albumValue].sort())) {
          updatedFields[key] = formValue;
        }
      } else if (formValue !== albumValue) {
        updatedFields[key] = formValue;
      }
    });

    const normalizedFormVideo = formData.video_cover_art_url || null;
    const normalizedAlbumVideo = album.video_cover_art_url || null;
    if (normalizedFormVideo !== normalizedAlbumVideo) {
      updatedFields.video_cover_art_url = normalizedFormVideo;
    }

    try {
      if (coverArtFile) {
        const newCoverArtUrl = await uploadFileToSupabase(coverArtFile, 'album-covers', user.id, true);
        if (newCoverArtUrl) updatedFields.cover_art_url = newCoverArtUrl;
      }

      if (Object.keys(updatedFields).length > 0) {
        updatedFields.updated_at = new Date().toISOString();
        const { data, error } = await supabase
          .from('albums')
          .update(updatedFields)
          .eq('id', album.id)
          .eq('uploader_id', user.id)
          .select()
          .single();
        if (error) throw error;
        toast({ title: 'Album Updated!', description: `"${data.title}" has been successfully updated.`, variant: 'success' });
        onAlbumUpdated?.(data);
      } else {
        toast({ title: 'No Changes Detected', description: 'No fields were modified.', variant: 'info' });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error updating album:', error);
      toast({ title: 'Update Failed', description: error.message || 'Could not update album.', variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========= Drag & Drop Handlers =========
  useEffect(() => {
    const node = dropRef.current;
    if (!node) return;

    const preventDefaults = (e) => { e.preventDefault(); e.stopPropagation(); };
    const onDrop = async (e) => {
      preventDefaults(e);
      const incoming = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('audio/'));
      if (incoming.length === 0) {
        toast({ title: 'No audio files', description: 'Drop audio files (mp3/wav) here.', variant: 'error' });
        return;
      }
      await enqueueFiles(incoming);
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => node.addEventListener(ev, preventDefaults));
    node.addEventListener('drop', onDrop);
    return () => {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => node.removeEventListener(ev, preventDefaults));
      node.removeEventListener('drop', onDrop);
    };
  }, []);

  const handlePickFiles = async (e) => {
    const incoming = [...(e.target.files || [])].filter(f => f.type.startsWith('audio/'));
    if (incoming.length === 0) {
      toast({ title: 'No audio files', description: 'Select audio files (mp3/wav).', variant: 'error' });
      return;
    }
    await enqueueFiles(incoming);
    e.target.value = ''; // permite seleccionar los mismos archivos otra vez si quiere
  };

  const readMetadata = async (file) => {
    try {
      const metadata = await parseBlob(file);
      const common = metadata.common || {};
      const format = metadata.format || {};
      const title = common.title || file.name.replace(/\.[^/.]+$/, '');
      const artist = (common.artist || common.artists?.[0] || profile?.display_name || profile?.username || 'Unknown Artist');
      const trackNo = (common.track && (common.track.no || common.track.no === 0) ? common.track.no : null);
      const durationSec = format.duration ? Math.round(format.duration) : null;
      return {
        title,
        artist,
        track_number_on_album: trackNo || null,
        duration: durationSec
      };
    } catch {
      // Fallback mínimo si no hay ID3
      return {
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: profile?.display_name || profile?.username || 'Unknown Artist',
        track_number_on_album: null,
        duration: null
      };
    }
  };

  const enqueueFiles = async (fileList) => {
    if (!user) {
      toast({ title: 'Login required', description: 'Please log in to add tracks.', variant: 'error' });
      return;
    }
    const limited = fileList.slice(0, MAX_BATCH - filesQueue.length);
    if (filesQueue.length + limited.length > MAX_BATCH) {
      toast({ title: 'Batch limited', description: `Max ${MAX_BATCH} files per batch.`, variant: 'info' });
    }

    const metas = await Promise.all(limited.map(readMetadata));
    const queued = limited.map((file, idx) => ({
      id: `${Date.now()}_${idx}_${Math.random().toString(16).slice(2)}`,
      file,
      meta: metas[idx],
      progress: 0,
      status: 'queued' // queued | uploading | done | error
    }));
    setFilesQueue(prev => [...prev, ...queued]);
  };

  const removeQueuedItem = (id) => {
    setFilesQueue(prev => prev.filter(f => f.id !== id));
  };

  const reorderQueue = (fromIndex, toIndex) => {
    setFilesQueue(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return arr;
    });
  };

  // Subida + creación de tracks + asignación a álbum
  const handleAddTracksToAlbum = async () => {
    if (!album || !user || !profile) {
      toast({ title: 'Missing data', description: 'Album or user not ready.', variant: 'error' });
      return;
    }
    if (filesQueue.length === 0) {
      toast({ title: 'No files', description: 'Add audio files first.', variant: 'error' });
      return;
    }

    setIsUploadingTracks(true);

    try {
      const createdTrackIds = [];

      // 1) Subir cada archivo y crear track
      for (let i = 0; i < filesQueue.length; i++) {
        const item = filesQueue[i];
        try {
          setFilesQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading', progress: 10 } : f));

          // 1a) Subir audio
          const audio_url = await uploadFileToSupabase(item.file, 'track-audio', user.id, false, (p) => {
            setFilesQueue(prev => prev.map(f => f.id === item.id ? { ...f, progress: Math.max(10, Math.min(90, Math.round(p))) } : f));
          });
          if (!audio_url) throw new Error('Audio upload failed');

          // 1b) Crear track (usa cover del álbum si no hay otra)
          const trackPayload = {
            uploader_id: user.id,
            creator_display_name: profile.display_name || profile.username || 'Unknown Artist',
            title: item.meta?.title || item.file.name.replace(/\.[^/.]+$/, ''),
            genre: album.genre || null,
            languages: Array.isArray(album.languages) ? album.languages : (typeof album.languages === 'string' ? album.languages.split(',').map(s => s.trim()).filter(Boolean) : []),
            release_date: album.release_date || null,
            track_number_on_album: item.meta?.track_number_on_album || null,
            is_christian_nature: true,
            is_instrumental: false,
            ai_in_production: false,
            ai_in_artwork: false,
            ai_in_lyrics: false,
            lyrics_text: null,
            lrc_file_path: null,
            audio_file_url: audio_url,
            cover_art_url: album.cover_art_url || null,
            stream_cost: 0.5,
            is_public: true,
            album_id: album.id // pre-asignado: adicional a la RPC de orden
          };

          const { data: newTrack, error: insErr } = await supabase.from('tracks').insert([trackPayload]).select().single();
          if (insErr) throw insErr;

          createdTrackIds.push(newTrack.id);
          setFilesQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done', progress: 100 } : f));
        } catch (err) {
          console.error('Track create error:', err);
          setFilesQueue(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error' } : f));
        }
      }

      if (createdTrackIds.length === 0) {
        toast({ title: 'No tracks created', description: 'All uploads failed.', variant: 'error' });
        setIsUploadingTracks(false);
        return;
      }

      // 2) Asegurar orden consecutivo en el álbum (RPC creada previamente)
      const { error: rpcErr } = await supabase.rpc('add_tracks_to_album', {
        p_album_id: album.id,
        p_track_ids: createdTrackIds,
        p_resequence: true
      });
      if (rpcErr) {
        console.error('add_tracks_to_album error:', rpcErr);
        // No abortamos: ya están creados con album_id; esta RPC solo ajusta track_number
      }

      toast({ title: 'Tracks added', description: `Added ${createdTrackIds.length} track(s) to "${album.title}".`, variant: 'success' });

      // 3) Limpia cola y notifica al padre para refrescar
      setFilesQueue([]);
      // Trae el álbum actualizado (por si cambió algo)
      const { data: refreshed, error: refErr } = await supabase.from('albums').select('*').eq('id', album.id).single();
      if (!refErr && refreshed) onAlbumUpdated?.(refreshed);

    } catch (err) {
      console.error('Batch add error:', err);
      toast({ title: 'Failed adding tracks', description: err.message || 'Unexpected error.', variant: 'error' });
    } finally {
      setIsUploadingTracks(false);
    }
  };

  // UI helpers
  const statusChip = (s) => {
    if (s === 'done') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">Done</span>;
    if (s === 'uploading') return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">Uploading</span>;
    if (s === 'error') return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">Error</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-300">Queued</span>;
  };

  if (!album) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl glass-effect-light text-white overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Disc className="w-6 h-6 mr-3 text-yellow-400" />
            Edit Album: {album.title}
          </DialogTitle>
          <DialogDescription className="text-gray-400 pt-2">
            Update album info below. Use “Add tracks to album” to drop multiple audio files and auto-fill metadata.
          </DialogDescription>
        </DialogHeader>

        {/* ===== Formulario de datos del álbum (existente) ===== */}
        <form onSubmit={handleSubmit} className="space-y-6 py-4 px-2">
          <div className="space-y-2">
            <Label htmlFor="edit_album_title" className="text-gray-300">Title</Label>
            <Input id="edit_album_title" name="title" value={formData.title || ''} onChange={handleInputChange} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="edit_album_genre" className="text-gray-300">Genre</Label>
              <Input id="edit_album_genre" name="genre" value={formData.genre || ''} onChange={handleInputChange} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_album_release_date" className="text-gray-300">Release Date</Label>
              <Input id="edit_album_release_date" name="release_date" type="date" value={formData.release_date || ''} onChange={handleInputChange} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_album_languages" className="text-gray-300">Languages (comma-separated)</Label>
            <Input id="edit_album_languages" name="languages" value={formData.languages || ''} onChange={handleInputChange} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
          </div>

          <div className="space-y-3">
            <Label className="text-gray-300">Cover Art</Label>
            {coverArtPreview && <img-replace src={coverArtPreview} alt="Cover art preview" className="w-32 h-32 object-cover rounded-md border border-white/20" />}
            <Input id="edit_album_cover_art_url" type="file" accept="image/*" onChange={handleFileChange} className="bg-white/5 border-white/10 text-gray-400 file:text-yellow-400 hover:file:bg-yellow-400/10" />
            <p className="text-xs text-gray-500">Upload new to replace. Bucket: album-covers.</p>
          </div>

          <div className="space-y-2">
            <VideoCoverArtSelector
              userId={user?.id}
              value={formData.video_cover_art_url}
              onChange={handleVideoCoverArtChange}
              disabled={isSubmitting}
              label="Album Video Cover Art (up to 20s loop, optional)"
              note="When present, this becomes the primary cover art and is inherited by tracks unless they override it."
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-white/10">
            <h4 className="text-md font-semibold text-yellow-400">Album Settings</h4>
            <div className="flex items-center space-x-2">
              <Switch id="edit_album_is_public" name="is_public" checked={!!formData.is_public} onCheckedChange={(checked) => handleSwitchChange('is_public', checked)} className="data-[state=checked]:bg-yellow-400" />
              <Label htmlFor="edit_album_is_public" className="text-gray-300 cursor-pointer">Publicly Visible</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="edit_album_artwork_is_not_explicit" name="artwork_is_not_explicit" checked={!!formData.artwork_is_not_explicit} onCheckedChange={(checked) => handleSwitchChange('artwork_is_not_explicit', checked)} className="data-[state=checked]:bg-yellow-400" />
              <Label htmlFor="edit_album_artwork_is_not_explicit" className="text-gray-300 cursor-pointer">Artwork is NOT Explicit</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="edit_album_artwork_ai_generated" name="artwork_ai_generated" checked={!!formData.artwork_ai_generated} onCheckedChange={(checked) => handleSwitchChange('artwork_ai_generated', checked)} className="data-[state=checked]:bg-yellow-400" />
              <Label htmlFor="edit_album_artwork_ai_generated" className="text-gray-300 cursor-pointer">Artwork is AI Generated</Label>
            </div>
          </div>

          <DialogFooter className="sm:justify-end pt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-white/10 border-white/20 text-white hover:bg-white/20">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>

        {/* ===== NUEVA SECCIÓN: Add tracks to album (drag&drop + autofill) ===== */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold golden-text flex items-center">
              <Music className="w-5 h-5 mr-2 text-yellow-400" />
              Add tracks to album
            </h4>
            <span className="text-xs text-gray-400">{filesQueue.length}/{MAX_BATCH} in queue</span>
          </div>

          <div
            ref={dropRef}
            className="w-full border-2 border-dashed border-yellow-500/40 rounded-xl p-4 sm:p-6 text-center bg-black/30 hover:bg-black/40 transition-colors"
          >
            <UploadCloud className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
            <p className="text-sm text-gray-300">Drag & drop audio files here (MP3/WAV) or</p>
            <div className="mt-2">
              <label className="inline-block">
                <span className="sr-only">Pick files</span>
                <Input type="file" accept="audio/*" multiple onChange={handlePickFiles} className="hidden" />
                <span className="inline-flex items-center px-3 py-2 rounded-md bg-white/10 text-sm text-yellow-300 hover:bg-white/20 cursor-pointer">
                  Choose Files
                </span>
              </label>
            </div>
          </div>

          {/* Cola de archivos */}
          {filesQueue.length > 0 && (
            <div className="mt-4 space-y-2">
              {filesQueue.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <button
                    type="button"
                    className="p-1 text-gray-500 hover:text-yellow-300 active:scale-95"
                    onClick={() => {
                      if (idx > 0) reorderQueue(idx, idx - 1);
                    }}
                    title="Move up"
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {item.meta?.title || item.file.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {(item.meta?.artist ? `${item.meta.artist} • ` : '')}
                      {item.file.name} {(item.meta?.duration ? `• ${item.meta.duration}s` : '')}
                    </p>
                    <div className="w-full h-1.5 bg-gray-700 rounded mt-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-400 to-amber-500"
                        style={{ width: `${item.progress || 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusChip(item.status)}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => removeQueuedItem(item.id)}
                      disabled={isUploadingTracks}
                      title="Remove from queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity mt-2"
                  onClick={handleAddTracksToAlbum}
                  disabled={isUploadingTracks || filesQueue.length === 0}
                >
                  {isUploadingTracks ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                  Add {filesQueue.length} to album
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditAlbumModal;
