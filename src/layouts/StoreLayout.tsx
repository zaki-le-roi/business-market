import { Link, useNavigate, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  ShoppingCart, User, Menu, X, Phone, Home, Building2,
  Truck, ShieldCheck, HeadphonesIcon, Package, ShoppingBag, Settings, ChevronDown, ChevronRight
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';
import { Category, Language } from '../types';
import AIChatbot from '../components/AIChatbot';
import SearchAutocomplete from '../components/SearchAutocomplete';
import { checkIsAdmin } from '../lib/admin';
import { getSystemSettings, SystemSettings } from '../lib/systemSettings';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function generateShades(baseHex: string): Record<number | string, string> {
  const rgb = hexToRgb(baseHex);
  if (!rgb) return {};
  const mix = (color: {r: number, g: number, b: number}, target: {r: number, g: number, b: number}, weight: number) => {
    return {
      r: Math.round(color.r * (1 - weight) + target.r * weight),
      g: Math.round(color.g * (1 - weight) + target.g * weight),
      b: Math.round(color.b * (1 - weight) + target.b * weight)
    };
  };
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  return {
    50:  rgbToHex(mix(rgb, white, 0.95).r, mix(rgb, white, 0.95).g, mix(rgb, white, 0.95).b),
    100: rgbToHex(mix(rgb, white, 0.85).r, mix(rgb, white, 0.85).g, mix(rgb, white, 0.85).b),
    200: rgbToHex(mix(rgb, white, 0.70).r, mix(rgb, white, 0.70).g, mix(rgb, white, 0.70).b),
    300: rgbToHex(mix(rgb, white, 0.50).r, mix(rgb, white, 0.50).g, mix(rgb, white, 0.50).b),
    400: rgbToHex(mix(rgb, white, 0.25).r, mix(rgb, white, 0.25).g, mix(rgb, white, 0.25).b),
    500: baseHex,
    600: rgbToHex(mix(rgb, black, 0.15).r, mix(rgb, black, 0.15).g, mix(rgb, black, 0.15).b),
    700: rgbToHex(mix(rgb, black, 0.30).r, mix(rgb, black, 0.30).g, mix(rgb, black, 0.30).b),
    800: rgbToHex(mix(rgb, black, 0.45).r, mix(rgb, black, 0.45).g, mix(rgb, black, 0.45).b),
    900: rgbToHex(mix(rgb, black, 0.60).r, mix(rgb, black, 0.60).g, mix(rgb, black, 0.60).b),
    950: rgbToHex(mix(rgb, black, 0.75).r, mix(rgb, black, 0.75).g, mix(rgb, black, 0.75).b),
  };
}

export function applyTheme(config: { primary?: string; secondary?: string; background?: string } | null | undefined) {
  let styleEl = document.getElementById('custom-store-theme');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-store-theme';
    document.head.appendChild(styleEl);
  }
  if (!config) {
    styleEl.innerHTML = '';
    return;
  }
  const { primary, secondary, background } = config;
  let cssRules = '';
  if (primary) {
    const shades = generateShades(primary);
    Object.entries(shades).forEach(([shade, hex]) => {
      cssRules += `--color-primary-${shade}: ${hex} !important;\n`;
    });
  }
  if (secondary) {
    const shades = generateShades(secondary);
    Object.entries(shades).forEach(([shade, hex]) => {
      cssRules += `--color-secondary-${shade}: ${hex} !important;\n`;
    });
  }
  if (background) {
    cssRules += `--store-background: ${background} !important;\n`;
    cssRules += `body { background-color: ${background} !important; }\n`;
  }
  styleEl.innerHTML = `:root {\n${cssRules}\n}`;
}

export default function StoreLayout() {
  const { lang, setLang, t, dir } = useLanguage();
  const { totalItems, isOpen, setIsOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [storePhone, setStorePhone] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [aiChatbotEnabled, setAiChatbotEnabled] = useState(true);
  const [customLogoUrl, setCustomLogoUrl] = useState('/logo.jpg');

  useEffect(() => {
    async function verifyAdmin() {
      const isUserAdmin = await checkIsAdmin();
      setIsAdmin(isUserAdmin);
    }
    verifyAdmin();
  }, []);

  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (data) setCategories(data);
    }
    loadCategories();
  }, []);

  useEffect(() => {
    const parseStr = (val: unknown): string => {
      if (typeof val === 'string') return val;
      if (val && typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
        return parseStr((val as { value: unknown }).value);
      }
      return '';
    };

    async function loadStoreInfo() {
      try {
        const sys = await getSystemSettings();
        if (sys.store_phone) setStorePhone(parseStr(sys.store_phone));
        if (sys.store_email) setStoreEmail(parseStr(sys.store_email));
        if ((sys as { ai_chatbot_enabled?: boolean }).ai_chatbot_enabled !== undefined) setAiChatbotEnabled(!!(sys as { ai_chatbot_enabled?: boolean }).ai_chatbot_enabled);
        if (sys.store_logo) setCustomLogoUrl(parseStr(sys.store_logo) || '/logo.jpg');
      } catch (err) {
        console.warn('Error loading store info:', err);
      }
    }

    loadStoreInfo();

    const handleSettingsUpdated = (e: Event) => {
      const customEvt = e as CustomEvent<SystemSettings>;
      if (customEvt.detail) {
        const sys = customEvt.detail;
        if (sys.store_phone) setStorePhone(parseStr(sys.store_phone));
        if (sys.store_email) setStoreEmail(parseStr(sys.store_email));
        if ((sys as { ai_chatbot_enabled?: boolean }).ai_chatbot_enabled !== undefined) setAiChatbotEnabled(!!(sys as { ai_chatbot_enabled?: boolean }).ai_chatbot_enabled);
        if (sys.store_logo) setCustomLogoUrl(parseStr(sys.store_logo) || '/logo.jpg');
      }
    };

    window.addEventListener('system_settings_updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('system_settings_updated', handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const catName = (cat: Category) => lang === 'ar' ? cat.name_ar : cat.name_fr;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 pb-16 lg:pb-0" dir={dir}>
      {/* Top bar — deep black with emerald accent */}
      <div className="bg-secondary-950 text-gray-200 text-xs sm:text-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-primary-400" />
              <span className="hidden sm:inline">{t('home.codBanner')}</span>
              <span className="sm:hidden">{t('home.codBanner').slice(0, 30)}...</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/track" className="flex items-center gap-1 hover:text-primary-300 transition-colors">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">{t('nav.trackOrder')}</span>
            </Link>
            <Link to="/support" className="flex items-center gap-1 hover:text-primary-300 transition-colors">
              <HeadphonesIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('nav.support')}</span>
            </Link>

            {/* Language Selector */}
            <div className="flex items-center gap-1 bg-secondary-900 border border-secondary-800 rounded-lg p-0.5">
              <button
                onClick={() => setLang('ar')}
                className={`px-2 py-0.5 text-xs font-bold rounded ${lang === 'ar' ? 'bg-primary-600 text-white' : 'text-gray-300 hover:text-white'}`}
              >
                عربي
              </button>
              <button
                onClick={() => setLang('fr')}
                className={`px-2 py-0.5 text-xs font-bold rounded ${lang === 'fr' ? 'bg-primary-600 text-white' : 'text-gray-300 hover:text-white'}`}
              >
                FR
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-0.5 text-xs font-bold rounded ${lang === 'en' ? 'bg-primary-600 text-white' : 'text-gray-300 hover:text-white'}`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo — Custom uploaded official logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <img src={customLogoUrl} alt={t('app.name')} className="w-10 h-10 rounded-xl object-cover shadow-sm border border-gray-100" referrerPolicy="no-referrer" />
              <div className="hidden sm:block">
                <div className="font-bold text-lg text-gray-900 leading-none">{t('app.name')}</div>
                <div className="text-xs text-gray-500 leading-none mt-0.5">{t('app.tagline')}</div>
              </div>
            </Link>

            {/* Search */}
            <div className="flex-1 max-w-2xl hidden md:block">
              <SearchAutocomplete />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && (
                <Link
                  to="/admin/dashboard"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 transition-colors"
                  title={lang === 'ar' ? 'لوحة المسؤول' : "Panneau d'administration"}
                >
                  <Settings className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-semibold">{lang === 'ar' ? 'لوحة المسؤول' : 'Admin'}</span>
                </Link>
              )}
              <Link to="/account" className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                <User className="w-5 h-5 text-gray-700" />
                <span className="text-sm font-medium text-gray-700">{t('common.account')}</span>
              </Link>
              <button
                onClick={() => setIsOpen(true)}
                className="relative flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ShoppingCart className="w-5 h-5 text-gray-700" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -end-1 w-5 h-5 bg-primary-600 text-white text-xs font-bold rounded-full flex items-center justify-center animate-scale-in">
                    {totalItems}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="pb-3 md:hidden">
            <SearchAutocomplete mobile />
          </div>
        </div>

        {/* Category nav */}
        <nav className="border-t border-gray-200 bg-white hidden md:block">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-1 h-12 overflow-x-auto no-scrollbar">
              <Link
                to="/products"
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors whitespace-nowrap"
              >
                {t('nav.products')}
              </Link>
              {categories.filter((c) => !c.parent_id).map((parent) => {
                const subcats = categories.filter((c) => c.parent_id === parent.id);
                if (subcats.length === 0) {
                  return (
                    <Link
                      key={parent.id}
                      to={`/category/${parent.slug}`}
                      className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {catName(parent)}
                    </Link>
                  );
                }

                return (
                  <div key={parent.id} className="relative group">
                    <Link
                      to={`/category/${parent.slug}`}
                      className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1"
                    >
                      <span>{catName(parent)}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-600 transition-transform group-hover:rotate-180" />
                    </Link>
                    <div className="absolute top-full start-0 hidden group-hover:block pt-1 z-50 animate-fadeIn">
                      <div className="bg-white rounded-xl shadow-xl border border-gray-100 py-2 min-w-[200px]">
                        {subcats.map((sub) => (
                          <Link
                            key={sub.id}
                            to={`/category/${parent.slug}/${sub.slug}`}
                            className="block px-4 py-2 text-xs font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                          >
                            {catName(sub)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              <Link
                to="/products?filter=flash_sale"
                className="px-3 py-2 text-sm font-bold text-warning-600 hover:text-warning-700 hover:bg-warning-50 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1"
              >
                {t('nav.deals')}
                <span className="w-2 h-2 bg-warning-500 rounded-full animate-pulse" />
              </Link>
            </div>
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white animate-slide-down max-h-[80vh] overflow-y-auto">
            <div className="px-4 py-3 space-y-1">
              <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg hover:bg-gray-100 font-medium text-gray-700 text-sm">
                {t('nav.products')}
              </Link>
              {categories.filter((c) => !c.parent_id).map((parent) => {
                const subcats = categories.filter((c) => c.parent_id === parent.id);
                const isExpanded = !!expandedParents[parent.id];

                if (subcats.length === 0) {
                  return (
                    <Link
                      key={parent.id}
                      to={`/category/${parent.slug}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-lg font-medium text-gray-800 hover:bg-gray-100 text-sm"
                    >
                      {catName(parent)}
                    </Link>
                  );
                }

                return (
                  <div key={parent.id} className="rounded-lg">
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 font-medium text-gray-800 text-sm">
                      <Link
                        to={`/category/${parent.slug}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex-1 truncate"
                      >
                        {catName(parent)}
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedParents((prev) => ({ ...prev, [parent.id]: !prev[parent.id] }));
                        }}
                        className="p-1 text-gray-400 hover:text-gray-700"
                      >
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 rtl:rotate-180 ${isExpanded ? 'rotate-90 rtl:rotate-90 text-indigo-600' : ''}`} />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="ms-4 ps-3 border-s border-gray-200 space-y-0.5 my-1">
                        {subcats.map((sub) => (
                          <Link
                            key={sub.id}
                            to={`/category/${parent.slug}/${sub.slug}`}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 hover:text-indigo-600 rounded-md font-medium"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                            <span className="truncate">{catName(sub)}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <Link to="/account" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg hover:bg-gray-100 font-medium text-gray-700 text-sm">
                {t('common.account')}
              </Link>
              {isAdmin && (
                <Link to="/admin/dashboard" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 font-semibold text-indigo-700 text-sm">
                  {lang === 'ar' ? 'لوحة التحكم للمسؤول ⚙️' : lang === 'fr' ? "Panneau d'administration ⚙️" : 'Admin Panel ⚙️'}
                </Link>
              )}
              <Link to="/track" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700">
                {t('nav.trackOrder')}
              </Link>
              <Link to="/support" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700">
                {t('nav.support')}
              </Link>
              {/* Language switcher in mobile menu */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex gap-2 px-3 py-2">
                  {(['ar', 'fr', 'en'] as Language[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => { setLang(l); setMobileMenuOpen(false); }}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${lang === l ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {l === 'ar' ? 'العربية' : l === 'fr' ? 'Français' : 'English'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer — black with emerald accents */}
      <footer className="bg-secondary-950 text-gray-300 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={customLogoUrl} alt={t('app.name')} className="w-10 h-10 rounded-xl object-cover shadow-sm border border-secondary-800" referrerPolicy="no-referrer" />
                <div className="font-bold text-white text-lg">{t('app.name')}</div>
              </div>
              <p className="text-sm text-gray-400">{t('app.tagline')}</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">{t('footer.help')}</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/track" className="hover:text-primary-400 transition-colors">{t('nav.trackOrder')}</Link></li>
                <li><Link to="/support" className="hover:text-primary-400 transition-colors">{t('nav.support')}</Link></li>
                <li><Link to="/products" className="hover:text-primary-400 transition-colors">{t('nav.products')}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">{t('footer.payment')}</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary-400" /> {t('checkout.cod')}</li>
                <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary-400" /> {t('checkout.cib')}</li>
                <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary-400" /> {t('checkout.edahabia')}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">{t('footer.contact')}</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary-400" /> {typeof storePhone === 'string' && storePhone.trim() ? storePhone : '+213 555 000 000'}</li>
                <li>{typeof storeEmail === 'string' && storeEmail.trim() ? storeEmail : 'contact@businessmarket.dz'}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-secondary-800 mt-8 pt-6 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} {t('app.name')}. {t('footer.rights')}.
          </div>
        </div>
      </footer>

      {/* Mobile Material 3 Bottom Navigation bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 backdrop-blur border-t border-gray-100 flex justify-around py-2 shadow-lg shadow-slate-900/5 select-none animate-slide-up" dir={dir}>
        <Link to="/" className="flex flex-col items-center gap-1 text-gray-500 hover:text-primary-600 transition-colors py-1 px-3">
          <Home className="w-5 h-5 text-gray-600" />
          <span className="text-[10px] font-bold text-gray-600">{lang === 'ar' ? 'الرئيسية' : 'Accueil'}</span>
        </Link>
        <Link to="/products" className="flex flex-col items-center gap-1 text-gray-500 hover:text-primary-600 transition-colors py-1 px-3">
          <ShoppingBag className="w-5 h-5 text-gray-600" />
          <span className="text-[10px] font-bold text-gray-600">{lang === 'ar' ? 'المنتجات' : 'Produits'}</span>
        </Link>
        <Link to="/wholesale" className="flex flex-col items-center gap-1 text-gray-500 hover:text-primary-600 transition-colors py-1 px-3 relative">
          <Building2 className="w-5 h-5 text-emerald-600" />
          <span className="text-[10px] font-bold text-emerald-700">{lang === 'ar' ? 'الجملة' : 'Grossiste'}</span>
          <span className="absolute top-0.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
        </Link>
        <button onClick={() => setIsOpen(true)} className="flex flex-col items-center gap-1 text-gray-500 hover:text-primary-600 transition-colors py-1 px-3 relative">
          <ShoppingCart className="w-5 h-5 text-gray-600" />
          <span className="text-[10px] font-bold text-gray-600">{lang === 'ar' ? 'السلة' : 'Panier'}</span>
          {totalItems > 0 && (
            <span className="absolute -top-1 right-2 bg-primary-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center">
              {totalItems}
            </span>
          )}
        </button>
        <Link to="/account" className="flex flex-col items-center gap-1 text-gray-500 hover:text-primary-600 transition-colors py-1 px-3">
          <User className="w-5 h-5 text-gray-600" />
          <span className="text-[10px] font-bold text-gray-600">{lang === 'ar' ? 'حسابي' : 'Compte'}</span>
        </Link>
      </div>

      {/* Cart drawer */}
      {isOpen && <CartDrawer />}

      {/* AI Chatbot */}
      {aiChatbotEnabled && <AIChatbot />}
    </div>
  );
}

function CartDrawer() {
  const { isOpen, setIsOpen, items, removeItem, updateQuantity, subtotal, totalItems } = useCart();
  const { t, formatPrice, dir } = useLanguage();
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex" dir={dir}>
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={() => setIsOpen(false)} />
      <div className={`relative ${dir === 'rtl' ? 'left-0' : 'right-0'} w-full max-w-md bg-white shadow-2xl animate-slide-in-${dir === 'rtl' ? 'left' : 'right'} flex flex-col`}>
        <div className="flex items-center justify-between p-4 border-b bg-secondary-950 text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary-400" />
            {t('cart.title')} ({totalItems})
          </h2>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-secondary-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">{t('cart.empty')}</p>
            <button onClick={() => { setIsOpen(false); navigate('/products'); }} className="btn-primary">
              {t('cart.continueShopping')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.map((item) => (
                <div key={item.product_id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                  <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{item.name}</h3>
                    <p className="text-primary-600 font-bold text-sm mt-1">{formatPrice(item.price)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(item.product_id)}
                        className="ms-auto text-error-500 hover:text-error-600 text-xs"
                      >
                        {t('cart.removeItem')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t p-4 space-y-3">
              <div className="flex justify-between font-bold">
                <span>{t('cart.total')}</span>
                <span className="text-primary-600">{formatPrice(subtotal)}</span>
              </div>
              <button
                onClick={() => { setIsOpen(false); navigate('/cart'); }}
                className="btn-outline w-full"
              >
                {t('cart.title')}
              </button>
              <button
                onClick={() => { setIsOpen(false); navigate('/checkout'); }}
                className="btn-primary w-full"
              >
                {t('cart.checkout')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
