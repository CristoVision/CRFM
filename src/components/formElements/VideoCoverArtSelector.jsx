import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { uploadFileToSupabase } from '@/components/formUtils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2, PlaySquare, RefreshCw, UploadCloud, X } from 'lucide-react';

const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'image/gif'];

const VideoCoverArtSelector = ({
  userId,
  value,
  onChange,
  label = 'Video cover art (5 seconds)',
  description = 'Upload a short looping video cover art or pick one you have already uploaded. Stored in bucket: videocoverart.',
  disabled = false,
  note,
}) => {
  const [existingVideos, setExistingVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    try {
      const url = new URL(value);
      return decodeURIComponent(url.pathname.split('/').pop() || 'Selected video');
    } catch {
      return 'Selected video';
    }
  }, [value]);

  const fetchExistingVideos = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.storage.from('videocoverart').list(userId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw error;

      const mapped = (data || []).map((item) => {
        const { data: urlData } = supabase.storage.from('videocoverart').getPublicUrl(`${userId}/${item.name}`);
        return {
          name: item.name,
          url: urlData?.publicUrl,
        };
      }).filter(Boolean);

      setExistingVideos(mapped);
    } catch (error) {
      console.error('Error fetching video cover arts', error);
      toast({ title: 'Could not load video cover art', description: error.message || 'Storage access failed.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchExistingVideos();
  }, [fetchExistingVideos]);

  const validateDuration = (file) => {
    if (!file) return Promise.resolve(false);
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        if (video.duration && video.duration > 5.25) {
          toast({ title: 'Video too long', description: 'Please upload a clip of 5 seconds or less.', variant: 'destructive' });
          resolve(false);
        } else {
          resolve(true);
        }
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(true); // fall back to trusting the upload if metadata fails (e.g., GIF)
      };
      video.src = url;
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !userId) return;
    if (!ACCEPTED_VIDEO_TYPES.some((type) => file.type === type || (type.startsWith('video/') && file.type.startsWith('video/')))) {
      toast({ title: 'Invalid file', description: 'Upload MP4/WEBM/OGG/MOV or GIF files.', variant: 'destructive' });
      return;
    }

    const isDurationOk = await validateDuration(file);
    if (!isDurationOk) return;

    setIsUploading(true);
    try {
      const url = await uploadFileToSupabase(file, 'videocoverart', userId, true);
      onChange?.(url);
      toast({ title: 'Video cover art uploaded', description: '5-second loop ready to use.', variant: 'success' });
      fetchExistingVideos();
    } catch (error) {
      console.error('Error uploading video cover art', error);
      toast({ title: 'Upload failed', description: error.message || 'Unable to upload video cover art.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectExisting = (url) => {
    onChange?.(url);
    toast({ title: 'Video cover art selected', description: 'Loop will display where supported.', variant: 'success' });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">{label}</Label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="text-gray-300 hover:text-yellow-300" onClick={fetchExistingVideos} disabled={disabled || isLoading || isUploading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" className="text-gray-300 hover:text-red-400" onClick={() => onChange?.('')} disabled={disabled || isUploading}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      {description && <p className="text-xs text-gray-400">{description}</p>}
      {note && <p className="text-xs text-yellow-300">{note}</p>}

      <div className="flex items-center gap-3">
        <Input type="file" accept="video/*,image/gif" onChange={handleFileChange} disabled={disabled || isUploading} className="bg-white/5 border-white/10 text-gray-400 file:text-yellow-400 hover:file:bg-yellow-400/10" />
        <Button type="button" variant="outline" className="border-yellow-400/40 text-yellow-300 hover:bg-yellow-400/10" disabled>
          <UploadCloud className="w-4 h-4 mr-2" />
          Bucket: videocoverart
        </Button>
      </div>

      {value && (
        <div className="relative rounded-lg overflow-hidden border border-yellow-500/30">
          <video
            key={value}
            src={value}
            className="w-full h-48 object-cover bg-black"
            loop
            muted
            playsInline
            autoPlay
            poster=""
          />
          <div className="absolute bottom-2 left-2 bg-black/60 text-xs text-yellow-200 px-2 py-1 rounded flex items-center gap-1">
            <PlaySquare className="w-4 h-4" />
            <span>{selectedLabel}</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-200">Your uploaded video cover arts</p>
          <p className="text-xs text-gray-400">{existingVideos.length} found</p>
        </div>
        {existingVideos.length === 0 ? (
          <p className="text-xs text-gray-500 border border-dashed border-white/10 rounded-md p-3">No uploads yet. Add a 5-second loop to get started.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-auto pr-1 custom-scrollbar">
            {existingVideos.map((item) => (
              <button
                key={item.url}
                type="button"
                className={`group relative rounded-md overflow-hidden border ${value === item.url ? 'border-yellow-400/70' : 'border-white/10'} hover:border-yellow-400/60 transition-colors`}
                onClick={() => handleSelectExisting(item.url)}
                disabled={disabled || isUploading}
              >
                <video src={item.url} className="w-full h-28 object-cover bg-black" muted loop playsInline />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10" />
                <div className="absolute bottom-1 left-1 right-1 bg-black/60 text-[11px] text-gray-200 px-2 py-1 truncate flex items-center gap-1">
                  <PlaySquare className="w-3 h-3" />
                  <span title={item.name}>{item.name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCoverArtSelector;
