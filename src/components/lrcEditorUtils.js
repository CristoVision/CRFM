const TIMESTAMP_REGEX = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?]/g;
const METADATA_TAGS = ['ti', 'ar', 'al', 'by', 'offset', 're', 've', 'length'];

const createLineId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeTime = (minutes, seconds, fraction = '') => {
  const whole = Number(minutes) * 60 + Number(seconds);
  if (!fraction) return whole;

  const numericFraction = Number(fraction);
  return whole + numericFraction / (fraction.length === 3 ? 1000 : 100);
};

export const formatTime = (value) => {
  if (value === null || typeof value === 'undefined' || Number.isNaN(value)) {
    return '--:--';
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const hundredths = Math.floor((value - Math.floor(value)) * 100);

  const pad = (num, len = 2) => String(num).padStart(len, '0');
  return `${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
};

export const parseLrcTextToLines = (text, filterMetadata = false) => {
  if (!text) return [];

  const normalized = text.replace(/\r\n?/g, '\n').split('\n');
  const parsed = [];

  normalized.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const metadataMatch = line.match(/^\[([a-zA-Z]+):.*\]$/);
    if (metadataMatch) {
      const tag = metadataMatch[1].toLowerCase();
      if (METADATA_TAGS.includes(tag)) {
        return;
      }
      if (filterMetadata) {
        return;
      }
    }

    const matches = [...line.matchAll(TIMESTAMP_REGEX)];
    const lyricText = line.replace(TIMESTAMP_REGEX, '').trim();

    if (matches.length === 0) {
      parsed.push({
        id: createLineId(),
        time: null,
        text: line,
      });
      return;
    }

    if (!lyricText) return;

    matches.forEach((match) => {
      const [, minutes, seconds, fraction = ''] = match;
      parsed.push({
        id: createLineId(),
        time: normalizeTime(minutes, seconds, fraction),
        text: lyricText,
      });
    });
  });

  return parsed.sort((a, b) => {
    if (a.time === null && b.time === null) return 0;
    if (a.time === null) return 1;
    if (b.time === null) return -1;
    return a.time - b.time;
  });
};

export const generateLrcContent = (lyrics = []) =>
  lyrics
    .filter((line) => line && typeof line.text === 'string' && line.text.trim().length)
    .map((line) => {
      if (line.time === null || typeof line.time === 'undefined') {
        return line.text.trim();
      }

      const minutes = Math.floor(line.time / 60);
      const seconds = Math.floor(line.time % 60);
      const hundredths = Math.floor((line.time - Math.floor(line.time)) * 100);

      const pad = (num) => String(num).padStart(2, '0');
      return `[${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}] ${line.text.trim()}`;
    })
    .join('\n');

export const getStoragePath = (rawPath) => {
  if (!rawPath) return null;

  const marker = '/storage/v1/object/public/';
  if (rawPath.includes(marker)) {
    const [, remainder] = rawPath.split(marker);
    return remainder?.replace(/^lyrics-sync-files\//, '') ?? null;
  }

  return rawPath.replace(/^\/+/, '').replace(/^lyrics-sync-files\//, '');
};
