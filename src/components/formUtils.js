import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';

export const defaultLanguages = [
  { value: "English", label: "English" },
  { value: "Español", label: "Español" },
  { value: "Tagalog", label: "Tagalog" },
  { value: "Cantonese", label: "Cantonese (粵語)" },
  { value: "Japanese", label: "Japanese (日本語)" },
];

export const normalizeTextInput = (value) => {
  if (typeof value !== 'string') return value;
  return value.normalize('NFC');
};

export const initialTrackFormData = {
  title: '',
  genre: '',
  customGenre: '',
  languages: [],
  release_date: null,
  track_number_on_album: 1,
  is_christian_nature: true,
  is_instrumental: false,
  ai_in_production: false,
  ai_in_artwork: false,
  ai_in_lyrics: false,
  lyrics_text: '',
  lrc_file_path: '', 
  audioFile: null,
  coverArtFile: null,
  video_cover_art_url: '',
  audioUploadProgress: 0,
  coverArtUploadProgress: 0,
  audioUploadComplete: false,
  coverArtUploadComplete: false,
  errors: {},
};

export const simulateUploadProgress = (file, progressSetter, completeSetter, fileType) => {
  if (!file) return false;
  
  const fileMimeType = file.type.toLowerCase();

  if (fileType === 'audio') {
    if (!fileMimeType.startsWith('audio/') || !['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav'].includes(fileMimeType)) {
      toast({ title: "Invalid Audio File", description: "Please upload a valid audio file (MP3 or WAV).", variant: "error"});
      return false; 
    }
  } else if (fileType === 'coverArt') {
    if (!fileMimeType.startsWith('image/')) {
      toast({ title: "Invalid Image File", description: "Please upload an image.", variant: "error"});
      return false;
    }
  }

  progressSetter(0);
  completeSetter(false);
  let currentProgress = 0;
  const interval = setInterval(() => {
    currentProgress += 10;
    if (currentProgress <= 100) {
      progressSetter(currentProgress);
    } else {
      clearInterval(interval);
      completeSetter(true);
    }
  }, 100);
  return true; 
};

export const uploadFileToSupabase = async (file, bucketName, userId, isPublic = false) => {
  const validBuckets = ['track-audio', 'track-cover', 'album-covers', 'playlist-covers', 'videocoverart'];
  if (!validBuckets.includes(bucketName)) {
    console.error(`Invalid bucket name: ${bucketName}. Must be one of ${validBuckets.join(', ')}`);
    throw new Error(`Invalid bucket name: ${bucketName}.`);
  }

  if (!file || !file.name) {
    console.error('No file or file.name provided to uploadFileToSupabase');
    throw new Error('No file or file.name provided to uploadFileToSupabase');
  }
  if (!userId) {
    console.error('No userId provided to uploadFileToSupabase');
    throw new Error('User ID is required for file upload.');
  }
  
  const nameParts = file.name.split('.');
  const ext = nameParts.pop();
  const base = nameParts.join('.')
    .replace(/\s+/g, '_')
    .replace(/[^\w-]/g, '')
    .toLowerCase();
  const safeName = `${base}.${ext}`;

  const filePath = `${userId}/${Date.now()}_${safeName}`;
  
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false, 
    });
  
  if (error) {
    console.error(`Supabase upload error to ${bucketName}:`, error);
    throw error;
  }
  
  const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return publicUrlData.publicUrl;
};

export const uploadPrivateFileToSupabase = async (file, bucketName, userId, options = {}) => {
  const validBuckets = ['downloads'];
  if (!validBuckets.includes(bucketName)) {
    console.error(`Invalid private bucket name: ${bucketName}. Must be one of ${validBuckets.join(', ')}`);
    throw new Error(`Invalid private bucket name: ${bucketName}.`);
  }

  if (!file || !file.name) {
    console.error('No file or file.name provided to uploadPrivateFileToSupabase');
    throw new Error('No file or file.name provided to uploadPrivateFileToSupabase');
  }
  if (!userId) {
    console.error('No userId provided to uploadPrivateFileToSupabase');
    throw new Error('User ID is required for private file upload.');
  }

  const nameParts = file.name.split('.');
  const ext = nameParts.pop();
  const base = nameParts
    .join('.')
    .replace(/\s+/g, '_')
    .replace(/[^\w-]/g, '')
    .toLowerCase();
  const safeName = `${base}.${ext}`;

  const prefix = options?.prefix ? String(options.prefix).replace(/^\/+|\/+$/g, '') : '';
  const filePath = prefix ? `${userId}/${prefix}/${Date.now()}_${safeName}` : `${userId}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage.from(bucketName).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    console.error(`Supabase private upload error to ${bucketName}:`, error);
    throw error;
  }

  return { bucket: bucketName, path: filePath };
};


export const validateTrackForm = (trackData, isAlbumContext = false) => {
  const errors = {};
  if (!trackData.title.trim()) errors.title = "Title is required.";
  if (trackData.title.length > 200) errors.title = "Title must be 200 characters or less.";
  
  if (!trackData.audioFile && !trackData.audio_file_url) errors.audioFile = "Audio file is required.";
  
  if (!isAlbumContext && !trackData.coverArtFile && !trackData.cover_art_url) {
    errors.coverArtFile = "Cover art is required for standalone tracks.";
  }
  
  if (!trackData.genre) errors.genre = "Genre is required.";
  if (trackData.genre === 'Other' && !trackData.customGenre.trim()) errors.customGenre = "Please specify genre.";
  if (!trackData.release_date) errors.release_date = "Release date is required.";
  if (trackData.track_number_on_album === undefined || trackData.track_number_on_album === null || isNaN(parseInt(trackData.track_number_on_album)) || parseInt(trackData.track_number_on_album) < 1) {
    errors.track_number_on_album = "Track # must be a number ≥ 1.";
  }
  if (!trackData.languages || trackData.languages.length === 0) errors.languages = "Language is required.";
  
  return errors;
};
