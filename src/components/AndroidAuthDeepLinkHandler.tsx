import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { ensureAuthenticatedAdmin } from '../lib/storage';

export default function AndroidAuthDeepLinkHandler() {
  const navigate = useNavigate();
  const isHandlingAuth = useRef(false);

  useEffect(() => {
    // Only run on native platforms (Android / iOS)
    if (!Capacitor.isNativePlatform()) return;

    const establishCustomerAndSession = async (user: { id: string; email?: string | null; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }) => {
      if (!user || !user.email) return;
      const cleanEmail = user.email.trim().toLowerCase();
      const userMeta = user.user_metadata || {};
      const displayName = (userMeta.full_name as string) || (userMeta.name as string) || cleanEmail.split('@')[0];
      const photoUrl = (userMeta.avatar_url as string) || (userMeta.picture as string) || null;

      try {
        // 1. Fetch or create customer record in Supabase
        const { data: customerList } = await supabase
          .from('customers')
          .select('*')
          .eq('email', cleanEmail)
          .order('created_at', { ascending: false });

        let customer = customerList && customerList.length > 0 ? customerList[0] : null;

        if (!customer) {
          const randomPhone = `pending-${Math.floor(10000000 + Math.random() * 90000000)}`;
          const extNotes = {
            profile_photo: photoUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=compress&cs=tinysrgb&w=150',
            country: 'Algeria',
            status: 'Active',
            preferred_currency: 'DZD',
            email_verified: true,
            phone_verified: false,
            login_history: [{ date: new Date().toISOString(), ip: '127.0.0.1', device: 'Android Google OAuth' }]
          };

          const { data: createdList } = await supabase
            .from('customers')
            .insert({
              phone: randomPhone,
              full_name: displayName,
              email: cleanEmail,
              is_verified: true,
              segment: 'new',
              notes: JSON.stringify(extNotes)
            })
            .select();

          customer = createdList && createdList.length > 0 ? createdList[0] : null;
        }

        if (customer) {
          localStorage.setItem('customer', JSON.stringify(customer));
        }

        // 2. Check if admin
        let isAdmin = cleanEmail === 'zakidj181@gmail.com' || cleanEmail === 'zakidj181@gmial.com';

        if (!isAdmin) {
          const appRole = (user.app_metadata?.role as string) || '';
          const userRole = (user.user_metadata?.role as string) || '';
          if (
            appRole === 'admin' ||
            appRole === 'super_admin' ||
            userRole === 'admin' ||
            userRole === 'super_admin' ||
            customer?.role === 'admin' ||
            customer?.is_admin === true
          ) {
            isAdmin = true;
          }
        }

        if (!isAdmin) {
          try {
            const { data: prof } = await supabase.from('profiles').select('role, is_admin').eq('email', cleanEmail).maybeSingle();
            if (prof && (prof.role === 'admin' || prof.role === 'super_admin' || prof.is_admin === true)) {
              isAdmin = true;
            }
          } catch {
            // Table check note
          }
        }

        if (!isAdmin) {
          try {
            const { data: aProf } = await supabase.from('admin_profiles').select('is_active').eq('email', cleanEmail).maybeSingle();
            if (aProf?.is_active) isAdmin = true;
          } catch {
            // Table check note
          }
        }

        if (isAdmin) {
          localStorage.setItem(
            'mock_admin_session',
            JSON.stringify({
              user: {
                id: user.id,
                email: cleanEmail,
                user_metadata: {
                  full_name: displayName,
                  avatar_url: photoUrl
                }
              }
            })
          );
          await ensureAuthenticatedAdmin(cleanEmail);
          navigate('/admin', { replace: true });
        } else {
          navigate('/', { replace: true });
        }

        // Slight delay to trigger reactivity and update headers
        setTimeout(() => {
          window.location.reload();
        }, 120);
      } catch (err) {
        console.error('Error establishing session in AndroidAuthDeepLinkHandler:', err);
      }
    };

    const handleAuthUrl = async (urlStr: string) => {
      if (!urlStr || isHandlingAuth.current) return;

      const isDeepLink =
        urlStr.startsWith('com.businessmarket.app://') ||
        urlStr.startsWith('businessmarket://') ||
        urlStr.includes('/auth/callback') ||
        urlStr.includes('access_token=') ||
        urlStr.includes('code=');

      if (!isDeepLink) return;

      isHandlingAuth.current = true;

      try {
        // Close Chrome Custom Tab / in-app browser
        await Browser.close().catch(() => {});

        const hashIndex = urlStr.indexOf('#');
        const queryIndex = urlStr.indexOf('?');

        let params: URLSearchParams;
        if (hashIndex !== -1) {
          params = new URLSearchParams(urlStr.substring(hashIndex + 1));
        } else if (queryIndex !== -1) {
          params = new URLSearchParams(urlStr.substring(queryIndex + 1));
        } else {
          params = new URLSearchParams();
        }

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const code = params.get('code');

        let authedUser = null;

        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (!sessionErr && sessionData?.user) {
            authedUser = sessionData.user;
          }
        } else if (code) {
          const { data: codeData, error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (!codeErr && codeData?.user) {
            authedUser = codeData.user;
          }
        }

        if (!authedUser) {
          const { data: curSession } = await supabase.auth.getSession();
          authedUser = curSession?.session?.user || null;
        }

        if (authedUser) {
          await establishCustomerAndSession(authedUser);
        }
      } catch (err) {
        console.error('Error handling Android auth deep link:', err);
      } finally {
        isHandlingAuth.current = false;
      }
    };

    // 1. Listen for deep link events while app is open / backgrounded
    const sub = CapApp.addListener('appUrlOpen', (data) => {
      if (data?.url) {
        handleAuthUrl(data.url);
      }
    });

    // 2. Check if app was cold-launched directly with a deep link URL
    CapApp.getLaunchUrl()
      .then((launchUrl) => {
        if (launchUrl?.url) {
          handleAuthUrl(launchUrl.url);
        }
      })
      .catch(() => {});

    // 3. Listen to Supabase onAuthStateChange as well
    const { data: authSub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        const storedCustomer = localStorage.getItem('customer');
        const storedAdmin = localStorage.getItem('mock_admin_session');
        if (!storedCustomer && !storedAdmin) {
          await establishCustomerAndSession(session.user);
        }
      }
    });

    return () => {
      sub.then((listener) => listener.remove()).catch(() => {});
      authSub.subscription.unsubscribe();
    };
  }, [navigate]);

  return null;
}
