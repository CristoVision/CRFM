// MODULE: UnauthenticatedRadio
// PURPOSE: Provides CRFM live radio playback for unauthenticated users
// EXPORTED: UnauthenticatedRadio
// DEPENDS: supabaseClient, use-toast, framer-motion, lucide-react, shadcn/ui

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Radio, Music, X, ChevronUp, Play, Pause, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useLanguage } from '@/contexts/LanguageContext';

// SECTION: Context Setup
const UnauthenticatedRadioContext = createContext();

// SECTION: Hook for using radio context
export const useUnauthenticatedRadio = () => {
  const context = useContext(UnauthenticatedRadioContext);
  if (context === undefined) {
    return {
      playStation: () => console.warn('useUnauthenticatedRadio must be used within a provider'),
      pause: () => { },
      resume: () => { },
      currentStation: null,
      currentTrack: null,
      isPlaying: false,
      isLoading: false,
      isMuted: true,
      setIsMuted: () => { },
      volume: 0,
      setVolume: () => { },
      showPlayer: false,
      setShowPlayer: () => { },
      isMinimized: true,
      setIsMinimized: () => { },
    };
  }
  return context;
};

// SECTION: Provider
const UnauthenticatedRadioProvider = ({ children }) => {
  const { t } = useLanguage();
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStation, setCurrentStation] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    try { return localStorage.getItem('radio-muted') === 'true'; } catch { return true; }
  });
  const [volume, setVolume] = useState(() => {
    try { return parseFloat(localStorage.getItem('radio-volume')) || 0.5; } catch { return 0.5; }
  });
  const [showPlayer, setShowPlayer] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);

  // SECTION: Effects for audio sync
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => { try { localStorage.setItem('radio-muted', isMuted); } catch { } }, [isMuted]);
  useEffect(() => { try { localStorage.setItem('radio-volume', volume); } catch { } }, [volume]);

  // SECTION: Core stream fetcher
  const fetchAndPlayTrack = async (station) => {
    setIsLoading(true);
    try {
      const { data: rpcTracks, error: rpcError } = await supabase.rpc('get_active_station_tracks', { p_station_id: station.id, p_limit: 1 });
      if (rpcError) throw rpcError;

      const track = rpcTracks?.[0];
      if (track && audioRef.current) {
        setCurrentTrack({
          title: track.title,
          artist: track.creator_display_name,
          cover_art_url: track.cover_art_url,
        });
        audioRef.current.src = track.audio_file_url;
        await audioRef.current.play();
        setIsPlaying(true);
      } else {
        toast({ title: t('player.radio.stationEmptyTitle'), description: t('player.radio.stationEmptyDescription'), variant: "destructive" });
        pause();
      }
    } catch (error) {
      toast({ title: t('player.radio.playErrorTitle'), description: error.message, variant: "destructive" });
      pause();
    } finally {
      setIsLoading(false);
    }
  };

  // SECTION: Controls
  const playStation = (station) => {
    if (currentStation?.id === station.id && isPlaying) return;
    setCurrentStation(station);
    setShowPlayer(true);
    setIsMinimized(false);
    fetchAndPlayTrack(station);
  };

  const pause = () => { if (audioRef.current) audioRef.current.pause(); setIsPlaying(false); };
  const resume = () => {
    if (audioRef.current && audioRef.current.src) { audioRef.current.play(); setIsPlaying(true); }
    else if (currentStation) { fetchAndPlayTrack(currentStation); }
  };

  const value = { playStation, pause, resume, currentStation, currentTrack, isPlaying, isLoading, isMuted, setIsMuted, volume, setVolume, showPlayer, setShowPlayer, isMinimized, setIsMinimized };

  return (
    <UnauthenticatedRadioContext.Provider value={value}>
      {children}
      <audio ref={audioRef} onEnded={() => fetchAndPlayTrack(currentStation)} crossOrigin="anonymous" />
    </UnauthenticatedRadioContext.Provider>
  );
};

// SECTION: Player UI
const RadioPlayerUI = () => {
  const {
    currentStation, currentTrack, isPlaying, isLoading, pause, resume,
    isMuted, setIsMuted, volume, setVolume, showPlayer, setShowPlayer,
    isMinimized, setIsMinimized
  } = useUnauthenticatedRadio();
  const { t } = useLanguage();

  if (!showPlayer) return null;

  if (isMinimized) {
    return (
      <div
        className="group fixed bottom-6 right-6 z-[55] w-14 h-14 rounded-full golden-gradient flex items-center justify-center cursor-pointer shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-200 ease-out"
        onClick={() => setIsMinimized(false)}
        role="button"
        title={currentStation?.name || t('player.radio.open')}
      >
        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.div key="playing" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute inset-0 flex items-center justify-center">
              <Music className="w-7 h-7 text-black group-hover:rotate-[15deg] transition-transform duration-300" />
            </motion.div>
          ) : (
            <motion.div key="paused" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute inset-0 flex items-center justify-center">
              <Radio className="w-7 h-7 text-black" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // SECTION: Expanded Radio UI
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-4 right-4 z-[60] w-[350px] player-background rounded-xl p-4 shadow-2xl border border-white/10"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 bg-yellow-400/10 rounded-md">
              <Radio className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-white truncate">{currentStation?.name || t('player.radio.defaultStation')}</h4>
              <p className="text-xs text-gray-400">{t('player.radio.liveLabel')}</p>
            </div>
          </div>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="player-button h-7 w-7" onClick={() => setIsMinimized(true)}><ChevronUp className="w-4 h-4 rotate-180" /></Button>
            <Button variant="ghost" size="icon" className="player-button h-7 w-7" onClick={() => { pause(); setShowPlayer(false); }}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <img
            src={currentTrack?.cover_art_url || "/favicon-32x32.png"}
            alt={currentTrack?.title || t('player.radio.coverArtAlt')}
            className="w-16 h-16 rounded-md object-cover border border-white/10"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white truncate">{isLoading ? t('player.radio.loading') : (currentTrack?.title || t('player.radio.upNext'))}</p>
            <p className="text-sm text-gray-400 truncate">{currentTrack?.artist || t('player.radio.defaultArtist')}</p>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-3 my-4">
          <Button
            onClick={isPlaying ? pause : resume}
            size="icon"
            className="w-11 h-11 rounded-full golden-gradient text-black hover:opacity-90"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />)}
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Button onClick={() => setIsMuted(m => !m)} variant="ghost" size="icon" className="player-button h-7 w-7">
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            onValueChange={(val) => setVolume(val[0])}
            max={1}
            step={0.05}
            className="player-slider"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// SECTION: Export wrapper
const UnauthenticatedRadio = () => (
  <UnauthenticatedRadioProvider>
    <RadioPlayerUI />
  </UnauthenticatedRadioProvider>
);

export default UnauthenticatedRadio;
