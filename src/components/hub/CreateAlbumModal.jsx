import React, { useState, useEffect, useCallback, useMemo } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { useNavigate } from 'react-router-dom';
    import { toast } from '@/components/ui/use-toast';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
    import { Button } from '@/components/ui/button';
    import { Progress } from '@/components/ui/progress';
    import ConfettiCelebration from '@/components/common/ConfettiCelebration';
import AlbumFormFields from '@/components/formElements/AlbumFormFields';
import AlbumTrackList from '@/components/formElements/AlbumTrackList';
import { uploadFileToSupabase, validateTrackForm, initialTrackFormData as formUtilsInitialTrackData } from '@/components/formUtils';
    import { Disc, Save, Loader2 } from 'lucide-react';

    const LOCAL_STORAGE_KEY_CREATE_ALBUM = 'crfm_create_album_draft';

const initialAlbumFormData = {
  title: '',
  release_date: null,
  genre: '',
  customGenre: '',
  languages: [],
  site_url: '',
  is_public: false,
  artwork_is_not_explicit: true,
  artwork_ai_generated: false,
  acknowledgement: false,
  coverArtFile: null,
  coverArtPreviewUrl: null,
  coverArtUploadProgress: 0,
  coverArtUploadComplete: false,
  video_cover_art_url: '',
};

    const CreateAlbumModal = ({ isOpen, onOpenChange, onAlbumCreated }) => {
      const { user, profile } = useAuth();
      const navigate = useNavigate();

    const getInitialAlbumState = () => {
       const savedDraft = localStorage.getItem(LOCAL_STORAGE_KEY_CREATE_ALBUM);
       if (savedDraft && isOpen) {
         const draft = JSON.parse(savedDraft);
         return {
           albumData: {
             ...initialAlbumFormData,
             ...draft.albumData,
             release_date: draft.albumData.release_date ? new Date(draft.albumData.release_date) : null,
             languages: draft.albumData.languages || [],
           },
           tracks: draft.tracks.map(t => ({
             ...formUtilsInitialTrackData,
             ...t,
             id: t.id || Date.now() + Math.random(),
             release_date: t.release_date ? new Date(t.release_date) : null,
             languages: t.languages || [],
             is_instrumental: t.is_instrumental || false, 
             audioFile: null, 
             coverArtFile: null, 
              video_cover_art_url: t.video_cover_art_url || '',
            })),
            applyAlbumVideoToTracks: draft.applyAlbumVideoToTracks !== undefined ? draft.applyAlbumVideoToTracks : true,
          };
        }
        return { albumData: initialAlbumFormData, tracks: [], applyAlbumVideoToTracks: true };
      };
      
      const [albumData, setAlbumData] = useState(getInitialAlbumState().albumData);
      const [tracks, setTracks] = useState(getInitialAlbumState().tracks);
      const [applyAlbumVideoToTracks, setApplyAlbumVideoToTracks] = useState(getInitialAlbumState().applyAlbumVideoToTracks);
      
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [genres, setGenres] = useState([]);
      const [albumFormErrors, setAlbumFormErrors] = useState({});
      const [trackFormErrors, setTrackFormErrors] = useState([]);
      const [overallProgress, setOverallProgress] = useState(0);
      const [progressStepMessage, setProgressStepMessage] = useState('');
      const [showConfetti, setShowConfetti] = useState(false);

      const MAX_TRACKS = 20;

      useEffect(() => {
        if (isOpen) {
          const initialState = getInitialAlbumState();
          setAlbumData(initialState.albumData);
          setTracks(initialState.tracks);
          setApplyAlbumVideoToTracks(initialState.applyAlbumVideoToTracks);
          setOverallProgress(0);
          setProgressStepMessage('');
          setShowConfetti(false);
        } else {
          setAlbumData(initialAlbumFormData);
          setTracks([]);
          setAlbumFormErrors({});
          setTrackFormErrors([]);
          setApplyAlbumVideoToTracks(true);
        }
      }, [isOpen]);


      useEffect(() => {
        if (isOpen) {
          const draft = { 
            albumData: {...albumData, coverArtFile: null, coverArtPreviewUrl: null}, 
            tracks: tracks.map(t => ({...t, audioFile: null, coverArtFile: null, coverArtPreviewUrl: null})),
            applyAlbumVideoToTracks,
          };
          localStorage.setItem(LOCAL_STORAGE_KEY_CREATE_ALBUM, JSON.stringify(draft));
        }
      }, [albumData, tracks, applyAlbumVideoToTracks, isOpen]);

      useEffect(() => {
        const fetchAlbumGenres = async () => {
          const { data, error } = await supabase.from('albums').select('genre');
          if (error) console.error('Error fetching album genres:', error);
          else {
            const uniqueGenres = [...new Set(data.map(item => item.genre).filter(Boolean))];
            setGenres(uniqueGenres.map(g => ({ value: g, label: g })));
          }
        };
        if(isOpen) fetchAlbumGenres();
      }, [isOpen]);

      const validateAlbumForm = useCallback(() => {
        const errors = {};
        if (!albumData.title.trim()) errors.title = "Album title is required.";
        if (!albumData.coverArtFile && !albumData.cover_art_url) errors.coverArtFile = "Album cover art is required.";
        if (!albumData.release_date) errors.release_date = "Album release date is required.";
        if (!albumData.genre) errors.genre = "Album genre is required.";
        if (albumData.genre === 'Other' && !albumData.customGenre.trim()) errors.customGenre = "Please specify album genre.";
        if (albumData.languages.length === 0) errors.languages = "At least one language is required for the album.";
        if (!albumData.acknowledgement) errors.acknowledgement = "You must acknowledge the terms.";
        setAlbumFormErrors(errors);
        return Object.keys(errors).length === 0;
      }, [albumData]);
      
      const runAllValidations = useCallback(() => {
        const isAlbumValid = validateAlbumForm();
        let areAllTracksValid = tracks.length > 0;
        const currentTrackErrors = tracks.map(track => validateTrackForm(track, true));
        
        currentTrackErrors.forEach(errors => {
            if(Object.keys(errors).length > 0) {
                areAllTracksValid = false;
            }
        });
        setTrackFormErrors(currentTrackErrors);
        return isAlbumValid && areAllTracksValid;
      }, [validateAlbumForm, tracks]);

      const handleAlbumInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setAlbumData(prev => ({ ...prev, [name]: type === 'checkbox' || type === 'switch' ? checked : value }));
      };
      
      const handleAlbumDateChange = (fieldName, date) => {
        setAlbumData(prev => ({ ...prev, [fieldName]: date }));
      };

      const handleAlbumGenreChange = (fieldName, value) => {
        setAlbumData(prev => ({ ...prev, [fieldName]: value, customGenre: value !== 'Other' ? '' : prev.customGenre }));
      };
      
      const handleAlbumLanguagesChange = (fieldName, selectedOptions) => {
        setAlbumData(prev => ({ ...prev, [fieldName]: selectedOptions }));
      };

      const handleAlbumCoverArtChange = (e, fileType, isCancel = false) => {
        const file = isCancel ? null : e.target.files[0];
        let updatedAlbumData = { ...albumData };

        updatedAlbumData.coverArtFile = file;
        updatedAlbumData.coverArtUploadProgress = 0;
        updatedAlbumData.coverArtUploadComplete = false;
        updatedAlbumData.coverArtPreviewUrl = null;
        
        if (file) {
            setAlbumData(prev => ({...prev, coverArtFile: file, coverArtPreviewUrl: URL.createObjectURL(file)}));
        } else {
            setAlbumData(prev => ({...prev, coverArtFile: null, coverArtPreviewUrl: null}));
        }
      };

      const handleAlbumVideoCoverArtChange = (videoUrl) => {
        setAlbumData(prev => ({ ...prev, video_cover_art_url: videoUrl || '' }));
      };

      const handleApplyAlbumVideoToggle = (checked) => {
        setApplyAlbumVideoToTracks(!!checked);
      };

      const handleSubmit = async (e) => {
        e.preventDefault();

        if (!albumData.coverArtFile?.name) {
          toast({ title: "Missing album cover", description: "Please select an album cover before saving.", variant: "error" });
          return;
        }

        for (const track of tracks) {
          if (!track.audioFile?.name) {
            toast({ title: `Missing audio for "${track.title || 'Unnamed Track'}"`, description: "Please attach an audio file for all tracks.", variant: "error" });
            return;
          }
        }

        if (!user || !profile) {
           toast({ title: "Authentication Error", description: "User or profile not found. Please log in.", variant: "error" });
           return;
        }
        if (!runAllValidations()) {
          toast({ title: "Validation Error", description: "Please fill all required fields for the album and each track.", variant: "error" });
          return;
        }
        setIsSubmitting(true);
        setOverallProgress(0);
        setProgressStepMessage("Initializing album creation...");

        const totalSteps = 1 + (tracks.length * 2) + 2; 
        let completedSteps = 0;
        const calculateAndUpdateProgress = () => {
            completedSteps++;
            setOverallProgress(Math.round((completedSteps / totalSteps) * 100));
        };

        try {
          setProgressStepMessage("Uploading album cover art...");
          const album_cover_art_url = await uploadFileToSupabase(albumData.coverArtFile, 'album-covers', user.id, true);
          if (!album_cover_art_url) throw new Error("Album cover art upload failed.");
          calculateAndUpdateProgress();

          const inheritedVideoCoverArt = applyAlbumVideoToTracks && albumData.video_cover_art_url ? albumData.video_cover_art_url : null;

          const uploadedTrackFileDetails = [];
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            setProgressStepMessage(`Uploading audio for ${track.title || `Track ${i + 1}`}...`);
            const track_audio_url = await uploadFileToSupabase(track.audioFile, 'track-audio', user.id, false);
            if (!track_audio_url) throw new Error(`Audio upload failed for track: ${track.title || `Track ${i + 1}`}`);
            calculateAndUpdateProgress();
            
            let track_cover_art_url = album_cover_art_url; 
            if (track.coverArtFile) { 
                setProgressStepMessage(`Uploading unique cover art for ${track.title || `Track ${i+1}`}...`);
                track_cover_art_url = await uploadFileToSupabase(track.coverArtFile, 'track-cover', user.id, true);
                if (!track_cover_art_url) throw new Error(`Cover art upload failed for track: ${track.title || `Track ${i + 1}`}`);
            } else {
                 setProgressStepMessage(`Using album cover for ${track.title || `Track ${i + 1}`}...`);
            }
            calculateAndUpdateProgress();
            uploadedTrackFileDetails.push({ ...track, audio_file_url: track_audio_url, cover_art_url: track_cover_art_url, video_cover_art_url: track.video_cover_art_url || inheritedVideoCoverArt || null });
          }

          setProgressStepMessage("Saving album information...");
          const albumToInsert = {
            uploader_id: user.id,
            creator_display_name: profile.display_name || profile.username || 'Unknown Artist',
            title: albumData.title,
            release_date: albumData.release_date,
            genre: albumData.genre === 'Other' ? albumData.customGenre : albumData.genre,
            languages: albumData.languages.map(lang => lang.value),
            is_public: albumData.is_public,
            artwork_is_not_explicit: albumData.artwork_is_not_explicit,
            artwork_ai_generated: albumData.artwork_ai_generated,
            cover_art_url: album_cover_art_url,
            video_cover_art_url: albumData.video_cover_art_url || null,
          };
          const { data: newAlbum, error: albumError } = await supabase.from('albums').insert([albumToInsert]).select().single();
          if (albumError) throw albumError;
          calculateAndUpdateProgress();

          setProgressStepMessage("Saving tracks information...");
          const tracksToInsert = uploadedTrackFileDetails.map(track => ({
            album_id: newAlbum.id,
            uploader_id: user.id,
            creator_display_name: profile.display_name || profile.username || 'Unknown Artist',
            title: track.title,
            genre: track.genre === 'Other' ? track.customGenre : track.genre,
            languages: track.languages.map(lang => lang.value),
            release_date: track.release_date,
            track_number_on_album: track.track_number_on_album,
            is_christian_nature: track.is_christian_nature,
            is_instrumental: track.is_instrumental,
            ai_in_production: track.ai_in_production,
            ai_in_artwork: track.ai_in_artwork,
            ai_in_lyrics: track.ai_in_lyrics,
            lyrics_text: track.lyrics_text,
            lrc_file_path: track.lrc_file_path,
            audio_file_url: track.audio_file_url,
            cover_art_url: track.cover_art_url,
            video_cover_art_url: track.video_cover_art_url || inheritedVideoCoverArt || null,
            stream_cost: 0.5,
            is_public: true, 
          }));

          const { error: tracksError } = await supabase.from('tracks').insert(tracksToInsert);
          if (tracksError) throw tracksError;
          calculateAndUpdateProgress();
          setProgressStepMessage("Album created successfully!");
          
          toast({ title: 'Album Created!', description: `"${newAlbum.title}" and its tracks uploaded successfully.`, variant: "success" });
          setShowConfetti(true);
          localStorage.removeItem(LOCAL_STORAGE_KEY_CREATE_ALBUM);
          
          setTimeout(() => {
            if(onAlbumCreated) onAlbumCreated(newAlbum);
            onOpenChange(false);
            navigate('/hub', { state: { defaultTab: 'content', defaultContentTab: 'albums' } });
          }, 2500);

        } catch (error) {
          console.error('Error creating album:', error);
          toast({ title: 'Creation Failed', description: error.message || 'Could not create album.', variant: 'error' });
          setOverallProgress(0);
          setProgressStepMessage('An error occurred. Please try again.');
        } finally {
          if (overallProgress !== 100 && completedSteps < totalSteps ) { 
             setIsSubmitting(false); 
          } else if (overallProgress === 100) {
             // submission is successful, button will be disabled until modal closes via timeout
          }
        }
      };
      
      const isSaveDisabled = useMemo(() => {
        if (isSubmitting || !albumData.acknowledgement || !albumData.coverArtFile || !albumData.title || !albumData.genre || (albumData.genre === 'Other' && !albumData.customGenre) || !albumData.release_date || albumData.languages.length === 0 || tracks.length === 0) {
            return true;
        }
        
        const anyAlbumErrors = Object.values(albumFormErrors).some(Boolean);
        if (anyAlbumErrors) return true;

        const anyTrackErrors = trackFormErrors.some(errors => Object.values(errors).some(Boolean));
        if(anyTrackErrors) return true;
        
        const anyTrackIncomplete = tracks.some(track => {
          const errors = validateTrackForm(track, true); 
          if (!track.audioFile) return true; 
          return Object.keys(errors).length > 0;
        });
        if (anyTrackIncomplete) return true;

        return false;
      }, [isSubmitting, albumData, tracks, albumFormErrors, trackFormErrors]);

      useEffect(() => {
        validateAlbumForm();
        setTrackFormErrors(tracks.map(track => validateTrackForm(track, true)));
      }, [albumData, tracks, validateAlbumForm]);

      return (
        <>
        <ConfettiCelebration isActive={showConfetti} />
        <Dialog open={isOpen} onOpenChange={(openState) => {
            if(!openState) {
              setAlbumData(initialAlbumFormData);
              setTracks([]);
              setAlbumFormErrors({});
              setTrackFormErrors([]);
              setOverallProgress(0);
              setProgressStepMessage('');
              setShowConfetti(false);
            }
            onOpenChange(openState);
        }}>
          <DialogContent className="sm:max-w-4xl glass-effect-light text-white overflow-y-auto max-h-[95vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center"><Disc className="w-7 h-7 mr-3 text-yellow-400" />Create New Album</DialogTitle>
              <DialogDescription className="text-gray-400 pt-2">Fill in album details and add tracks.</DialogDescription>
            </DialogHeader>
            
            {isSubmitting && (
                <div className="px-2 pt-4 pb-2 space-y-2">
                  <Progress value={overallProgress} className="w-full" />
                  <p className="text-sm text-center text-yellow-300 h-5">
                    {progressStepMessage || (overallProgress === 100 ? 'Finalizing...' : 'Processing...')}
                  </p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 py-4 px-1 custom-scrollbar">
              <AlbumFormFields
                albumData={albumData}
                albumFormErrors={albumFormErrors}
                genres={genres}
                onInputChange={handleAlbumInputChange}
              onDateChange={handleAlbumDateChange}
              onGenreChange={handleAlbumGenreChange}
              onLanguagesChange={handleAlbumLanguagesChange}
              onFileChange={handleAlbumCoverArtChange}
              onAlbumVideoCoverArtChange={handleAlbumVideoCoverArtChange}
              albumVideoCoverArtUrl={albumData.video_cover_art_url}
              applyAlbumVideoToTracks={applyAlbumVideoToTracks}
              onApplyAlbumVideoToggle={handleApplyAlbumVideoToggle}
              userId={user?.id}
              isSubmitting={isSubmitting}
            />

              <AlbumTrackList
                tracks={tracks}
              setTracks={setTracks}
              trackFormErrors={trackFormErrors}
              setTrackFormErrors={setTrackFormErrors}
              genres={genres}
              MAX_TRACKS={MAX_TRACKS}
              isSubmitting={isSubmitting}
              albumVideoCoverArtUrl={applyAlbumVideoToTracks ? albumData.video_cover_art_url : ''}
              userId={user?.id}
            />
              
              <DialogFooter className="sm:justify-end pt-6 border-t border-white/10">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" disabled={isSubmitting}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSaveDisabled} className="golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button disabled:opacity-60 disabled:cursor-not-allowed">
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {overallProgress > 0 && overallProgress < 100 ? 'Creating Album...' : (overallProgress === 100 ? 'Finalizing...' : 'Create Album')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </>
      );
    };

    export default CreateAlbumModal;
