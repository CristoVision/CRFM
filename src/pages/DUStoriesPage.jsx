import React, { useMemo, useState } from 'react';
import { BookOpen, ExternalLink, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const DEFAULT_BASE_URL = 'http://localhost:3333';

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function DUStoriesPage() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [baseUrl, setBaseUrl] = useState(
    localStorage.getItem('crfm:du:baseUrl') || DEFAULT_BASE_URL
  );

  const entries = useMemo(() => {
    try {
      return window?.DU_INDEX_CACHE || [];
    } catch (error) {
      return [];
    }
  }, []);

  const [indexError, setIndexError] = useState('');
  const [indexEntries, setIndexEntries] = useState(entries);

  React.useEffect(() => {
    let mounted = true;
    const loadIndex = async () => {
      try {
        const response = await fetch('/du/index.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('missing-index');
        const data = await response.json();
        const filtered = Array.isArray(data)
          ? data.filter((entry) => entry.collection === 'dream')
          : [];
        if (!mounted) return;
        setIndexEntries(filtered);
        window.DU_INDEX_CACHE = filtered;
      } catch (error) {
        if (!mounted) return;
        setIndexError(t('stories.missingIndex'));
      }
    };
    loadIndex();
    return () => {
      mounted = false;
    };
  }, [t]);

  const filteredEntries = useMemo(() => {
    const query = normalizeText(searchQuery);
    if (!query) return indexEntries;
    return indexEntries.filter((entry) => {
      const haystack = normalizeText(
        `${entry.title || ''} ${entry.section_label || ''} ${entry.path || ''} ${(entry.tags || []).join(' ')}`
      );
      return haystack.includes(query);
    });
  }, [indexEntries, searchQuery]);

  const handleBaseUrlChange = (event) => {
    const value = event.target.value;
    setBaseUrl(value);
    localStorage.setItem('crfm:du:baseUrl', value);
  };

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
                <h1 className="text-3xl sm:text-4xl font-bold golden-text">{t('stories.title')}</h1>
                <p className="text-gray-300 text-sm sm:text-base">{t('stories.subtitle')}</p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-300">
              {t('stories.countLabel', { count: filteredEntries.length })}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('stories.searchPlaceholder')}
                className="w-full rounded-lg bg-black/30 border border-white/10 px-9 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
              />
            </div>
            <div className="flex flex-col gap-1 text-xs text-gray-400">
              <span>{t('stories.baseUrlLabel')}</span>
              <input
                type="text"
                value={baseUrl}
                onChange={handleBaseUrlChange}
                className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
                placeholder={t('stories.baseUrlHint')}
              />
            </div>
          </div>
        </section>

        <section className="glass-effect rounded-2xl p-5">
          {indexError && <p className="text-sm text-yellow-200">{indexError}</p>}
          {!indexError && filteredEntries.length === 0 && (
            <p className="text-sm text-gray-400">{t('stories.empty')}</p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredEntries.map((entry) => (
              <article key={entry.path} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-yellow-300">{entry.section_label || entry.section}</p>
                    <h3 className="text-base font-semibold text-white">{entry.title || entry.path}</h3>
                    <p className="text-xs text-gray-500 mt-1">{entry.path}</p>
                  </div>
                  <BookOpen className="w-5 h-5 text-yellow-400" />
                </div>
                <p className="text-sm text-gray-300 mt-3 line-clamp-3">
                  {entry.summary || t('stories.empty')}
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-yellow-300 border-yellow-400/40 hover:bg-yellow-400/10"
                    onClick={() =>
                      window.open(`${baseUrl}/api/file?collection=dream&path=${encodeURIComponent(entry.path)}`, '_blank')
                    }
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {t('stories.openApi')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-yellow-300 border-yellow-400/40 hover:bg-yellow-400/10"
                    onClick={() => window.open(`${baseUrl}/workspace`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {t('stories.openWorkspace')}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default DUStoriesPage;
