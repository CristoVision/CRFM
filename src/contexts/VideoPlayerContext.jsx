import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { usePlayer } from '@/contexts/PlayerContext';
import VideoPlayerModal from '@/components/videos/VideoPlayerModal';
import { reportClientError } from '@/lib/errorReporter';

const VideoPlayerContext = createContext(null);

export function useVideoPlayer() {
  const ctx = useContext(VideoPlayerContext);
  if (!ctx) throw new Error('useVideoPlayer must be used within a VideoPlayerProvider');
  return ctx;
}

export function VideoPlayerProvider({ children }) {
  const { pause } = usePlayer();
  const [currentVideo, setCurrentVideo] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      setCurrentVideo(null);
      setPlaybackUrl('');
      setErrorText('');
    }, 150);
  }, []);

  const playVideo = useCallback(async (video) => {
    if (!video) return;
    try { pause?.(); } catch { /* noop */ }
    setCurrentVideo(video);
    setPlaybackUrl('');
    setErrorText('');
    setLoadingUrl(true);
    setIsOpen(true);

    try {
      if (video.storage_path) {
        const { data } = supabase.storage.from('video').getPublicUrl(video.storage_path);
        if (data?.publicUrl) {
          setPlaybackUrl(data.publicUrl);
        } else {
          setErrorText('Could not generate playback URL for this video.');
        }
      } else {
        setErrorText('No video file associated with this record.');
      }
    } catch (err) {
      console.error('VideoPlayerProvider: error getting video URL', err);
      setErrorText('Could not generate playback URL for this video.');
      reportClientError({
        source: 'video_playback_url',
        message: err?.message || 'Failed to get video URL',
        context: { videoId: video.id },
      });
    } finally {
      setLoadingUrl(false);
    }
  }, [pause]);

  const value = {
    currentVideo,
    playbackUrl,
    loadingUrl,
    errorText,
    isOpen,
    playVideo,
    close,
  };

  return (
    <VideoPlayerContext.Provider value={value}>
      {children}
      <VideoPlayerModal
        isOpen={isOpen}
        onClose={close}
        video={currentVideo}
        playbackUrl={playbackUrl}
        loadingUrl={loadingUrl}
        errorText={errorText}
      />
    </VideoPlayerContext.Provider>
  );
}
