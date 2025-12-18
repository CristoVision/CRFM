import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { useNavigate } from 'react-router-dom';
    import { toast } from '@/components/ui/use-toast';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Progress } from '@/components/ui/progress';
    import ConfettiCelebration from '@/components/common/ConfettiCelebration';
    import TrackFormFields from '@/components/formElements/TrackFormFields';
    import AcknowledgementField from '@/components/formElements/AcknowledgementField';
    import { uploadFileToSupabase, validateTrackForm, initialTrackFormData as formUtilsInitialTrackData } from '@/components/formUtils';
    import { UploadCloud, Save, Loader2 } from 'lucide-react';

    const LOCAL_STORAGE_KEY_CREATE_TRACK = 'crfm_create_track_draft';

    const CreateTrackModal = ({ isOpen, onOpenChange, onTrackCreated }) => {
      const { user, profile } = useAuth();
      const navigate = useNavigate();
      
      const getInitialFormData = () => {
        const savedDraft = localStorage.getItem(LOCAL_STORAGE_KEY_CREATE_TRACK);
        if (savedDraft && isOpen) {
          const draft = JSON.parse(savedDraft);
          return {
            ...formUtilsInitialTrackData,
            ...draft,
            release_date: draft.release_date ? new Date(draft.release_date) : null,
            languages: draft.languages || [],
            acknowledgement: draft.acknowledgement || false,
            is_instrumental: draft.is_instrumental || false,
            audioFile: null,
            coverArtFile: null,
          };
        }
        return {...formUtilsInitialTrackData, acknowledgement: false, is_instrumental: false };
      };

      const [formData, setFormData] = useState(getInitialFormData);
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [genres, setGenres] = useState([]);
      const [formErrors, setFormErrors] = useState({});
      const [overallProgress, setOverallProgress] = useState(0);
      const [showConfetti, setShowConfetti] = useState(false);
      const [progressStepMessage, setProgressStepMessage] = useState('');


      useEffect(() => {
        if (isOpen) {
          setFormData(getInitialFormData()); 
          setOverallProgress(0);
          setProgressStepMessage('');
          setShowConfetti(false);
        }
      }, [isOpen]);

      useEffect(() => {
        if (isOpen) {
          const draft = {
            ...formData,
            audioFile: null,
            coverArtFile: null,
            audioUploadProgress: 0,
            coverArtUploadProgress: 0,
            audioUploadComplete: false,
            coverArtUploadComplete: false,
            release_date: formData.release_date ? new Date(formData.release_date).toISOString() : null,
          };
          localStorage.setItem(LOCAL_STORAGE_KEY_CREATE_TRACK, JSON.stringify(draft));
        }
      }, [formData, isOpen]);

      useEffect(() => {
        const fetchGenres = async () => {
          const { data, error } = await supabase.from('tracks').select('genre');
          if (error) {
            console.error('Error fetching genres:', error);
          } else {
            const uniqueGenres = [...new Set(data.map(item => item.genre).filter(Boolean))];
            setGenres(uniqueGenres.map(g => ({ value: g, label: g })));
          }
        };
        if (isOpen) fetchGenres();
      }, [isOpen]);

      const runValidations = useCallback(() => {
        const errors = validateTrackForm(formData);
        if (!formData.acknowledgement) errors.acknowledgement = "You must acknowledge the terms.";
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
      }, [formData]);


      const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (formErrors[name]) {
          setFormErrors(prev => ({ ...prev, [name]: null }));
        }
      };

      const handleDateChange = (name, date) => {
        setFormData(prev => ({ ...prev, [name]: date }));
        if (formErrors[name]) {
          setFormErrors(prev => ({ ...prev, [name]: null }));
        }
      };

      const handleGenreChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value, customGenre: value !== 'Other' ? '' : prev.customGenre }));
        if (formErrors.genre || (value !== 'Other' && formErrors.customGenre)) {
          setFormErrors(prev => ({ ...prev, genre: null, customGenre: null }));
        }
      };
      
      const handleLanguagesChange = (name, selectedOptions) => {
        setFormData(prev => ({ ...prev, [name]: selectedOptions }));
        if (formErrors[name]) {
          setFormErrors(prev => ({ ...prev, [name]: null }));
        }
      };

      const handleFileChange = (e, fileType, isCancel = false) => {
        const file = isCancel ? null : e.target.files[0];
        
        let updatedFormData = { ...formData };

        if (fileType === 'audio') {
            updatedFormData.audioFile = file;
        } else if (fileType === 'coverArt') {
            updatedFormData.coverArtFile = file;
            updatedFormData.coverArtPreviewUrl = null;
        }

        if (file) {
             if (fileType === 'coverArt') {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFormData(prev => ({ ...prev, coverArtPreviewUrl: reader.result, coverArtFile: file }));
                };
                reader.readAsDataURL(file);
            } else {
               setFormData(prev => ({ ...prev, audioFile: file}));
            }

            if (formErrors[fileType === 'audio' ? 'audioFile' : 'coverArtFile']) {
                setFormErrors(prev => ({ ...prev, [fileType === 'audio' ? 'audioFile' : 'coverArtFile']: null }));
            }
        } else {
           setFormData(updatedFormData);
        }
      };

      const handleVideoCoverArtChange = (videoUrl) => {
        setFormData(prev => ({ ...prev, video_cover_art_url: videoUrl || '' }));
      };

      const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.audioFile?.name) {
          toast({ title: "Missing audio file", description: "Please select an audio file before saving.", variant: "error" });
          return;
        }
        if (!formData.coverArtFile?.name) {
          toast({ title: "Missing cover art", description: "Please select a cover image before saving.", variant: "error" });
          return;
        }

        if (!runValidations()) {
          toast({ title: "Validation Error", description: "Please fill all required fields correctly.", variant: "error" });
          return;
        }
        if (!user || !profile) {
          toast({ title: "Authentication Error", description: "User or profile not found. Please log in.", variant: "error" });
          return;
        }
        setIsSubmitting(true);
        setOverallProgress(0);
        setProgressStepMessage("Initializing track creation...");

        try {
          setProgressStepMessage("Uploading audio file...");
          const audio_file_url = await uploadFileToSupabase(formData.audioFile, 'track-audio', user.id, false);
          if (!audio_file_url) throw new Error("Audio file upload failed.");
          setOverallProgress(33);
          setProgressStepMessage("Uploading cover art...");

          const cover_art_url = await uploadFileToSupabase(formData.coverArtFile, 'track-cover', user.id, true);
          if (!cover_art_url) throw new Error("Cover art upload failed.");
          setOverallProgress(66);
          setProgressStepMessage("Saving track information...");

          const trackToInsert = {
            uploader_id: user.id,
            creator_display_name: profile.display_name || profile.username || 'Unknown Artist',
            title: formData.title,
            genre: formData.genre === 'Other' ? formData.customGenre : formData.genre,
            languages: formData.languages.map(lang => lang.value),
            release_date: formData.release_date,
            track_number_on_album: formData.track_number_on_album,
            is_christian_nature: formData.is_christian_nature,
            is_instrumental: formData.is_instrumental,
            ai_in_production: formData.ai_in_production,
            ai_in_artwork: formData.ai_in_artwork,
            ai_in_lyrics: formData.ai_in_lyrics,
            lyrics_text: formData.lyrics_text,
            lrc_file_path: formData.lrc_file_path,
            audio_file_url,
            cover_art_url,
            video_cover_art_url: formData.video_cover_art_url || null,
            stream_cost: 0.5,
            is_public: true, 
          };

          const { data: newTrack, error } = await supabase.from('tracks').insert([trackToInsert]).select().single();
          if (error) throw error;
          setOverallProgress(100);
          setProgressStepMessage("Track created successfully!");
          
          toast({ title: 'Track Uploaded!', description: `"${newTrack.title}" created successfully.`, variant: "success" });
          setShowConfetti(true);
          localStorage.removeItem(LOCAL_STORAGE_KEY_CREATE_TRACK);
          
          setTimeout(() => {
            if (onTrackCreated) onTrackCreated(newTrack);
            onOpenChange(false); 
            navigate('/hub', { state: { defaultTab: 'content', defaultContentTab: 'tracks' } });
          }, 2500);

        } catch (error) {
          console.error('Error creating track:', error);
          toast({ title: 'Upload Failed', description: error.message || 'Could not create track.', variant: 'error' });
          setOverallProgress(0);
          setProgressStepMessage('An error occurred. Please try again.');
          setIsSubmitting(false);
        }
      };
      
       const isSaveDisabled = !formData.acknowledgement || 
                           !formData.audioFile || 
                           !formData.coverArtFile || 
                           Object.keys(formErrors).some(key => formErrors[key] !== null && formErrors[key] !== undefined && formErrors[key] !== '') ||
                           isSubmitting;


      useEffect(() => {
        runValidations();
      }, [formData.acknowledgement, formData.audioFile, formData.coverArtFile, runValidations]);
      
      return (
        <>
          <ConfettiCelebration isActive={showConfetti} />
          <Dialog open={isOpen} onOpenChange={(openState) => {
              if (!openState) {
                  setFormData({...formUtilsInitialTrackData, acknowledgement: false, is_instrumental: false });
                  setFormErrors({});
                  setOverallProgress(0);
                  setProgressStepMessage('');
                  setShowConfetti(false);
              }
              onOpenChange(openState);
          }}>
            <DialogContent className="sm:max-w-3xl text-white overflow-y-auto max-h-[90vh]">
              <DialogHeader className="pb-3 border-b border-white/10">
                <DialogTitle className="flex items-center gap-2 text-xl golden-text">
                  <UploadCloud className="w-5 h-5 text-emerald-300" />
                  Upload Track
                </DialogTitle>
                <DialogDescription className="text-gray-400 pt-1">
                  Audio + artwork first. Advanced fields stay out of the way until you need them.
                </DialogDescription>
              </DialogHeader>

              {isSubmitting && (
                <div className="px-2 pt-4 pb-2 space-y-2">
                  <Progress value={overallProgress} className="w-full" />
                  <p className="text-sm text-center text-yellow-300 h-5">
                      {progressStepMessage || (overallProgress === 100 ? 'Finalizing...' : 'Processing...')}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6 py-4 px-2">
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <TrackFormFields
                    formData={formData}
                    formErrors={formErrors}
                    genres={genres}
                    onInputChange={handleInputChange}
                    onDateChange={handleDateChange}
                    onGenreChange={handleGenreChange}
                    onLanguagesChange={handleLanguagesChange}
                    onFileChange={handleFileChange}
                    onVideoCoverArtChange={handleVideoCoverArtChange}
                    userId={user?.id}
                    isSubmitting={isSubmitting}
                    parentVideoCoverArtUrl={null}
                  />
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <AcknowledgementField
                    checked={formData.acknowledgement}
                    onChange={handleInputChange}
                    error={formErrors.acknowledgement}
                    disabled={isSubmitting}
                  />
                </div>
                <DialogFooter className="sm:justify-end pt-6">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" disabled={isSubmitting}>Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSaveDisabled} className="gold-to-green-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button disabled:opacity-60 disabled:cursor-not-allowed">
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    {overallProgress > 0 && overallProgress < 100 ? 'Uploading...' : (overallProgress === 100 ? 'Finalizing...' : 'Save Track')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      );
    };

    export default CreateTrackModal;
