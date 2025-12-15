import { useState, useCallback } from 'react';

export const usePlayerQueue = (initialQueue = [], initialOriginalQueue = [], initialCurrentIndex = -1) => {
  const [queue, setQueue] = useState(initialQueue);
  const [originalQueue, setOriginalQueue] = useState(initialOriginalQueue);
  const [currentIndex, setCurrentIndex] = useState(initialCurrentIndex);
  const [shuffleMode, setShuffleMode] = useState('off');
  const [repeatMode, setRepeatMode] = useState('off');

  const updateQueueAndIndex = useCallback((newQueue, trackToPlayId) => {
    setOriginalQueue([...newQueue]);
    if (shuffleMode === 'on') {
      const shuffled = [...newQueue].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
      const newIdx = shuffled.findIndex(t => t.id === trackToPlayId);
      setCurrentIndex(newIdx !== -1 ? newIdx : 0);
    } else {
      setQueue(newQueue);
      const newIdx = newQueue.findIndex(t => t.id === trackToPlayId);
      setCurrentIndex(newIdx !== -1 ? newIdx : 0);
    }
  }, [shuffleMode]);

  const cycleShuffleMode = useCallback((currentTrack) => {
    setShuffleMode(prevMode => {
      const newMode = prevMode === 'off' ? 'on' : 'off';
      if (newMode === 'on') {
        if (currentTrack && queue.length > 1) {
          const restOfQueue = queue.filter(t => t.id !== currentTrack.id);
          const shuffledRest = [...restOfQueue].sort(() => Math.random() - 0.5);
          const newQueue = [currentTrack, ...shuffledRest];
          setQueue(newQueue);
          setCurrentIndex(0);
        } else if (queue.length > 0) {
          setQueue(prev => [...prev].sort(() => Math.random() - 0.5));
        }
      } else {
        const currentTrackId = currentTrack?.id;
        setQueue(originalQueue);
        if (currentTrackId) {
          const newIndex = originalQueue.findIndex(t => t.id === currentTrackId);
          setCurrentIndex(newIndex !== -1 ? newIndex : 0);
        } else if (originalQueue.length > 0) {
          setCurrentIndex(0);
        } else {
          setCurrentIndex(-1);
        }
      }
      return newMode;
    });
  }, [originalQueue, queue]);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode(prevMode => {
      if (prevMode === 'off') return 'all';
      if (prevMode === 'all') return 'one';
      return 'off';
    });
  }, []);
  
  const resetQueue = useCallback(() => {
    setQueue([]);
    setOriginalQueue([]);
    setCurrentIndex(-1);
  }, []);


  return {
    queue,
    setQueue,
    originalQueue,
    setOriginalQueue,
    currentIndex,
    setCurrentIndex,
    shuffleMode,
    setShuffleMode,
    repeatMode,
    setRepeatMode,
    updateQueueAndIndex,
    cycleShuffleMode,
    cycleRepeatMode,
    resetQueue,
  };
};
