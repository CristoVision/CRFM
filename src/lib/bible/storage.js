const STORAGE_PREFIX = 'crfm:bible';

const buildKey = (userId, section) => `${STORAGE_PREFIX}:${section}:${userId}`;

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
};

export const loadHighlights = (userId) => {
  if (!userId) return {};
  return safeParse(localStorage.getItem(buildKey(userId, 'highlights')), {});
};

export const saveHighlights = (userId, highlights) => {
  if (!userId) return;
  localStorage.setItem(buildKey(userId, 'highlights'), JSON.stringify(highlights));
};

export const loadNotes = (userId) => {
  if (!userId) return {};
  return safeParse(localStorage.getItem(buildKey(userId, 'notes')), {});
};

export const saveNotes = (userId, notes) => {
  if (!userId) return;
  localStorage.setItem(buildKey(userId, 'notes'), JSON.stringify(notes));
};

export const loadSeenVerses = (userId) => {
  if (!userId) return [];
  return safeParse(localStorage.getItem(buildKey(userId, 'seen_verses')), []);
};

export const saveSeenVerses = (userId, seen) => {
  if (!userId) return;
  localStorage.setItem(buildKey(userId, 'seen_verses'), JSON.stringify(seen));
};

export const getNextRandomVerse = (userId, verses) => {
  if (!userId || !Array.isArray(verses) || verses.length === 0) return null;
  const seen = loadSeenVerses(userId);
  const available = verses.filter((verse) => !seen.includes(verse.id));
  const pool = available.length > 0 ? available : verses;
  const next = pool[Math.floor(Math.random() * pool.length)];
  const nextSeen = available.length > 0 ? [...seen, next.id] : [next.id];
  saveSeenVerses(userId, nextSeen);
  return next;
};
