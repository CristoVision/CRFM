import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileUploadProgress from './FileUploadProgress';
import MultiSelectCombobox from './MultiSelectCombobox';
import AcknowledgementField from './AcknowledgementField';
import VideoCoverArtSelector from './VideoCoverArtSelector';
import { defaultLanguages } from '../formUtils.js';
import { cn } from '@/lib/utils';

const AlbumFormFields = ({
  albumData,
  albumFormErrors,
  genres,
  onInputChange,
  onDateChange,
  onGenreChange,
  onLanguagesChange,
  onFileChange,
  onAlbumVideoCoverArtChange,
  albumVideoCoverArtUrl,
  applyAlbumVideoToTracks = true,
  onApplyAlbumVideoToggle,
  userId,
  isSubmitting
}) => {
  return (
    <div className="p-4 border border-yellow-500/30 rounded-lg glass-effect space-y-4">
      <h3 className="text-xl font-semibold text-yellow-400 border-b border-yellow-500/20 pb-2">Album Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="album_title" className="text-gray-300">Title <span className="text-red-500">*</span></Label>
          <Input 
            id="album_title" 
            name="title" 
            value={albumData.title} 
            onChange={onInputChange} 
            className={cn("bg-white/5 border-white/10 focus:border-yellow-400 text-white", albumFormErrors.title && "border-red-500")} 
            disabled={isSubmitting}
          />
          {albumFormErrors.title && <p className="text-xs text-red-400 mt-1">{albumFormErrors.title}</p>}
        </div>
        <div>
          <Label htmlFor="album_release_date" className="text-gray-300">Release Date <span className="text-red-500">*</span></Label>
          <DatePicker 
            date={albumData.release_date ? new Date(albumData.release_date) : null} 
            setDate={(date) => onDateChange('release_date', date)} 
            className={cn(albumFormErrors.release_date && "border-red-500 focus-within:border-red-500")} 
            disabled={isSubmitting}
          />
          {albumFormErrors.release_date && <p className="text-xs text-red-400 mt-1">{albumFormErrors.release_date}</p>}
        </div>
      </div>
      <div>
        <Label htmlFor="album_coverArtFile" className="text-gray-300">Cover Art <span className="text-red-500">*</span></Label>
        <Input 
          id="album_coverArtFile" 
          type="file" 
          accept="image/*" 
          onChange={(e) => onFileChange(e, 'coverArt')} 
          className={cn("bg-white/5 border-white/10 text-gray-400 file:text-yellow-400", albumFormErrors.coverArtFile && "border-red-500")} 
          disabled={isSubmitting}
        />
        {albumData.coverArtPreviewUrl && <img-replace src={albumData.coverArtPreviewUrl} alt="Album cover preview" className="mt-2 w-24 h-24 object-cover rounded-md border border-white/20" />}
        {!albumData.coverArtPreviewUrl && albumData.cover_art_url && <img-replace src={albumData.cover_art_url} alt="Album cover" className="mt-2 w-24 h-24 object-cover rounded-md border border-white/20" />}
        <FileUploadProgress 
          file={albumData.coverArtFile || albumData.cover_art_url} 
          progress={albumData.coverArtUploadProgress} 
          uploadComplete={albumData.coverArtUploadComplete || !!albumData.cover_art_url} 
          onCancel={() => onFileChange(null, 'coverArt', true)} 
          disabled={isSubmitting}
        />
        {albumFormErrors.coverArtFile && <p className="text-xs text-red-400 mt-1">{albumFormErrors.coverArtFile}</p>}
      </div>
      <div className="space-y-2">
        <VideoCoverArtSelector
          userId={userId || albumData?.uploader_id}
          value={albumVideoCoverArtUrl}
          onChange={onAlbumVideoCoverArtChange}
          disabled={isSubmitting}
          note="If set, this loop becomes the primary cover art. Tracks without their own video will inherit it."
          label="Album Video Cover Art (up to 20s loop, optional)"
        />
        <div className="flex items-center space-x-2">
          <Switch
            id="album_apply_video_to_tracks"
            checked={applyAlbumVideoToTracks}
            onCheckedChange={(checked) => onApplyAlbumVideoToggle?.(checked)}
            className="data-[state=checked]:bg-yellow-400"
            disabled={isSubmitting}
          />
          <Label htmlFor="album_apply_video_to_tracks" className="text-gray-300 text-sm">Use this video for all tracks unless a track overrides it</Label>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="album_genre" className="text-gray-300">Genre <span className="text-red-500">*</span></Label>
          <Select value={albumData.genre} onValueChange={(value) => onGenreChange('genre', value)} disabled={isSubmitting}>
            <SelectTrigger className={cn("bg-white/5 border-white/10 focus:border-yellow-400 text-white", albumFormErrors.genre && "border-red-500")}>
              <SelectValue placeholder="Select genre" />
            </SelectTrigger>
            <SelectContent className="bg-black/80 backdrop-blur-md border-yellow-500/50 text-white">
              {genres.map(g => <SelectItem key={g.value} value={g.value} className="hover:!bg-yellow-400/10 focus:!bg-yellow-400/20">{g.label}</SelectItem>)}
              <SelectItem value="Other" className="hover:!bg-yellow-400/10 focus:!bg-yellow-400/20">Other (Specify)</SelectItem>
            </SelectContent>
          </Select>
          {albumFormErrors.genre && <p className="text-xs text-red-400 mt-1">{albumFormErrors.genre}</p>}
          {albumData.genre === 'Other' && (
            <Input 
              name="customGenre" 
              value={albumData.customGenre} 
              onChange={onInputChange} 
              placeholder="Specify genre" 
              className={cn("mt-2 bg-white/5 border-white/10 focus:border-yellow-400 text-white", albumFormErrors.customGenre && "border-red-500")} 
              disabled={isSubmitting}
            />
          )}
          {albumData.genre === 'Other' && albumFormErrors.customGenre && <p className="text-xs text-red-400 mt-1">{albumFormErrors.customGenre}</p>}
        </div>
        <div>
          <Label htmlFor="album_languages" className="text-gray-300">Languages <span className="text-red-500">*</span></Label>
          <MultiSelectCombobox 
            options={defaultLanguages} 
            selected={albumData.languages} 
            onChange={(selected) => onLanguagesChange('languages', selected)} 
            placeholder="Select languages" 
            className={cn(albumFormErrors.languages && "!border-red-500")} 
            disabled={isSubmitting}
          />
          {albumFormErrors.languages && <p className="text-xs text-red-400 mt-1">{albumFormErrors.languages}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div>
          <Label htmlFor="album_site_url" className="text-gray-300">Site URL (Optional)</Label>
          <Input 
            id="album_site_url" 
            name="site_url" 
            type="url" 
            value={albumData.site_url} 
            onChange={onInputChange} 
            className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" 
            disabled={isSubmitting}
          />
        </div>
        <div className="flex items-center space-x-2 pt-5">
          <Switch 
            id="album_is_public" 
            name="is_public" 
            checked={albumData.is_public} 
            onCheckedChange={(checked) => onInputChange({target: {name: 'is_public', checked, type:'switch'}})} 
            className="data-[state=checked]:bg-yellow-400" 
            disabled={isSubmitting}
          />
          <Label htmlFor="album_is_public" className="text-gray-300">Publicly Visible</Label>
        </div>
      </div>
      <div className="space-y-4 pt-4 border-t border-white/10">
        <h4 className="text-md font-semibold text-yellow-400">Artwork Declarations</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <div className="flex items-center space-x-2">
              <Switch 
                id="album_artwork_is_not_explicit" 
                name="artwork_is_not_explicit" 
                checked={albumData.artwork_is_not_explicit} 
                onCheckedChange={(checked) => onInputChange({target: {name: 'artwork_is_not_explicit', checked, type:'switch'}})} 
                className="data-[state=checked]:bg-yellow-400" 
                disabled={isSubmitting}
              />
              <Label htmlFor="album_artwork_is_not_explicit" className="text-gray-300 text-sm">Artwork is NOT Explicit</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="album_artwork_ai_generated" 
                name="artwork_ai_generated" 
                checked={albumData.artwork_ai_generated} 
                onCheckedChange={(checked) => onInputChange({target: {name: 'artwork_ai_generated', checked, type:'switch'}})} 
                className="data-[state=checked]:bg-yellow-400" 
                disabled={isSubmitting}
              />
              <Label htmlFor="album_artwork_ai_generated" className="text-gray-300 text-sm">Artwork is AI Generated</Label>
            </div>
        </div>
      </div>
      <AcknowledgementField
        checked={albumData.acknowledgement}
        onChange={onInputChange}
        error={albumFormErrors.acknowledgement}
        idPrefix="album_"
        disabled={isSubmitting}
      />
    </div>
  );
};

export default AlbumFormFields;
