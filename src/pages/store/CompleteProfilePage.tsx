import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, MapPin, Building2, Home, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { isValidAlgerianPhone, normalizePhone } from '../../lib/phone';
import { Wilaya } from '../../types';
import { ALL_WILAYAS } from '../../constants/wilayas';

interface CustomerData {
  id: string;
  phone?: string | null;
  full_name?: string | null;
  email?: string | null;
  wilaya_id?: number | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
}

export default function CompleteProfilePage() {
  const { lang, dir } = useLanguage();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [selectedWilayaId, setSelectedWilayaId] = useState<number | ''>('');
  const [communesByWilaya, setCommunesByWilaya] = useState<Record<string, { id: string; name_ar: string; name_fr: string; daira?: string }[]>>({});
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('customer');
    if (!saved) {
      navigate('/login');
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      setCustomer(parsed);
      setFullName(parsed.full_name || '');
      if (parsed.phone && !parsed.phone.startsWith('pending-')) {
        setPhone(parsed.phone);
      }
      if (parsed.wilaya_id) {
        setSelectedWilayaId(Number(parsed.wilaya_id));
      }
      setCity(parsed.city || '');
      setAddress(parsed.address || '');
    } catch {
      navigate('/login');
      return;
    }

    async function loadWilayasAndCommunes() {
      try {
        const { data: wData, error: wError } = await supabase
          .from('wilayas')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');
        if (wError) throw wError;
        if (wData && wData.length > 0) {
          setWilayas(wData as Wilaya[]);
        } else {
          setWilayas(ALL_WILAYAS);
        }

        const { data: cData } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'communes_by_wilaya')
          .maybeSingle();
        if (cData) {
          setCommunesByWilaya((cData.value as unknown as { value: Record<string, { id: string; name_ar: string; name_fr: string; daira?: string }[]> }).value || {});
        }
      } catch (err) {
        console.error('Error loading locations:', err);
      } finally {
        setLoading(false);
      }
    }
    loadWilayasAndCommunes();
  }, [navigate]);

  const tr = (ar: string, fr: string, en: string) =>
    lang === 'ar' ? ar : lang === 'fr' ? fr : en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) {
      setError(tr('تعذر العثور على معلومات الحساب', 'Compte introuvable', 'Account not found'));
      return;
    }
    if (!fullName.trim()) {
      setError(tr('يرجى إدخال الاسم الكامل', 'Veuillez saisir votre nom complet', 'Please enter your full name'));
      return;
    }
    if (!phone.trim() || !isValidAlgerianPhone(phone)) {
      setError(tr('رقم هاتف غير صحيح (مثال: 0555000000)', 'Numéro de téléphone invalide (Ex: 0555000000)', 'Invalid phone number (Ex: 0555000000)'));
      return;
    }
    if (!selectedWilayaId) {
      setError(tr('يرجى اختيار الولاية', 'Veuillez sélectionner la wilaya', 'Please select a wilaya'));
      return;
    }
    if (!city.trim()) {
      setError(tr('يرجى إدخال البلدية / المدينة', 'Veuillez saisir la commune', 'Please enter your municipality/city'));
      return;
    }
    if (!address.trim()) {
      setError(tr('يرجى إدخال العنوان الكامل بالتفصيل', 'Veuillez saisir l\'adresse complète', 'Please enter your complete address'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const normalizedPhone = normalizePhone(phone);

      // Check if this phone number is already registered by another customer (not the current one)
      const { data: existingPhone } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', normalizedPhone)
        .neq('id', customer.id)
        .maybeSingle();

      if (existingPhone) {
        setError(tr('رقم الهاتف هذا مسجل بالفعل لحساب آخر', 'Ce numéro de téléphone est déjà utilisé', 'This phone number is already registered by another account'));
        setSubmitting(false);
        return;
      }

      const selectedWilayaObj = wilayas.find(w => w.id === Number(selectedWilayaId));
      const wilayaNameText = selectedWilayaObj ? (lang === 'ar' ? selectedWilayaObj.name_ar : selectedWilayaObj.name_fr) : '';

      const initialAddress = {
        id: Math.random().toString(36).substr(2, 9),
        label: lang === 'ar' ? 'العنوان الافتراضي' : 'Adresse principale',
        address: address.trim(),
        city: city.trim(),
        state: wilayaNameText,
        postal_code: postalCode.trim() || undefined,
        is_default: true
      };

      const extNotes = {
        profile_photo: '',
        country: 'Algeria',
        state: wilayaNameText,
        postal_code: postalCode.trim(),
        gps_location: '',
        status: 'Active',
        preferred_language: lang,
        preferred_currency: 'DZD',
        email_verified: customer.email ? true : false,
        phone_verified: true,
        admin_notes: '',
        internal_tags: ['Completed Profile'],
        loyalty_points: 10,
        coupons_used: [],
        refund_history: [],
        return_requests: [],
        payment_methods: [],
        delivery_history: [],
        login_history: [
          ...(customer.notes ? (JSON.parse(customer.notes).login_history || []) : []),
          { date: new Date().toISOString(), ip: '127.0.0.1', device: 'Web Browser / Profile Completion' }
        ],
        wishlist: [],
        shopping_cart: [],
        saved_addresses: [initialAddress]
      };

      const { data: updated, error: updateError } = await supabase
        .from('customers')
        .update({
          phone: normalizedPhone,
          full_name: fullName.trim(),
          wilaya_id: Number(selectedWilayaId),
          city: city.trim(),
          address: address.trim(),
          is_verified: true,
          notes: JSON.stringify(extNotes),
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id)
        .select()
        .single();

      if (updateError) throw updateError;

      localStorage.setItem('customer', JSON.stringify(updated));
      setSuccess(true);
      setTimeout(() => {
        navigate('/account');
        // Reload page to refresh context
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error('Error updating customer profile:', err);
      const errMsg = err instanceof Error ? err.message : '';
      setError(errMsg || tr('حدث خطأ أثناء حفظ البيانات', 'Une erreur est survenue lors de l\'enregistrement', 'An error occurred while saving your details'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]" dir={dir}>
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-2" />
        <p className="text-gray-500">{tr('جاري تحميل البيانات...', 'Chargement...', 'Loading...')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12" dir={dir}>
      <div className="card p-8 shadow-xl border border-slate-100 rounded-3xl bg-white">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-primary-200">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            {tr('إكمال معلومات الحساب', 'Compléter le profil', 'Complete Profile Details')}
          </h1>
          <p className="text-slate-500 text-sm mt-1.5">
            {tr('يرجى ملء معلومات التوصيل والهاتف لمتابعة التسوق وإكمال طلباتك بنجاح', 'Veuillez remplir vos informations de livraison et de téléphone pour continuer.', 'Please fill out your delivery and phone details to continue.')}
          </p>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-6 text-center animate-fadeIn">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 animate-bounce" />
            <h3 className="text-lg font-bold text-slate-800">{tr('تم حفظ المعلومات بنجاح!', 'Profil complété avec succès !', 'Profile completed successfully!')}</h3>
            <p className="text-slate-500 text-sm mt-1">{tr('جاري توجيهك إلى حسابك...', 'Redirection...', 'Redirecting you to your account...')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label text-slate-700 font-semibold mb-1.5">{tr('الاسم الكامل *', 'Nom complet *', 'Full Name *')}</label>
              <div className="relative">
                <User className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-gray-400 pointer-events-none" />
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label text-slate-700 font-semibold mb-1.5">{tr('رقم الهاتف *', 'Téléphone *', 'Phone Number *')}</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-gray-400 pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input ps-10 border-slate-200 focus:border-primary-500 rounded-xl"
                    placeholder="0555 00 00 00"
                    dir="ltr"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label text-slate-700 font-semibold mb-1.5">{tr('الولاية *', 'Wilaya *', 'Wilaya *')}</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-gray-400 pointer-events-none" />
                  <select
                    value={selectedWilayaId}
                    onChange={(e) => {
                      setSelectedWilayaId(e.target.value ? Number(e.target.value) : '');
                      setCity('');
                    }}
                    className="input ps-10 border-slate-200 focus:border-primary-500 rounded-xl appearance-none"
                    required
                  >
                    <option value="">{tr('اختر الولاية', 'Sélectionner wilaya', 'Select wilaya')}</option>
                    {wilayas.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {lang === 'ar' ? w.name_ar : w.name_fr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label text-slate-700 font-semibold mb-1.5">{tr('البلدية / المدينة *', 'Commune / Ville *', 'Municipality / City *')}</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-gray-400 pointer-events-none" />
                  {selectedWilayaId && communesByWilaya[String(selectedWilayaId)]?.length > 0 ? (
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="input ps-10 border-slate-200 focus:border-primary-500 rounded-xl appearance-none"
                      required
                    >
                      <option value="">{tr('اختر البلدية', 'Sélectionner commune', 'Select commune')}</option>
                      {communesByWilaya[String(selectedWilayaId)].map((c) => (
                        <option key={c.id} value={lang === 'ar' ? c.name_ar : c.name_fr}>
                          {lang === 'ar' ? c.name_ar : c.name_fr}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="input ps-10 border-slate-200 focus:border-primary-500 rounded-xl"
                      placeholder={tr('الجزائر الوسطى', 'Alger Centre', 'Alger Centre')}
                      required
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="label text-slate-700 font-semibold mb-1.5">{tr('الرمز البريدي (اختياري)', 'Code postal (optionnel)', 'Postal Code (optional)')}</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="input border-slate-200 focus:border-primary-500 rounded-xl"
                  placeholder="16000"
                />
              </div>
            </div>

            <div>
              <label className="label text-slate-700 font-semibold mb-1.5">{tr('العنوان الكامل بالتفصيل *', 'Adresse complète et détaillée *', 'Full Detailed Address *')}</label>
              <div className="relative">
                <Home className="w-4 h-4 absolute top-3 start-3 text-gray-400" />
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="input ps-10 py-2 h-20 resize-none border-slate-200 focus:border-primary-500 rounded-xl"
                  placeholder={tr('اسم الشارع، رقم العمارة أو المنزل، الطابق...', 'Nom de rue, numéro, étage...', 'Street name, building/house number, floor...')}
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-error-500 text-sm flex items-center gap-1.5 bg-error-50 p-3 rounded-xl border border-error-100">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl shadow-lg shadow-primary-100 transition-all text-base font-bold flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {tr('جاري حفظ البيانات...', 'Enregistrement...', 'Saving...')}
                </>
              ) : (
                tr('إكمال وحفظ', 'Valider et continuer', 'Complete & Save')
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
