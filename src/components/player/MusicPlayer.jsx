// MODULE: MusicPlayer
// PURPOSE: Orquesta la UI del reproductor (collapsed / expanded / minimized) y mediaSession metadata/controles.
// EXPORTED: default
// DEPENDS: PlayerContext (usePlayer), AuthContext (useAuth), subcomponentes de UI

import React, { useEffect } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import CollapsedPlayer from './CollapsedPlayer';
import ExpandedPlayer from './ExpandedPlayer';
import FloatingPlayer from './FloatingPlayer';
import { useAuth } from '@/contexts/AuthContext';

function MusicPlayer() {
  const {
    currentTrack,
    playerState,
    isPlaying,
    play,          // alias a playAudio (expuesto por PlayerContext para compatibilidad)
    pause,         // alias a pauseAudio
    playNext,
    playPrevious,
    seekTo,
    audioRef
  } = usePlayer();

  const { user } = useAuth();

  // SECTION: Media Session metadata + handlers
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
        ['play', 'pause', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack', 'seekto']
          .forEach(action => navigator.mediaSession.setActionHandler(action, null));
      }
      return;
    }

    const metadata = {
      title: currentTrack.title,
      artist: currentTrack.creator_display_name || currentTrack.artist || 'CRFM',
      album: currentTrack.albumTitle || 'CRFM',
    };

    if (currentTrack.cover_art_url) {
      metadata.artwork = [
        { src: currentTrack.cover_art_url, sizes: '512x512', type: 'image/png' },
        { src: currentTrack.cover_art_url, sizes: '256x256', type: 'image/png' },
      ];
    }

    navigator.mediaSession.metadata = new MediaMetadata(metadata);
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    navigator.mediaSession.setActionHandler('play', () => { play(); });
    navigator.mediaSession.setActionHandler('pause', () => { pause(); });
    navigator.mediaSession.setActionHandler('seekbackward', ({ seekOffset = 10 }) => audioRef.current && seekTo(audioRef.current.currentTime - seekOffset));
    navigator.mediaSession.setActionHandler('seekforward', ({ seekOffset = 10 }) => audioRef.current && seekTo(audioRef.current.currentTime + seekOffset));
    navigator.mediaSession.setActionHandler('previoustrack', playPrevious);
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (audioRef.current && details.seekTime !== undefined) {
        seekTo(details.seekTime);
        if (!isPlaying) {
          play();
        }
      }
    });

    return () => {
      if (!('mediaSession' in navigator)) return;
      ['play', 'pause', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack', 'seekto']
        .forEach(action => navigator.mediaSession.setActionHandler(action, null));
    };
  }, [currentTrack, isPlaying, play, pause, playNext, playPrevious, seekTo, audioRef]);

  // SECTION: Keep position state synced (where supported)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !audioRef.current) return;
    const audioEl = audioRef.current;

    const updatePosition = () => {
      try {
        const duration = audioEl.duration;
        navigator.mediaSession.setPositionState?.({
          duration: isFinite(duration) ? duration : 0,
          position: audioEl.currentTime,
          playbackRate: audioEl.playbackRate,
        });
      } catch {
        // ignore unsupported browsers
      }
    };

    audioEl.addEventListener('timeupdate', updatePosition);
    updatePosition();

    return () => {
      audioEl.removeEventListener('timeupdate', updatePosition);
    };
  }, [currentTrack, audioRef]);

  // SECTION: Auth gate
  if (!user) return null;

  // SECTION: UI states
  if (playerState === 'minimized') return <FloatingPlayer />;
  if (!currentTrack) return null;

  switch (playerState) {
    case 'expanded':
      return <ExpandedPlayer />;
    case 'collapsed':
    default:
      return <CollapsedPlayer />;
  }
}

export default MusicPlayer;
