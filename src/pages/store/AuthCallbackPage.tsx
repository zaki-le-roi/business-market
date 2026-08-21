import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ensureAuthenticatedAdmin } from '../../lib/storage';
import { useLanguage } from '../../contexts/LanguageContext';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const processAuth = async () => {
      try {
        const fullUrl = window.location.href;
        const hashIndex = fullUrl.indexOf('#');
        const queryIndex = fullUrl.indexOf('?');

        let queryParams = new URLSearchParams();
        let hashParams = new URLSearchParams();

        if (queryIndex !== -1) {
          const queryStr = hashIndex > queryIndex 
            ? fullUrl.substring(queryIndex + 1, hashIndex) 
            : fullUrl.substring(queryIndex + 1);
          queryParams = new URLSearchParams(queryStr);
        }

        if (hashIndex !== -1) {
          hashParams = new URLSearchParams(fullUrl.substring(hashIndex + 1));
        }

        const error = hashParams.get('error_description') || queryParams.get('error_description') || hashParams.get('error') || queryParams.get('error');
        if (error) {
          setErrorMsg(error);
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const code = queryParams.get('code') || hashParams.get('code');

        let user = null;

        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!sessionErr && sessionData?.user) {
            user = sessionData.user;
          }
        } else if (code) {
          const { data: codeData, error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (!codeErr && codeData?.user) {
            user = codeData.user;
          }
        }

        if (!user) {
          const { data: curSession } = await supabase.auth.getSession();
          user = curSession?.session?.user || null;
        }

        if (!user || !user.email) {
          navigate('/login');
          return;
        }

        const cleanEmail = user.email.trim().toLowerCase();
        const userMeta = user.user_metadata || {};
        const displayName = (userMeta.full_name as string) || (userMeta.name as string) || cleanEmail.split('@')[0];
        const photoUrl = (userMeta.avatar_url as string) || (userMeta.picture as string) || null;

        // Sync or create customer
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
            login_history: [{ date: new Date().toISOString(), ip: '127.0.0.1', device: 'Google OAuth Callback' }]
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

        // Check if admin
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
            // Note
          }
        }

        if (!isAdmin) {
          try {
            const { data: aProf } = await supabase.from('admin_profiles').select('is_active').eq('email', cleanEmail).maybeSingle();
            if (aProf?.is_active) isAdmin = true;
          } catch {
            // Note
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

        setTimeout(() => {
          window.location.reload();
        }, 100);
      } catch (err) {
        console.error('Error processing auth callback:', err);
        navigate('/login');
      }
    };

    processAuth();
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <Loader2 className="w-10 h-10 text-primary-600 animate-spin mb-4" />
      <h2 className="text-xl font-bold text-slate-800 mb-2">
        {lang === 'ar' ? 'جاري التحقق من تسجيل الدخول...' : 'Vérification de la connexion...'}
      </h2>
      <p className="text-slate-500 text-sm max-w-sm">
        {errorMsg ? errorMsg : (lang === 'ar' ? 'يرجى الانتظار لحظة بينما نقوم بإنهاء جلسة المصادقة الخاصة بك.' : 'Veuillez patienter un instant...')}
      </p>
    </div>
  );
}
