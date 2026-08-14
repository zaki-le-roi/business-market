import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useParams, Link, useNavigate } from 'react-router-dom';
import {
  Search, SlidersHorizontal, X, Star, ShoppingCart,
  ChevronDown, Package, Zap, Folder, Layers, Tag, ChevronRight
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useCart } from '../../contexts/CartContext';
import { supabase } from '../../lib/supabase';
import { Product, Category, Customer } from '../../types';
import { isWholesaleCustomer } from '../../lib/wholesale';

// Helper to gather a category ID and all its descendant category IDs recursively
function getCategoryAndDescendantIds(catId: string, allCats: Category[]): string[] {
  let ids = [catId];
  const children = allCats.filter((c) => c.parent_id === catId);
  for (const child of children) {
    ids = ids.concat(getCategoryAndDescendantIds(child.id, allCats));
  }
  return ids;
}

// Helper to construct full ancestor chain array from root parent to target category
function getCategoryAncestors(catId: string | undefined, allCats: Category[]): Category[] {
  if (!catId || allCats.length === 0) return [];
  const chain: Category[] = [];
  let curr: Category | undefined = allCats.find((c) => c.id === catId || c.slug === catId);
  const visited = new Set<string>();

  while (curr && !visited.has(curr.id)) {
    visited.add(curr.id);
    chain.unshift(curr);
    if (!curr.parent_id) break;
    curr = allCats.find((c) => c.id === curr?.parent_id);
  }
  return chain;
}

/* ----------------------------- Product Card ----------------------------- */

function ProductCard({ product, customer }: { product: Product; customer: Customer | null }) {
  const { lang, t, formatPrice } = useLanguage();
  const { addItem } = useCart();
  const name = lang === 'ar' ? product.name_ar : product.name_fr;
  const image = product.images?.[0] || '';
  const isWholesale = isWholesaleCustomer(customer);
  const displayPrice = isWholesale && product.wholesale_price ? product.wholesale_price : product.price;
  const discount = product.compare_price && product.compare_price > product.price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100) : 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="absolute start-3 top-3 z-10 flex flex-col gap-1.5">
        {product.is_flash_sale && (
          <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-[11px] font-bold text-white shadow">
            <Zap className="h-3 w-3" /> {t('product.flashSale')}
          </span>
        )}
        {discount > 0 && (
          <span className="rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white shadow">-{discount}%</span>
        )}
      </div>
      <Link to={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-gray-50">
        {image ? (
          <img src={image} alt={name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300"><Package className="h-10 w-10" /></div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link to={`/products/${product.slug}`} className="line-clamp-2 text-sm font-semibold text-gray-800 hover:text-indigo-600">{name}</Link>
        <div className="mt-1.5 flex items-center gap-1">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className={`h-3.5 w-3.5 ${i <= Math.round(product.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
            ))}
          </div>
          <span className="text-xs text-gray-400">({product.review_count || 0})</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          {isWholesale && product.wholesale_price ? (
            <>
              <span className="text-lg font-bold text-primary-600">{formatPrice(product.wholesale_price)}</span>
              <span className="text-sm text-gray-400 line-through">{formatPrice(product.price)}</span>
            </>
          ) : (
            <>
              <span className="text-lg font-bold text-gray-900">{formatPrice(product.price)}</span>
              {product.compare_price && product.compare_price > product.price && (
                <span className="text-sm text-gray-400 line-through">{formatPrice(product.compare_price)}</span>
              )}
            </>
          )}
        </div>
        {isWholesale && product.moq && product.moq > 1 && (
          <p className="mt-1 text-xs text-amber-600">MOQ: {product.moq}+</p>
        )}
        <button
          onClick={() => addItem({ ...product, price: displayPrice })}
          disabled={product.stock_quantity <= 0}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          <ShoppingCart className="h-4 w-4" />
          {product.stock_quantity <= 0 ? t('product.outOfStock') : t('product.addToCart')}
        </button>
      </div>
    </div>
  );
}

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

/* ------------------------------ Sidebar ------------------------------ */

type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'best_selling' | 'rating';

const SORT_OPTIONS: { key: SortKey; ar: string; fr: string }[] = [
  { key: 'newest', ar: 'الأحدث', fr: 'Nouveautés' },
  { key: 'price_asc', ar: 'السعر: من الأقل', fr: 'Prix: croissant' },
  { key: 'price_desc', ar: 'السعر: من الأعلى', fr: 'Prix: décroissant' },
  { key: 'best_selling', ar: 'الأكثر مبيعاً', fr: 'Meilleures ventes' },
  { key: 'rating', ar: 'الأعلى تقييماً', fr: 'Mieux notés' },
];

const PRICE_PRESETS = [1000, 5000, 10000, 25000, 50000];

function FilterSidebar({
  categories,
  selectedCategory,
  onCategoryChange,
  maxPrice,
  priceRange,
  onPriceChange,
  sort,
  onSortChange,
  onClear,
  directCounts,
  cumulativeCounts,
}: {
  categories: Category[];
  selectedCategory: string;
  onCategoryChange: (slug: string, parentSlug?: string) => void;
  maxPrice: number;
  priceRange: number;
  onPriceChange: (v: number) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  onClear: () => void;
  directCounts: Record<string, number>;
  cumulativeCounts: Record<string, number>;
}) {
  const { lang, t, formatPrice } = useLanguage();
  const isAr = lang === 'ar';

  // State tracking expanded parent category IDs in sidebar tree
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  // Expand ancestors whenever active category changes
  useEffect(() => {
    if (!selectedCategory || categories.length === 0) return;
    const activeCat = categories.find((c) => c.slug === selectedCategory || c.id === selectedCategory);
    if (!activeCat) return;

    const ancestors = getCategoryAncestors(activeCat.id, categories);
    setExpandedParents((prev) => {
      const next = { ...prev };
      ancestors.forEach((cat) => {
        next[cat.id] = true;
      });
      return next;
    });
  }, [selectedCategory, categories]);

  const toggleExpand = (parentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedParents((prev) => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  const rootParents = categories.filter((c) => !c.parent_id);

  return (
    <div className="flex flex-col gap-6 text-slate-800">
      {/* Sort By Dropdown */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          {isAr ? 'ترتيب حسب' : 'Trier par'}
        </label>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50/50 py-2 ps-3 pe-8 text-xs sm:text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {isAr ? o.ar : o.fr}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* Professional Expandable Category Tree */}
      <div>
        <div className="mb-2.5 flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Layers className="h-4 w-4 text-indigo-500" />
            {isAr ? 'الفئات والتصنيفات' : 'Catégories'}
          </h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-500">
            {categories.length}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 max-h-[460px] overflow-y-auto pe-1 no-scrollbar">
          {/* All Categories Option */}
          <button
            onClick={() => onCategoryChange('')}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-start text-xs sm:text-sm transition-colors ${
              selectedCategory === ''
                ? 'bg-indigo-50 text-indigo-700 font-semibold border-s-2 border-indigo-600 ps-2 shadow-2xs'
                : 'font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <Folder className={`h-4 w-4 shrink-0 ${selectedCategory === '' ? 'text-indigo-600' : 'text-slate-400'}`} />
              {t('common.all')}
            </span>
          </button>

          {/* Parent Categories */}
          {rootParents.map((parent) => {
            const children = categories.filter((c) => c.parent_id === parent.id);
            const isParentSelected = selectedCategory === parent.slug || selectedCategory === parent.id;
            const isExpanded = !!expandedParents[parent.id];
            const parentTotalCount = cumulativeCounts[parent.id] ?? 0;

            return (
              <div key={parent.id} className="rounded-lg">
                {/* Parent Category Row */}
                <div
                  className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-start transition-colors cursor-pointer ${
                    isParentSelected
                      ? 'bg-indigo-50/90 text-indigo-700 font-semibold border-s-2 border-indigo-600 ps-2 shadow-2xs'
                      : 'font-medium text-slate-800 hover:bg-slate-50 hover:text-indigo-600'
                  }`}
                  onClick={() => {
                    onCategoryChange(parent.slug);
                    if (children.length > 0) {
                      setExpandedParents((prev) => ({ ...prev, [parent.id]: true }));
                    }
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 me-1">
                    {children.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => toggleExpand(parent.id, e)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-transform"
                        title={isExpanded ? (isAr ? 'إغلاق' : 'Réduire') : (isAr ? 'توسيع' : 'Développer')}
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 transition-transform duration-200 rtl:rotate-180 ${
                            isExpanded ? 'rotate-90 rtl:rotate-90 text-indigo-600' : ''
                          }`}
                        />
                      </button>
                    )}
                    {parent.image_url ? (
                      <img
                        src={parent.image_url}
                        alt={isAr ? parent.name_ar : parent.name_fr}
                        className="h-5 w-5 rounded object-cover shrink-0 border border-slate-200"
                      />
                    ) : (
                      children.length === 0 && <Folder className="h-4 w-4 shrink-0 text-slate-400 me-0.5" />
                    )}
                    <span className="truncate text-xs sm:text-sm">
                      {isAr ? parent.name_ar : parent.name_fr}
                    </span>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-normal transition-colors ${
                      isParentSelected
                        ? 'bg-indigo-100 text-indigo-800 font-medium'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                    }`}
                  >
                    {parentTotalCount}
                  </span>
                </div>

                {/* Subcategories Vertical Tree */}
                {children.length > 0 && isExpanded && (
                  <div className="ms-3.5 ps-3 border-s border-slate-200 space-y-0.5 my-1">
                    {children.map((child) => {
                      const isChildSelected = selectedCategory === child.slug || selectedCategory === child.id;
                      const childCount = directCounts[child.id] ?? 0;

                      return (
                        <button
                          key={child.id}
                          onClick={() => onCategoryChange(child.slug, parent.slug)}
                          className={`group/child flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-start text-xs sm:text-sm font-medium transition-all ${
                            isChildSelected
                              ? 'bg-indigo-50 text-indigo-700 font-semibold border-s-2 border-indigo-600 ps-2 shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 me-1">
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                                isChildSelected ? 'bg-indigo-600' : 'bg-slate-300 group-hover/child:bg-indigo-500'
                              }`}
                            />
                            <span className="truncate">{isAr ? child.name_ar : child.name_fr}</span>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-normal transition-colors ${
                              isChildSelected
                                ? 'bg-indigo-100 text-indigo-800 font-medium'
                                : 'bg-slate-100 text-slate-400 group-hover/child:bg-slate-200'
                            }`}
                          >
                            {childCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Price Filter Range */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          {isAr ? 'نطاق السعر' : 'Fourchette de prix'}
        </label>
        <input
          type="range"
          min={0}
          max={maxPrice}
          step={500}
          value={priceRange}
          onChange={(e) => onPriceChange(Number(e.target.value))}
          className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>{formatPrice(0)}</span>
          <span className="font-semibold text-slate-900">{formatPrice(priceRange)}</span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {PRICE_PRESETS.filter((p) => p <= maxPrice).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPriceChange(p)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                priceRange === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ≤ {formatPrice(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Clear Filters Button */}
      <button
        type="button"
        onClick={onClear}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
      >
        <X className="h-3.5 w-3.5" />
        {isAr ? 'مسح الفلاتر' : 'Effacer les filtres'}
      </button>
    </div>
  );
}

/* ------------------------------ ProductsPage ------------------------------ */

const PAGE_SIZE = 12;

export default function ProductsPage() {
  const { t, lang, dir } = useLanguage();
  const navigate = useNavigate();
  const { slug: routeSlug, childSlug } = useParams<{ slug?: string; parentSlug?: string; childSlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAr = lang === 'ar';
  const urlQ = searchParams.get('q') || '';
  const urlFilter = searchParams.get('filter') || '';
  const urlCategorySlug = childSlug || routeSlug || searchParams.get('category') || '';

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(urlQ);
  const [sort, setSort] = useState<SortKey>('newest');
  const [priceRange, setPriceRange] = useState(50000);
  const [maxPrice, setMaxPrice] = useState(50000);
  const [currentPage, setCurrentPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('customer');
    if (saved) {
      try {
        setCustomer(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Fetch active categories and all active products
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('products').select('*').eq('is_active', true),
      ]);

      let loadedCats = (catRes.data || []) as Category[];
      let loadedProds = (prodRes.data || []) as Product[];

      // Merge local products if present
      const localSaved = localStorage.getItem('local_admin_products') || localStorage.getItem('products');
      if (localSaved) {
        try {
          const parsed = JSON.parse(localSaved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const map = new Map<string, Product>();
            loadedProds.forEach(p => map.set(p.id, p));
            parsed.forEach((p: Product) => {
              if (p && p.id) {
                map.set(p.id, { ...(map.get(p.id) || {}), ...p });
              }
            });
            loadedProds = Array.from(map.values()).filter(p => p.is_active !== false);
          }
        } catch {
          // fallback
        }
      }

      // Merge local categories if present
      const localCatsSaved = localStorage.getItem('local_admin_categories') || localStorage.getItem('categories');
      if (localCatsSaved) {
        try {
          const parsedCats = JSON.parse(localCatsSaved);
          if (Array.isArray(parsedCats) && parsedCats.length > 0) {
            const catMap = new Map<string, Category>();
            loadedCats.forEach(c => catMap.set(c.id, c));
            parsedCats.forEach((c: Category) => {
              if (c && c.id && c.is_active !== false) {
                catMap.set(c.id, { ...(catMap.get(c.id) || {}), ...c });
              }
            });
            loadedCats = Array.from(catMap.values());
          }
        } catch {
          // fallback
        }
      }

      // Bind category object to each product
      const boundProds = loadedProds.map((p) => ({
        ...p,
        category: loadedCats.find((c) => c.id === p.category_id || c.slug === p.category_id),
      }));

      setCategories(loadedCats);
      setAllProducts(boundProds);

      const ceiling = Math.max(boundProds.reduce((m, p) => Math.max(m, p.price), 0), 1000);
      setMaxPrice(ceiling);
      setPriceRange((prev) => (prev > ceiling ? ceiling : prev));
    } catch (e) {
      console.error('[ProductsPage] Error loading data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();

    const handleSync = () => {
      loadInitialData();
    };
    window.addEventListener('products_updated', handleSync);
    window.addEventListener('categories_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('products_updated', handleSync);
      window.removeEventListener('categories_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [loadInitialData]);

  useEffect(() => {
    setSearchInput(urlQ);
  }, [urlQ]);

  // Compute product counts accurately across the entire database
  const directProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allProducts.forEach((p) => {
      if (p.category_id) {
        counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      }
      if (p.category?.id && p.category.id !== p.category_id) {
        counts[p.category.id] = (counts[p.category.id] || 0) + 1;
      }
    });
    return counts;
  }, [allProducts]);

  const cumulativeProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach((cat) => {
      const descendantIds = getCategoryAndDescendantIds(cat.id, categories);
      let sum = 0;
      descendantIds.forEach((id) => {
        sum += directProductCounts[id] || 0;
      });
      counts[cat.id] = sum;
    });
    return counts;
  }, [categories, directProductCounts]);

  // Compute ancestor chain for active category (e.g., [Beauty, Makeup, Perfumes])
  const ancestorChain = useMemo(() => {
    if (!urlCategorySlug || categories.length === 0) return [];
    return getCategoryAncestors(urlCategorySlug, categories);
  }, [categories, urlCategorySlug]);

  const activeCategory = ancestorChain.length > 0 ? ancestorChain[ancestorChain.length - 1] : null;

  // Determine if activeCategory is a parent view (has subcategories or is root parent)
  const childCategories = useMemo(() => {
    if (!activeCategory) return [];
    return categories.filter((c) => c.parent_id === activeCategory.id);
  }, [activeCategory, categories]);

  const isParentView = useMemo(() => {
    if (!activeCategory) return false;
    return !activeCategory.parent_id || childCategories.length > 0;
  }, [activeCategory, childCategories]);

  const parentCategory = useMemo(() => {
    if (ancestorChain.length === 0) return null;
    return ancestorChain[0];
  }, [ancestorChain]);

  const currentChildCategory = useMemo(() => {
    if (ancestorChain.length > 1) return ancestorChain[ancestorChain.length - 1];
    return null;
  }, [ancestorChain]);

  // Sibling child categories under parent (for navigation pills when inside child category)
  const siblingCategories = useMemo(() => {
    if (parentCategory) {
      return categories.filter((c) => c.parent_id === parentCategory.id);
    }
    return [];
  }, [parentCategory, categories]);

  // Filter products by category, search query, feature filters, price range, and sort
  const filteredProducts = useMemo(() => {
    let list = [...allProducts];

    // Category filtering
    if (activeCategory) {
      if (isParentView) {
        // Parent Category view -> Include products assigned directly to parent OR any descendant child categories
        const targetIds = getCategoryAndDescendantIds(activeCategory.id, categories);
        const targetSlugs = categories.filter((c) => targetIds.includes(c.id)).map((c) => c.slug);

        list = list.filter(
          (p) =>
            (p.category_id && targetIds.includes(p.category_id)) ||
            (p.category_id && targetSlugs.includes(p.category_id)) ||
            (p.category?.id && targetIds.includes(p.category.id))
        );
      } else {
        // Child Category view -> Include ONLY products belonging specifically to this child category!
        list = list.filter(
          (p) =>
            p.category_id === activeCategory.id ||
            p.category_id === activeCategory.slug ||
            p.category?.id === activeCategory.id
        );
      }
    }

    // Search query filter
    if (urlQ.trim()) {
      const q = urlQ.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name_ar?.toLowerCase().includes(q) ||
          p.name_fr?.toLowerCase().includes(q) ||
          p.description_ar?.toLowerCase().includes(q) ||
          p.description_fr?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q)
      );
    }

    // Special promotion filters
    if (urlFilter === 'flash_sale') list = list.filter((p) => p.is_flash_sale);
    if (urlFilter === 'featured') list = list.filter((p) => p.is_featured);

    // Price range filter
    list = list.filter((p) => p.price <= priceRange);

    // Sorting
    return list.sort((a, b) => {
      switch (sort) {
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        case 'best_selling':
          return (b.sales_count || 0) - (a.sales_count || 0);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [allProducts, activeCategory, isParentView, categories, urlQ, urlFilter, priceRange, sort]);

  // Pagination slice
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const displayedProducts = filteredProducts.slice(startIndex, startIndex + PAGE_SIZE);

  // Reset pagination when category, search, or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [urlCategorySlug, urlQ, urlFilter, sort, priceRange]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) next.set('q', searchInput.trim());
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const handleCategoryChange = (slug: string, parentSlugParam?: string) => {
    if (!slug) {
      navigate('/products');
      return;
    }
    if (parentSlugParam) {
      navigate(`/category/${parentSlugParam}/${slug}`);
    } else {
      navigate(`/category/${slug}`);
    }
  };

  const handleClear = () => {
    navigate('/products');
    setSort('newest');
    setPriceRange(maxPrice);
    setSearchInput('');
  };

  const activeFilterLabel =
    urlFilter === 'flash_sale'
      ? isAr
        ? 'عروض فلاش'
        : 'Ventes Flash'
      : urlFilter === 'featured'
      ? isAr
        ? 'منتجات مميزة'
        : 'Produits en vedette'
      : null;

  const pageTitle =
    activeFilterLabel ||
    (activeCategory ? (isAr ? activeCategory.name_ar : activeCategory.name_fr) : urlQ ? `"${urlQ}"` : t('nav.products'));

  const sidebar = (
    <FilterSidebar
      categories={categories}
      selectedCategory={urlCategorySlug}
      onCategoryChange={handleCategoryChange}
      maxPrice={maxPrice}
      priceRange={priceRange}
      onPriceChange={setPriceRange}
      sort={sort}
      onSortChange={setSort}
      onClear={handleClear}
      directCounts={directProductCounts}
      cumulativeCounts={cumulativeProductCounts}
    />
  );

  return (
    <div dir={dir} className="mx-auto w-full max-w-7xl px-4 py-8">
      {/* ---------------- Breadcrumb Navigation ---------------- */}
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
        <Link to="/" className="hover:text-indigo-600 transition">
          {t('nav.home')}
        </Link>

        {ancestorChain.length === 0 ? (
          <>
            <span>/</span>
            <span className="font-extrabold text-gray-900">{t('nav.products')}</span>
          </>
        ) : (
          ancestorChain.map((cat, idx) => {
            const isLast = idx === ancestorChain.length - 1;
            const catName = isAr ? cat.name_ar : cat.name_fr;
            const parentCat = idx > 0 ? ancestorChain[0] : null;
            const targetUrl = parentCat ? `/category/${parentCat.slug}/${cat.slug}` : `/category/${cat.slug}`;

            return (
              <div key={cat.id} className="flex items-center gap-2">
                <span>/</span>
                {isLast ? (
                  <span className="font-extrabold text-indigo-600">{catName}</span>
                ) : (
                  <Link to={targetUrl} className="hover:text-indigo-600 transition">
                    {catName}
                  </Link>
                )}
              </div>
            );
          })
        )}
      </nav>

      {/* ---------------- Enterprise Category Header / Banner ---------------- */}
      <div className="mb-6 rounded-3xl border border-gray-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -end-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {parentCategory && currentChildCategory && (
                <Link
                  to={`/category/${parentCategory.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300 border border-indigo-400/30 hover:bg-indigo-500/30 transition"
                >
                  <Folder className="h-3.5 w-3.5" />
                  {isAr ? parentCategory.name_ar : parentCategory.name_fr}
                </Link>
              )}
              {isParentView && activeCategory && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-400/30">
                  <Layers className="h-3.5 w-3.5" />
                  {isAr ? 'تصنيف رئيسي' : 'Catégorie Principale'}
                </span>
              )}
              {!isParentView && activeCategory && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-400/30">
                  <Tag className="h-3.5 w-3.5" />
                  {isAr ? 'تصنيف فرعي مخصص' : 'Sous-catégorie Spécifique'}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black sm:text-4xl text-white tracking-tight">{pageTitle}</h1>

            {/* Description */}
            {activeCategory && (isAr ? activeCategory.description_ar : activeCategory.description_fr) && (
              <p className="mt-2 text-sm text-slate-300 max-w-2xl leading-relaxed font-medium">
                {isAr ? activeCategory.description_ar : activeCategory.description_fr}
              </p>
            )}
          </div>

          {/* Statistics summary */}
          {activeCategory && (
            <div className="flex shrink-0 items-center gap-4 border-t border-slate-800 md:border-t-0 md:border-s md:border-slate-800 pt-4 md:pt-0 md:ps-6">
              <div className="text-center">
                <span className="block text-2xl font-black text-indigo-400">
                  {isParentView
                    ? cumulativeProductCounts[activeCategory.id] ?? 0
                    : directProductCounts[activeCategory.id] ?? 0}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {isAr ? 'منتجات المتاحة' : 'Produits disponibles'}
                </span>
              </div>

              {isParentView && childCategories.length > 0 && (
                <div className="text-center border-s border-slate-800 ps-4">
                  <span className="block text-2xl font-black text-amber-400">{childCategories.length}</span>
                  <span className="text-xs font-bold text-slate-400">
                    {isAr ? 'تصنيفات فرعية' : 'Sous-catégories'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Child Categories Display Grid (When viewing Parent Category) ---------------- */}
      {isParentView && childCategories.length > 0 && (
        <div className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-purple-50/30 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-gray-900 tracking-tight">
              <Folder className="h-5 w-5 text-indigo-600" />
              {isAr ? 'التصنيفات الفرعية' : 'Sous-catégories'}
              <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                {childCategories.length}
              </span>
            </h2>
            <span className="text-xs font-semibold text-gray-500 hidden sm:inline">
              {isAr ? 'اختر تصنيفاً فرعياً لعرض منتجاته الحصرية' : 'Sélectionnez une sous-catégorie'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {childCategories.map((child) => {
              const count = directProductCounts[child.id] ?? 0;
              return (
                <Link
                  key={child.id}
                  to={`/category/${parentCategory?.slug}/${child.slug}`}
                  className="group relative flex flex-col items-center justify-between rounded-2xl border border-gray-200/90 bg-white p-4 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-400 hover:shadow-lg active:scale-95"
                >
                  <div className="mb-2.5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-inner">
                    {child.image_url ? (
                      <img
                        src={child.image_url}
                        alt={isAr ? child.name_ar : child.name_fr}
                        className="h-full w-full rounded-2xl object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    ) : (
                      <Tag className="h-6 w-6" />
                    )}
                  </div>
                  <span className="line-clamp-1 text-xs sm:text-sm font-extrabold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {isAr ? child.name_ar : child.name_fr}
                  </span>
                  <span className="mt-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                    {count} {isAr ? 'منتج' : 'produits'}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- Sibling Subcategories Navigation Pills (When viewing Child Category) ---------------- */}
      {!isParentView && parentCategory && siblingCategories.length > 0 && (
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <Link
            to={`/category/${parentCategory.slug}`}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-extrabold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition shadow-sm"
          >
            <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            {isAr ? `الكل في (${parentCategory.name_ar})` : `Tout dans (${parentCategory.name_fr})`}
          </Link>
          {siblingCategories.map((child) => {
            const isSelected = activeCategory?.id === child.id;
            const count = directProductCounts[child.id] ?? 0;
            return (
              <Link
                key={child.id}
                to={`/category/${parentCategory.slug}/${child.slug}`}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition shadow-sm ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{isAr ? child.name_ar : child.name_fr}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* ---------------- Search Bar inside Category Context ---------------- */}
      <form onSubmit={handleSearch} className="relative mb-6">
        <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={
            activeCategory
              ? isAr
                ? `بحث داخل ${isAr ? activeCategory.name_ar : activeCategory.name_fr}...`
                : `Rechercher dans ${activeCategory.name_fr}...`
              : t('common.searchPlaceholder')
          }
          className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 ps-12 pe-28 text-sm text-gray-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-medium"
        />
        <button
          type="submit"
          className="absolute end-2 top-1/2 -translate-y-1/2 rounded-xl bg-gray-900 px-5 py-2 text-sm font-bold text-white transition hover:bg-indigo-600"
        >
          {t('common.search')}
        </button>
      </form>

      {/* Mobile filter toggle */}
      <button
        onClick={() => setShowMobileFilters(true)}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
        {isAr ? 'الفلاتر والتصنيفات' : 'Filtres'}
      </button>

      {/* Main Layout Grid */}
      <div className="flex gap-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">{sidebar}</div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Item count header */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-500">
              {loading
                ? isAr
                  ? 'جاري التحميل...'
                  : 'Chargement...'
                : totalItems > 0
                ? isAr
                  ? `عرض ${startIndex + 1} - ${Math.min(startIndex + PAGE_SIZE, totalItems)} من إجمالي ${totalItems} منتج`
                  : `Affichage de ${startIndex + 1} - ${Math.min(startIndex + PAGE_SIZE, totalItems)} sur ${totalItems} produits`
                : isAr
                ? 'لا توجد منتجات'
                : 'Aucun produit'}
            </p>
          </div>

          {/* Product Grid / Empty State */}
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : displayedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center shadow-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
                <Package className="h-8 w-8" />
              </div>
              <p className="mt-4 text-lg font-bold text-gray-800">{t('common.noResults')}</p>
              <p className="mt-1 text-sm font-medium text-gray-400">
                {isAr ? 'لا توجد منتجات مسجلة في هذا التصنيف حالياً' : 'Aucun produit disponible dans cette catégorie'}
              </p>
              <button
                onClick={handleClear}
                className="mt-5 rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-600"
              >
                {isAr ? 'عرض جميع المنتجات' : 'Voir tous les produits'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {displayedProducts.map((p) => (
                <ProductCard key={p.id} product={p} customer={customer} />
              ))}
            </div>
          )}

          {/* ---------------- Pagination Controls ---------------- */}
          {totalPages > 1 && !loading && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition"
              >
                {isAr ? 'السابق' : 'Précédent'}
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-10 w-10 rounded-xl text-sm font-extrabold transition ${
                      currentPage === pageNum
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition"
              >
                {isAr ? 'التالي' : 'Suivant'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter off-canvas drawer */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="relative ms-auto flex h-full w-full max-w-xs flex-col bg-white shadow-2xl z-10 animate-in slide-in-from-end duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  {isAr ? 'التصنيفات والفلاتر' : 'Catégories et Filtres'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {sidebar}
            </div>

            {/* Sticky Action Footer */}
            <div className="border-t border-slate-100 p-3.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 active:scale-98"
              >
                {isAr ? `عرض النتائج (${totalItems})` : `Voir les résultats (${totalItems})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
