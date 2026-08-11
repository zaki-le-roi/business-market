import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, KeyRound, Loader2, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { hashPassword } from '../../lib/auth';
import { processDomainEvent } from '../../lib/automationEngine';

export default function RegisterPage() {
  const { t, lang, dir } = useLanguage();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accountType, setAccountType] = useState<'retail' | 'wholesale'>('retail');
  const [companyName, setCompanyName] = useState('');
  const [registerNum, setRegisterNum] = useState('');
  const [taxId, setTaxId] = useState('');
  const [nis, setNis] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tr = (ar: string, fr: string, en: string) =>
    lang === 'ar' ? ar : lang === 'fr' ? fr : en;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError(tr('يرجى إدخال الاسم الكامل', 'Veuillez saisir votre nom complet', 'Please enter your full name'));
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError(tr('يرجى إدخال بريد إلكتروني صحيح', 'Veuillez saisir un e-mail valide', 'Please enter a valid email'));
      return;
    }
    if (password.length < 6) {
      setError(tr('يجب أن تكون كلمة المرور 6 أحرف على الأقل', 'Le mot de passe doit contenir au moins 6 caractères', 'Password must be at least 6 characters'));
      return;
    }
    if (password !== confirmPassword) {
      setError(tr('كلمتا المرور غير متطابقتين', 'Les mots de passe ne correspondent pas', 'Passwords do not match'));
      return;
    }

    if (accountType === 'wholesale') {
      if (!companyName.trim()) {
        setError(tr('يرجى إدخال اسم الشركة', 'Veuillez saisir le nom de l\'entreprise', 'Please enter company name'));
        return;
      }
      if (!registerNum.trim()) {
        setError(tr('يرجى إدخال رقم السجل التجاري (RC)', 'Veuillez saisir le numéro de registre de commerce', 'Please enter register number (RC)'));
        return;
      }
      if (!taxId.trim()) {
        setError(tr('يرجى إدخال الرقم الضريبي (NIF)', 'Veuillez saisir le NIF', 'Please enter tax ID (NIF)'));
        return;
      }
    }

    setLoading(true);

    try {
      const emailLower = email.trim().toLowerCase();

      // Check if email already exists
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('email', emailLower)
        .maybeSingle();

      if (existing) {
        setError(tr('هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.', 'Cet e-mail est déjà utilisé', 'This email is already registered. Please login.'));
        setLoading(false);
        return;
      }

      // Hash the password
      const password_hash = await hashPassword(password);

      // Generate a temporary unique phone number placeholder to satisfy NOT NULL constraint
      const randomPhonePlaceholder = `pending-${Math.floor(10000000 + Math.random() * 90000000)}`;

      const extNotes = {
        profile_photo: '',
        country: 'Algeria',
        status: 'Active',
        preferred_language: lang,
        preferred_currency: 'DZD',
        email_verified: false,
        phone_verified: false,
        login_history: [
          { date: new Date().toISOString(), ip: '127.0.0.1', device: 'Web Browser / Registration' }
        ]
      };

      const { data: customer, error: custError } = await supabase
        .from('customers')
        .insert({
          phone: randomPhonePlaceholder,
          full_name: fullName.trim(),
          email: emailLower,
          password_hash,
          is_verified: true,
          is_guest: false,
          segment: accountType === 'wholesale' ? 'vip' : 'new',
          account_type: accountType,
          wholesale_status: accountType === 'wholesale' ? 'pending' : null,
          company_name: accountType === 'wholesale' ? companyName.trim() : null,
          register_number: accountType === 'wholesale' ? registerNum.trim() : null,
          tax_id: accountType === 'wholesale' ? taxId.trim() : null,
          nis: (accountType === 'wholesale' && nis.trim()) ? nis.trim() : null,
          notes: JSON.stringify(extNotes),
        })
        .select()
        .single();

      if (custError || !customer) {
        console.error('Registration insertion error:', custError);
        setError(tr('فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.', 'Échec de création du compte', 'Failed to create account. Please try again.'));
        setLoading(false);
        return;
      }

      // Automatically log the user in
      localStorage.setItem('customer', JSON.stringify(customer));

      // Trigger Automation Engine for CustomerRegistered
      try {
        processDomainEvent('CustomerRegistered', { email: emailLower, name: fullName.trim() })
          .catch((err) => console.warn('[RegisterPage] Automation trigger warning:', err));
      } catch (autoErr) {
        console.warn('[RegisterPage] Automation trigger failed:', autoErr);
      }

      // Redirect to the complete-profile page as requested!
      navigate('/complete-profile');
      
      // Force refresh of layout context so it loads client session
      setTimeout(() => {
        window.location.reload();
      }, 100);

    } catch (err) {
      console.error('Registration error:', err);
      setError(tr('حدث خطأ أثناء إنشاء الحساب', 'Erreur de création de compte', 'An error occurred during account creation'));
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
          <h1 className="text-2xl font-bold text-slate-800">{t('auth.registerTitle')}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {tr('سجل حساباً جديداً بالبريد الإلكتروني للبدء بالطلب والمتابعة', 'Créez un compte par e-mail pour commencer', 'Register with your email to start shopping')}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-error-50 border border-error-100 rounded-xl text-error-600 text-sm flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Account Type Selector */}
        <div className="mb-5">
          <label className="label text-slate-600 font-semibold mb-2 block">{tr('نوع الحساب *', 'Type de compte *', 'Account Type *')}</label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => { setAccountType('retail'); setError(''); }}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                accountType === 'retail'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tr('تجزئة (عادي)', 'Détail (Standard)', 'Retail (Default)')}
            </button>
            <button
              type="button"
              onClick={() => { setAccountType('wholesale'); setError(''); }}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                accountType === 'wholesale'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tr('جملة (تاجر)', 'Gros (Grossiste)', 'Wholesale (Merchant)')}
            </button>
          </div>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="label text-slate-600 font-semibold mb-1.5">{tr('الاسم الكامل *', 'Nom complet *', 'Full Name *')}</label>
            <div className="relative">
              <User className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input ps-10 border-slate-200 focus:border-primary-500 rounded-xl"
                placeholder={tr('محمد بن علي', 'Mohamed Benali', 'John Smith')}
                required
              />
            </div>
          </div>

          <div>
            <label className="label text-slate-600 font-semibold mb-1.5">{tr('البريد الإلكتروني *', 'E-mail *', 'Email Address *')}</label>
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

          {accountType === 'wholesale' && (
            <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 space-y-3.5 animate-fadeIn">
              <h3 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-1.5 uppercase tracking-wide">
                {tr('بيانات الشركة والنشاط التجاري', 'Détails de l\'entreprise', 'Business details')}
              </h3>
              
              <div>
                <label className="label text-slate-500 font-medium text-xs mb-1 block">{tr('اسم الشركة *', 'Nom de l\'entreprise *', 'Company Name *')}</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="input border-slate-200 focus:border-primary-500 rounded-xl py-1.5 text-xs"
                  placeholder="Sarl / Eurl / Store Name"
                  required
                />
              </div>

              <div>
                <label className="label text-slate-500 font-medium text-xs mb-1 block">{tr('رقم السجل التجاري (RC) *', 'Registre du Commerce (RC) *', 'Commercial Register (RC) *')}</label>
                <input
                  type="text"
                  value={registerNum}
                  onChange={(e) => setRegisterNum(e.target.value)}
                  className="input border-slate-200 focus:border-primary-500 rounded-xl py-1.5 text-xs"
                  placeholder="e.g. 16/00-1234567B26"
                  required
                />
              </div>

              <div>
                <label className="label text-slate-500 font-medium text-xs mb-1 block">{tr('الرقم الضريبي (NIF) *', 'Identifiant Fiscal (NIF) *', 'Tax Identifier (NIF) *')}</label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="input border-slate-200 focus:border-primary-500 rounded-xl py-1.5 text-xs"
                  placeholder="15 digits code"
                  required
                />
              </div>

              <div>
                <label className="label text-slate-500 font-medium text-xs mb-1 block">{tr('الرقم الإحصائي (NIS) (اختياري)', 'Identifiant Statistique (NIS) (Optionnel)', 'Statistical Identifier (NIS) (Optional)')}</label>
                <input
                  type="text"
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  className="input border-slate-200 focus:border-primary-500 rounded-xl py-1.5 text-xs"
                  placeholder="17 digits code"
                />
              </div>
            </div>
          )}

          <div>
            <label className="label text-slate-600 font-semibold mb-1.5">{tr('كلمة المرور *', 'Mot de passe *', 'Password *')}</label>
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

          <div>
            <label className="label text-slate-600 font-semibold mb-1.5">{tr('تأكيد كلمة المرور *', 'Confirmer le mot de passe *', 'Confirm Password *')}</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input ps-10 pe-10 border-slate-200 focus:border-primary-500 rounded-xl"
                placeholder="••••••••"
                dir="ltr"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-bold rounded-xl shadow-lg shadow-primary-50 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {tr('جاري إنشاء الحساب...', 'Création en cours...', 'Creating Account...')}
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                {tr('إنشاء الحساب ومتابعة', 'Créer un compte', 'Create Account & Continue')}
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6 pt-5 border-t border-slate-100">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="text-primary-600 font-bold hover:text-primary-700 hover:underline">
            {t('common.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
