import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { HomepageBanner } from '../types';
import { getBanners } from '../lib/banners';

export default function HomeHeroSlider() {
  const { lang, t, dir } = useLanguage();
  const isRtl = dir === 'rtl';

  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load banners
  const loadBannerData = useCallback(async () => {
    try {
      const data = await getBanners();
      const now = new Date();
      const activeBanners = data.filter(b => {
        if (!b.active) return false;
        if (b.start_date && new Date(b.start_date) > now) return false;
        if (b.end_date && new Date(b.end_date) < now) return false;
        return true;
      });

      setBanners(activeBanners);
      setCurrentIndex((prev) => (activeBanners.length > 0 ? prev % activeBanners.length : 0));
    } catch (err) {
      console.error('[HomeHeroSlider] Error loading banners for slider:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBannerData();

    const handleUpdate = () => {
      loadBannerData();
    };

    window.addEventListener('banners_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('banners_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadBannerData]);

  const nextSlide = useCallback(() => {
    if (banners.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevSlide = useCallback(() => {
    if (banners.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  // Autoplay setup
  useEffect(() => {
    if (banners.length <= 1 || isHovered) {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
      return;
    }

    autoplayTimerRef.current = setInterval(() => {
      nextSlide();
    }, 4500); // 4.5 seconds auto play

    return () => {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
      }
    };
  }, [banners.length, isHovered, nextSlide]);

  // Drag / Swipe handling on mobile
  const handleDragEnd = (_event: unknown, info: { offset: { x: number; y: number } }) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold) {
      if (isRtl) {
        prevSlide();
      } else {
        nextSlide();
      }
    } else if (info.offset.x > swipeThreshold) {
      if (isRtl) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  };

  // Helper to resolve localized banner content
  const getSlideContent = (b: HomepageBanner) => {
    const title = lang === 'ar' ? b.title_ar || b.title : b.title_fr || b.title;
    const subtitle = lang === 'ar' ? b.subtitle_ar || b.subtitle : b.subtitle_fr || b.subtitle;
    const btnText = lang === 'ar' ? b.button_text_ar || b.button_text : b.button_text_fr || b.button_text;
    
    return { title, subtitle, btnText };
  };

  if (loading) {
    return (
      <div className="w-full aspect-[21/9] min-h-[350px] md:min-h-[450px] bg-slate-100 flex items-center justify-center animate-pulse rounded-2xl overflow-hidden">
        <div className="text-slate-400 text-sm font-semibold flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  // Fallback if no active banners exist in the system
  if (banners.length === 0) {
    return (
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-3xl shadow-lg mx-auto w-full max-w-7xl">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center text-white sm:py-28">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur">
            <Sparkles className="h-4 w-4" /> {t('app.tagline')}
          </span>
          <h1 className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
            {t('home.heroTitle')}
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/90 sm:text-lg">
            {t('home.heroSubtitle')}
          </p>
          <Link
            to="/products"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-indigo-600 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          >
            {t('home.shopNow')} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section 
      className="relative w-full max-w-7xl mx-auto overflow-hidden bg-slate-900 rounded-2xl md:rounded-3xl shadow-lg group/slider h-[380px] sm:h-[420px] md:h-[480px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence initial={false} mode="wait">
        {banners.map((b, idx) => {
          if (idx !== currentIndex) return null;
          const { title, subtitle, btnText } = getSlideContent(b);
          
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="absolute inset-0 w-full h-full flex flex-col justify-center select-none cursor-grab active:cursor-grabbing"
            >
              {/* Picture tag for responsive Lazy Loading of desktop vs mobile versions */}
              <picture className="absolute inset-0 w-full h-full">
                {b.mobile_image_url && (
                  <source media="(max-width: 640px)" srcSet={b.mobile_image_url} />
                )}
                <img
                  src={b.image_url}
                  alt={title || 'Banner Slide'}
                  loading="lazy"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.onerror = null;
                    target.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=80';
                  }}
                  className="w-full h-full object-cover select-none pointer-events-none"
                />
              </picture>

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/20 md:bg-gradient-to-r md:from-black/80 md:via-black/40 md:to-transparent" />

              {/* Slide Content Overlay */}
              <div 
                className={`relative z-10 px-6 sm:px-12 md:px-16 flex flex-col justify-center h-full max-w-3xl ${
                  b.text_alignment === 'center'
                    ? 'items-center mx-auto text-center'
                    : b.text_alignment === 'right'
                    ? 'items-end ml-auto text-right'
                    : 'items-start mr-auto text-left'
                }`}
                style={{ color: b.text_color || '#ffffff' }}
              >
                {/* Decorative badge if promotional/arrival type */}
                <motion.span 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur"
                >
                  <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                  {t('app.tagline')}
                </motion.span>

                {/* Banner Title */}
                {title && (
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight leading-tight md:leading-snug"
                  >
                    {title}
                  </motion.h2>
                )}

                {/* Banner Subtitle */}
                {subtitle && (
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="mt-3 text-xs sm:text-sm md:text-lg max-w-xl font-light opacity-90 leading-relaxed"
                  >
                    {subtitle}
                  </motion.p>
                )}

                {/* Action CTA Button */}
                {btnText && b.button_link && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                    className="mt-6 md:mt-8"
                  >
                    {b.button_link.startsWith('http') ? (
                      <a
                        href={b.button_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full px-6 sm:px-8 py-3 text-sm font-extrabold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                        style={{
                          backgroundColor: b.button_color || '#4f46e5',
                          color: '#ffffff',
                        }}
                      >
                        {btnText} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                      </a>
                    ) : (
                      <Link
                        to={b.button_link}
                        className="inline-flex items-center gap-2 rounded-full px-6 sm:px-8 py-3 text-sm font-extrabold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                        style={{
                          backgroundColor: b.button_color || '#4f46e5',
                          color: '#ffffff',
                        }}
                      >
                        {btnText} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                      </Link>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Slide Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute top-1/2 left-4 -translate-y-1/2 flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-black/35 backdrop-blur-xs text-white hover:bg-black/60 opacity-0 group-hover/slider:opacity-100 transition-opacity duration-200 z-20 focus:outline-none"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
          </button>
          
          <button
            onClick={nextSlide}
            className="absolute top-1/2 right-4 -translate-y-1/2 flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-black/35 backdrop-blur-xs text-white hover:bg-black/60 opacity-0 group-hover/slider:opacity-100 transition-opacity duration-200 z-20 focus:outline-none"
            aria-label="Next Slide"
          >
            <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </>
      )}

      {/* Pagination Dot Indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`h-2 rounded-full transition-all duration-300 focus:outline-none ${
                i === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
