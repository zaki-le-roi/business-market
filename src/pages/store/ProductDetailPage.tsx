import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, ShieldCheck, Truck, ArrowLeft, ArrowRight, Minus, Plus, Zap } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useCart } from '../../contexts/CartContext';
import { supabase } from '../../lib/supabase';
import { Product } from '../../types';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { lang, dir, formatPrice } = useLanguage();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string>('');

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    let foundProd: Product | null = null;

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!error && data) {
        foundProd = data as Product;
      }
    } catch (e) {
      console.warn('[ProductDetailPage] Supabase fetch warning:', e);
    }

    // Check local storage fallback if not found or edited locally
    const localSaved = localStorage.getItem('local_admin_products') || localStorage.getItem('products');
    if (localSaved) {
      try {
        const parsed: Product[] = JSON.parse(localSaved);
        if (Array.isArray(parsed)) {
          const matched = parsed.find(p => p.slug === slug || p.id === slug);
          if (matched) {
            foundProd = foundProd ? { ...foundProd, ...matched } : matched;
          }
        }
      } catch {
        // ignore
      }
    }

    if (foundProd) {
      setProduct(foundProd);
      if (foundProd.images && foundProd.images.length > 0) {
        setSelectedImage(foundProd.images[0]);
      }
    } else {
      setProduct(null);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    if (slug) {
      fetchProduct();
    }

    const handleSync = () => {
      if (slug) fetchProduct();
    };
    window.addEventListener('products_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('products_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [slug, fetchProduct]);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const imagesList = product?.images && product.images.length > 0
    ? product.images
    : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80'];

  const currentIdx = imagesList.indexOf(selectedImage) !== -1 ? imagesList.indexOf(selectedImage) : 0;

  const handlePrevImage = () => {
    const prevIdx = (currentIdx - 1 + imagesList.length) % imagesList.length;
    setSelectedImage(imagesList[prevIdx]);
  };

  const handleNextImage = () => {
    const nextIdx = (currentIdx + 1) % imagesList.length;
    setSelectedImage(imagesList[nextIdx]);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 40;
    const isRightSwipe = distance < -40;

    if (isLeftSwipe) {
      if (dir === 'rtl') handlePrevImage(); else handleNextImage();
    } else if (isRightSwipe) {
      if (dir === 'rtl') handleNextImage(); else handlePrevImage();
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-gray-500">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center p-4">
        <h2 className="text-xl font-bold text-gray-800">{lang === 'ar' ? 'المنتج غير موجود' : 'Product Not Found'}</h2>
        <Link to="/products" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold">
          {lang === 'ar' ? 'تصفح جميع المنتجات' : 'Browse All Products'}
        </Link>
      </div>
    );
  }

  const name = lang === 'ar' ? product.name_ar : (product.name_fr || product.name_ar);
  const description = lang === 'ar' ? product.description_ar : (product.description_fr || product.description_ar);

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      addItem(product);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8" dir={dir}>
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium">
        {dir === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
        <span>{lang === 'ar' ? 'العودة' : 'Back'}</span>
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Images Gallery */}
        <div className="space-y-4">
          <div 
            className="relative aspect-square bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 group select-none touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {selectedImage ? (
              <img 
                src={selectedImage} 
                alt={name} 
                onClick={() => setIsLightboxOpen(true)}
                className="w-full h-full object-cover cursor-zoom-in transition-transform duration-300 group-hover:scale-105" 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
            )}

            {/* Navigation Overlay Arrows */}
            {imagesList.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                  className="absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 p-2 rounded-full bg-white/90 text-gray-800 shadow-md hover:bg-white transition opacity-90 sm:opacity-0 group-hover:opacity-100"
                  aria-label="Previous image"
                >
                  {dir === 'rtl' ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                  className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 p-2 rounded-full bg-white/90 text-gray-800 shadow-md hover:bg-white transition opacity-90 sm:opacity-0 group-hover:opacity-100"
                  aria-label="Next image"
                >
                  {dir === 'rtl' ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                </button>

                {/* Counter Badge */}
                <div className="absolute bottom-3 ltr:right-3 rtl:left-3 bg-black/70 backdrop-blur-sm text-white text-xs font-mono px-2.5 py-1 rounded-full shadow">
                  {currentIdx + 1} / {imagesList.length}
                </div>
              </>
            )}
          </div>

          {/* Thumbnails Row */}
          {imagesList.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
              {imagesList.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                    (selectedImage || imagesList[0]) === img 
                      ? 'border-primary-600 ring-2 ring-primary-600/20 scale-105 shadow-sm' 
                      : 'border-gray-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lightbox Zoom Modal */}
        {isLightboxOpen && selectedImage && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setIsLightboxOpen(false)}
          >
            <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="absolute -top-10 ltr:right-0 rtl:left-0 text-white hover:text-gray-300 font-bold text-sm bg-gray-800 px-3 py-1 rounded-lg"
              >
                ✕ {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
              <img src={selectedImage} alt="" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
            </div>
          </div>
        )}

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{name}</h1>
            <div className="mt-3 flex items-center gap-4">
              <span className="text-2xl font-bold text-primary-600 font-mono">{formatPrice(product.price)}</span>
              {product.compare_price && product.compare_price > product.price && (
                <span className="text-lg text-gray-400 line-through font-mono">{formatPrice(product.compare_price)}</span>
              )}
            </div>
          </div>

          <div className="border-t border-b border-gray-100 py-4 space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">{description || (lang === 'ar' ? 'لا يوجد وصف للمنتج.' : 'No description available.')}</p>
          </div>

          {/* Quantity & Buy */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-700">{lang === 'ar' ? 'الكمية:' : 'Quantity:'}</span>
              <div className="flex items-center border border-gray-200 rounded-lg">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 text-gray-600 hover:text-gray-900"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 font-bold text-sm">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2 text-gray-600 hover:text-gray-900"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAddToCart}
                className="flex-1 py-3.5 px-6 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-600/20 transition-all flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                <span>{lang === 'ar' ? 'إضافة إلى السلة' : 'Add to Cart'}</span>
              </button>
              <button
                onClick={() => { handleAddToCart(); navigate('/checkout'); }}
                className="flex-1 py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                <span>{lang === 'ar' ? 'شراء الآن' : 'Buy Now'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary-600 shrink-0" />
              <span>{lang === 'ar' ? 'توصيل سريع لـ 58 ولاية' : 'Fast shipping to 58 wilayas'}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{lang === 'ar' ? 'الدفع عند الاستلام' : 'Cash on delivery'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
