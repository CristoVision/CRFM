// MODULE: PlayerContext
// PURPOSE: Fuente única de verdad para el reproductor (track activo, cola vía QueueContext, estado UI, audio, lyrics y pagos).
// EXPORTED: usePlayer, PlayerProvider
// DEPENDS: AuthContext, QueueContext, usePlayerAudioControls, useLrcLoader, supabase (RPC), playerUtils (localStorage)

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLrcLoader } from '@/hooks/useLrcLoader';
import { loadStateFromLocalStorage, saveStateToLocalStorage } from '@/player/playerUtils.jsx';
import { usePlayerAudioControls } from '@/player/usePlayerAudioControls.js';
import { QueueContext } from '@/contexts/QueueContext.jsx';
import { supabase } from '@/lib/supabaseClient';
import { logTrackPlay } from '@/lib/analyticsClient';

// SECTION: Context bootstrap
const PlayerContext = createContext();

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
}

// SECTION: Local helpers (session + track positions)
function getClientSessionId(trackId) {
  const key = `crfm_session_track_${trackId}`;
  let id = null;
  try { id = localStorage.getItem(key); } catch { /* noop */ }
  if (!id) {
try {
  id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
  localStorage.setItem(key, id);
} catch {
  id = String(Date.now()) + Math.random().toString(16).slice(2);
}
  }
  return id;
}
function saveTrackPosition(trackId, seconds) {
  try { localStorage.setItem(`crfm_track_pos_${trackId}`, String(Math.max(0, Math.floor(seconds || 0)))); } catch { /* noop */ }
}
function getSavedTrackPosition(trackId) {
  try {
const v = localStorage.getItem(`crfm_track_pos_${trackId}`);
return v ? parseInt(v, 10) : 0;
  } catch { return 0; }
}
function clearTrackPosition(trackId) {
  try { localStorage.removeItem(`crfm_track_pos_${trackId}`); } catch { /* noop */ }
}

// SECTION: RPC helpers (billing/stream session)
async function rpcStartOrResumeStream(trackId, userId, positionSeconds = 0) {
  const clientSessionId = getClientSessionId(trackId);
  const { data, error } = await supabase.rpc('start_or_resume_stream', {
p_track_id: trackId,
p_user_id: userId,
p_client_session_id: clientSessionId,
p_position_seconds: Math.max(0, Math.floor(positionSeconds || 0)),
  });
  if (error) {
console.error('[RPC] start_or_resume_stream error:', error.message || error);
return { ok: false, reason: 'rpc_error', message: error.message };
  }
  return data || { ok: false, reason: 'no_data' };
}

// MODULE BODY: Provider
export function PlayerProvider({ children }) {
  // SECTION: External contexts
  const queueContext = useContext(QueueContext);
  const { user, refreshUserProfile } = useAuth();

  // SECTION: UI/Player state
  const [activePlayingTrack, setActivePlayingTrack] = useState(null);
  const [playerState, setPlayerState] = useState('collapsed'); // 'collapsed' | 'expanded' | 'minimized'
  const [showCollapsedLyrics, setShowCollapsedLyrics] = useState(true);
  const [floatingLyricsMode, setFloatingLyricsMode] = useState('off'); // 'off' | 'phantom' | 'karaoke'
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isRehydrated, setIsRehydrated] = useState(false);
  const [isEmbedContext, setIsEmbedContext] = useState(false);

  // SECTION: Audio controls (single <audio> ref + state)
  const {
audioRef, isPlaying, setIsPlaying, currentTime, setCurrentTime,
duration, setDuration, volume, setVolume, isMuted, setIsMuted,
previousVolume, setPreviousVolume, playAudio, pauseAudio, seekTo,
setVolumeLevel, toggleMute, resetAudio
  } = usePlayerAudioControls();

  // SECTION: Lyrics loader (LRC / plain fallback)
  const {
lyrics: currentLyrics,
activeIndex: activeLyricsLineIndex,
loading: lrcLoading,
error: lrcError,
hasLrc
  } = useLrcLoader(activePlayingTrack, currentTime);

  const normalizeTrackForPlayer = useCallback((track) => {
    if (!track) return track;
    const albumCover = track.album_cover_art_url || track.albums?.cover_art_url || null;
    const albumVideo = track.album_video_cover_art_url || track.albums?.video_cover_art_url || null;
    const creatorAvatar = track.creator_avatar_url || track.profiles?.avatar_url || null;
    return {
      ...track,
      album_cover_art_url: albumCover,
      album_video_cover_art_url: albumVideo,
      creator_avatar_url: creatorAvatar,
      cover_art_url: track.cover_art_url || albumCover || creatorAvatar || track.cover_art_url,
    };
  }, []);

  // SECTION: Core playback orchestrator
  const actuallyPlayTrack = useCallback((track, resumeAt = 0) => {
setActivePlayingTrack(track);
resetAudio();
setTimeout(() => {
  if (audioRef.current && Number.isFinite(resumeAt) && resumeAt > 0) {
    try { audioRef.current.currentTime = resumeAt; } catch { /* noop */ }
  }
  playAudio();
}, 50);
  }, [resetAudio, playAudio, audioRef]);

  // SECTION: Public entry point to request playback (handles billing/embeds/self-uploader)
  const handlePlayRequest = useCallback(async (trackToPlay, _trackQueueIgnored = []) => {
if (!trackToPlay || (isProcessingPayment && activePlayingTrack?.id !== trackToPlay.id)) return;
const normalizedTrack = normalizeTrackForPlayer(trackToPlay);

// Free for uploader
if (user && normalizedTrack.uploader_id === user.id) {
  const resumePos = getSavedTrackPosition(normalizedTrack.id);
  actuallyPlayTrack(normalizedTrack, resumePos);
  return;
}

// Embed preview (no-auth but priced) -> allow play
if (isEmbedContext && !user && normalizedTrack.stream_cost > 0) {
  const resumePos = getSavedTrackPosition(normalizedTrack.id);
  actuallyPlayTrack(normalizedTrack, resumePos);
  return;
}

const resumePos = getSavedTrackPosition(normalizedTrack.id);

// Paid streams
if (normalizedTrack.stream_cost && normalizedTrack.stream_cost > 0) {
  if (!user?.id) { setActivePlayingTrack(null); return; }
  setIsProcessingPayment(true);
  try {
    const res = await rpcStartOrResumeStream(normalizedTrack.id, user.id, resumePos);
    if (res?.ok || res?.reason === 'already_charged') {
      actuallyPlayTrack(normalizedTrack, resumePos);
      try { await refreshUserProfile?.(); } catch { /* noop */ }
    } else {
      setActivePlayingTrack(null);
      return;
    }
  } finally {
    setIsProcessingPayment(false);
  }
} else {
  // Free streams
  actuallyPlayTrack(normalizedTrack, resumePos);
}
  }, [
user, isProcessingPayment, activePlayingTrack?.id,
actuallyPlayTrack, refreshUserProfile, isEmbedContext, normalizeTrackForPlayer
  ]);

  // SECTION: Initial rehydrate from URL + localStorage
  useEffect(() => {
setIsEmbedContext(window.location.pathname.startsWith('/embed/'));

const saved = loadStateFromLocalStorage();
if (saved.currentTime && saved.currentTrack) setCurrentTime(saved.currentTime);

if (saved.volume !== undefined) {
  setVolume(saved.volume);
  if (audioRef.current) audioRef.current.volume = saved.volume;
}
if (saved.playerState) setPlayerState(saved.playerState);
if (saved.showCollapsedLyrics !== undefined) setShowCollapsedLyrics(saved.showCollapsedLyrics);
if (saved.floatingLyricsMode) setFloatingLyricsMode(saved.floatingLyricsMode);

setIsRehydrated(true);
  }, [audioRef, setCurrentTime, setVolume]);

  // SECTION: Persist changes to localStorage
  useEffect(() => {
if (!isRehydrated) return;
saveStateToLocalStorage({
  currentTrack: activePlayingTrack,
  currentTime: isPlaying ? currentTime : audioRef.current?.currentTime || 0,
  volume, playerState, showCollapsedLyrics, floatingLyricsMode, isPlaying
});
  }, [
activePlayingTrack, currentTime, volume, playerState,
showCollapsedLyrics, floatingLyricsMode, isPlaying, isRehydrated, audioRef
  ]);

  // SECTION: React to QueueContext changes (auto-play or stop)
  useEffect(() => {
if (!isRehydrated || !queueContext) return;
const trackFromQueue = queueContext.currentTrack;

if (trackFromQueue) {
  if (activePlayingTrack?.id !== trackFromQueue.id) {
    handlePlayRequest(
      trackFromQueue,
      queueContext.isShuffling ? queueContext.shuffledQueue : queueContext.queue
    );
  }
} else {
  if (activePlayingTrack) {
    pauseAudio();
    setActivePlayingTrack(null);
    resetAudio();
  }
}
  }, [
queueContext?.currentTrack, isRehydrated,
queueContext?.isShuffling, queueContext?.queue, queueContext?.shuffledQueue,
activePlayingTrack, pauseAudio, resetAudio, handlePlayRequest
  ]);

  // SECTION: Enrich track with album/creator art when missing
  useEffect(() => {
    if (!activePlayingTrack?.id) return;
    const needsEnrichment = !activePlayingTrack.cover_art_url ||
      !activePlayingTrack.album_cover_art_url ||
      !activePlayingTrack.album_video_cover_art_url ||
      !activePlayingTrack.creator_avatar_url;
    if (!needsEnrichment) return;

    let isMounted = true;
    const enrichTrack = async () => {
      const { data, error } = await supabase
        .from('tracks')
        .select('id, cover_art_url, video_cover_art_url, album_id, albums(cover_art_url, video_cover_art_url), profiles!tracks_uploader_id_profiles_fkey(avatar_url)')
        .eq('id', activePlayingTrack.id)
        .maybeSingle();
      if (!isMounted || error || !data) return;

      setActivePlayingTrack((prev) => {
        if (!prev || prev.id !== data.id) return prev;
        const merged = normalizeTrackForPlayer({
          ...prev,
          ...data,
          albums: data.albums || prev.albums,
          profiles: data.profiles || prev.profiles,
        });
        const didChange = merged.cover_art_url !== prev.cover_art_url ||
          merged.album_cover_art_url !== prev.album_cover_art_url ||
          merged.album_video_cover_art_url !== prev.album_video_cover_art_url ||
          merged.creator_avatar_url !== prev.creator_avatar_url ||
          merged.video_cover_art_url !== prev.video_cover_art_url;
        return didChange ? merged : prev;
      });
    };

    enrichTrack();
    return () => { isMounted = false; };
  }, [
    activePlayingTrack?.id,
    activePlayingTrack?.cover_art_url,
    activePlayingTrack?.album_cover_art_url,
    activePlayingTrack?.album_video_cover_art_url,
    activePlayingTrack?.creator_avatar_url,
    normalizeTrackForPlayer,
  ]);

  // SECTION: Wire audio element events -> player state
  useEffect(() => {
const audio = audioRef.current;
if (!audio) return;

const handleTimeUpdate = () => {
  const t = audio.currentTime;
  setCurrentTime(t);
  if (!audio.__lastSaved || Math.abs(t - audio.__lastSaved) >= 2) {
    if (activePlayingTrack?.id) saveTrackPosition(activePlayingTrack.id, t);
    audio.__lastSaved = t;
  }
};

const handleLoadedMetadata = () => {
  setDuration(audio.duration);
  if (activePlayingTrack?.id) {
    const resumeAt = getSavedTrackPosition(activePlayingTrack.id);
    if (Number.isFinite(resumeAt) && resumeAt > 0) {
      try { audio.currentTime = resumeAt; } catch { /* noop */ }
      setCurrentTime(resumeAt);
    }
  }
};

const handleAudioEnded = () => {
  if (activePlayingTrack?.id) clearTrackPosition(activePlayingTrack.id);
  if (activePlayingTrack?.id) {
    const playMs = Number.isFinite(duration) ? Math.floor(duration * 1000) : Math.floor((audioRef.current?.currentTime || 0) * 1000);
    logTrackPlay({
      trackId: activePlayingTrack.id,
      userId: user?.id || null,
      isPaid: !!activePlayingTrack?.stream_cost && activePlayingTrack.stream_cost > 0,
      amountCreatorCents: 0,
      amountOrgCents: 0,
      currencyCode: 'USD',
      source: isEmbedContext ? 'embed' : 'web',
      playMs,
      completed: true,
    });
  }
  if (queueContext) queueContext.playNext();
};

const handlePlayEvent = () => setIsPlaying(true);
const handlePauseEvent = () => setIsPlaying(false);

audio.addEventListener('timeupdate', handleTimeUpdate);
audio.addEventListener('loadedmetadata', handleLoadedMetadata);
audio.addEventListener('ended', handleAudioEnded);
audio.addEventListener('play', handlePlayEvent);
audio.addEventListener('pause', handlePauseEvent);

return () => {
  audio.removeEventListener('timeupdate', handleTimeUpdate);
  audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
  audio.removeEventListener('ended', handleAudioEnded);
  audio.removeEventListener('play', handlePlayEvent);
  audio.removeEventListener('pause', handlePauseEvent);
};
  }, [
activePlayingTrack?.id, queueContext,
setCurrentTime, setDuration, setIsPlaying, audioRef
  ]);

  // SECTION: Keep audio play/pause synced with isPlaying + track presence
  useEffect(() => {
if (audioRef.current && activePlayingTrack && isRehydrated) {
  if (isPlaying) playAudio();
  else pauseAudio();
} else if (!activePlayingTrack && audioRef.current) {
  pauseAudio();
  resetAudio();
}
  }, [isPlaying, activePlayingTrack, isRehydrated, playAudio, pauseAudio, resetAudio, audioRef]);

  // SECTION: Fire analytics on play start/resume
  useEffect(() => {
    if (!activePlayingTrack || !isPlaying) return;
    const playMs = Math.floor((audioRef.current?.currentTime || currentTime || 0) * 1000);
    logTrackPlay({
      trackId: activePlayingTrack.id,
      userId: user?.id || null,
      isPaid: !!activePlayingTrack?.stream_cost && activePlayingTrack.stream_cost > 0,
      amountCreatorCents: 0,
      amountOrgCents: 0,
      currencyCode: 'USD',
      source: isEmbedContext ? 'embed' : 'web',
      playMs,
      completed: false,
    });
  }, [activePlayingTrack, isPlaying, audioRef, currentTime, user?.id, isEmbedContext]);

  // SECTION: Public controls
  const togglePlay = useCallback(() => {
if (!activePlayingTrack && queueContext?.currentTrack) {
  handlePlayRequest(
    queueContext.currentTrack,
    queueContext.isShuffling ? queueContext.shuffledQueue : queueContext.queue
  );
} else if (activePlayingTrack) {
  if (isPlaying) pauseAudio();
  else playAudio();
}
  }, [activePlayingTrack, queueContext, handlePlayRequest, isPlaying, pauseAudio, playAudio]);

  const playerContextPlayNext = useCallback(() => { if (queueContext) queueContext.playNext(); }, [queueContext]);
  const playerContextPlayPrevious = useCallback(() => { if (queueContext) queueContext.playPrev(); }, [queueContext]);

  const toggleCollapsedLyrics = useCallback(() => setShowCollapsedLyrics(prev => !prev), []);
  const cycleFloatingLyricsMode = useCallback(() => {
setFloatingLyricsMode(prev => (prev === 'off' ? 'phantom' : prev === 'phantom' ? 'karaoke' : 'off'));
  }, []);

  // SECTION: Context value (== API pública del Player)
  const value = {
// state
currentTrack: activePlayingTrack,
isPlaying, setIsPlaying,
currentTime, duration, volume, isMuted, playerState,
activeLyricsLineIndex, currentLyrics, lrcLoading, lrcError, hasLrc,
showCollapsedLyrics, floatingLyricsMode, isProcessingPayment,
shuffleMode: queueContext?.isShuffling,
repeatMode: queueContext?.isRepeating,
isEmbedContext,

// refs
audioRef,

// playback API
playTrack: handlePlayRequest,
togglePlay,
playNext: playerContextPlayNext,
playPrevious: playerContextPlayPrevious,
seekTo,

// audio properties
setVolumeLevel, toggleMute, setPlayerState, toggleCollapsedLyrics, cycleFloatingLyricsMode,
cycleShuffleMode: () => queueContext?.toggleShuffle(),
cycleRepeatMode: () => queueContext?.toggleRepeat(),
queueContextCurrentTrack: queueContext?.currentTrack,

// compatibility aliases for existing consumers (e.g., MusicPlayer.jsx uses play/pause)
play: playAudio,
pause: pauseAudio,

// (exposure kept for completeness; not used directly here)
setIsMuted, setPreviousVolume, previousVolume,
  };

  // SECTION: Provider + dedicated <audio> element
  return (
<PlayerContext.Provider value={value}>
  {children}
  <audio ref={audioRef} src={activePlayingTrack?.audio_file_url} crossOrigin="anonymous" />
</PlayerContext.Provider>
  );
}
