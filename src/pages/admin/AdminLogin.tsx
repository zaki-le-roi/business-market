import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { checkIsAdmin } from '../../lib/admin';
import { ensureAuthenticatedAdmin } from '../../lib/storage';

export default function AdminLogin() {
  const { lang, dir } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verify if current session is an authorized administrator
  const verifyAdminAuth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      setLoading(true);
      const isAdmin = await checkIsAdmin();
      if (isAdmin) {
        navigate('/admin/dashboard');
      } else {
        await supabase.auth.signOut();
        setError(
          lang === 'ar'
            ? 'عذراً، حساب Google هذا ليس له صلاحية دخول للمشرفين.'
            : 'Access Denied: Your Google account is not an authorized administrator.'
        );
      }
    } catch (err) {
      console.error('Admin Auth Check Error:', err);
    } finally {
      setLoading(false);
    }
  }, [navigate, lang]);

  useEffect(() => {
    verifyAdminAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        verifyAdminAuth();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [verifyAdminAuth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
      } else if (data.session) {
        await verifyAdminAuth();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  const [gsiAdminRendered, setGsiAdminRendered] = useState(false);

  const handleDirectGoogleAdminAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      if (Capacitor.isNativePlatform()) {
        const { data, error: oAuthErr } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'com.businessmarket.app://auth/callback',
            skipBrowserRedirect: true,
          },
        });
        if (oAuthErr) throw oAuthErr;
        if (data?.url) {
          await Browser.open({ url: data.url, windowName: '_self' });
        }
        return;
      }

      const redirectUrl = window.location.origin.includes('localhost')
        ? window.location.origin + '/auth/callback'
        : 'https://business-market-olt.pages.dev/auth/callback';

      const { error: oAuthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (oAuthErr) throw oAuthErr;
    } catch (err: unknown) {
      console.warn('Admin Google Auth note:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isGoogleConfigured = typeof googleClientId === 'string' && 
    googleClientId.trim() !== '' && 
    googleClientId !== 'YOUR_GOOGLE_CLIENT_ID';

  // Load Google Sign-In SDK for Admin login via GSI
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!isGoogleConfigured || !googleClientId) return;

    interface GoogleCredentialResponse {
      credential: string;
    }

    interface GoogleAccountsId {
      initialize: (options: { client_id: string; auto_select?: boolean; callback: (res: GoogleCredentialResponse) => void }) => void;
      renderButton: (element: HTMLElement, options: { type?: string; theme?: string; size?: string; width?: string; text?: string; shape?: string }) => void;
    }

    interface GoogleSdk {
      accounts: {
        id: GoogleAccountsId;
      };
    }

    const scriptId = 'google-gsi-script-admin';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initAndRender = () => {
      const g = (window as unknown as { google?: GoogleSdk }).google;
      if (g?.accounts?.id) {
        g.accounts.id.initialize({
          client_id: googleClientId,
          auto_select: false,
          callback: async (response: GoogleCredentialResponse) => {
            try {
              setLoading(true);
              setError(null);

              if (response.credential) {
                try {
                  const { data: authData, error: authErr } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    token: response.credential,
                  });

                  if (!authErr && authData?.session?.user) {
                    await verifyAdminAuth();
                    return;
                  }
                } catch (spErr) {
                  console.warn('Supabase signInWithIdToken note:', spErr);
                }

                // Fallback decode JWT payload directly from Google credential
                const base64Url = response.credential.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(
                  window
                    .atob(base64)
                    .split('')
                    .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
                );
                const payload = JSON.parse(jsonPayload) as { email?: string; name?: string; picture?: string };

                if (payload && payload.email) {
                  const adminEmail = payload.email.toLowerCase();
                  let isAdmin = adminEmail === 'zakidj181@gmail.com' || adminEmail === 'zakidj181@gmial.com';

                  if (!isAdmin) {
                    try {
                      const { data: profile } = await supabase
                        .from('admin_profiles')
                        .select('is_active')
                        .eq('email', adminEmail)
                        .maybeSingle();
                      if (profile?.is_active) {
                        isAdmin = true;
                      }
                    } catch (dbErr) {
                      console.warn('Admin DB profile query note:', dbErr);
                    }
                  }

                  if (!isAdmin) {
                    const mockProfiles = JSON.parse(localStorage.getItem('mock_admin_profiles') || '[]');
                    const match = mockProfiles.find((p: { email: string; is_active: boolean }) => p.email?.toLowerCase() === adminEmail);
                    if (match?.is_active) {
                      isAdmin = true;
                    }
                  }

                  if (isAdmin) {
                    localStorage.setItem('mock_admin_session', JSON.stringify({
                      user: {
                        id: 'admin-' + Date.now(),
                        email: payload.email,
                        user_metadata: {
                          full_name: payload.name,
                          avatar_url: payload.picture,
                        }
                      }
                    }));
                    await ensureAuthenticatedAdmin(adminEmail);
                    navigate('/admin/dashboard');
                    return;
                  } else {
                    setError(
                      lang === 'ar'
                        ? 'عذراً، حساب Google هذا ليس له صلاحية دخول للمشرفين.'
                        : 'Access Denied: Your Google account is not an authorized administrator.'
                    );
                    setLoading(false);
                    return;
                  }
                }
              }
            } catch (jwtErr: unknown) {
              console.error('Error handling Admin Google credentials:', jwtErr);
              const errMsg = jwtErr instanceof Error ? jwtErr.message : String(jwtErr);
              setError(`${lang === 'ar' ? 'فشل تسجيل الدخول بواسطة Google' : 'Failed to sign in with Google'}: ${errMsg}`);
              setLoading(false);
            }
          },
        });

        const targetEl = document.getElementById('googleAdminSignInBtn');
        if (targetEl) {
          targetEl.innerHTML = '';
          g.accounts.id.renderButton(targetEl, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            width: '280',
            text: 'signin_with',
            shape: 'pill'
          });
          setGsiAdminRendered(true);
        }
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setTimeout(initAndRender, 100);
      };
      document.body.appendChild(script);
    } else {
      setTimeout(initAndRender, 100);
    }
  }, [googleClientId, isGoogleConfigured, verifyAdminAuth, navigate, lang]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100" dir={dir}>
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-emerald-950/80 border border-emerald-800 text-emerald-400 rounded-xl flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">{lang === 'ar' ? 'تسجيل دخول المشرف' : 'Admin Portal Login'}</h1>
          <p className="text-xs text-slate-400">{lang === 'ar' ? 'أدخل معلومات الحساب للوصول للوحة التحكم' : 'Enter your credentials to access the dashboard'}</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                placeholder="admin@businessmarket.dz"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">{lang === 'ar' ? 'كلمة المرور' : 'Password'}</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{lang === 'ar' ? 'جاري التحقق...' : 'Verifying...'}</span>
              </>
            ) : (
              <>
                <span>{lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-slate-900 px-2 text-slate-500">
              {lang === 'ar' ? 'أو عبر' : 'Or continue with'}
            </span>
          </div>
        </div>

        {/* GOOGLE ADMIN SIGN-IN BUTTON CONTAINER */}
        <div className="w-full flex flex-col items-center gap-2">
          {!gsiAdminRendered && (
            <button
              type="button"
              onClick={handleDirectGoogleAdminAuth}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-3 shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{lang === 'ar' ? 'المتابعة باستخدام Google' : 'Continue with Google'}</span>
            </button>
          )}

          <div
            id="googleAdminSignInBtn"
            className={`w-full flex justify-center min-h-[44px] ${!gsiAdminRendered ? 'hidden' : ''}`}
          ></div>
        </div>
      </div>
    </div>
  );
}
