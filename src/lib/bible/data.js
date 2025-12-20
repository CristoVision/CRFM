import sampleData from '@/data/bible_es_sample.json';

const DEFAULT_BIBLE_DATA_URL = '/bible/hebrew_es.json';

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s:.-]/g, '')
    .replace(/\s+/g, ' ');

const toSlug = (value) => normalizeText(value).replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'bk';

const ensureVerseId = (verse) =>
  verse.id || `${verse.bookId}-${verse.chapter}-${verse.verse}`;

const normalizeVerse = (verse, bookDefaults) => {
  const bookId = verse.bookId || verse.book_id || bookDefaults.id;
  const book = verse.book || verse.book_name || bookDefaults.name;
  const chapter = Number(verse.chapter || verse.chapter_number || bookDefaults.chapter || 1);
  const verseNumber = Number(verse.verse || verse.verse_number || verse.verseIndex || 1);
  const text = String(verse.text || verse.content || '');
  const id = ensureVerseId({ ...verse, bookId, chapter, verse: verseNumber });
  return {
    id,
    bookId,
    book,
    chapter,
    verse: verseNumber,
    text,
  };
};

export const normalizeBibleData = (rawData = {}) => {
  if (!rawData || typeof rawData !== 'object') {
    return normalizeBibleData(sampleData);
  }

  const verses = [];
  const books = [];
  const bookOrder = [];
  const bookMap = new Map();

  const registerBook = (book) => {
    const id = book.id || book.bookId || book.code || toSlug(book.name);
    if (bookMap.has(id)) return bookMap.get(id);
    const entry = {
      id,
      name: book.name || book.title || id.toUpperCase(),
      order: Number(book.order || book.canon_order || book.index || books.length + 1),
      chapters: [],
    };
    bookMap.set(id, entry);
    books.push(entry);
    bookOrder.push(id);
    return entry;
  };

  if (Array.isArray(rawData.verses)) {
    rawData.verses.forEach((verse) => {
      const bookId = verse.bookId || verse.book_id || toSlug(verse.book || verse.book_name);
      const bookName = verse.book || verse.book_name || bookId.toUpperCase();
      const bookEntry = registerBook({ id: bookId, name: bookName, order: verse.book_order });
      const normalized = normalizeVerse(verse, { id: bookEntry.id, name: bookEntry.name });
      verses.push(normalized);
    });
  } else if (Array.isArray(rawData.books)) {
    rawData.books.forEach((book, index) => {
      const bookEntry = registerBook({
        id: book.id || book.bookId || book.code || toSlug(book.name || `book-${index + 1}`),
        name: book.name || book.title || `Book ${index + 1}`,
        order: book.order || book.canon_order || index + 1,
      });

      const chapters = Array.isArray(book.chapters) ? book.chapters : [];
      chapters.forEach((chapter, chapterIndex) => {
        const chapterNumber = Number(chapter.number || chapter.chapter || chapterIndex + 1);
        const versesInChapter = Array.isArray(chapter.verses)
          ? chapter.verses
          : Array.isArray(chapter)
            ? chapter
            : [];

        versesInChapter.forEach((verse) => {
          const normalized = normalizeVerse(verse, {
            id: bookEntry.id,
            name: bookEntry.name,
            chapter: chapterNumber,
          });
          verses.push(normalized);
        });
      });
    });
  }

  const sortedBooks = books.sort((a, b) => a.order - b.order);
  const isSample = Boolean(rawData.isSample || rawData.sample || rawData === sampleData);
  const version = rawData.version || (isSample ? 'sample' : 'unknown');

  return {
    version,
    isSample,
    books: sortedBooks,
    verses,
    bookOrder,
  };
};

export const loadBibleData = async (options = {}) => {
  const url = options.url || DEFAULT_BIBLE_DATA_URL;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      return normalizeBibleData(data);
    }
  } catch (error) {
    console.warn('Bible data load failed, using sample dataset.', error);
  }
  return normalizeBibleData(sampleData);
};

export { DEFAULT_BIBLE_DATA_URL };
