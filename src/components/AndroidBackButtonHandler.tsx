import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';

export default function AndroidBackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  const locationRef = useRef(location);
  const navigateRef = useRef(navigate);

  // Keep refs up to date on every location or navigate change
  useEffect(() => {
    locationRef.current = location;
    navigateRef.current = navigate;
  }, [location, navigate]);

  useEffect(() => {
    let active = true;
    let listener: { remove: () => void | Promise<void> } | null = null;
    let appStateListener: { remove: () => void | Promise<void> } | null = null;

    const registerListener = async () => {
      try {
        const l = await CapApp.addListener('backButton', () => {
          if (!active) return;
          const pathname = locationRef.current.pathname;

          // 1. Root pages or Admin pages minimize/exit the app rather than instantly killing it
          if (
            pathname === '/' ||
            pathname === '/admin' ||
            pathname === '/admin/dashboard' ||
            pathname === '/admin/login' ||
            pathname === '/admin/system' ||
            pathname === '/admin/products' ||
            pathname === '/admin/categories' ||
            pathname === '/admin/banners' ||
            pathname === '/admin/orders'
          ) {
            CapApp.minimizeApp();
            return;
          }

          // 2. Product -> Products
          const productDetailRegex = /^\/products\/[^/]+$/;
          if (productDetailRegex.test(pathname)) {
            navigateRef.current('/products');
            return;
          }

          // 3. Products -> Categories (Home contains the categories section)
          if (pathname === '/products') {
            navigateRef.current('/');
            return;
          }

          // 4. Categories -> Home
          if (pathname.startsWith('/category/')) {
            navigateRef.current('/');
            return;
          }

          // 5. Cart -> Previous page
          if (pathname === '/cart') {
            navigateRef.current(-1);
            return;
          }

          // Default fallback: Go back
          navigateRef.current(-1);
        });

        const sl = await CapApp.addListener('appStateChange', (state) => {
          if (state.isActive) {
            window.dispatchEvent(new CustomEvent('app_resumed'));
          }
        });

        if (active) {
          listener = l;
          appStateListener = sl;
        } else {
          l.remove();
          sl.remove();
        }
      } catch (err) {
        console.warn('Capacitor App plugin listener failed to initialize (this is expected in browser):', err);
      }
    };

    registerListener();

    return () => {
      active = false;
      if (listener) listener.remove();
      if (appStateListener) appStateListener.remove();
    };
  }, []); // Run ONLY ONCE on mount

  return null;
}
