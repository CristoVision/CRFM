// MODULE: FloatingLyricsOverlay
// PURPOSE: Display floating or karaoke-style synced lyrics overlay during playback
// EXPORTED: FloatingLyricsOverlay
// DEPENDS: usePlayer, framer-motion

import React, { useEffect, useState } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { motion, AnimatePresence } from 'framer-motion';

// SECTION: Component Definition
function FloatingLyricsOverlay() {
  const {
    currentTrack,
    floatingLyricsMode,
    activeLyricsLineIndex,
    currentLyrics,
    isPlaying,
    hasLrc
  } = usePlayer();
  const [isVisible, setIsVisible] = useState(false);

  // SECTION: Derived lyric text
  const activeLyricText = hasLrc && activeLyricsLineIndex !== -1 && currentLyrics[activeLyricsLineIndex]
    ? currentLyrics[activeLyricsLineIndex].text
    : null;

  // SECTION: Visibility management
  useEffect(() => {
    if (floatingLyricsMode !== 'off' && activeLyricText && isPlaying && hasLrc) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [floatingLyricsMode, activeLyricText, isPlaying, hasLrc]);

  // SECTION: Conditional render guards
  if (floatingLyricsMode === 'off' || !hasLrc || !activeLyricText) return null;

  const baseContainerClasses = "fixed pointer-events-none z-[100] transition-all duration-300 ease-in-out flex items-center justify-center";
  let modeSpecificContainerClasses = "";
  let textClasses = "font-semibold text-center";
  let motionProps = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3, ease: "circOut" }
  };

  // SECTION: Phantom Mode (mini overlay)
  if (floatingLyricsMode === 'phantom') {
    modeSpecificContainerClasses = "bottom-24 left-1/2 -translate-x-1/2 w-auto";
    motionProps.initial = { opacity: 0, y: 20 };
    motionProps.animate = { opacity: 1, y: 0 };
    motionProps.exit = { opacity: 0, y: 20 };

    return (
      <AnimatePresence>
        {isVisible && currentTrack && (
          <motion.div {...motionProps} className={`${baseContainerClasses} ${modeSpecificContainerClasses}`}>
            <div className="bg-black/60 backdrop-blur-sm border border-yellow-400/30 px-4 py-2 rounded-lg shadow-2xl">
              <p className={`${textClasses} text-yellow-300 text-sm sm:text-base`}>{activeLyricText}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // SECTION: Karaoke Mode (fullscreen)
  if (floatingLyricsMode === 'karaoke') {
    modeSpecificContainerClasses = "top-0 left-0 w-full h-full p-4 sm:p-8 md:p-12";
    motionProps.initial = { opacity: 0, scale: 0.9 };
    motionProps.animate = { opacity: 1, scale: 1 };
    motionProps.exit = { opacity: 0, scale: 0.9 };

    return (
      <AnimatePresence>
        {isVisible && currentTrack && (
          <motion.div {...motionProps} className={`${baseContainerClasses} ${modeSpecificContainerClasses}`}>
            <div className="w-full max-w-4xl mx-auto bg-black/70 backdrop-blur-md border-2 border-yellow-500/50 px-4 py-3 sm:px-6 sm:py-4 rounded-xl shadow-2xl">
              <p className={`${textClasses} text-yellow-400 text-2xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight lyric-stroke-gold`}>
                {activeLyricText}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return null;
}

export default FloatingLyricsOverlay;
