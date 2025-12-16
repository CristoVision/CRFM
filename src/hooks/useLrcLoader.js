import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const parseLrcTimestamp = (timestamp) => {
  if (typeof timestamp !== 'string') return 0;
  const parts = timestamp.match(/(\d+):(\d+)\.(\d+)/);
  if (!parts) return 0;
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  const milliseconds = parseInt(parts[3].padEnd(3, '0').slice(0,3), 10);
  return minutes * 60 + seconds + milliseconds / 1000;
};

export const parseLrcTextToLines = (lrcText, isFilePath = false) => {
  if (!lrcText) return [];
  const lines = lrcText.split('\\n').join('\n').split('\n');
  const parsed = [];
  let hasTimestamps = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const timeTagMatch = trimmedLine.match(/\[(\d{2}:\d{2}\.\d{2,3})\]/g);
    const textContent = trimmedLine.replace(/\[(\d{2}:\d{2}\.\d{2,3})\]/g, '').trim();

    if (timeTagMatch) {
      hasTimestamps = true;
      for (const tag of timeTagMatch) {
        const timestamp = tag.substring(1, tag.length - 1);
        parsed.push({ time: parseLrcTimestamp(timestamp), text: textContent || '\u00A0' });
      }
    } else if (!isFilePath) {
      parsed.push({ time: null, text: textContent });
    }
  }
  
  if (hasTimestamps) {
     parsed.sort((a, b) => a.time - b.time);
  } else if (!isFilePath && parsed.length > 0) {
    return parsed.map((line, index) => ({ ...line, time: index * 3 })); 
  }

  return parsed.filter(line => line.text.trim() !== '' || line.time !== null);
};

export const findActiveLyricIndex = (lyrics, currentTime) => {
  if (!lyrics || lyrics.length === 0) return -1;

  let activeIndex = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time === null) continue; 

    if (lyrics[i].time <= currentTime) {
      if (i + 1 < lyrics.length) {
        if (lyrics[i + 1].time === null || lyrics[i + 1].time > currentTime) {
          activeIndex = i;
          break;
        }
      } else {
        activeIndex = i;
        break;
      }
    }
  }
  return activeIndex;
};


export function useLrcLoader(currentTrack, currentTime) {
  const [lyrics, setLyrics] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLrcFile = useCallback(async (lrcFilePath) => {
    if (!lrcFilePath) {
      setError(new Error("LRC file path is undefined."));
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: downloadError } = await supabase
        .storage
        .from('lyrics-sync-files')
        .download(lrcFilePath);

      if (downloadError) {
        throw new Error(`Supabase storage error: ${downloadError.message} (Path: ${lrcFilePath})`);
      }
      if (!data) {
        throw new Error('LRC file not found or empty.');
      }
      const text = await data.text();
      if (!text.trim()) {
        return []; 
      }
      const parsed = parseLrcTextToLines(text, true);
      return parsed;
    } catch (err) {
      console.error('Error fetching or parsing LRC file:', err);
      setError(err);
      return null; 
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    setActiveIndex(-1); 

    if (!currentTrack) {
      setLyrics([]);
      setError(null);
      setLoading(false);
      return;
    }

    const loadLyrics = async () => {
      if (!isMounted) return;
      setLoading(true);
      setError(null);
      let loadedLyrics = [];

      if (currentTrack.lrc_file_path) {
        const fileLyrics = await fetchLrcFile(currentTrack.lrc_file_path);
        if (fileLyrics !== null) { 
          loadedLyrics = fileLyrics;
        }
      }

      if (loadedLyrics.length === 0 && currentTrack.lyrics_text) {
        if (error && currentTrack.lrc_file_path) {
            setError(null); 
        }
        const textLyrics = parseLrcTextToLines(currentTrack.lyrics_text, false);
        loadedLyrics = textLyrics;
      } else if (loadedLyrics.length === 0 && !currentTrack.lyrics_text && !error) {
        // No lyrics available - not an error condition itself
      }
      
      if (isMounted) {
        setLyrics(loadedLyrics);
        setLoading(false);
      }
    };

    loadLyrics();
    
    return () => {
      isMounted = false;
    };

  }, [currentTrack, fetchLrcFile]);

  useEffect(() => {
    if (lyrics.length > 0 && !loading) {
      const newActiveIndex = findActiveLyricIndex(lyrics, currentTime);
      setActiveIndex(newActiveIndex);
    } else {
      setActiveIndex(-1);
    }
  }, [lyrics, currentTime, loading]);

  const hasLrc = !loading && !error && lyrics && lyrics.length > 0;

  return { lyrics, activeIndex, loading, error, hasLrc };
}
