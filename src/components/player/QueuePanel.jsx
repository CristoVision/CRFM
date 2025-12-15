import React, { useContext } from 'react';
import { QueueContext } from '@/contexts/QueueContext.jsx';
import { usePlayer } from '@/contexts/PlayerContext.jsx';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { X, ListMusic, Play, Trash2, Shuffle } from 'lucide-react';

const DEFAULT_COVER_ART = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXVkaW98ZW58MHx8MHx8fDA%3D&w=1000&q=80';

const QueuePanel = ({ onClose }) => {
  const queueContext = useContext(QueueContext);
  const playerContext = usePlayer();

  if (!queueContext) {
    return null;
  }

  const {
    queue,
    shuffledQueue,
    isShuffling,
    playTrackAtIndex,
    removeFromQueue,
    clearQueue,
    toggleShuffle,
  } = queueContext;

  const activeQueue = isShuffling ? shuffledQueue : queue;
      // currentTrackIndex from QueueContext is the index in the *active* queue.
      // queueContext.currentTrack is the actual track object.

  const handlePlayTrack = (indexInDisplayedActiveQueue) => {
    if (indexInDisplayedActiveQueue < 0 || indexInDisplayedActiveQueue >= activeQueue.length) {
      return;
    }
    playTrackAtIndex(indexInDisplayedActiveQueue);
    playerContext?.setIsPlaying(true);
  };

      const handleRemoveTrack = (e, trackId) => {
        e.stopPropagation(); 
        removeFromQueue(trackId);
      };
      
      const handleClearQueue = (e) => {
        e.stopPropagation();
        clearQueue();
      };

  const handleShuffleQueue = (e) => {
    e.stopPropagation();
    toggleShuffle();
  };

      if (!activeQueue || activeQueue.length === 0) {
        return (
          <div className="p-4 bg-neutral-800 text-white rounded-lg shadow-xl w-full max-w-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <ListMusic className="w-5 h-5 mr-2 text-yellow-400" />
                Queue (0 tracks)
              </h3>
              <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-grow flex flex-col items-center justify-center text-neutral-400">
              <ListMusic className="w-16 h-16 mb-4 text-neutral-600" />
              <p className="text-lg">Your queue is empty.</p>
              <p className="text-sm">Add some music to get started!</p>
            </div>
          </div>
        );
      }

      return (
        <div className="p-4 bg-neutral-800 text-white rounded-lg shadow-xl w-full max-w-md h-full flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold flex items-center">
              <ListMusic className="w-5 h-5 mr-2 text-yellow-400" />
              Queue ({activeQueue.length} tracks)
            </h3>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShuffleQueue}
                className={`p-2 ${isShuffling ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-400 hover:text-white'}`}
                title={isShuffling ? "Reshuffle" : "Shuffle Queue"}
                disabled={activeQueue.length < 2}
              >
                <Shuffle className="w-4 h-4" />
              </Button>
              {activeQueue.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleClearQueue} 
                  className="text-xs border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center py-1 px-2"
                  disabled={activeQueue.length === 0}
                  title="Clear Queue"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white p-2">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <ScrollArea className="h-64 md:h-80 flex-grow pr-3">
            <div className="space-y-2">
              {activeQueue.map((track, index) => {
                // queueContext.currentTrack is the actual playing track object.
                // We need to compare its ID with the track in the list.
                const isCurrentlyPlaying = playerContext.currentTrack?.id === track.id && playerContext.isPlaying;
                return (
                  <div
                    key={track.id + '-' + index} 
                    className={`flex items-center p-2 rounded-md cursor-pointer transition-all duration-150 ease-in-out group
                                ${isCurrentlyPlaying 
                                  ? 'bg-yellow-500/20 hover:bg-yellow-500/30 ring-1 ring-yellow-500/50' 
                                  : 'hover:bg-neutral-700/60'
                                }`}
                    onClick={() => handlePlayTrack(index)}
                  >
                    <img
                      src={track.cover_art_url || DEFAULT_COVER_ART}
                      alt={track.title}
                      className="w-10 h-10 rounded object-cover mr-3 shadow-sm"
                    />
                    <div className="flex-grow min-w-0">
                      <p className={`font-medium truncate ${isCurrentlyPlaying ? 'text-yellow-300' : 'text-white group-hover:text-yellow-400'}`}>
                        {track.title}
                      </p>
                      <p className="text-xs text-neutral-400 truncate group-hover:text-neutral-300">
                        {track.creator_display_name || 'Unknown Artist'}
                      </p>
                    </div>
                    {isCurrentlyPlaying && (
                      <Play className="w-4 h-4 text-yellow-400 flex-shrink-0 mx-2 animate-pulse" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2 w-7 h-7 text-neutral-500 hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => handleRemoveTrack(e, track.id)}
                      title="Remove from queue"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      );
    };

    export default QueuePanel;
