import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import NestedTrackForm from './NestedTrackForm';
import { initialTrackFormData as formUtilsInitialTrackData } from '../formUtils.js';
import { toast } from '@/components/ui/use-toast';
import { PlusCircle } from 'lucide-react';

const AlbumTrackList = ({ 
  tracks, 
  setTracks, 
  trackFormErrors, 
  setTrackFormErrors, 
  genres, 
  MAX_TRACKS, 
  isSubmitting,
  albumVideoCoverArtUrl,
  userId,
}) => {
  const [collapsedTracks, setCollapsedTracks] = useState({});

  const addTrack = () => {
    if (tracks.length < MAX_TRACKS) {
      const newTrackId = Date.now() + Math.random();
      setTracks(prev => [...prev, { ...formUtilsInitialTrackData, id: newTrackId, track_number_on_album: prev.length + 1 }]);
      setCollapsedTracks(prev => ({...prev, [newTrackId]: false})); 
    } else {
      toast({ title: "Track Limit Reached", description: `You can add a maximum of ${MAX_TRACKS} tracks per album.`, variant: "error" });
    }
  };

  const updateTrackField = useCallback((index, fieldName, value) => {
    setTracks(prevTracks =>
      prevTracks.map((track, i) =>
        i === index ? { ...track, [fieldName]: value } : track
      )
    );
  }, [setTracks]);

  const removeTrack = (index) => {
    const trackIdToRemove = tracks[index].id;
    setTracks(prev => prev.filter((_, i) => i !== index).map((t, idx) => ({...t, track_number_on_album: idx + 1 })));
    setTrackFormErrors(prev => prev.filter((_,i) => i !== index));
    setCollapsedTracks(prev => {
        const newCollapsed = {...prev};
        delete newCollapsed[trackIdToRemove];
        return newCollapsed;
    });
  };
  
  const toggleTrackCollapse = (trackId) => {
    setCollapsedTracks(prev => ({...prev, [trackId]: !prev[trackId]}));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pt-4 border-t border-yellow-500/30">
          <h3 className="text-xl font-semibold text-yellow-400">Tracks ({tracks.length}/{MAX_TRACKS})</h3>
          <Button type="button" onClick={addTrack} variant="outline" size="sm" className="text-yellow-300 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-200" disabled={tracks.length >= MAX_TRACKS || isSubmitting}>
              <PlusCircle className="w-4 h-4 mr-2" />Add Track
          </Button>
      </div>
      {tracks.map((track, index) => (
        <NestedTrackForm 
          key={track.id} 
          trackData={track} 
          index={index} 
          updateTrackData={updateTrackField} 
          removeTrack={removeTrack} 
          genres={genres} 
          formErrors={trackFormErrors[index] || {}}
          isCollapsed={collapsedTracks[track.id] || false}
          onToggleCollapse={() => toggleTrackCollapse(track.id)}
          isSubmitting={isSubmitting}
          albumVideoCoverArtUrl={albumVideoCoverArtUrl}
          userId={userId}
        />
      ))}
       {tracks.length === 0 && (
          <p className="text-center text-gray-400 py-4">Add at least one track to the album.</p>
      )}
    </div>
  );
};

export default AlbumTrackList;
