import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';
import { TranslationKey, getTranslation } from '../lib/i18n';
import { getSystemSettings, saveSystemSettings } from '../lib/systemSettings';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  currency: string;
  setCurrency: (curr: string) => void;
  dir: 'rtl' | 'ltr';
  t: (key: string) => string;
  tr: (ar: string, fr?: string, en?: string) => string;
  formatPrice: (amount: number) => string;
  formatDate: (dateString: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_lang');
    return (saved === 'fr' || saved === 'en' || saved === 'ar') ? saved : 'ar';
  });

  const [currency, setCurrencyState] = useState<string>(() => {
    return localStorage.getItem('app_currency') || 'DZD';
  });

  const dir: 'rtl' | 'ltr' = lang === 'ar' ? 'rtl' : 'ltr';

  // Load language and currency from Supabase system_settings / store_settings
  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      try {
        const settings = await getSystemSettings();
        if (isMounted && settings) {
          if (settings.default_language && ['ar', 'fr', 'en'].includes(settings.default_language)) {
            setLangState(settings.default_language as Language);
          }
          if (settings.default_currency) {
            setCurrencyState(settings.default_currency);
          }
        }
      } catch (err) {
        console.warn('Failed to load language/currency settings from Supabase:', err);
      }
    }

    loadSettings();

    // Listen to custom setting update events
    const handleSettingsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        if (customEvent.detail.default_language) {
          setLangState(customEvent.detail.default_language as Language);
        }
        if (customEvent.detail.default_currency) {
          setCurrencyState(customEvent.detail.default_currency);
        }
      }
    };

    window.addEventListener('system_settings_updated', handleSettingsUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('system_settings_updated', handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang, dir]);

  useEffect(() => {
    localStorage.setItem('app_currency', currency);
  }, [currency]);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('app_lang', newLang);

    // Save to Supabase store_settings and system_settings asynchronously
    saveSystemSettings({ default_language: newLang }).catch((err) => {
      console.warn('Failed to save default_language to Supabase:', err);
    });
  };

  const setCurrency = (curr: string) => {
    setCurrencyState(curr);
    localStorage.setItem('app_currency', curr);

    // Save to Supabase store_settings and system_settings asynchronously
    saveSystemSettings({ default_currency: curr as 'DZD' | 'EUR' | 'USD' }).catch((err) => {
      console.warn('Failed to save default_currency to Supabase:', err);
    });
  };

  const t = (key: string): string => {
    if (!key) return '';
    return getTranslation(lang, key as TranslationKey);
  };

  const tr = (ar: string, fr?: string, en?: string): string => {
    if (lang === 'fr') return fr || ar;
    if (lang === 'en') return en || fr || ar;
    return ar;
  };

  const formatPrice = (amount: number): string => {
    if (isNaN(amount) || amount === null || amount === undefined) return '0 ' + currency;
    const locale = lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US';
    const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);

    if (currency === 'EUR') return `${formatted} €`;
    if (currency === 'USD') return `$${formatted}`;
    
    // Default DZD
    return lang === 'ar' ? `${formatted} د.ج` : `${formatted} DA`;
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, currency, setCurrency, dir, t, tr, formatPrice, formatDate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
