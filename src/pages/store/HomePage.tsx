import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck, ShieldCheck, Globe, Phone, Zap, Star, ArrowRight,
  Tag, TrendingUp, Sparkles, Clock, Megaphone, Building2, ExternalLink, ShoppingBag, Video, FileText
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useCart } from '../../contexts/CartContext';
import { supabase } from '../../lib/supabase';
import { Product, Category, CmsContent, CMSMediaItem } from '../../types';
import { fetchMedia } from '../../lib/cms';
import HomeHeroSlider from '../../components/HomeHeroSlider';

/* ----------------------------- Product Card ----------------------------- */

function ProductCard({ product }: { product: Product }) {
  const { lang, t, formatPrice } = useLanguage();
  const { addItem } = useCart();

  const name = lang === 'ar' ? product.name_ar : product.name_fr;
  const image = product.images?.[0] || '';
  const discount = product.compare_price && product.compare_price > product.price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
    : 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      {/* Badges */}
      <div className="absolute start-3 top-3 z-10 flex flex-col gap-1.5">
        {product.is_flash_sale && (
          <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-[11px] font-bold text-white shadow">
            <Zap className="h-3 w-3" /> {t('product.flashSale')}
          </span>
        )}
        {discount > 0 && (
          <span className="rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white shadow">
            -{discount}%
          </span>
        )}
      </div>

      {/* Image */}
      <Link to={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-gray-50">
        {image ? (
          <img
            src={image}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <Tag className="h-10 w-10" />
          </div>
        )}
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <Link to={`/products/${product.slug}`} className="line-clamp-2 text-sm font-semibold text-gray-800 hover:text-indigo-600">
          {name}
        </Link>

        {/* Rating */}
        <div className="mt-1.5 flex items-center gap-1">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${i <= Math.round(product.rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400">({product.review_count})</span>
        </div>

        {/* Price */}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-gray-900">{formatPrice(product.price)}</span>
          {product.compare_price && product.compare_price > product.price && (
            <span className="text-sm text-gray-400 line-through">{formatPrice(product.compare_price)}</span>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() => addItem(product)}
          disabled={product.stock_quantity <= 0}
          className="mt-3 w-full rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {product.stock_quantity <= 0 ? t('product.outOfStock') : t('product.addToCart')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Skeletons ------------------------------ */

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="aspect-square animate-pulse bg-gray-100" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
        <div className="h-8 w-full animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}

function CategorySkeleton() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-20 w-20 animate-pulse rounded-full bg-gray-100" />
      <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
    </div>
  );
}

/* ------------------------------ Section ------------------------------ */

function SectionHeader({
  icon: Icon, title, to,
}: { icon: React.ElementType; title: string; to?: string }) {
  const { t } = useLanguage();
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
        <Icon className="h-6 w-6 text-indigo-600" />
        {title}
      </h2>
      {to && (
        <Link to={to} className="flex items-center gap-1 text-sm font-medium text-indigo-600 transition-all hover:gap-2 hover:text-indigo-700">
          {t('common.viewAll')} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      )}
    </div>
  );
}

/* ------------------------------ HomePage ------------------------------ */

export default function HomePage() {
  const { t, lang, dir } = useLanguage();
  const [flashDeals, setFlashDeals] = useState<Product[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ads, setAds] = useState<CmsContent[]>([]);
  const [publishedMedia, setPublishedMedia] = useState<CMSMediaItem[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const loadHomeData = async () => {
    setLoading(true);
    console.log('[HomePage] Started fetching homepage data...');
    try {
      // Fetch CMS media items from Supabase
      const mediaList = await fetchMedia();
      const activeMedia = mediaList.filter(m => m.status === 'published');
      setPublishedMedia(activeMedia);

      const [productsResponse, categoriesResponse] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order').limit(8),
      ]);

      let cmsData: CmsContent[] = [];
      try {
        const { data } = await supabase.from('cms_content').select('*').eq('is_active', true).order('sort_order');
        if (data) cmsData = data as CmsContent[];
      } catch {
        // Ignored if legacy table is removed
      }

      let dbProds: Product[] = [];
      if (!productsResponse.error && Array.isArray(productsResponse.data)) {
        dbProds = productsResponse.data as Product[];
        try {
          localStorage.setItem('local_admin_products', JSON.stringify(dbProds));
          localStorage.setItem('products', JSON.stringify(dbProds));
        } catch {
          // ignore
        }
      } else {
        // Fallback to local storage only if Supabase request failed or returned empty
        const localProdsRaw = localStorage.getItem('local_admin_products') || localStorage.getItem('products');
        if (localProdsRaw) {
          try {
            const parsedLocal: Product[] = JSON.parse(localProdsRaw);
            if (Array.isArray(parsedLocal)) {
              dbProds = parsedLocal;
            }
          } catch (e) {
            console.warn('[HomePage] Failed to parse local products storage:', e);
          }
        }
      }

      let dbCats: Category[] = [];
      if (!categoriesResponse.error && Array.isArray(categoriesResponse.data)) {
        dbCats = categoriesResponse.data as Category[];
        try {
          localStorage.setItem('local_admin_categories', JSON.stringify(dbCats));
          localStorage.setItem('categories', JSON.stringify(dbCats));
        } catch {
          // ignore
        }
      } else {
        // Fallback to local categories only if Supabase request failed
        const localCatsRaw = localStorage.getItem('local_admin_categories') || localStorage.getItem('categories');
        if (localCatsRaw) {
          try {
            const parsedCats: Category[] = JSON.parse(localCatsRaw);
            if (Array.isArray(parsedCats)) {
              dbCats = parsedCats.filter(c => c && c.is_active !== false);
            }
          } catch (e) {
            console.warn('[HomePage] Failed to parse local categories storage:', e);
          }
        }
      }

      const activeProducts = dbProds.filter((p) => p.is_active !== false);

      // Filter and limit client-side
      const flash = activeProducts.filter((p) => p.is_flash_sale).slice(0, 8);
      const feat = activeProducts.filter((p) => p.is_featured).slice(0, 8);
      const best = [...activeProducts]
        .sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0))
        .slice(0, 8);

      setFlashDeals(flash);
      setFeatured(feat);
      setBestSellers(best);
      setCategories(dbCats);
      setAllProducts(activeProducts);
      if (cmsData.length > 0) {
        setAds(cmsData);
      }
    } catch (e) {
      console.error('[HomePage] Exception caught fetching homepage data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData();

    const handleSync = () => {
      loadHomeData();
    };

    window.addEventListener('products_updated', handleSync);
    window.addEventListener('categories_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('products_updated', handleSync);
      window.removeEventListener('categories_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const features = [
    { icon: Truck, ar: 'الدفع عند الاستلام', fr: 'Paiement à la livraison' },
    { icon: Globe, ar: 'توصيل لكل 58 ولاية', fr: 'Livraison 58 wilayas' },
    { icon: Phone, ar: 'تحقق رقم الهاتف', fr: 'Vérification téléphone' },
    { icon: ShieldCheck, ar: 'دعم ثنائي اللغة', fr: 'Support bilingue' },
  ];

  return (
    <div dir={dir} className="flex flex-col gap-12 pb-16">
      {/* Dynamic Hero Carousel/Slider */}
      <HomeHeroSlider />

      {/* Features bar */}
      <section className="mx-auto w-full max-w-7xl px-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <f.icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold text-gray-700">{lang === 'ar' ? f.ar : f.fr}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Flash Deals */}
      <section className="mx-auto w-full max-w-7xl px-4">
        <SectionHeader icon={Zap} title={t('home.flashDeals')} to="/products" />
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : flashDeals.length === 0 ? (
          <p className="py-10 text-center text-gray-400">{t('common.noResults')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {flashDeals.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* Published Store Videos & Media Gallery Section */}
      {!loading && publishedMedia.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4">
          <SectionHeader
            icon={Video}
            title={lang === 'ar' ? 'فيديوهات وعروض المتجر التعريفية' : 'Vidéos & Présentations Officielles'}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publishedMedia.map((media) => {
              const isVideo = media.file_type === 'video';
              const isImage = media.file_type === 'image';
              const title = lang === 'ar' ? (media.title_ar || media.name) : (media.title_fr || media.name);
              const desc = lang === 'ar' ? media.description_ar : media.description_fr;

              return (
                <div
                  key={media.id}
                  className="group relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-indigo-500/40"
                >
                  {/* Media Player / Image Frame */}
                  <div className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
                    {isVideo ? (
                      <video
                        src={media.url}
                        controls
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                    ) : isImage ? (
                      <img
                        src={media.url}
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="p-6 text-center text-slate-300">
                        <FileText className="w-12 h-12 text-indigo-400 mx-auto mb-2" />
                        <a href={media.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 underline">
                          {lang === 'ar' ? 'تحميل المستند' : 'Télécharger'}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Content Details */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800/80">
                          {isVideo ? '🎬 VIDEO' : isImage ? '📷 IMAGE' : '📄 PDF'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {media.folder || '/videos'}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-100 leading-snug line-clamp-1">
                        {title}
                      </h3>
                      {desc && (
                        <p className="text-xs text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                          {desc}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Shop by Category */}
      <section className="mx-auto w-full max-w-7xl px-4">
        <SectionHeader icon={Tag} title={t('home.shopByCategory')} to="/products" />
        {loading ? (
          <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
            {Array.from({ length: 8 }).map((_, i) => <CategorySkeleton key={i} />)}
          </div>
        ) : categories.length === 0 ? (
          <p className="py-10 text-center text-gray-400">{t('common.noResults')}</p>
        ) : (
          <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
            {categories.map((c) => (
              <Link key={c.id} to={`/category/${c.slug}`} className="group flex flex-col items-center gap-2">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 ring-2 ring-transparent transition group-hover:ring-indigo-400">
                  {c.image_url ? (
                    <img src={c.image_url} alt={lang === 'ar' ? c.name_ar : c.name_fr} className="h-full w-full object-cover" />
                  ) : (
                    <Tag className="h-8 w-8 text-indigo-400" />
                  )}
                </div>
                <span className="text-center text-xs font-medium text-gray-700 group-hover:text-indigo-600">
                  {lang === 'ar' ? c.name_ar : c.name_fr}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Promoted Product Advertisement Banner */}
      {!loading && ads.some(a => a.type === 'product_ad') && (
        <section className="mx-auto w-full max-w-7xl px-4">
          <SectionHeader icon={Megaphone} title={lang === 'ar' ? 'العروض الممولة والمنتجات المروجة' : 'Offres Sponsorisées'} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ads.filter(a => a.type === 'product_ad').map((ad) => {
              const meta = ad.metadata || {};
              const linkedProd = allProducts.find(p => p.id === meta.product_id);
              if (!linkedProd) return null;

              const promoBadge = lang === 'ar' ? (meta.badge_ar as string) : (meta.badge_fr as string);
              const promoTitle = lang === 'ar' ? ad.title_ar : ad.title_fr;
              const promoDesc = lang === 'ar' ? ad.content_ar : ad.content_fr;
              const promoImg = (meta.image as string) || linkedProd.images?.[0] || '';

              return (
                <div key={ad.id} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-xl flex flex-col sm:flex-row items-stretch border border-indigo-500/20">
                  {/* Photo content */}
                  <div className="relative sm:w-1/2 aspect-video sm:aspect-auto overflow-hidden">
                    {promoImg ? (
                      <img src={promoImg} alt="" className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-indigo-950">
                        <ShoppingBag className="w-16 h-16 text-indigo-400" />
                      </div>
                    )}
                    {promoBadge && (
                      <span className="absolute top-4 left-4 bg-rose-500 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                        {promoBadge}
                      </span>
                    )}
                  </div>
                  {/* Text content */}
                  <div className="p-6 sm:p-8 sm:w-1/2 flex flex-col justify-between space-y-4">
                    <div>
                      <span className="text-indigo-400 text-[10px] font-bold uppercase tracking-wider block mb-1">
                        📢 {lang === 'ar' ? 'عرض ترويجي ممول' : 'Sponsorisé'}
                      </span>
                      <h3 className="text-lg font-extrabold leading-snug line-clamp-2">
                        {promoTitle || (lang === 'ar' ? linkedProd.name_ar : linkedProd.name_fr)}
                      </h3>
                      <p className="text-xs text-slate-300 mt-2 line-clamp-3 leading-relaxed">
                        {promoDesc || (lang === 'ar' ? linkedProd.short_description_ar : linkedProd.short_description_fr)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-4 border-t border-indigo-900/60">
                      <div>
                        <p className="text-[10px] text-slate-400">{lang === 'ar' ? 'السعر الترويجي' : 'Prix Promo'}</p>
                        <p className="text-base font-black text-rose-400">{linkedProd.price} DZD</p>
                      </div>
                      <Link to={`/products/${linkedProd.slug}`} className="rounded-xl bg-white px-4 py-2 text-[11px] font-extrabold text-indigo-900 hover:bg-rose-500 hover:text-white transition-all shadow-md">
                        {lang === 'ar' ? 'تسوق العرض الآن' : 'Découvrir'}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="mx-auto w-full max-w-7xl px-4">
        <SectionHeader icon={Sparkles} title={t('home.featuredProducts')} to="/products" />
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : featured.length === 0 ? (
          <p className="py-10 text-center text-gray-400">{t('common.noResults')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* COD Banner */}
      <section className="mx-auto w-full max-w-7xl px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-10 sm:px-12 sm:py-12">
          <div className="absolute -end-10 -top-10 opacity-10">
            <Truck className="h-40 w-40 text-white" />
          </div>
          <div className="relative flex flex-col items-start gap-4 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold sm:text-2xl">{t('home.codBanner')}</h3>
              <p className="mt-1 text-sm text-white/90">{t('home.codBannerDesc')}</p>
            </div>
            <Link to="/products" className="shrink-0 rounded-full bg-white px-6 py-3 text-sm font-bold text-emerald-600 transition hover:scale-105">
              {t('home.shopNow')}
            </Link>
          </div>
        </div>
      </section>

      {/* Best Sellers */}
      <section className="mx-auto w-full max-w-7xl px-4">
        <SectionHeader icon={TrendingUp} title={t('home.bestSellers')} to="/products" />
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : bestSellers.length === 0 ? (
          <p className="py-10 text-center text-gray-400">{t('common.noResults')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {bestSellers.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* Sponsoring Companies & Brands Banner */}
      {!loading && ads.some(a => a.type === 'company_ad') && (
        <section className="mx-auto w-full max-w-7xl px-4">
          <SectionHeader icon={Building2} title={lang === 'ar' ? 'الشركات الراعية والشركاء التجاريين' : 'Partenaires & Sponsors Officiels'} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {ads.filter(a => a.type === 'company_ad').map((ad) => {
              const meta = ad.metadata || {};
              const companyName = lang === 'ar' ? (meta.company_name_ar as string) : (meta.company_name_fr as string);
              const logoImg = meta.image as string;
              const linkUrl = meta.url as string;

              return (
                <div key={ad.id} className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-between text-center gap-4">
                  {/* Partner logo container */}
                  <div className="w-20 h-20 bg-gray-50 rounded-2xl overflow-hidden flex items-center justify-center p-2 group-hover:scale-105 transition-transform">
                    {logoImg ? (
                      <img src={logoImg} alt={companyName} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <Building2 className="w-10 h-10 text-gray-300" />
                    )}
                  </div>
                  {/* Text details */}
                  <div className="min-w-0">
                    <h4 className="font-bold text-gray-800 text-sm truncate">{companyName}</h4>
                    <p className="text-[10px] text-gray-400 mt-1 line-clamp-1">{lang === 'ar' ? ad.title_ar : ad.title_fr}</p>
                  </div>
                  {/* Call to action button */}
                  {linkUrl ? (
                    <a
                      href={linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      <span>{lang === 'ar' ? 'زيارة العرض' : 'Visiter'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-[9px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded">
                      {lang === 'ar' ? 'راعٍ رسمي' : 'Sponsor'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="mx-auto w-full max-w-7xl px-4">
        <div className="rounded-3xl border border-gray-100 bg-gradient-to-br from-gray-50 to-indigo-50 px-6 py-10 text-center sm:py-12">
          <Clock className="mx-auto h-8 w-8 text-indigo-500" />
          <h3 className="mt-3 text-xl font-bold text-gray-900 sm:text-2xl">
            {lang === 'ar' ? 'اشترك في النشرة البريدية' : 'Inscrivez-vous à la newsletter'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {lang === 'ar' ? 'كن أول من يعرف عن العروض والمنتجات الجديدة' : 'Soyez les premiers informés des offres et nouveautés'}
          </p>
          {subscribed ? (
            <p className="mt-5 font-semibold text-emerald-600">
              {lang === 'ar' ? '✓ تم الاشتراك بنجاح!' : '✓ Inscription réussie!'}
            </p>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); if (email) setSubscribed(true); }}
              className="mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={lang === 'ar' ? 'بريدك الإلكتروني' : 'Votre email'}
                className="flex-1 rounded-full border border-gray-200 bg-white px-5 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <button type="submit" className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-indigo-700">
                {lang === 'ar' ? 'اشترك' : "S'inscrire"}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
