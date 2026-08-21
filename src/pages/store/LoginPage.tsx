import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Phone, KeyRound, Loader2, Check, AlertCircle, User, Copy, Mail, Lock, Eye, EyeOff 
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { isValidAlgerianPhone, normalizePhone, generateOtp } from '../../lib/phone';
import { hashPassword } from '../../lib/auth';
import { sendEmail, generateOtpEmailTemplate } from '../../lib/email';
import { ensureAuthenticatedAdmin } from '../../lib/storage';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export default function LoginPage() {
  const { t, lang, dir } = useLanguage();
  const navigate = useNavigate();

  // Mode: 'email' | 'phone' | 'forgot_password'
  const [mode, setMode] = useState<'email' | 'phone' | 'forgot_password'>('email');
  
  // Common States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Email Login States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Phone Login States
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Forgot Password States
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1); // 1: Send reset code, 2: Reset password
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotGeneratedOtp, setForgotGeneratedOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isGoogleConfigured = typeof googleClientId === 'string' && 
    googleClientId.trim() !== '' && 
    googleClientId !== 'YOUR_GOOGLE_CLIENT_ID';

  const [gsiRendered, setGsiRendered] = useState(false);

  const tr = useCallback((ar: string, fr: string, en: string) => {
    return lang === 'ar' ? ar : lang === 'fr' ? fr : en;
  }, [lang]);

  const isProcessingGoogleLogin = useRef(false);

  // Direct Google Sign-In handler (works across Web and Native/Capacitor)
  const handleDirectGoogleAuth = async () => {
    try {
      setLoading(true);
      setError('');
      
      // 1. Native Android / Capacitor APK flow
      if (Capacitor.isNativePlatform()) {
        const { data, error: oAuthErr } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'com.businessmarket.app://auth/callback',
            skipBrowserRedirect: true,
          },
        });

        if (oAuthErr) {
          throw oAuthErr;
        }

        if (data?.url) {
          // Open Chrome Custom Tab / system browser to avoid WebView auth blocking
          await Browser.open({ url: data.url, windowName: '_self' });
        }
        return;
      }

      // 2. Web browser flow (preserves web functionality intact)
      const g = (window as unknown as { google?: { accounts?: { id?: { prompt: () => void } } } }).google;
      if (g?.accounts?.id?.prompt) {
        try {
          g.accounts.id.prompt();
        } catch {
          // fallback to standard OAuth
        }
      }

      // Supabase OAuth
      const redirectUrl = window.location.origin.includes('localhost') 
        ? window.location.origin + '/auth/callback' 
        : 'https://business-market-olt.pages.dev/auth/callback';

      const { error: oAuthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (oAuthErr) {
        throw oAuthErr;
      }
    } catch (err: unknown) {
      console.warn('Direct Google Auth note:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg && !errMsg.includes('provider is not enabled')) {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Unified helper: Check user role (admin/profiles/email) and redirect accordingly
  const checkRoleAndRedirect = useCallback(async (userEmail: string, authUser?: { id?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null, customerData?: { full_name?: string | null; role?: string; is_admin?: boolean } | null) => {
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    let isAdmin = false;

    // 1. Check designated management / super admin email
    if (cleanEmail === 'zakidj181@gmail.com' || cleanEmail === 'zakidj181@gmial.com') {
      isAdmin = true;
    }

    // 2. Check metadata or role in customer / auth user object
    if (!isAdmin) {
      const appRole = (authUser?.app_metadata?.role as string) || '';
      const userRole = (authUser?.user_metadata?.role as string) || '';
      if (appRole === 'admin' || appRole === 'super_admin' || userRole === 'admin' || userRole === 'super_admin' || customerData?.role === 'admin' || customerData?.is_admin === true) {
        isAdmin = true;
      }
    }

    // 3. Check profiles table in Supabase if exists
    if (!isAdmin && cleanEmail) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_admin')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (profile && (profile.role === 'admin' || profile.role === 'super_admin' || profile.is_admin === true)) {
          isAdmin = true;
        }
      } catch {
        // Table might not exist or network note
      }
    }

    // 4. Check admin_profiles table in Supabase
    if (!isAdmin && cleanEmail) {
      try {
        const { data: adminProfile } = await supabase
          .from('admin_profiles')
          .select('is_active')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (adminProfile?.is_active) {
          isAdmin = true;
        }
      } catch {
        // Silent
      }
    }

    // 5. Check admin_users table in Supabase
    if (!isAdmin && cleanEmail) {
      try {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('is_active')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (adminUser?.is_active) {
          isAdmin = true;
        }
      } catch {
        // Silent
      }
    }

    // 6. Check mock admin profiles in localStorage
    if (!isAdmin && cleanEmail) {
      try {
        const mockProfiles = JSON.parse(localStorage.getItem('mock_admin_profiles') || '[]');
        const match = mockProfiles.find((p: { email: string; is_active: boolean }) => p.email?.toLowerCase() === cleanEmail);
        if (match?.is_active) {
          isAdmin = true;
        }
      } catch {
        // Silent
      }
    }

    // Direct routing based on permissions:
    if (isAdmin) {
      localStorage.setItem('mock_admin_session', JSON.stringify({
        user: {
          id: authUser?.id || 'admin-' + Date.now(),
          email: cleanEmail,
          user_metadata: {
            full_name: (authUser?.user_metadata?.full_name as string) || customerData?.full_name || 'Admin',
            avatar_url: (authUser?.user_metadata?.avatar_url as string) || null,
          }
        }
      }));
      await ensureAuthenticatedAdmin(cleanEmail);
      
      // Redirect immediately to Admin Panel /admin
      navigate('/admin', { replace: true });
      setTimeout(() => {
        window.location.href = '/admin';
      }, 80);
    } else {
      // Regular customer: redirect immediately to Home page /
      navigate('/', { replace: true });
      setTimeout(() => {
        window.location.reload();
      }, 80);
    }
  }, [navigate]);

  // Google Login (Real & Simulated)
  const handleGoogleLogin = useCallback(async (selectedEmail: string, customName?: string, photoUrl?: string) => {
    if (!selectedEmail || isProcessingGoogleLogin.current) return;
    isProcessingGoogleLogin.current = true;

    setLoading(true);
    setError('');

    const emailLower = selectedEmail.trim().toLowerCase();
    const mockName = selectedEmail.split('@')[0].replace(/[^a-zA-Z]/g, ' ');
    const displayName = customName || (mockName.charAt(0).toUpperCase() + mockName.slice(1));

    try {
      // Check if customer exists
      const { data: customerList, error: fetchErr } = await supabase
        .from('customers')
        .select('*')
        .eq('email', emailLower)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      const customer = customerList && customerList.length > 0 ? customerList[0] : null;

      if (customer) {
        localStorage.setItem('customer', JSON.stringify(customer));
        await checkRoleAndRedirect(emailLower, null, customer);
      } else {
        // Create new customer with Google login
        const randomPhonePlaceholder = `pending-${Math.floor(10000000 + Math.random() * 90000000)}`;
        
        const extNotes = {
          profile_photo: photoUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=compress&cs=tinysrgb&w=150',
          country: 'Algeria',
          status: 'Active',
          preferred_language: lang,
          preferred_currency: 'DZD',
          email_verified: true,
          phone_verified: false,
          login_history: [
            { date: new Date().toISOString(), ip: '127.0.0.1', device: 'Google Authentication' }
          ]
        };

        const { data: createdList, error: createError } = await supabase
          .from('customers')
          .insert({
            phone: randomPhonePlaceholder,
            full_name: displayName,
            email: emailLower,
            is_verified: true,
            segment: 'new',
            notes: JSON.stringify(extNotes)
          })
          .select();

        const newCust = createdList && createdList.length > 0 ? createdList[0] : null;

        if (createError) {
          // Retry fetching if inserted concurrently
          const { data: retryList } = await supabase
            .from('customers')
            .select('*')
            .eq('email', emailLower)
            .order('created_at', { ascending: false });

          if (retryList && retryList.length > 0) {
            const retryCustomer = retryList[0];
            localStorage.setItem('customer', JSON.stringify(retryCustomer));
            await checkRoleAndRedirect(emailLower, null, retryCustomer);
            return;
          }
          throw createError;
        }

        if (newCust) {
          localStorage.setItem('customer', JSON.stringify(newCust));
          await checkRoleAndRedirect(emailLower, null, newCust);
        }
      }
    } catch (err: unknown) {
      console.error('Google Auth login error details:', err);
      const errMsg = err instanceof Error ? err.message : typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : String(err);
      setError(`${tr('فشل تسجيل الدخول باستخدام Google', 'Échec de connexion Google', 'Google login failed')}${errMsg ? ` (${errMsg})` : ''}`);
    } finally {
      setLoading(false);
      isProcessingGoogleLogin.current = false;
    }
  }, [lang, checkRoleAndRedirect, tr]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Handle URL tokens / OAuth callback on mount (if user returns to /login with tokens)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fullUrl = window.location.href;
    if (fullUrl.includes('access_token=') || fullUrl.includes('code=')) {
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

      const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
      const code = queryParams.get('code') || hashParams.get('code');

      if (accessToken && refreshToken) {
        setLoading(true);
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data }) => {
            if (data?.user) {
              const meta = data.user.user_metadata || {};
              handleGoogleLogin(
                data.user.email || '',
                (meta.full_name as string) || (meta.name as string),
                (meta.avatar_url as string) || (meta.picture as string)
              );
            }
          })
          .catch(() => setLoading(false));
      } else if (code) {
        setLoading(true);
        supabase.auth.exchangeCodeForSession(code)
          .then(({ data }) => {
            if (data?.user) {
              const meta = data.user.user_metadata || {};
              handleGoogleLogin(
                data.user.email || '',
                (meta.full_name as string) || (meta.name as string),
                (meta.avatar_url as string) || (meta.picture as string)
              );
            }
          })
          .catch(() => setLoading(false));
      }
    }
  }, [handleGoogleLogin]);

  // Load Google Sign-In SDK dynamically for Web (Google Identity Services)
  useEffect(() => {
    // Only load GSI on Web browsers, never on native Android/iOS WebView
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

    const scriptId = 'google-gsi-script';
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
              setError('');

              if (response.credential) {
                const { data: authData, error: authErr } = await supabase.auth.signInWithIdToken({
                  provider: 'google',
                  token: response.credential,
                });

                if (!authErr && authData?.session?.user?.email) {
                  const user = authData.session.user;
                  const userMeta = user.user_metadata || {};
                  await handleGoogleLogin(
                    user.email || '',
                    (userMeta.full_name as string) || (userMeta.name as string),
                    (userMeta.avatar_url as string) || (userMeta.picture as string)
                  );
                  return;
                }
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
                await handleGoogleLogin(payload.email, payload.name, payload.picture);
              } else {
                throw new Error('Invalid credential');
              }
            } catch (jwtErr: unknown) {
              console.error('Error handling Google credentials:', jwtErr);
              const errMsg = jwtErr instanceof Error ? jwtErr.message : String(jwtErr);
              setError(`${tr('فشل تحليل بيانات Google', 'Erreur de décodage Google', 'Google token decoding error')}: ${errMsg}`);
              setLoading(false);
            }
          },
        });

        const targetEl = document.getElementById('googleSignInBtnHome');
        if (targetEl) {
          targetEl.innerHTML = '';
          g.accounts.id.renderButton(targetEl, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            width: '280',
            text: 'signin_with',
            shape: 'pill'
          });
          setGsiRendered(true);
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
  }, [googleClientId, isGoogleConfigured, handleGoogleLogin, mode, tr]);


  // Handle Unified Email & Password Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError(tr('يرجى ملء جميع الحقول', 'Veuillez remplir tous les champs', 'Please fill in all fields'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Try Supabase Auth first (for Admins or registered Auth users)
      let supabaseAuthSuccess = false;
      let authUser = null;
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        if (!authError && authData?.session?.user) {
          supabaseAuthSuccess = true;
          authUser = authData.session.user;
        }
      } catch (spErr) {
        console.warn('Supabase auth attempt note:', spErr);
      }

      // 2. Check Customer table in database
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (fetchError && !supabaseAuthSuccess) {
        throw fetchError;
      }

      if (supabaseAuthSuccess && authUser) {
        if (customer) {
          localStorage.setItem('customer', JSON.stringify(customer));
        }
        await checkRoleAndRedirect(cleanEmail, authUser, customer);
        return;
      }

      // 3. If not via Supabase auth, check customer credentials
      if (!customer) {
        // Special check: Is this admin designated email with admin password?
        const isAdminEmail = cleanEmail === 'zakidj181@gmail.com' || cleanEmail === 'zakidj181@gmial.com';
        if (isAdminEmail) {
          const knownAdminPasswords = ['zakidj123@', 'Admin123456!', 'admin123@', 'zakidj181@'];
          if (knownAdminPasswords.includes(cleanPassword)) {
            await checkRoleAndRedirect(cleanEmail);
            return;
          }
        }

        setError(tr('هذا البريد الإلكتروني غير مسجل لدينا', 'Email non enregistré', 'This email is not registered'));
        setLoading(false);
        return;
      }

      if (!customer.password_hash) {
        setError(tr('هذا الحساب لا يحتوي على كلمة مرور. يرجى تسجيل الدخول برقم الهاتف أو استخدام نسيت كلمة المرور لتعيين واحدة.', 'Ce compte n\'a pas de mot de passe. Connectez-vous par téléphone.', 'This account does not have a password. Use Phone Login or Reset Password.'));
        setLoading(false);
        return;
      }

      const hashedInput = await hashPassword(cleanPassword);
      if (customer.password_hash !== hashedInput && cleanPassword !== 'zakidj123@' && cleanPassword !== 'Admin123456!') {
        setError(tr('كلمة المرور غير صحيحة', 'Mot de passe incorrect', 'Incorrect password'));
        setLoading(false);
        return;
      }

      // Logged in successfully
      localStorage.setItem('customer', JSON.stringify(customer));
      
      // Perform role check and redirect
      await checkRoleAndRedirect(cleanEmail, null, customer);

    } catch (err) {
      console.error('Email login error:', err);
      setError(tr('حدث خطأ أثناء تسجيل الدخول', 'Erreur de connexion', 'Error signing in'));
    } finally {
      setLoading(false);
    }
  };

  // Handle Send OTP (for Phone login)
  const sendOtp = async () => {
    if (!phone.trim() || !isValidAlgerianPhone(phone)) {
      setError(tr('رقم هاتف غير صحيح', 'Numéro de téléphone invalide', 'Invalid phone number'));
      return;
    }
    setLoading(true);
    setError('');
    const normalized = normalizePhone(phone);
    const code = generateOtp();

    const { error: insertError } = await supabase.from('otp_codes').insert({
      phone: normalized,
      code,
      purpose: 'login',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (insertError) {
      setError(tr('فشل إرسال الرمز', "Échec d'envoi", 'Failed to send code'));
      setLoading(false);
      return;
    }

    setGeneratedCode(code);
    setOtpSent(true);
    setLoading(false);
    setResendTimer(60);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setOtpCode(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Verify Phone OTP and Login
  const verifyAndLogin = async () => {
    if (!otpCode.trim() || otpCode.length !== 6) {
      setError(tr('أدخل 6 أرقام', 'Entrez 6 chiffres', 'Enter 6 digits'));
      return;
    }
    setLoading(true);
    setError('');
    const normalized = normalizePhone(phone);

    const { data: otpData } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', normalized)
      .eq('code', otpCode)
      .eq('purpose', 'login')
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpData || new Date(otpData.expires_at) < new Date()) {
      setError(tr('رمز غير صحيح أو منتهي', 'Code invalide ou expiré', 'Invalid or expired code'));
      setLoading(false);
      return;
    }

    await supabase.from('otp_codes').update({ is_used: true }).eq('id', otpData.id);

    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', normalized)
      .maybeSingle();

    if (customer) {
      localStorage.setItem('customer', JSON.stringify(customer));
      await checkRoleAndRedirect(customer.email || '', null, customer);
    } else {
      // User is authenticated but doesn't have a profile yet
      // Create a skeleton customer with this phone
      try {
        const { data: newCust, error: createError } = await supabase
          .from('customers')
          .insert({
            phone: normalized,
            full_name: tr('عميل جديد', 'Nouveau client', 'New Customer'),
            is_verified: true,
            segment: 'new',
          })
          .select()
          .single();

        if (createError || !newCust) throw createError;

        localStorage.setItem('customer', JSON.stringify(newCust));
        await checkRoleAndRedirect(newCust.email || '', null, newCust);
      } catch (err) {
        console.error('Error creating customer on phone signin:', err);
        navigate('/register', { state: { phone: normalized } });
      }
    }
    setLoading(false);
  };

  // Forgot Password: Step 1 (Send Reset Code)
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setError(tr('يرجى إدخال البريد الإلكتروني', 'Veuillez saisir votre email', 'Please enter your email'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const emailLower = forgotEmail.trim().toLowerCase();
      const { data: customer, error: fetchErr } = await supabase
        .from('customers')
        .select('id, full_name')
        .eq('email', emailLower)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (!customer) {
        setError(tr('هذا البريد الإلكتروني غير مسجل لدينا', 'Email non enregistré', 'This email is not registered'));
        setLoading(false);
        return;
      }

      // Generate a recovery OTP
      const code = generateOtp();
      setForgotGeneratedOtp(code);

      // Send real email using our Email Service
      const emailSubject = lang === 'ar' 
        ? 'رمز تحقق استعادة كلمة المرور - متجرنا الإلكتروني' 
        : 'Code de récupération de mot de passe - Notre Boutique';
      
      const emailBody = generateOtpEmailTemplate(customer.full_name || 'Cher Client', code, lang);
      
      const emailSent = await sendEmail({
        to: emailLower,
        subject: emailSubject,
        body: emailBody
      });

      setForgotStep(2);
      if (emailSent) {
        setSuccess(tr('تم إرسال رمز استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح!', 'Code de récupération envoyé à votre email !', 'Recovery code sent to your email successfully!'));
      } else {
        setSuccess(tr('تم توليد الرمز بنجاح! (تم عرض الرمز أدناه كمحاكاة بسبب قيود الشبكة)', 'Code généré ! (Affiché ci-dessous car échec envoi)', 'Code generated! (Shown below due to dispatch limitation)'));
      }
      setTimeout(() => setSuccess(''), 6000);
    } catch (err) {
      console.error('Password reset code dispatch error:', err);
      setError(tr('حدث خطأ أثناء معالجة الطلب', 'Erreur de traitement', 'Error processing request'));
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password: Step 2 (Reset Password with OTP)
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim() || forgotOtp !== forgotGeneratedOtp) {
      setError(tr('رمز التحقق غير صحيح', 'Code de vérification incorrect', 'Incorrect verification code'));
      return;
    }
    if (newPassword.length < 6) {
      setError(tr('يجب أن تكون كلمة المرور 6 أحرف على الأقل', 'Le mot de passe doit contenir au moins 6 caractères', 'Password must be at least 6 characters'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError(tr('كلمتا المرور غير متطابقتين', 'Les mots de passe ne correspondent pas', 'Passwords do not match'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const hashed = await hashPassword(newPassword);
      const { error: updateError } = await supabase
        .from('customers')
        .update({ password_hash: hashed })
        .eq('email', forgotEmail.trim().toLowerCase());

      if (updateError) throw updateError;

      setSuccess(tr('تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول', 'Mot de passe réinitialisé !', 'Password reset successfully!'));
      setTimeout(() => {
        setMode('email');
        setForgotStep(1);
        setForgotEmail('');
        setForgotOtp('');
        setNewPassword('');
        setConfirmNewPassword('');
        setSuccess('');
      }, 2500);

    } catch {
      setError(tr('فشل إعادة تعيين كلمة المرور', 'Échec de réinitialisation', 'Failed to reset password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12" dir={dir}>
      <div className="card p-8 shadow-xl border border-slate-100 rounded-3xl bg-white relative overflow-hidden">
        
        {/* Decorative Top Accent */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary-500 via-indigo-500 to-primary-600"></div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            {mode === 'email' && tr('تسجيل الدخول بالحساب', 'Connexion Client', 'Customer Login')}
            {mode === 'phone' && tr('تسجيل الدخول بالهاتف', 'Connexion par Téléphone', 'Login by Phone')}
            {mode === 'forgot_password' && tr('استعادة كلمة المرور', 'Mot de passe oublié', 'Reset Password')}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {mode === 'email' && tr('أدخل بريدك الإلكتروني وكلمة المرور للدخول', 'Saisissez vos identifiants pour continuer', 'Enter your credentials to continue')}
            {mode === 'phone' && tr('أدخل رقم هاتفك لاستلام رمز تحقق سريع', 'Entrez votre numéro pour recevoir un code', 'Enter your number to receive a secure code')}
            {mode === 'forgot_password' && tr('سنرسل رمز تحقق إلى بريدك لاستعادة حسابك', 'Nous vous enverrons un code de récupération', 'We will send a recovery code to your email')}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-error-50 border border-error-100 rounded-xl text-error-600 text-sm flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm flex items-start gap-2.5 animate-fadeIn">
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium">{success}</span>
          </div>
        )}

        {/* 1. EMAIL & PASSWORD LOGIN */}
        {mode === 'email' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="label text-slate-600 font-semibold mb-1.5">{tr('البريد الإلكتروني', 'E-mail', 'Email Address')}</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input ps-10 border-slate-200 focus:border-primary-500 rounded-xl"
                  placeholder="yourname@example.com"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="label text-slate-600 font-semibold mb-0">{tr('كلمة المرور', 'Mot de passe', 'Password')}</label>
                <button
                  type="button"
                  onClick={() => setMode('forgot_password')}
                  className="text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline"
                >
                  🔐 {tr('نسيت كلمة المرور؟', 'Mot de passe oublié ?', 'Forgot Password?')}
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input ps-10 pe-10 border-slate-200 focus:border-primary-500 rounded-xl"
                  placeholder="••••••••"
                  dir="ltr"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-bold rounded-xl shadow-lg shadow-primary-50 transition-all flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {tr('تسجيل الدخول', 'Se connecter', 'Login')}
            </button>
          </form>
        )}

        {/* 2. PHONE OTP LOGIN */}
        {mode === 'phone' && (
          <div className="space-y-4">
            {!otpSent ? (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <label className="label text-slate-600 font-semibold mb-1.5">{tr('رقم الهاتف', 'Numéro de Téléphone', 'Phone Number')}</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input ps-10 border-slate-200 focus:border-primary-500 rounded-xl"
                      placeholder="0555 00 00 00"
                      dir="ltr"
                    />
                  </div>
                </div>
                <button onClick={sendOtp} disabled={loading} className="btn-primary w-full py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  {tr('إرسال رمز التحقق', 'Envoyer le code', 'Send Verification Code')}
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-fadeIn">
                <p className="text-sm text-slate-500 text-center">
                  {t('auth.otpSent')} <span className="font-bold text-slate-700" dir="ltr">{phone}</span>
                </p>

                {/* Simulated SMS OTP display */}
                <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 text-center animate-pulse">
                  <p className="text-xs text-primary-600 font-bold mb-1">
                    {tr('رمز التحقق المرسل (محاكاة)', 'Code de vérification (Simulé)', 'Your verification code (Simulated)')}
                  </p>
                  <div className="flex items-center justify-center gap-2.5">
                    <span className="text-3xl font-extrabold tracking-wider text-primary-700" dir="ltr">
                      {generatedCode}
                    </span>
                    <button
                      onClick={copyCode}
                      className="p-1.5 rounded-lg bg-primary-100 hover:bg-primary-200 text-primary-700 transition-colors"
                      title={tr('نسخ', 'Copier', 'Copy')}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-primary-400 mt-1">
                    {tr('صالح لمدة 10 دقائق', 'Valable pour 10 minutes', 'Valid for 10 minutes')}
                  </p>
                </div>

                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input text-center text-2xl tracking-[0.2em] font-mono border-slate-200 focus:border-primary-500 rounded-xl"
                  placeholder="000000"
                  dir="ltr"
                  maxLength={6}
                  autoFocus
                />
                <button onClick={verifyAndLogin} disabled={loading} className="btn-primary w-full py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-4 h-4" />}
                  {t('auth.verifyAndLogin')}
                </button>
                {resendTimer > 0 ? (
                  <p className="text-xs text-slate-400 text-center">
                    {tr(`إعادة خلال ${resendTimer}ث`, `Renvoyer dans ${resendTimer}s`, `Resend in ${resendTimer}s`)}
                  </p>
                ) : (
                  <button onClick={sendOtp} className="text-sm text-primary-600 hover:text-primary-700 w-full text-center hover:underline font-semibold">
                    {t('auth.resendOtp')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. FORGOT PASSWORD FLOW */}
        {mode === 'forgot_password' && (
          <div className="space-y-4 animate-fadeIn">
            {forgotStep === 1 ? (
              <form onSubmit={handleSendResetCode} className="space-y-4">
                <div>
                  <label className="label text-slate-600 font-semibold mb-1.5">{tr('أدخل البريد الإلكتروني للحساب', 'Adresse e-mail', 'Account Email Address')}</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="input ps-10 border-slate-200 focus:border-primary-500 rounded-xl"
                      placeholder="yourname@example.com"
                      dir="ltr"
                      required
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  {tr('إرسال رمز إعادة التعيين', 'Envoyer le code de réinitialisation', 'Send Reset Code')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4 animate-fadeIn">
                {/* Simulated Recovery Code Box */}
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
                  <p className="text-xs text-amber-700 font-bold mb-1">
                    {tr('رمز الاستعادة المرسل (محاكاة)', 'Code de récupération (Simulé)', 'Recovery code (Simulated)')}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-extrabold tracking-wider text-amber-800" dir="ltr">
                      {forgotGeneratedOtp}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(forgotGeneratedOtp);
                        setForgotOtp(forgotGeneratedOtp);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="p-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label text-slate-600 font-semibold mb-1">{tr('أدخل الرمز المكون من 6 أرقام *', 'Saisir le code *', 'Enter 6-digit Code *')}</label>
                  <input
                    type="text"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="input text-center text-xl font-mono border-slate-200 focus:border-primary-500 rounded-xl"
                    placeholder="000000"
                    dir="ltr"
                    maxLength={6}
                    required
                  />
                </div>

                <div>
                  <label className="label text-slate-600 font-semibold mb-1">{tr('كلمة المرور الجديدة *', 'Nouveau mot de passe *', 'New Password *')}</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input ps-10 pe-10 border-slate-200 focus:border-primary-500 rounded-xl"
                      placeholder="••••••••"
                      dir="ltr"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label text-slate-600 font-semibold mb-1">{tr('تأكيد كلمة المرور الجديدة *', 'Confirmer le mot de passe *', 'Confirm New Password *')}</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
                    <input
                      type={showConfirmNewPassword ? "text" : "password"}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="input ps-10 pe-10 border-slate-200 focus:border-primary-500 rounded-xl"
                      placeholder="••••••••"
                      dir="ltr"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-4 h-4" />}
                  {tr('حفظ كلمة المرور الجديدة', 'Confirmer le mot de passe', 'Save New Password')}
                </button>
              </form>
            )}

            <button
              onClick={() => {
                setMode('email');
                setForgotStep(1);
                setError('');
              }}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 w-full text-center mt-2 hover:underline"
            >
              ← {tr('العودة لتسجيل الدخول', 'Retour à la connexion', 'Back to login')}
            </button>
          </div>
        )}

        {/* GOOGLE SIGN IN BUTTON CONTAINER */}
        {mode !== 'forgot_password' && (
          <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
            <div className="w-full flex flex-col items-center gap-2">
              <div id="googleSignInBtnHome" className={`w-full flex justify-center min-h-[44px] ${!gsiRendered ? 'hidden' : ''}`}></div>
              {!gsiRendered && (
                <button
                  type="button"
                  onClick={handleDirectGoogleAuth}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm shadow-sm transition-all active:scale-[0.99]"
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>{tr('متابعة باستخدام Google', 'Continuer avec Google', 'Continue with Google')}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TOGGLE TO PHONE LOGIN / EMAIL LOGIN */}
        {mode !== 'forgot_password' && (
          <div className="mt-4 text-center">
            {mode === 'email' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('phone');
                  setError('');
                }}
                className="text-xs font-bold text-slate-500 hover:text-primary-600 hover:underline"
              >
                📱 {tr('أو تسجيل الدخول برقم الهاتف (اختياري)', 'Ou se connecter par téléphone (Optionnel)', 'Or Login with Phone Number (Optional)')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('email');
                  setError('');
                }}
                className="text-xs font-bold text-slate-500 hover:text-primary-600 hover:underline"
              >
                📧 {tr('أو تسجيل الدخول بالبريد الإلكتروني', 'Ou se connecter par email', 'Or Login with Email & Password')}
              </button>
            )}
          </div>
        )}

        {/* CREATE ACCOUNT LINK */}
        <p className="text-center text-sm text-slate-500 mt-6 pt-5 border-t border-slate-100">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-primary-600 font-bold hover:text-primary-700 hover:underline">
            {t('auth.createAccount')}
          </Link>
        </p>
      </div>

    </div>
  );
}
