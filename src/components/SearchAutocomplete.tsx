import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Tag } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Product } from '../types';

interface SearchAutocompleteProps {
  mobile?: boolean;
}

export default function SearchAutocomplete({ mobile }: SearchAutocompleteProps) {
  const { lang, t, formatPrice } = useLanguage();
  const isAr = lang === 'ar';
  const navigate = useNavigate();
  
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const col = isAr ? 'name_ar' : 'name_fr';
        const { data } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .ilike(col, `%${query}%`)
          .limit(5);
        setSuggestions((data as Product[]) || []);
      } catch (err) {
        console.error('Autocomplete fetch error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, isAr]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsOpen(false);
      navigate(`/products?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSelectProduct = (slug: string) => {
    setIsOpen(false);
    setQuery('');
    navigate(`/products/${slug}`);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSearchSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={mobile ? t('nav.search') : t('nav.searchPlaceholder') || 'بحث عن منتجات...'}
          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
        />
        <button
          type="submit"
          className="absolute end-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-gray-500" /> : <Search className="w-4 h-4" />}
        </button>
      </form>

      {isOpen && (query.trim().length > 0 || suggestions.length > 0) && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-80 overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-100 py-2 divide-y divide-gray-50">
          {loading && suggestions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-gray-400 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              {isAr ? 'جاري البحث...' : 'Recherche...'}
            </div>
          ) : suggestions.length > 0 ? (
            <>
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProduct(p.slug)}
                  className="w-full px-4 py-3 text-start hover:bg-gray-50 flex items-center gap-3 transition-colors text-sm"
                >
                  <div className="w-10 h-10 bg-gray-50 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 flex items-center justify-center">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Tag className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {isAr ? p.name_ar : p.name_fr}
                    </p>
                    <p className="text-xs text-gray-500 font-semibold mt-0.5">
                      {formatPrice(p.price)}
                    </p>
                  </div>
                </button>
              ))}
              <button
                onClick={handleSearchSubmit}
                className="w-full px-4 py-2 text-center text-xs font-semibold text-primary-600 hover:bg-primary-50 transition-colors"
              >
                {isAr ? 'عرض كل نتائج البحث' : 'Voir tous les résultats'}
              </button>
            </>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              {isAr ? 'لم نجد أي منتج يطابق بحثك' : 'Aucun produit trouvé'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
