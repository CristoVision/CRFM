import React, { useState, useEffect } from 'react';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { Label } from '@/components/ui/label';
    import { Switch } from '@/components/ui/switch';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
    import { Edit3, Loader2, CheckCircle } from 'lucide-react';
    import MultiSelectCombobox from '@/components/formElements/MultiSelectCombobox';
    import { defaultLanguages } from '@/components/formUtils';
    import FileUploadProgress from '@/components/formElements/FileUploadProgress';

    const VIDEO_BUCKET = 'video';
    const COVER_ART_BUCKET = 'video';

    const EditMusicVideoModal = ({ isOpen, onOpenChange, video, onVideoUpdated }) => {
      const { user } = useAuth();
      const [formData, setFormData] = useState({
        title: '',
        description: '',
        language: '',
        is_public: true,
      });
      const [newVideoFile, setNewVideoFile] = useState(null);
      const [newCoverArtFile, setNewCoverArtFile] = useState(null);
      
      const [videoUploadProgress, setVideoUploadProgress] = useState(0);
      const [coverArtUploadProgress, setCoverArtUploadProgress] = useState(0);
      const [isVideoUploading, setIsVideoUploading] = useState(false);
      const [isCoverArtUploading, setIsCoverArtUploading] = useState(false);
      const [isVideoUploadComplete, setIsVideoUploadComplete] = useState(false);
      const [isCoverArtUploadComplete, setIsCoverArtUploadComplete] = useState(false);

      const [isSubmitting, setIsSubmitting] = useState(false);
      const [errors, setErrors] = useState({});

      useEffect(() => {
        if (video) {
          setFormData({
            title: video.title || '',
            description: video.description || '',
            language: video.language || '',
            is_public: video.is_public === undefined ? true : video.is_public,
          });
          setNewVideoFile(null);
          setNewCoverArtFile(null);
          setVideoUploadProgress(0);
          setCoverArtUploadProgress(0);
          setIsVideoUploadComplete(false);
          setIsCoverArtUploadComplete(false);
          setErrors({});
        }
      }, [video, isOpen]);

      const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
          ...prev,
          [name]: type === 'checkbox' ? checked : value
        }));
      };
      
      const handleLanguageChange = (selectedOptions) => {
        setFormData(prev => ({ ...prev, language: selectedOptions[0]?.value || '' }));
      };

      const handleFileChange = (e, setFile, setProgress, setComplete, setIsUploading, fileType) => {
        const file = e.target.files[0];
        if (file) {
          if (fileType === 'video' && !file.type.startsWith('video/')) {
            toast({ title: "Invalid File Type", description: "Please upload a valid video file.", variant: "destructive" });
            return;
          }
          if (fileType === 'cover_art' && !file.type.startsWith('image/')) {
            toast({ title: "Invalid File Type", description: "Please upload a valid image file for the cover art.", variant: "destructive" });
            return;
          }
          setFile(file);
          setProgress(0);
          setComplete(false);
          setIsUploading(false);
        }
      };

      const validateForm = () => {
        const newErrors = {};
        if (!formData.title.trim()) newErrors.title = 'Title is required.';
        if (formData.title.length > 200) newErrors.title = 'Title must be 200 characters or less.';
        if (!formData.description.trim()) newErrors.description = 'Description is required.';
        if (formData.description.length > 1000) newErrors.description = 'Description must be 1000 characters or less.';
        if (!formData.language) newErrors.language = 'Language is required.';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
      };

      const uploadFile = async (file, bucket, progressSetter, completeSetter, uploadingSetter, fileTypeForToast) => {
        if (!file || !user) return null;
        uploadingSetter(true);
        progressSetter(0);
        completeSetter(false);

        const sanitizedName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
        const filePath = `${user.id}/${Date.now()}_${sanitizedName}`;
        
        try {
          const { error } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type,
              onUploadProgress: (event) => {
                if (event.lengthComputable) {
                  const percentLoaded = Math.round((event.loaded / event.total) * 100);
                  progressSetter(percentLoaded);
                }
              }
            });

          if (error) throw error;
          
          progressSetter(100);
          completeSetter(true);
          toast({ title: `${fileTypeForToast} Upload Successful`, variant: "success" });
          
          return filePath;

        } catch (error) {
          console.error(`Error uploading ${fileTypeForToast}:`, error);
          toast({ title: `Error Uploading ${fileTypeForToast}`, description: error.message, variant: "destructive" });
          progressSetter(0);
          return null;
        } finally {
          uploadingSetter(false);
        }
      };

      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm() || !user || !video) return;

        setIsSubmitting(true);
        let updatedVideoStoragePath = video.storage_path;
        let updatedCoverArtUrl = video.cover_art_url;

        if (newVideoFile) {
          updatedVideoStoragePath = await uploadFile(newVideoFile, VIDEO_BUCKET, setVideoUploadProgress, setIsVideoUploadComplete, setIsVideoUploading, 'Video');
          if (!updatedVideoStoragePath) {
            setIsSubmitting(false);
            return;
          }
        }

        if (newCoverArtFile) {
          const newCoverArtPath = await uploadFile(newCoverArtFile, COVER_ART_BUCKET, setCoverArtUploadProgress, setIsCoverArtUploadComplete, setIsCoverArtUploading, 'Cover Art');
          if (newCoverArtPath) {
            const { data: publicUrlData } = supabase.storage.from(COVER_ART_BUCKET).getPublicUrl(newCoverArtPath);
            updatedCoverArtUrl = publicUrlData.publicUrl;
          } else {
            setIsSubmitting(false);
            return;
          }
        }
        
        try {
          const updateData = {
            ...formData,
            storage_path: updatedVideoStoragePath,
            cover_art_url: updatedCoverArtUrl,
            updated_at: new Date().toISOString(),
          };

          const { data, error } = await supabase
            .from('videos')
            .update(updateData)
            .eq('id', video.id)
            .eq('uploader_id', user.id)
            .select()
            .single();

          if (error) throw error;

          toast({ title: "Music Video Updated!", description: `"${data.title}" has been successfully updated.`, variant: "success" });
          onVideoUpdated(data);
          onOpenChange(false);
        } catch (error) {
          console.error('Error updating video:', error);
          toast({ title: "Error Updating Video", description: error.message, variant: "destructive" });
        } finally {
          setIsSubmitting(false);
        }
      };

      if (!video) return null;

      return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!isSubmitting) onOpenChange(open); }}>
          <DialogContent className="sm:max-w-2xl glass-effect text-white border-yellow-500/30">
            <DialogHeader>
              <DialogTitle className="flex items-center text-2xl golden-text">
                <Edit3 className="w-7 h-7 mr-3" /> Edit Music Video
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <div>
                <Label htmlFor="edit-video-title" className="text-gray-300">Title</Label>
                <Input id="edit-video-title" name="title" value={formData.title} onChange={handleInputChange} placeholder="Enter video title" className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
                {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title}</p>}
              </div>

              <div>
                <Label htmlFor="edit-video-description" className="text-gray-300">Description</Label>
                <Textarea id="edit-video-description" name="description" value={formData.description} onChange={handleInputChange} placeholder="Describe your music video" className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" rows={3} />
                {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="edit-video-language" className="text-gray-300">Language</Label>
                   <MultiSelectCombobox
                    options={defaultLanguages}
                    selected={formData.language ? [{value: formData.language, label: formData.language}] : []}
                    onChange={handleLanguageChange}
                    placeholder="Select language"
                    className="w-full"
                  />
                  {errors.language && <p className="text-red-400 text-xs mt-1">{errors.language}</p>}
                </div>
                <div>
                  <Label className="text-gray-300">Cost (CrossCoins)</Label>
                  <div className="p-2 h-10 flex items-center rounded-md bg-white/5 border border-white/10 text-white font-semibold">
                    0.5
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Stream cost is fixed and cannot be edited.</p>
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-video-file" className="text-gray-300 block mb-1">Replace Video File (Optional)</Label>
                <Input id="edit-video-file" type="file" accept="video/*" onChange={(e) => handleFileChange(e, setNewVideoFile, setVideoUploadProgress, setIsVideoUploadComplete, setIsVideoUploading, 'video')} className="text-gray-400 file:text-yellow-400 file:font-semibold hover:file:bg-yellow-400/10" />
                {newVideoFile && <FileUploadProgress file={newVideoFile} progress={videoUploadProgress} uploadComplete={isVideoUploadComplete} onCancel={() => { setNewVideoFile(null); setVideoUploadProgress(0); setIsVideoUploadComplete(false); }} />}
                {video.storage_path && !newVideoFile && <p className="text-xs text-gray-400 mt-1">Current file: <span className="font-mono text-yellow-300/80">{video.storage_path.split('/').pop()}</span></p>}
              </div>

              <div>
                <Label htmlFor="edit-cover-art-file" className="text-gray-300 block mb-1">Replace Cover Art (Optional)</Label>
                <Input id="edit-cover-art-file" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setNewCoverArtFile, setCoverArtUploadProgress, setIsCoverArtUploadComplete, setIsCoverArtUploading, 'cover_art')} className="text-gray-400 file:text-yellow-400 file:font-semibold hover:file:bg-yellow-400/10" />
                {newCoverArtFile && <FileUploadProgress file={newCoverArtFile} progress={coverArtUploadProgress} uploadComplete={isCoverArtUploadComplete} onCancel={() => { setNewCoverArtFile(null); setCoverArtUploadProgress(0); setIsCoverArtUploadComplete(false); }} />}
                 {!newCoverArtFile && video.cover_art_url && <p className="text-xs text-gray-400 mt-1">Current cover art: <a href={video.cover_art_url} target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:underline">View</a></p>}
              </div>

              <div className="flex items-center space-x-3">
                <Switch id="edit-video-public" name="is_public" checked={formData.is_public} onCheckedChange={(checked) => setFormData(prev => ({...prev, is_public: checked}))} className="data-[state=checked]:bg-yellow-500"/>
                <Label htmlFor="edit-video-public" className="text-gray-300">Make Publicly Available</Label>
              </div>

              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="bg-white/10 border-white/20 text-gray-300 hover:bg-white/20" disabled={isSubmitting}>Cancel</Button>
                </DialogClose>
                <Button type="submit" className="golden-gradient text-black font-semibold hover:opacity-90" disabled={isSubmitting || isVideoUploading || isCoverArtUploading}>
                  {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      );
    };

    export default EditMusicVideoModal;
