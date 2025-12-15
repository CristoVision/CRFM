import React, { createContext, useState, useEffect, useCallback } from 'react';

export const QueueContext = createContext();

export const QueueProvider = ({ children }) => {
  const [queue, setQueue] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [shuffledQueue, setShuffledQueue] = useState([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false); 

  const currentTrack = isShuffling 
    ? (shuffledQueue[currentTrackIndex] || null) 
    : (queue[currentTrackIndex] || null);

  const setPlaybackQueue = useCallback((tracks, startIndex = 0) => {
    setQueue(tracks);
    if (isShuffling) {
      const newShuffledQueue = [...tracks].sort(() => Math.random() - 0.5);
      setShuffledQueue(newShuffledQueue);
      const currentTrackInNewShuffle = newShuffledQueue.findIndex(t => t.id === tracks[startIndex]?.id);
      setCurrentTrackIndex(currentTrackInNewShuffle !== -1 ? currentTrackInNewShuffle : 0);
    } else {
      setCurrentTrackIndex(startIndex);
      setShuffledQueue([]); 
    }
  }, [isShuffling]);

  const playTrackAtIndex = useCallback((index) => {
    if (isShuffling) {
      if (index >= 0 && index < shuffledQueue.length) {
        setCurrentTrackIndex(index);
      }
    } else {
      if (index >= 0 && index < queue.length) {
        setCurrentTrackIndex(index);
      }
    }
  }, [isShuffling, queue, shuffledQueue]);

  const nextTrack = useCallback(() => {
    const activeQueue = isShuffling ? shuffledQueue : queue;
    if (activeQueue.length === 0) return;

    if (isRepeating === 'one' && currentTrackIndex !== -1) {
      // Repeat current track logic is handled by player's onEnded
      // For explicit next, it should go to next or loop if it's the only track
      if (activeQueue.length === 1) {
         setCurrentTrackIndex(0);
      } else {
        setCurrentTrackIndex(prevIndex => (prevIndex + 1) % activeQueue.length);
      }
    } else if (isRepeating === 'all' && currentTrackIndex === activeQueue.length - 1) {
      setCurrentTrackIndex(0);
    } else if (currentTrackIndex < activeQueue.length - 1) {
      setCurrentTrackIndex(prevIndex => prevIndex + 1);
    } else if (isRepeating !== 'all' && currentTrackIndex === activeQueue.length - 1) {
      // Stop at the end if not repeating all
      // Or potentially clear player state, handled by PlayerContext
    }
  }, [currentTrackIndex, queue, shuffledQueue, isShuffling, isRepeating]);


  const prevTrack = useCallback(() => {
    const activeQueue = isShuffling ? shuffledQueue : queue;
    if (activeQueue.length === 0) return;

    if (isRepeating === 'one' && currentTrackIndex !== -1) {
       // Similar to nextTrack, repeat one is handled by onEnded
       // For explicit prev, it should go to prev or loop if it's the only track
       if (activeQueue.length === 1) {
         setCurrentTrackIndex(0);
       } else {
         setCurrentTrackIndex(prevIndex => (prevIndex - 1 + activeQueue.length) % activeQueue.length);
       }
    } else if (currentTrackIndex > 0) {
      setCurrentTrackIndex(prevIndex => prevIndex - 1);
    } else if (isRepeating === 'all' && currentTrackIndex === 0) {
      setCurrentTrackIndex(activeQueue.length - 1);
    }
  }, [currentTrackIndex, queue, shuffledQueue, isShuffling, isRepeating]);
  
  const toggleShuffle = useCallback(() => {
    setIsShuffling(prev => {
      const newShuffleState = !prev;
      if (newShuffleState) {
        const currentPlayingTrackId = queue[currentTrackIndex]?.id;
        const newShuffledQueue = [...queue].sort(() => Math.random() - 0.5);
        setShuffledQueue(newShuffledQueue);
        const newIndexInShuffled = newShuffledQueue.findIndex(t => t.id === currentPlayingTrackId);
        setCurrentTrackIndex(newIndexInShuffled !== -1 ? newIndexInShuffled : 0);
      } else {
        // When turning shuffle off, find the current track from shuffled queue in original queue
        const currentPlayingTrackId = shuffledQueue[currentTrackIndex]?.id;
        const newIndexInOriginal = queue.findIndex(t => t.id === currentPlayingTrackId);
        setCurrentTrackIndex(newIndexInOriginal !== -1 ? newIndexInOriginal : 0);
        setShuffledQueue([]); // Clear shuffled queue
      }
      return newShuffleState;
    });
  }, [queue, currentTrackIndex, shuffledQueue]);

  const toggleRepeat = useCallback(() => {
    setIsRepeating(prev => {
      if (prev === false) return 'all';
      if (prev === 'all') return 'one';
      return false; // Off
    });
  }, []);

  const addToQueue = useCallback((track) => {
    setQueue(prevQueue => {
      if (prevQueue.find(t => t.id === track.id)) return prevQueue; // Avoid duplicates
      const newQueue = [...prevQueue, track];
      if (isShuffling) {
        // Add to shuffled queue as well, perhaps at a random position or end
        setShuffledQueue(prevShuffled => [...prevShuffled, track]); 
      }
      return newQueue;
    });
  }, [isShuffling]);

  const removeFromQueue = useCallback((trackId) => {
    let removedTrackIndexInOriginal = -1;
    let removedTrackIndexInShuffled = -1;
    
    setQueue(prevQueue => {
      removedTrackIndexInOriginal = prevQueue.findIndex(t => t.id === trackId);
      const newQueue = prevQueue.filter(t => t.id !== trackId);
      
      if (isShuffling) {
        setShuffledQueue(prevShuffled => {
          removedTrackIndexInShuffled = prevShuffled.findIndex(t => t.id === trackId);
          return prevShuffled.filter(t => t.id !== trackId);
        });
      }
      
      // Adjust currentTrackIndex if the removed track was before or at the current index
      if (!isShuffling && removedTrackIndexInOriginal !== -1 && removedTrackIndexInOriginal <= currentTrackIndex) {
        if (removedTrackIndexInOriginal < currentTrackIndex) {
          setCurrentTrackIndex(prev => prev - 1);
        } else if (removedTrackIndexInOriginal === currentTrackIndex) {
          // If the currently playing track is removed
          if (newQueue.length === 0) setCurrentTrackIndex(-1);
          else if (currentTrackIndex >= newQueue.length) setCurrentTrackIndex(newQueue.length - 1);
          // else currentTrackIndex remains, next track will be at this index
        }
      } else if (isShuffling && removedTrackIndexInShuffled !== -1 && removedTrackIndexInShuffled <= currentTrackIndex) {
         if (removedTrackIndexInShuffled < currentTrackIndex) {
          setCurrentTrackIndex(prev => prev - 1);
        } else if (removedTrackIndexInShuffled === currentTrackIndex) {
          const activeShuffledQueue = shuffledQueue.filter(t => t.id !== trackId);
          if (activeShuffledQueue.length === 0) setCurrentTrackIndex(-1);
          else if (currentTrackIndex >= activeShuffledQueue.length) setCurrentTrackIndex(activeShuffledQueue.length - 1);
        }
      }
      return newQueue;
    });
  }, [isShuffling, currentTrackIndex, shuffledQueue]);


  const clearQueue = useCallback(() => {
    setQueue([]);
    setShuffledQueue([]);
    setCurrentTrackIndex(-1);
  }, []);
  
  const value = {
    queue,
    shuffledQueue,
    currentTrack,
    currentTrackIndex,
    isShuffling,
    isRepeating,
    setPlaybackQueue,
    playTrackAtIndex,
    nextTrack,
    prevTrack,
    playNext: nextTrack,
    playPrev: prevTrack,
    toggleShuffle,
    toggleRepeat,
    addToQueue,
    removeFromQueue,
    clearQueue,
    setCurrentTrackIndex // Expose for direct manipulation if needed by player
  };

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
};
