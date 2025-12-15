import { useState, useCallback, useEffect, useRef } from 'react';

export const usePlayerAudioControls = (initialCurrentTime = 0, initialVolume = 1) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialCurrentTime);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(initialVolume);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(initialVolume);

  const playAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.error("[PlayerAudioControls] Error playing audio:", e));
      setIsPlaying(true);
    }
  }, []);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const seekTo = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolumeLevel = useCallback((vol) => {
    setVolume(vol);
    setIsMuted(vol === 0);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      audioRef.current.muted = vol === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setVolumeLevel(previousVolume);
    } else {
      setPreviousVolume(volume);
      setVolumeLevel(0);
    }
  }, [isMuted, volume, previousVolume, setVolumeLevel]);

  const resetAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    setCurrentTime(0);
    setDuration(0);
  }, []);

  return {
    audioRef,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    previousVolume,
    setPreviousVolume,
    playAudio,
    pauseAudio,
    seekTo,
    setVolumeLevel,
    toggleMute,
    resetAudio,
  };
};
