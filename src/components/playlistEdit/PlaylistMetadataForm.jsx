import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Image as ImageIcon } from 'lucide-react';
import VideoCoverArtSelector from '@/components/formElements/VideoCoverArtSelector';

const PlaylistMetadataForm = ({ playlistData, onInputChange, onFileChange, coverArtPreview, isSubmitting, onVideoCoverArtChange, videoCoverArtUrl, userId }) => {
  return (
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <div className="md:col-span-2 space-y-4">
    <div className="space-y-2">
      <Label htmlFor="edit_playlist_title" className="text-gray-300">Title <span className="text-red-500">*</span></Label>
      <Input 
        id="edit_playlist_title" 
        name="title" 
        value={playlistData.title || ''} 
        onChange={onInputChange} 
        required 
        className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" 
        disabled={isSubmitting}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="edit_playlist_description" className="text-gray-300">Description (Optional)</Label>
      <Textarea 
        id="edit_playlist_description" 
        name="description" 
        value={playlistData.description || ''} 
        onChange={onInputChange} 
        rows={3} 
        className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" 
        disabled={isSubmitting}
      />
    </div>
  </div>
  <div className="space-y-2">
    <Label htmlFor="edit_playlist_cover_art" className="text-gray-300">Cover Art</Label>
    {coverArtPreview ? (
      <img-replace src={coverArtPreview} alt="Cover art preview" className="w-full aspect-square object-cover rounded-md border border-white/20" />
    ) : (
      <div className="w-full aspect-square bg-white/5 rounded-md flex items-center justify-center border border-dashed border-white/20">
        <ImageIcon className="w-12 h-12 text-gray-500" />
      </div>
    )}
    <Input 
      id="edit_playlist_cover_art" 
      type="file" 
      accept="image/*" 
      onChange={onFileChange} 
      className="bg-white/5 border-white/10 text-gray-400 file:text-yellow-400 hover:file:bg-yellow-400/10" 
      disabled={isSubmitting}
    />
    <p className="text-xs text-gray-500">Upload new to replace. Bucket: playlist-covers.</p>
  </div>
  <div className="md:col-span-3 space-y-2">
    <VideoCoverArtSelector
      userId={userId}
      value={videoCoverArtUrl}
      onChange={onVideoCoverArtChange}
      disabled={isSubmitting}
      label="Video Cover Art (up to 20s loop)"
      note="If set, this loop becomes the primary cover art for this playlist when tracks lack their own video cover art."
    />
  </div>
  <div className="md:col-span-3 flex items-center space-x-2">
    <Checkbox 
      id="edit_playlist_is_public" 
      name="is_public" 
      checked={!!playlistData.is_public} 
      onCheckedChange={(checked) => onInputChange({ target: { name: 'is_public', checked, type: 'checkbox' }})} 
      className="border-gray-500 data-[state=checked]:bg-yellow-400 data-[state=checked]:border-yellow-500" 
      disabled={isSubmitting}
    />
    <Label htmlFor="edit_playlist_is_public" className="text-gray-300 cursor-pointer">Publicly Visible</Label>
  </div>
</div>
  );
};

export default PlaylistMetadataForm;
