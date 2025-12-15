import React from 'react';
import { Button } from '@/components/ui/button';
import TrackFormFields from './TrackFormFields';
import { simulateUploadProgress } from '../formUtils.js';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NestedTrackForm = ({ trackData, index, updateTrackData, removeTrack, genres, formErrors = {}, isCollapsed, onToggleCollapse, isSubmitting, albumVideoCoverArtUrl, userId }) => {
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    updateTrackData(index, name, type === 'checkbox' ? checked : value);
  };

  const handleDateChange = (fieldName, date) => {
    updateTrackData(index, fieldName, date);
  };

  const handleGenreChange = (fieldName, value) => {
    updateTrackData(index, fieldName, value);
    if (value !== 'Other') {
      updateTrackData(index, 'customGenre', '');
    }
  };

  const handleLanguagesChange = (fieldName, selectedOptions) => {
    updateTrackData(index, fieldName, selectedOptions);
  };

  const handleFileChange = (e, fileType, isCancel = false) => {
    const file = isCancel ? null : e.target.files[0];

    if (fileType === 'audio') {
        updateTrackData(index, 'audioFile', file);
        updateTrackData(index, 'audioUploadProgress', 0);
        updateTrackData(index, 'audioUploadComplete', false);
    } else if (fileType === 'coverArt') {
        updateTrackData(index, 'coverArtFile', file);
        updateTrackData(index, 'coverArtUploadProgress', 0);
        updateTrackData(index, 'coverArtUploadComplete', false);
        updateTrackData(index, 'coverArtPreviewUrl', null);
    }
    
    if (file) {
        const isValidFile = simulateUploadProgress(
            file,
            (progress) => updateTrackData(index, `${fileType}UploadProgress`, progress),
            (complete) => updateTrackData(index, `${fileType}UploadComplete`, complete),
            fileType
        );

        if (isValidFile) {
            if (fileType === 'coverArt') {
                const reader = new FileReader();
                reader.onloadend = () => updateTrackData(index, 'coverArtPreviewUrl', reader.result);
                reader.readAsDataURL(file);
            }
        } else {
            if (e && e.target) e.target.value = null; 
            updateTrackData(index, fileType === 'audio' ? 'audioFile' : 'coverArtFile', null);
            if (fileType === 'coverArt') updateTrackData(index, 'coverArtPreviewUrl', null);
        }
    } else { 
         updateTrackData(index, fileType === 'audio' ? 'audioFile' : 'coverArtFile', null);
         updateTrackData(index, `${fileType}UploadProgress`, 0);
         updateTrackData(index, `${fileType}UploadComplete`, false);
         if (fileType === 'coverArt') updateTrackData(index, 'coverArtPreviewUrl', null);
    }
  };

  const handleVideoCoverArtChange = (videoUrl) => {
    updateTrackData(index, 'video_cover_art_url', videoUrl || '');
  };

  return (
    <div className="p-4 border border-white/10 rounded-lg glass-effect space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold text-yellow-300">Track #{index + 1}: {trackData.title || "New Track"}</h4>
        <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onToggleCollapse} className="text-gray-400 hover:text-yellow-300 p-1" disabled={isSubmitting}>
                {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => removeTrack(index)} className="text-red-400 hover:text-red-300 p-1" disabled={isSubmitting}>
                <Trash2 className="w-5 h-5" />
            </Button>
        </div>
      </div>

      <AnimatePresence>
        {!isCollapsed && (
            <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden space-y-4"
            >
              <TrackFormFields
                formData={trackData}
                formErrors={formErrors}
                genres={genres}
                onInputChange={handleInputChange}
                onDateChange={handleDateChange}
                onGenreChange={handleGenreChange}
                onLanguagesChange={handleLanguagesChange}
                onFileChange={handleFileChange}
                onVideoCoverArtChange={handleVideoCoverArtChange}
                userId={userId}
                parentVideoCoverArtUrl={albumVideoCoverArtUrl}
                isAlbumContext={true}
                idPrefix={`track_${index}_`}
                isSubmitting={isSubmitting}
              />
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NestedTrackForm;
