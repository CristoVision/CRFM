import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translate } from '@/i18n/translations';

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: (key, params) => translate('en', key, params),
});

const STORAGE_KEY = 'crfm_language';

const getInitialLanguage = () => {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'es') return stored;
  const browserLang = window.navigator.language || '';
  return browserLang.toLowerCase().startsWith('es') ? 'es' : 'en';
};

const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = (nextLanguage) => {
    setLanguageState(nextLanguage);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, nextLanguage);
      document.documentElement.lang = nextLanguage;
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = useMemo(() => {
    return (key, params) => translate(language, key, params);
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

const useLanguage = () => useContext(LanguageContext);

export { LanguageProvider, useLanguage };
