import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import MultiSelectTrackPicker from '@/components/ui/MultiSelectTrackPicker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { XCircle } from 'lucide-react';

const PlaylistTrackManager = ({ currentTracks, tracksToAdd, onRemoveExistingTrack, onRemoveStagedTrack, onSelectTracksForStaging, isSubmitting }) => {
  return (
<div className="space-y-4 pt-4 border-t border-white/10">
  <h3 className="text-lg font-semibold text-yellow-300">Manage Tracks</h3>
  
  <div className="space-y-2">
    <Label className="text-gray-300">Add New Tracks</Label>
    <MultiSelectTrackPicker 
        selectedTracks={tracksToAdd} 
        onSelectedTracksChange={onSelectTracksForStaging}
        placeholder="Search and select tracks to add..."
        disabled={isSubmitting}
    />
  </div>

  {(currentTracks.length > 0 || tracksToAdd.filter(ttd => !currentTracks.some(ct => ct.id === ttd.id)).length > 0) && (
    <div className="space-y-2">
      <Label className="text-gray-300">Tracks in Playlist:</Label>
      <ScrollArea className="max-h-60 border border-white/10 rounded-md p-2 bg-black/30">
        {currentTracks.map(track => (
          <div key={`current-${track.playlist_track_id || track.id}`} className="p-2 bg-white/5 rounded-md text-sm flex justify-between items-center mb-1">
            <div className="flex items-center overflow-hidden">
                <img-replace src={track.cover_art_url || "https://via.placeholder.com/32"} alt={track.title} className="w-8 h-8 rounded-sm mr-2 object-cover"/>
                <span className="truncate">{track.title}</span>
            </div>
             <Button variant="ghost" size="sm" onClick={() => onRemoveExistingTrack(track)} className="p-0 h-auto hover:bg-transparent" disabled={isSubmitting}>
               <XCircle className="w-4 h-4 text-red-400 hover:text-red-300"/>
             </Button>
          </div>
        ))}
        {tracksToAdd.filter(ttd => !currentTracks.some(ct => ct.id === ttd.id)).map(track => (
             <div key={`new-${track.id}`} className="p-2 bg-yellow-500/10 rounded-md text-sm flex justify-between items-center mb-1">
                <div className="flex items-center overflow-hidden">
                    <img-replace src={track.cover_art_url || "https://via.placeholder.com/32"} alt={track.title} className="w-8 h-8 rounded-sm mr-2 object-cover"/>
                    <span className="truncate text-yellow-200">{track.title} (New)</span>
                </div>
               <Button variant="ghost" size="sm" onClick={() => onRemoveStagedTrack(track.id)} className="p-0 h-auto hover:bg-transparent" disabled={isSubmitting}>
                 <XCircle className="w-4 h-4 text-orange-400 hover:text-orange-300"/>
               </Button>
            </div>
        ))}
      </ScrollArea>
    </div>
  )}
   {currentTracks.length === 0 && tracksToAdd.length === 0 && (
      <p className="text-sm text-gray-400">No tracks in this playlist yet. Use search above to add some!</p>
  )}
</div>
  );
};

export default PlaylistTrackManager;
