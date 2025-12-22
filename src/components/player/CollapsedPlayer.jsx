// MODULE: CollapsedPlayer
// PURPOSE: Barra inferior persistente con controles básicos, info de track y un “ticker” de lyric activo.
// EXPORTED: default
// DEPENDS: PlayerContext (usePlayer), framer-motion, subcomponentes (Controls, TrackInfo, Volume, Actions, ProgressBar)

import React, { useEffect, useState } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { motion, AnimatePresence } from 'framer-motion';
import CollapsedPlayerControls from './CollapsedPlayerControls.jsx';
import CollapsedPlayerTrackInfo from './CollapsedPlayerTrackInfo.jsx';
import CollapsedPlayerVolume from './CollapsedPlayerVolume.jsx';
import CollapsedPlayerActions from './CollapsedPlayerActions.jsx';
import CollapsedPlayerProgressBar from './CollapsedPlayerProgressBar.jsx';

function CollapsedPlayer() {
  const {
    currentTrack,
    showCollapsedLyrics,
    currentLyrics,
    activeLyricsLineIndex,
    hasLrc,
  } = usePlayer();
  const [isDocked, setIsDocked] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById('player-dock-sentinel');
    if (!sentinel || typeof IntersectionObserver === 'undefined') {
      setIsDocked(false);
      return () => {};
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsDocked(Boolean(entry?.isIntersecting));
      },
      { root: null, threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const activeLyricText =
    hasLrc &&
      activeLyricsLineIndex !== -1 &&
      currentLyrics[activeLyricsLineIndex]
      ? currentLyrics[activeLyricsLineIndex].text
      : null;

  return (
    <div className={`${isDocked ? 'absolute' : 'fixed'} bottom-0 left-0 right-0 player-background border-t border-white/10 player-shadow z-50`}>
      {/* SECTION: Active lyric ticker */}
      <AnimatePresence>
        {showCollapsedLyrics && hasLrc && activeLyricText && currentTrack && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="px-4 pt-3 pb-1 text-center"
          >
            <p className="text-yellow-400 text-sm truncate font-semibold lyric-line-highlight">
              {activeLyricText}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION: Controls row */}
      <div className="px-3 sm:px-4 py-3">
        <CollapsedPlayerProgressBar />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CollapsedPlayerTrackInfo />
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <CollapsedPlayerControls />
            <div className="flex items-center space-x-1 sm:space-x-3">
              <CollapsedPlayerVolume />
              <CollapsedPlayerActions />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CollapsedPlayer;
