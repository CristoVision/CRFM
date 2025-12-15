import React, { useState, useEffect, useRef } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { Music, MessageSquare, Type, XCircle, ChevronUp, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

function FloatingPlayer() {
  const { 
    setPlayerState, 
    cycleFloatingLyricsMode, 
    floatingLyricsMode,
    currentTrack,
    hasLrc 
  } = usePlayer();
  const { user } = useAuth();
  const [showOptions, setShowOptions] = useState(false);
  const optionsRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      const mainButton = event.target.closest('.floating-player-button-main-trigger');
      if (optionsRef.current && !optionsRef.current.contains(event.target) && !mainButton) {
        setShowOptions(false);
      }
    }
    if (showOptions) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [optionsRef, showOptions]);

  // If there's no user, this component shouldn't render at all.
  // The logic in App.jsx handles this, but we'll keep the check here.
  if (!user) return null;

  const handleMainClick = (e) => {
    e.stopPropagation(); 
    setShowOptions(prev => !prev);
  };

  const getIconForMode = () => {
    if (floatingLyricsMode === 'phantom') return <MessageSquare className="w-4 h-4" />;
    if (floatingLyricsMode === 'karaoke') return <Type className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />; 
  };
  
  const getLabelForMode = () => {
    if (floatingLyricsMode === 'phantom') return "Lyrics: Phantom";
    if (floatingLyricsMode === 'karaoke') return "Lyrics: Karaoke";
    return "Lyrics: Off";
  };

  return (
    <>
      <div 
        className="floating-player-button-main-trigger group fixed bottom-6 right-6 z-[55] w-14 h-14 rounded-full golden-gradient flex items-center justify-center cursor-pointer shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-200 ease-out"
        onClick={handleMainClick}
        role="button"
        tabIndex={0}
        aria-haspopup="true"
        aria-expanded={showOptions}
        aria-label="Open player options"
      >
        <Music className="w-7 h-7 text-black group-hover:rotate-[15deg] transition-transform duration-300" />
      </div>
      <AnimatePresence>
        {showOptions && (
          <motion.div
            ref={optionsRef}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "circOut" }}
            className="fixed bottom-24 right-6 w-auto p-2 bg-black/90 backdrop-blur-md rounded-lg shadow-xl flex flex-col items-start space-y-1.5 border border-yellow-400/30 z-[60]"
            onClick={(e) => e.stopPropagation()} 
          >
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-yellow-400/20 hover:text-yellow-300 w-full justify-start px-3 py-2 text-sm"
              onClick={() => {
                setPlayerState('collapsed');
                setShowOptions(false);
              }}
              disabled={!currentTrack} 
            >
              <ChevronUp className="w-4 h-4 mr-2" /> Open Player
            </Button>
            
            {currentTrack && hasLrc && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-yellow-400/20 hover:text-yellow-300 w-full justify-start px-3 py-2 text-sm"
                onClick={() => {
                  cycleFloatingLyricsMode();
                }}
              >
                {getIconForMode()}
                <span className="ml-2">{getLabelForMode()}</span>
              </Button>
            )}
             {currentTrack && !hasLrc && (
              <div className="px-3 py-2 text-xs text-gray-400 flex items-center w-full justify-start">
                <Settings2 className="w-4 h-4 mr-2 text-gray-500" />
                <span>Lyrics options unavailable</span>
              </div>
            )}
            {!currentTrack && (
                 <div className="px-3 py-2 text-xs text-gray-400 flex items-center w-full justify-start">
                    <Music className="w-4 h-4 mr-2 text-gray-500" />
                    <span>No track loaded</span>
                </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default FloatingPlayer;
