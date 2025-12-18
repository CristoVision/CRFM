import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileUploadProgress from './FileUploadProgress';
import MultiSelectCombobox from './MultiSelectCombobox';
import VideoCoverArtSelector from './VideoCoverArtSelector';
import { defaultLanguages } from '../formUtils.js';
import { cn } from '@/lib/utils';

const TrackFormFields = ({
  formData,
  formErrors,
  genres,
  onInputChange,
  onDateChange,
  onGenreChange,
  onLanguagesChange,
  onFileChange,
  onVideoCoverArtChange,
  userId,
  parentVideoCoverArtUrl,
  isAlbumContext = false, 
  idPrefix = '',
  isSubmitting = false,
}) => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}title`} className="text-gray-300">Title <span className="text-red-500">*</span></Label>
          <Input id={`${idPrefix}title`} name="title" value={formData.title} onChange={onInputChange} maxLength={200} className={cn("bg-white/5 border-white/10 focus:border-yellow-400 text-white", formErrors.title && "border-red-500")} disabled={isSubmitting} />
          {formErrors.title && <p className="text-xs text-red-400 mt-1">{formErrors.title}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}release_date`} className="text-gray-300">Release Date <span className="text-red-500">*</span></Label>
          <DatePicker
            date={formData.release_date ? new Date(formData.release_date) : null}
            setDate={(date) => onDateChange('release_date', date)}
            placeholder="Select release date"
            className={cn(formErrors.release_date && "border-red-500 focus-within:border-red-500")}
            disabled={isSubmitting}
          />
          {formErrors.release_date && <p className="text-xs text-red-400 mt-1">{formErrors.release_date}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}audioFile`} className="text-gray-300">Audio File (.mp3, .wav) <span className="text-red-500">*</span></Label>
          <Input id={`${idPrefix}audioFile`} name="audioFile" type="file" accept="audio/mpeg,audio/wav,audio/mp3,audio/x-wav,audio/*" onChange={(e) => onFileChange(e, 'audio')} className={cn("bg-white/5 border-white/10 text-gray-400 file:text-yellow-400 hover:file:bg-yellow-400/10", formErrors.audioFile && "border-red-500")} disabled={isSubmitting} />
          <FileUploadProgress 
            file={formData.audioFile || formData.audio_file_url} 
            progress={formData.audioUploadProgress || 0} 
            uploadComplete={formData.audioUploadComplete || !!formData.audio_file_url} 
            onCancel={() => onFileChange({target: {files: [null]}}, 'audio', true)} 
            disabled={isSubmitting}
          />
          {formErrors.audioFile && <p className="text-xs text-red-400 mt-1">{formErrors.audioFile}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}coverArtFile`} className="text-gray-300">Cover Art (Image) {!isAlbumContext && <span className="text-red-500">*</span>}</Label>
          <Input id={`${idPrefix}coverArtFile`} name="coverArtFile" type="file" accept="image/*" onChange={(e) => onFileChange(e, 'coverArt')} className={cn("bg-white/5 border-white/10 text-gray-400 file:text-yellow-400 hover:file:bg-yellow-400/10", formErrors.coverArtFile && "border-red-500")} disabled={isSubmitting} />
          {formData.coverArtPreviewUrl && <img-replace src={formData.coverArtPreviewUrl} alt="Cover art preview" className="mt-2 w-24 h-24 object-cover rounded-md border border-white/20" />}
          {!formData.coverArtPreviewUrl && formData.cover_art_url && <img-replace src={formData.cover_art_url} alt="Cover art" className="mt-2 w-24 h-24 object-cover rounded-md border border-white/20" />}
          <FileUploadProgress 
          file={formData.coverArtFile || formData.cover_art_url} 
          progress={formData.coverArtUploadProgress || 0} 
          uploadComplete={formData.coverArtUploadComplete || !!formData.cover_art_url} 
          onCancel={() => onFileChange({target: {files: [null]}}, 'coverArt', true)}
          disabled={isSubmitting}
        />
        {formErrors.coverArtFile && <p className="text-xs text-red-400 mt-1">{formErrors.coverArtFile}</p>}
      </div>
    </div>

      <div className="space-y-2">
        <VideoCoverArtSelector
          userId={userId}
          value={formData.video_cover_art_url}
          onChange={(url) => onVideoCoverArtChange?.(url)}
          disabled={isSubmitting}
          note={parentVideoCoverArtUrl ? 'If empty, the album/playlist video cover art will be used automatically.' : undefined}
          label="Video Cover Art (up to 20s loop, optional)"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}genre`} className="text-gray-300">Genre <span className="text-red-500">*</span></Label>
          <Select value={formData.genre} onValueChange={(value) => onGenreChange('genre', value)} disabled={isSubmitting}>
            <SelectTrigger className={cn("bg-white/5 border-white/10 focus:border-yellow-400 text-white", formErrors.genre && "border-red-500")}>
              <SelectValue placeholder="Select genre" />
            </SelectTrigger>
            <SelectContent className="bg-black/80 backdrop-blur-md border-yellow-500/50 text-white">
              {genres.map(g => <SelectItem key={g.value} value={g.value} className="hover:!bg-yellow-400/10 focus:!bg-yellow-400/20">{g.label}</SelectItem>)}
              <SelectItem value="Other" className="hover:!bg-yellow-400/10 focus:!bg-yellow-400/20">Other (Specify)</SelectItem>
            </SelectContent>
          </Select>
          {formErrors.genre && <p className="text-xs text-red-400 mt-1">{formErrors.genre}</p>}
          {formData.genre === 'Other' && (
            <div className="mt-2 space-y-1">
              <Input name="customGenre" value={formData.customGenre} onChange={onInputChange} placeholder="Specify genre" className={cn("bg-white/5 border-white/10 focus:border-yellow-400 text-white", formErrors.customGenre && "border-red-500")} disabled={isSubmitting} />
              {formErrors.customGenre && <p className="text-xs text-red-400 mt-1">{formErrors.customGenre}</p>}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}languages`} className="text-gray-300">Languages <span className="text-red-500">*</span></Label>
          <MultiSelectCombobox
            options={defaultLanguages}
            selected={formData.languages || []}
            onChange={(selected) => onLanguagesChange('languages', selected)}
            placeholder="Select or add languages"
            className={cn(formErrors.languages && "!border-red-500")}
            disabled={isSubmitting}
          />
          {formErrors.languages && <p className="text-xs text-red-400 mt-1">{formErrors.languages}</p>}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}track_number_on_album`} className="text-gray-300">Track Number {isAlbumContext ? '(on album)' : ''}</Label>
          <Input id={`${idPrefix}track_number_on_album`} name="track_number_on_album" type="number" min="1" value={formData.track_number_on_album} onChange={onInputChange} className={cn("bg-white/5 border-white/10 focus:border-yellow-400 text-white", formErrors.track_number_on_album && "border-red-500")} disabled={isSubmitting} />
          {formErrors.track_number_on_album && <p className="text-xs text-red-400 mt-1">{formErrors.track_number_on_album}</p>}
        </div>
         <div className="space-y-2">
          <Label htmlFor={`${idPrefix}lrc_file_path`} className="text-gray-300">LRC File Path (Optional)</Label>
          <Input id={`${idPrefix}lrc_file_path`} name="lrc_file_path" value={formData.lrc_file_path || ''} onChange={onInputChange} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" placeholder="e.g., /lyrics/track-title.lrc" disabled={isSubmitting}/>
        </div>
      </div>

      <details className="rounded-xl border border-white/10 bg-black/10 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold text-yellow-300 flex items-center justify-between">
          Advanced (lyrics & declarations)
          <span className="text-xs text-gray-500">optional</span>
        </summary>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}lyrics_text`} className="text-gray-300">Lyrics (Optional)</Label>
            <Textarea id={`${idPrefix}lyrics_text`} name="lyrics_text" value={formData.lyrics_text} onChange={onInputChange} rows={5} className="bg-white/5 border-white/10 focus:border-yellow-400 text-white" disabled={isSubmitting} />
          </div>

          <div className="space-y-4 pt-2 border-t border-white/10">
            <h4 className="text-md font-semibold text-yellow-400">Content Declarations</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
              {[
                { id: 'is_christian_nature', label: 'Christian Nature', defaultChecked: true },
                { id: 'is_instrumental', label: 'Instrumental', defaultChecked: false },
                { id: 'ai_in_production', label: 'AI in Production', defaultChecked: false },
                { id: 'ai_in_artwork', label: 'AI in Artwork', defaultChecked: false },
                { id: 'ai_in_lyrics', label: 'AI in Lyrics', defaultChecked: false },
              ].map(cb => (
                <div key={cb.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${idPrefix}${cb.id}`}
                    name={cb.id}
                    checked={formData[cb.id]}
                    onCheckedChange={(checked) => onInputChange({ target: { name: cb.id, checked, type: 'checkbox' } })}
                    className="border-gray-500 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black data-[state=checked]:border-yellow-500"
                    disabled={isSubmitting}
                  />
                  <Label htmlFor={`${idPrefix}${cb.id}`} className="text-gray-300 cursor-pointer text-sm">{cb.label}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>
    </>
  );
};

export default TrackFormFields;
