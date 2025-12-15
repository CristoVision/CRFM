import React, { useEffect, useRef } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { ScrollText } from 'lucide-react';

function PlayerLyricsView() {
  const { currentLyrics, activeLyricsLineIndex, hasLrc, lrcError } = usePlayer();
  const activeRef = useRef(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLyricsLineIndex]);

  if (lrcError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <ScrollText className="w-10 h-10 text-yellow-400 mb-2" />
        <p className="text-sm text-red-300">Could not load lyrics.</p>
      </div>
    );
  }

  if (!hasLrc || !currentLyrics?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4 space-y-2">
        <ScrollText className="w-10 h-10 text-yellow-400" />
        <p className="text-sm text-gray-300">No lyrics available for this track.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-3 py-4 space-y-2">
      {currentLyrics.map((line, idx) => {
        const isActive = idx === activeLyricsLineIndex;
        return (
          <div
            key={`${line.id || idx}-${line.time || idx}`}
            ref={isActive ? activeRef : null}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-yellow-400/20 border border-yellow-400/50 text-white'
                : 'bg-white/5 border border-white/5 text-gray-200'
            }`}
          >
            {line.text || '\u00a0'}
          </div>
        );
      })}
    </div>
  );
}

export default PlayerLyricsView;
