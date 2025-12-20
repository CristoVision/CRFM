import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Bookmark, Highlighter, PenLine, RefreshCcw, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { loadBibleData } from '@/lib/bible/data';
import { buildSearchIndex, searchVerses } from '@/lib/bible/search';
import { getNextRandomVerse, loadHighlights, loadNotes, saveHighlights, saveNotes } from '@/lib/bible/storage';

function BiblePage() {
  const { user, favorites, addFavorite, removeFavorite } = useAuth();
  const { t } = useLanguage();
  const [bibleData, setBibleData] = useState({ books: [], verses: [], isSample: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [selectedVerseId, setSelectedVerseId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dailyVerse, setDailyVerse] = useState(null);
  const [highlights, setHighlights] = useState({});
  const [notes, setNotes] = useState({});
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      try {
        const data = await loadBibleData();
        if (!mounted) return;
        setBibleData(data);
        const firstBook = data.books[0]?.id || '';
        setSelectedBookId(firstBook);
        setSelectedChapter(1);
      } catch (error) {
        console.error('Failed to load bible data', error);
        setLoadError('bible.loadError');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setHighlights({});
      setNotes({});
      setDailyVerse(null);
      return;
    }
    setHighlights(loadHighlights(user.id));
    setNotes(loadNotes(user.id));
  }, [user]);

  const chaptersByBook = useMemo(() => {
    const map = new Map();
    bibleData.verses.forEach((verse) => {
      if (!map.has(verse.bookId)) map.set(verse.bookId, new Set());
      map.get(verse.bookId).add(verse.chapter);
    });
    return new Map(
      Array.from(map.entries()).map(([bookId, chapterSet]) => [
        bookId,
        Array.from(chapterSet).sort((a, b) => a - b),
      ])
    );
  }, [bibleData.verses]);

  const currentChapters = chaptersByBook.get(selectedBookId) || [1];

  useEffect(() => {
    if (!currentChapters.includes(selectedChapter)) {
      setSelectedChapter(currentChapters[0] || 1);
    }
  }, [currentChapters, selectedChapter]);

  const currentVerses = useMemo(() => {
    return bibleData.verses
      .filter((verse) => verse.bookId === selectedBookId && verse.chapter === selectedChapter)
      .sort((a, b) => a.verse - b.verse);
  }, [bibleData.verses, selectedBookId, selectedChapter]);

  const searchIndex = useMemo(() => buildSearchIndex(bibleData.verses), [bibleData.verses]);

  const searchResults = useMemo(
    () => searchVerses(searchQuery, searchIndex, { limit: 40 }),
    [searchQuery, searchIndex]
  );

  const selectedVerse = useMemo(
    () => currentVerses.find((verse) => verse.id === selectedVerseId) || null,
    [currentVerses, selectedVerseId]
  );

  useEffect(() => {
    if (!user || bibleData.verses.length === 0) return;
    const verse = getNextRandomVerse(user.id, bibleData.verses);
    setDailyVerse(verse);
  }, [user, bibleData.verses]);

  useEffect(() => {
    if (!selectedVerseId) return;
    const element = document.getElementById(`verse-${selectedVerseId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedVerseId, currentVerses]);

  useEffect(() => {
    if (!selectedVerseId) {
      setNoteDraft('');
      return;
    }
    setNoteDraft(notes[selectedVerseId]?.text || '');
  }, [selectedVerseId, notes]);

  const handleSelectVerse = (verse) => {
    setSelectedBookId(verse.bookId);
    setSelectedChapter(verse.chapter);
    setSelectedVerseId(verse.id);
  };

  const handleToggleFavorite = async (verseId) => {
    if (!user) {
      toast({ title: t('bible.loginRequired'), description: t('bible.loginToSave'), variant: 'destructive' });
      return;
    }
    const isFavorited = favorites?.some(
      (favorite) => favorite.content_type === 'verse' && favorite.content_id === verseId
    );
    if (isFavorited) {
      await removeFavorite('verse', verseId);
      toast({ title: t('bible.favoriteRemoved'), variant: 'success' });
    } else {
      await addFavorite('verse', verseId);
      toast({ title: t('bible.favoriteAdded'), variant: 'success' });
    }
  };

  const handleToggleHighlight = (verseId) => {
    if (!user) {
      toast({ title: t('bible.loginRequired'), description: t('bible.loginToHighlight'), variant: 'destructive' });
      return;
    }
    const next = { ...highlights, [verseId]: !highlights[verseId] };
    if (!next[verseId]) delete next[verseId];
    setHighlights(next);
    saveHighlights(user.id, next);
  };

  const handleSaveNote = () => {
    if (!user || !selectedVerseId) return;
    const nextNotes = {
      ...notes,
      [selectedVerseId]: {
        text: noteDraft.trim(),
        updatedAt: new Date().toISOString(),
      },
    };
    if (!noteDraft.trim()) {
      delete nextNotes[selectedVerseId];
    }
    setNotes(nextNotes);
    saveNotes(user.id, nextNotes);
    toast({ title: t('bible.noteSaved'), variant: 'success' });
  };

  const handleClearSearch = () => setSearchQuery('');

  const isSelectedFavorited = selectedVerse
    ? favorites?.some(
        (favorite) => favorite.content_type === 'verse' && favorite.content_id === selectedVerse.id
      )
    : false;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <div className="flex flex-col gap-6">
        <section className="glass-effect rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-yellow-400/20 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold golden-text">{t('bible.title')}</h1>
                <p className="text-gray-300 text-sm sm:text-base">{t('bible.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-2 rounded-lg bg-black/30 text-xs sm:text-sm text-yellow-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>{t('bible.searchMethod')}</span>
              </div>
            </div>
          </div>
          {bibleData.isSample && (
            <div className="mt-4 text-xs sm:text-sm text-yellow-200 bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-2">
              {t('bible.sampleWarning')}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_1.85fr] gap-6">
          <div className="flex flex-col gap-6">
            <div className="glass-effect rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-semibold text-white">{t('bible.searchTitle')}</h2>
              </div>
              <div className="flex flex-col gap-3">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('bible.searchPlaceholder')}
                  className="w-full rounded-lg bg-black/30 border border-white/10 px-4 py-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
                />
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{t('bible.searchHint')}</span>
                  {searchQuery && (
                    <button onClick={handleClearSearch} className="text-yellow-300 hover:text-yellow-200">
                      {t('bible.clearSearch')}
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-2">
                {searchQuery && searchResults.length === 0 && (
                  <p className="text-sm text-gray-400">{t('bible.noResults')}</p>
                )}
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectVerse(result.verse)}
                    className="w-full text-left rounded-xl border border-white/10 bg-black/20 px-4 py-3 hover:border-yellow-400/40 hover:bg-black/40 transition"
                  >
                    <p className="text-xs text-yellow-300 mb-1">
                      {result.verse.book} {result.verse.chapter}:{result.verse.verse}
                    </p>
                    <p className="text-sm text-gray-200 line-clamp-2">{result.verse.text}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-effect rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Bookmark className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-semibold text-white">{t('bible.dailyTitle')}</h2>
              </div>
              {!user && (
                <p className="text-sm text-gray-400">{t('bible.loginForDaily')}</p>
              )}
              {user && dailyVerse && (
                <div className="space-y-2">
                  <p className="text-xs text-yellow-300">
                    {dailyVerse.book} {dailyVerse.chapter}:{dailyVerse.verse}
                  </p>
                  <p className="text-sm text-gray-200 leading-relaxed">{dailyVerse.text}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDailyVerse(getNextRandomVerse(user.id, bibleData.verses))}
                    className="text-yellow-300 border-yellow-400/40 hover:bg-yellow-400/10"
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    {t('bible.newVerse')}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="glass-effect rounded-2xl p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-yellow-400" />
                  <h2 className="text-lg font-semibold text-white">{t('bible.readerTitle')}</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <select
                    value={selectedBookId}
                    onChange={(event) => setSelectedBookId(event.target.value)}
                    className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
                  >
                    {bibleData.books.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedChapter}
                    onChange={(event) => setSelectedChapter(Number(event.target.value))}
                    className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
                  >
                    {currentChapters.map((chapter) => (
                      <option key={chapter} value={chapter}>
                        {t('bible.chapter')} {chapter}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {loading && <p className="text-sm text-gray-400 mt-4">{t('common.loading')}</p>}
              {loadError && <p className="text-sm text-red-300 mt-4">{t(loadError)}</p>}
              {!loading && (
                <div className="mt-4 space-y-3 max-h-[480px] overflow-y-auto pr-2">
                  {currentVerses.map((verse) => (
                    <button
                      key={verse.id}
                      id={`verse-${verse.id}`}
                      onClick={() => setSelectedVerseId(verse.id)}
                      className={`w-full text-left rounded-xl px-4 py-3 border transition ${
                        selectedVerseId === verse.id
                          ? 'border-yellow-400/60 bg-yellow-400/10'
                          : 'border-white/10 bg-black/20 hover:border-yellow-400/30 hover:bg-black/40'
                      }`}
                    >
                      <p className="text-xs text-yellow-300 mb-1">
                        {verse.book} {verse.chapter}:{verse.verse}
                      </p>
                      <p
                        className={`text-sm leading-relaxed ${
                          highlights[verse.id] ? 'text-yellow-100' : 'text-gray-200'
                        }`}
                      >
                        {verse.text}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-effect rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <PenLine className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-semibold text-white">{t('bible.studyTitle')}</h2>
              </div>
              {!selectedVerse && <p className="text-sm text-gray-400">{t('bible.selectVerse')}</p>}
              {selectedVerse && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-yellow-300">
                      {selectedVerse.book} {selectedVerse.chapter}:{selectedVerse.verse}
                    </p>
                    <p className="text-sm text-gray-200 leading-relaxed">{selectedVerse.text}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleFavorite(selectedVerse.id)}
                      className="text-yellow-300 border-yellow-400/40 hover:bg-yellow-400/10"
                    >
                      <Bookmark className="w-4 h-4 mr-2" />
                      {isSelectedFavorited ? t('bible.favoriteRemove') : t('bible.favoriteAdd')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleHighlight(selectedVerse.id)}
                      className="text-yellow-300 border-yellow-400/40 hover:bg-yellow-400/10"
                    >
                      <Highlighter className="w-4 h-4 mr-2" />
                      {highlights[selectedVerse.id] ? t('bible.highlightOff') : t('bible.highlightOn')}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">{t('bible.noteLabel')}</label>
                    <textarea
                      rows={4}
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      placeholder={t('bible.notePlaceholder')}
                      className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
                    />
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveNote}
                        disabled={!user}
                        className="text-yellow-300 border-yellow-400/40 hover:bg-yellow-400/10 disabled:opacity-60"
                      >
                        {t('bible.saveNote')}
                      </Button>
                      {!user && <span className="text-xs text-gray-500">{t('bible.loginToNotes')}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default BiblePage;
