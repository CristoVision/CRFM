const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
  'y', 'o', 'u', 'que', 'en', 'por', 'para', 'con', 'sin', 'sobre', 'entre',
  'a', 'e', 'es', 'son', 'fue', 'era', 'ser', 'se', 'su', 'sus', 'tu', 'tus',
  'mi', 'mis', 'te', 'ti', 'lo', 'le', 'les', 'yo', 'nos', 'vos', 'ellos',
  'ellas', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'eses', 'esas',
  'ahi', 'alli', 'aqui', 'asi', 'mas', 'menos', 'muy', 'tambien',
]);

const SUFFIXES = [
  'amientos', 'imiento', 'imientos', 'amiento',
  'aciones', 'acion', 'iciones', 'icion',
  'mente', 'adoras', 'adores', 'adora', 'ador',
  'amente', 'idad', 'idades', 'anza', 'anzas',
  'ante', 'antes', 'ancia', 'ancias',
  'ando', 'iendo', 'ados', 'adas', 'ado', 'ada',
  'ar', 'er', 'ir', 'es', 'os', 'as', 's',
];

const CONCEPT_EXPANSIONS = {
  dios: ['senor', 'yahweh', 'elohim', 'padre', 'todopoderoso'],
  senor: ['dios', 'yahweh', 'elohim', 'maestro'],
  amor: ['misericordia', 'bondad', 'gracia', 'caridad'],
  fe: ['confianza', 'esperanza', 'fidelidad'],
  temor: ['miedo', 'reverencia', 'respeto'],
  paz: ['shalom', 'reposo', 'descanso'],
  justicia: ['rectitud', 'juicio', 'verdad'],
  perdon: ['perdonar', 'misericordia', 'gracia'],
  salvacion: ['redencion', 'liberacion', 'rescate'],
  sabiduria: ['entendimiento', 'conocimiento', 'discernimiento'],
  espiritu: ['aliento', 'ruah', 'viento'],
};

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s:.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stemToken = (token) => {
  for (const suffix of SUFFIXES) {
    if (token.length > suffix.length + 2 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
};

const tokenize = (value) => {
  const normalized = normalizeText(value);
  return normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token && !STOP_WORDS.has(token));
};

const buildBigrams = (tokens) => tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`);

const buildConcepts = (tokens) => {
  const concepts = new Set();
  tokens.forEach((token) => {
    const expansions = CONCEPT_EXPANSIONS[token];
    if (expansions) {
      expansions.forEach((term) => concepts.add(term));
    }
  });
  return Array.from(concepts);
};

const buildVerseKey = (verse) => `${verse.bookId}:${verse.chapter}:${verse.verse}`;

export const buildSearchIndex = (verses = []) => {
  const entries = [];
  const verseByKey = new Map();
  const chapterMap = new Map();

  verses.forEach((verse) => {
    const chapterKey = `${verse.bookId}:${verse.chapter}`;
    if (!chapterMap.has(chapterKey)) {
      chapterMap.set(chapterKey, []);
    }
    chapterMap.get(chapterKey).push(verse);
  });

  verses.forEach((verse) => {
    const tokens = tokenize(verse.text);
    const stems = tokens.map(stemToken);
    const bigrams = buildBigrams(tokens);
    const entry = {
      id: verse.id,
      key: buildVerseKey(verse),
      verse,
      tokens,
      stems,
      bigrams,
      contextTokens: [],
      normalizedText: normalizeText(verse.text),
    };
    entries.push(entry);
    verseByKey.set(entry.key, entry);
  });

  entries.forEach((entry) => {
    const chapterKey = `${entry.verse.bookId}:${entry.verse.chapter}`;
    const chapterVerses = chapterMap.get(chapterKey) || [];
    const index = chapterVerses.findIndex((verse) => verse.id === entry.verse.id);
    const neighbors = [
      chapterVerses[index - 1],
      chapterVerses[index + 1],
    ].filter(Boolean);

    const contextTokens = new Set();
    neighbors.forEach((neighbor) => {
      tokenize(neighbor.text).forEach((token) => contextTokens.add(token));
    });
    entry.contextTokens = Array.from(contextTokens);
  });

  return {
    entries,
    verseByKey,
    chapterMap,
  };
};

const parseReference = (query, entries) => {
  const normalized = normalizeText(query);
  const parts = normalized.split(' ').filter(Boolean);
  const chapterVerseMatch = normalized.match(/(\d+)\s*[:.-]\s*(\d+)/);
  if (!chapterVerseMatch) return null;
  const chapter = Number(chapterVerseMatch[1]);
  const verse = Number(chapterVerseMatch[2]);
  const bookToken = parts.find((part) => !part.match(/\d+/));
  if (!bookToken) return null;

  const candidate = entries.find((entry) =>
    normalizeText(entry.verse.book).includes(bookToken) ||
    normalizeText(entry.verse.bookId).includes(bookToken)
  );

  if (!candidate) return null;
  return `${candidate.verse.bookId}:${chapter}:${verse}`;
};

export const searchVerses = (query, index, options = {}) => {
  if (!index || !index.entries) return [];
  const trimmed = query.trim();
  if (!trimmed) return [];

  const tokens = tokenize(trimmed);
  const stems = tokens.map(stemToken);
  const bigrams = buildBigrams(tokens);
  const concepts = buildConcepts(tokens);
  const expandedTokens = [...new Set([...tokens, ...concepts])];
  const normalizedQuery = normalizeText(trimmed);
  const refKey = parseReference(trimmed, index.entries);

  const results = [];

  index.entries.forEach((entry) => {
    let score = 0;

    if (refKey && entry.key === refKey) {
      score += 100;
    }

    if (normalizedQuery.length > 2 && entry.normalizedText.includes(normalizedQuery)) {
      score += 40;
    }

    bigrams.forEach((bigram) => {
      if (entry.bigrams.includes(bigram)) score += 10;
    });

    expandedTokens.forEach((token) => {
      if (entry.tokens.includes(token)) score += 6;
      if (entry.contextTokens.includes(token)) score += 2;
    });

    stems.forEach((stem) => {
      if (entry.stems.includes(stem)) score += 4;
    });

    if (score > 0) {
      results.push({
        ...entry,
        score,
      });
    }
  });

  results.sort((a, b) => b.score - a.score);
  const limit = options.limit || 40;
  return results.slice(0, limit);
};

export const describeSearchMethod = () =>
  'Resonancia Contextual Trenzada: mezcla coincidencias exactas, bigramas, raices y el contexto de versiculos vecinos.';
