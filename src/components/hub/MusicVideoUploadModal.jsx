import React, { useState, useEffect, useRef } from 'react';
    import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { Label } from '@/components/ui/label';
    import { Switch } from '@/components/ui/switch';
    import { Progress } from '@/components/ui/progress';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
    import { UploadCloud, Loader2 } from 'lucide-react';
    import MultiSelectCombobox from '@/components/formElements/MultiSelectCombobox';
    import { defaultLanguages } from '@/components/formUtils';
    import ConfettiCelebration from '@/components/common/ConfettiCelebration';

    const VIDEO_BUCKET = 'video';
    const COVER_ART_BUCKET = 'video';

    const sanitizeFileName = (filename) => {
      if (!filename) return '';
      const normalized = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const sanitized = normalized
        .replace(/\s+/g, '_')
        .replace(/[()]/g, '_')
        .replace(/[^a-zA-Z0-9_.-]/g, '');
      return sanitized.replace(/__+/g, '_');
    };

    const MusicVideoUploadModal = ({ isOpen, onOpenChange, onVideoUploaded }) => {
      const { user, profile } = useAuth();
      const [title, setTitle] = useState('');
      const [description, setDescription] = useState('');
      const [language, setLanguage] = useState('');
      const [isPublic, setIsPublic] = useState(true);
      const [videoFile, setVideoFile] = useState(null);
      const [coverArtFile, setCoverArtFile] = useState(null);
      
      const [isUploading, setIsUploading] = useState(false);
      const [uploadProgress, setUploadProgress] = useState(0);
      const [uploadStatus, setUploadStatus] = useState('');
      const [showConfetti, setShowConfetti] = useState(false);
      const [errors, setErrors] = useState({});
      const scrollRef = useRef(null);

      const resetForm = () => {
        setTitle('');
        setDescription('');
        setLanguage('');
        setIsPublic(true);
        setVideoFile(null);
        setCoverArtFile(null);
        setErrors({});
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatus('');
        setShowConfetti(false);
      };

      useEffect(() => {
        if (!isOpen) {
          resetForm();
        }
      }, [isOpen]);

      const validateForm = () => {
        const newErrors = {};
        if (!title.trim()) newErrors.title = 'Title is required.';
        if (title.length > 200) newErrors.title = 'Title must be 200 characters or less.';
        if (!description.trim()) newErrors.description = 'Description is required.';
        if (description.length > 1000) newErrors.description = 'Description must be 1000 characters or less.';
        if (!language) newErrors.language = 'Language is required.';
        if (!videoFile) newErrors.videoFile = 'Video file is required.';
        if (!coverArtFile) newErrors.coverArtFile = 'Cover art image is required.';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
      };

      const handleFileChange = (e, setFile, fileType) => {
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
        }
      };
      
      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm() || !user || isUploading) return;

        const sanitizedVideoName = sanitizeFileName(videoFile.name);
        const sanitizedCoverName = sanitizeFileName(coverArtFile.name);

        if (!sanitizedVideoName) {
            toast({ title: "Invalid Video Filename", description: "After sanitization, the video filename is empty. Please rename the file.", variant: "destructive" });
            return;
        }
        if (!sanitizedCoverName) {
            toast({ title: "Invalid Cover Art Filename", description: "After sanitization, the cover art filename is empty. Please rename the file.", variant: "destructive" });
            return;
        }

        setIsUploading(true);
        setShowConfetti(false);
        setUploadProgress(0);
        setUploadStatus('Preparing upload...');
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

        try {
            setUploadStatus(`Uploading video: ${sanitizedVideoName}`);
            const videoPath = `${user.id}/${Date.now()}_${sanitizedVideoName}`;
            const { error: videoError } = await supabase.storage
                .from(VIDEO_BUCKET)
                .upload(videoPath, videoFile, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: videoFile.type,
                    onUploadProgress: (event) => {
                        if (event.lengthComputable) {
                            const percent = (event.loaded / event.total) * 100;
                            setUploadProgress(percent * 0.8);
                        }
                    },
                });
            if (videoError) throw new Error(`Video upload failed: ${videoError.message}`);

            setUploadProgress(80);
            setUploadStatus(`Uploading cover art: ${sanitizedCoverName}`);
            const coverPath = `${user.id}/${Date.now()}_${sanitizedCoverName}`;
            const { error: coverError } = await supabase.storage
                .from(COVER_ART_BUCKET)
                .upload(coverPath, coverArtFile, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: coverArtFile.type,
                    onUploadProgress: (event) => {
                        if (event.lengthComputable) {
                            const percent = (event.loaded / event.total) * 100;
                            setUploadProgress(80 + (percent * 0.15));
                        }
                    },
                });
            if (coverError) throw new Error(`Cover art upload failed: ${coverError.message}`);
            const { data: { publicUrl: coverArtUrlValue } } = supabase.storage.from(COVER_ART_BUCKET).getPublicUrl(coverPath);

            setUploadProgress(95);
            setUploadStatus('Finalizing...');

            const videoData = {
                uploader_id: user.id,
                title,
                description,
                language,
                cost_cc: 0.5,
                is_public: isPublic,
                cover_art_url: coverArtUrlValue,
                video_type: 'music_video',
                creator_display_name: profile?.username || user.email,
                storage_path: videoPath,
            };

            const { data, error: dbError } = await supabase.from('videos').insert(videoData).select().single();
            if (dbError) throw dbError;
            
            setUploadProgress(100);
            setUploadStatus('Upload Complete! 🎉');
            setShowConfetti(true);

            setTimeout(() => {
                toast({ title: "Music Video Uploaded!", description: `"${data.title}" is now available.`, variant: "success" });
                onVideoUploaded(data);
                onOpenChange(false);
            }, 4000);

        } catch (error) {
            console.error('Error during video upload process:', error);
            toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
            setIsUploading(false);
            setUploadProgress(0);
            setUploadStatus('');
        }
      };

      return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!isUploading) onOpenChange(open); }}>
          <DialogContent className="relative sm:max-w-2xl glass-effect-light text-white border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-yellow-400 via-rose-400 to-red-500" />
            <ConfettiCelebration isActive={showConfetti} />
            <DialogHeader className="pb-3 border-b border-white/10">
              <DialogTitle className="flex items-center text-2xl golden-text">
                <span className="w-11 h-11 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center mr-3">
                  <UploadCloud className="w-6 h-6 text-yellow-300" />
                </span>
                Upload Music Video
              </DialogTitle>
              <DialogDescription className="text-gray-300 pt-1">Upload a video + cover image. Keep the file smaller for the free tier.</DialogDescription>
            </DialogHeader>

            {isUploading && (
                <div className="w-full px-6 pt-2 pb-4">
                    <p className="text-center text-yellow-300 mb-2 font-semibold">{uploadStatus}</p>
                    <Progress value={uploadProgress} className="w-full" />
                </div>
            )}

            <form ref={scrollRef} onSubmit={handleSubmit} className="space-y-6 py-4 pr-4 -mr-2 custom-scrollbar">
              <div className={isUploading ? 'opacity-50 pointer-events-none' : ''}>
                <div>
                  <Label htmlFor="video-title" className="text-gray-300">Title</Label>
                  <Input id="video-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter video title" className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" />
                  {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title}</p>}
                </div>

                <div className="mt-6">
                  <Label htmlFor="video-description" className="text-gray-300">Description</Label>
                  <Textarea id="video-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your music video" className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" rows={3} />
                  {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <Label htmlFor="video-language" className="text-gray-300">Language</Label>
                    <MultiSelectCombobox
                      options={defaultLanguages}
                      selected={language ? [{value: language, label: language}] : []}
                      onChange={(selectedOptions) => setLanguage(selectedOptions[0]?.value || '')}
                      placeholder="Select language"
                      className="w-full"
                    />
                    {errors.language && <p className="text-red-400 text-xs mt-1">{errors.language}</p>}
                  </div>
                  <div>
                    <p className="text-gray-300 text-sm">Stream Cost</p>
                    <p className="text-white font-semibold text-lg">0.5 CrossCoins</p>
                    <p className="text-xs text-gray-400">This is a fixed cost for music videos.</p>
                  </div>
                </div>
                
                <div className="mt-6">
                  <Label htmlFor="video-file" className="text-gray-300 block mb-1">Video File (MP4, MOV, etc.)</Label>
                  <Input id="video-file" type="file" accept="video/*" onChange={(e) => handleFileChange(e, setVideoFile, 'video')} className="text-gray-400 file:text-yellow-400 file:font-semibold hover:file:bg-yellow-400/10" />
                  {videoFile && !errors.videoFile && <p className="text-xs text-green-400 mt-1">Selected: {videoFile.name}</p>}
                  {errors.videoFile && <p className="text-red-400 text-xs mt-1">{errors.videoFile}</p>}
                </div>

                <div className="mt-6">
                  <Label htmlFor="cover-art-file" className="text-gray-300 block mb-1">Cover Art Image (JPG, PNG)</Label>
                  <Input id="cover-art-file" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setCoverArtFile, 'cover_art')} className="text-gray-400 file:text-yellow-400 file:font-semibold hover:file:bg-yellow-400/10" />
                  {coverArtFile && !errors.coverArtFile && <p className="text-xs text-green-400 mt-1">Selected: {coverArtFile.name}</p>}
                  {errors.coverArtFile && <p className="text-red-400 text-xs mt-1">{errors.coverArtFile}</p>}
                </div>

                <div className="flex items-center space-x-3 mt-6">
                  <Switch id="video-public" checked={isPublic} onCheckedChange={setIsPublic} className="data-[state=checked]:bg-yellow-500"/>
                  <Label htmlFor="video-public" className="text-gray-300">Make Publicly Available</Label>
                </div>
              </div>

              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="bg-white/10 border-white/20 text-gray-300 hover:bg-white/20" disabled={isUploading}>Cancel</Button>
                </DialogClose>
                <Button type="submit" className="golden-gradient text-black font-semibold hover:opacity-90" disabled={isUploading}>
                  {isUploading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <UploadCloud className="w-5 h-5 mr-2" />}
                  {isUploading ? 'Uploading...' : 'Upload Video'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      );
    };

    export default MusicVideoUploadModal;
