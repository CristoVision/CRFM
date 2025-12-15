import { useState, useEffect } from 'react';

// Hook for parsing .lrc files from a URL
export function useLrcParser(lrcUrl) {
  const [lyrics, setLyrics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lrcUrl) {
      setLyrics([]);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchAndParseLrc = async () => {
      setLoading(true);
      setError(null);
      setLyrics([]); 

      try {
        const response = await fetch(lrcUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch LRC file: ${response.status} ${response.statusText}`);
        }

        const lrcText = await response.text();
        if (!lrcText.trim()) {
          
          setLyrics([]);
        } else {
          const parsedLyrics = parseLrcTextToLines(lrcText, true); 
          setLyrics(parsedLyrics);
        }
      } catch (err) {
        console.error("Error in useLrcParser:", err);
        setError(err.message);
        setLyrics([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAndParseLrc();
  }, [lrcUrl]);

  return { lyrics, loading, error };
}


export function parseLrcTextToLines(text, isLrcFileFormat = false) {
  if (!text) return [];
  const lines = text.split('\\n').join('\n').split('\n');
  const lyrics = [];
  let hasTimestamps = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue; 

    
    const lrcMatch = trimmedLine.match(/^\[(\d{2,}):(\d{2})[\.:](\d{2,3})\](.*)/);
    if (lrcMatch) {
      hasTimestamps = true;
      const minutes = parseInt(lrcMatch[1], 10);
      const seconds = parseInt(lrcMatch[2], 10);
      const centisecondsOrMilliseconds = parseInt(lrcMatch[3], 10);
      const lyricText = lrcMatch[4].trim();

      
      const time = minutes * 60 + seconds + (lrcMatch[3].length === 2 ? centisecondsOrMilliseconds / 100 : centisecondsOrMilliseconds / 1000);
      
      if (lyricText) { 
          lyrics.push({ time, text: lyricText });
      }
    } else if (!isLrcFileFormat) {
      
      
      lyrics.push({ time: lyrics.length * 3, text: trimmedLine }); 
    } else if (isLrcFileFormat && !trimmedLine.startsWith('[')) {
      // If it's supposed to be an LRC file but line doesn't start with [, it's likely just text.
      // Treat as untimed line within an LRC context if no previous timestamps were found.
      // If timestamps were found, this line might be malformed or part of a multi-line lyric without its own stamp.
      // For simplicity, we'll add it as untimed if no timestamps have been encountered yet.
      if (!hasTimestamps) {
        lyrics.push({ time: lyrics.length * 3, text: trimmedLine });
      }
    }
  }
  
  if (hasTimestamps) {
    lyrics.sort((a, b) => a.time - b.time);
  }
  
  return lyrics;
}



export function findActiveLyricLine(lyrics, currentTime) {
  if (!lyrics || lyrics.length === 0) return -1;

  let activeIndex = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time === null || typeof lyrics[i].time === 'undefined') continue;

    if (lyrics[i].time <= currentTime) {
      if (i + 1 < lyrics.length) {
        if (lyrics[i + 1].time === null || typeof lyrics[i+1].time === 'undefined' || lyrics[i+1].time > currentTime) {
          activeIndex = i;
          break;
        }
      } else {
        
        activeIndex = i;
        break;
      }
    }
  }
  
  if (activeIndex === -1 && lyrics.length > 0 && currentTime < lyrics[0].time && lyrics[0].time !== null) {
    
  }


  return activeIndex;
}
