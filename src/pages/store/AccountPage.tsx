import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Package, MapPin, HeadphonesIcon, LogOut,
  ShoppingBag, ChevronRight, Loader2, CheckCircle, AlertCircle, Settings, Shield, Globe, Trash2, PlusCircle, Smartphone
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { Customer, Order, parseCustomerExtended, ExtendedCustomerFields, SavedAddress } from '../../types';
import { checkIsAdmin } from '../../lib/admin';

type Tab = 'orders' | 'profile' | 'addresses' | 'support';

export default function AccountPage() {
  const { t, lang, formatPrice, formatDate, dir } = useLanguage();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<(Customer & ExtendedCustomerFields) | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [loading, setLoading] = useState(true);

  // Profile Form States
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [country, setCountry] = useState('Algeria');
  const [stateProvince, setStateProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [gpsLocation, setGpsLocation] = useState('');
  const [prefLang, setPrefLang] = useState('fr');
  const [prefCurrency, setPrefCurrency] = useState('DZD');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');

  // Address Manager States
  const [newAddrLabel, setNewAddrLabel] = useState('');
  const [newAddrCity, setNewAddrCity] = useState('');
  const [newAddrState, setNewAddrState] = useState('');
  const [newAddrAddress, setNewAddrAddress] = useState('');
  const [newAddrPostal, setNewAddrPostal] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('customer');
    if (!saved) {
      navigate('/login');
      return;
    }
    const c = JSON.parse(saved) as Customer;
    const ext = parseCustomerExtended(c);
    setCustomer(ext);
    setProfileName(ext.full_name || '');
    setProfileEmail(ext.email || '');
    setCity(ext.city || '');
    setAddress(ext.address || '');
    setProfilePhoto(ext.profile_photo || '');
    setCountry(ext.country || 'Algeria');
    setStateProvince(ext.state || '');
    setPostalCode(ext.postal_code || '');
    setGpsLocation(ext.gps_location || '');
    setPrefLang(ext.preferred_language || 'fr');
    setPrefCurrency(ext.preferred_currency || 'DZD');

    loadOrders(ext.phone);

    const checkRole = async () => {
      const result = await checkIsAdmin();
      setIsAdmin(result);
    };
    checkRole();
  }, [navigate]);

  const loadOrders = async (phone: string) => {
    const { data } = await supabase
      .from('orders')
      .select('*, wilaya:wilayas(*)')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false });
    if (data) setOrders(data as Order[]);
    setLoading(false);
  };

  const saveProfile = async () => {
    if (!customer) return;
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const extNotes: ExtendedCustomerFields = {
        profile_photo: profilePhoto.trim(),
        country: country.trim(),
        state: stateProvince.trim(),
        postal_code: postalCode.trim(),
        gps_location: gpsLocation.trim(),
        preferred_language: prefLang,
        preferred_currency: prefCurrency,
        status: customer.status || 'Active',
        email_verified: customer.email_verified,
        phone_verified: customer.phone_verified,
        admin_notes: customer.admin_notes || '',
        internal_tags: customer.internal_tags || [],
        loyalty_points: customer.loyalty_points ?? 0,
        coupons_used: customer.coupons_used || [],
        refund_history: customer.refund_history || [],
        return_requests: customer.return_requests || [],
        payment_methods: customer.payment_methods || [],
        delivery_history: customer.delivery_history || [],
        login_history: customer.login_history || [],
        wishlist: customer.wishlist || [],
        shopping_cart: customer.shopping_cart || [],
        saved_addresses: customer.saved_addresses || []
      };

      const { error: updateError } = await supabase
        .from('customers')
        .update({
          full_name: profileName.trim() || null,
          email: profileEmail.trim() || null,
          city: city.trim() || null,
          address: address.trim() || null,
          notes: JSON.stringify(extNotes),
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);
      if (updateError) throw updateError;

      const updatedCustomer = {
        ...customer,
        full_name: profileName.trim() || null,
        email: profileEmail.trim() || null,
        city: city.trim() || null,
        address: address.trim() || null,
        notes: JSON.stringify(extNotes),
        ...extNotes
      };
      
      setCustomer(updatedCustomer);
      localStorage.setItem('customer', JSON.stringify(updatedCustomer));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : (lang === 'ar' ? 'فشل الحفظ' : 'Erreur de sauvegarde'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async () => {
    if (!customer) return;
    if (!newAddrLabel || !newAddrAddress || !newAddrCity) {
      alert(lang === 'ar' ? 'يرجى ملء الحقول المطلوبة' : 'Veuillez remplir les champs obligatoires');
      return;
    }

    setSaving(true);
    try {
      const newAddr = {
        id: Math.random().toString(36).substr(2, 9),
        label: newAddrLabel,
        address: newAddrAddress,
        city: newAddrCity,
        state: newAddrState,
        postal_code: newAddrPostal,
        is_default: (customer.saved_addresses || []).length === 0
      };

      const updatedAddresses = [...(customer.saved_addresses || []), newAddr];
      const extNotes: ExtendedCustomerFields = {
        profile_photo: profilePhoto,
        country: country,
        state: stateProvince,
        postal_code: postalCode,
        gps_location: gpsLocation,
        preferred_language: prefLang,
        preferred_currency: prefCurrency,
        status: customer.status || 'Active',
        email_verified: customer.email_verified,
        phone_verified: customer.phone_verified,
        admin_notes: customer.admin_notes || '',
        internal_tags: customer.internal_tags || [],
        loyalty_points: customer.loyalty_points ?? 0,
        coupons_used: customer.coupons_used || [],
        refund_history: customer.refund_history || [],
        return_requests: customer.return_requests || [],
        payment_methods: customer.payment_methods || [],
        delivery_history: customer.delivery_history || [],
        login_history: customer.login_history || [],
        wishlist: customer.wishlist || [],
        shopping_cart: customer.shopping_cart || [],
        saved_addresses: updatedAddresses
      };

      const { error: updateError } = await supabase
        .from('customers')
        .update({
          notes: JSON.stringify(extNotes),
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);
      if (updateError) throw updateError;

      const updatedCustomer = {
        ...customer,
        notes: JSON.stringify(extNotes),
        ...extNotes
      };
      
      setCustomer(updatedCustomer);
      localStorage.setItem('customer', JSON.stringify(updatedCustomer));

      // Reset Form
      setNewAddrLabel('');
      setNewAddrCity('');
      setNewAddrState('');
      setNewAddrAddress('');
      setNewAddrPostal('');
      setShowAddressForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error adding address');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!customer) return;
    setSaving(true);
    try {
      const updatedAddresses = (customer.saved_addresses || []).filter(a => a.id !== id);
      const extNotes: ExtendedCustomerFields = {
        profile_photo: profilePhoto,
        country: country,
        state: stateProvince,
        postal_code: postalCode,
        gps_location: gpsLocation,
        preferred_language: prefLang,
        preferred_currency: prefCurrency,
        status: customer.status || 'Active',
        email_verified: customer.email_verified,
        phone_verified: customer.phone_verified,
        admin_notes: customer.admin_notes || '',
        internal_tags: customer.internal_tags || [],
        loyalty_points: customer.loyalty_points ?? 0,
        coupons_used: customer.coupons_used || [],
        refund_history: customer.refund_history || [],
        return_requests: customer.return_requests || [],
        payment_methods: customer.payment_methods || [],
        delivery_history: customer.delivery_history || [],
        login_history: customer.login_history || [],
        wishlist: customer.wishlist || [],
        shopping_cart: customer.shopping_cart || [],
        saved_addresses: updatedAddresses
      };

      const { error: updateError } = await supabase
        .from('customers')
        .update({
          notes: JSON.stringify(extNotes),
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);
      if (updateError) throw updateError;

      const updatedCustomer = {
        ...customer,
        notes: JSON.stringify(extNotes),
        ...extNotes
      };
      
      setCustomer(updatedCustomer);
      localStorage.setItem('customer', JSON.stringify(updatedCustomer));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting address');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefaultAddress = async (id: string) => {
    if (!customer) return;
    setSaving(true);
    try {
      const updatedAddresses = (customer.saved_addresses || []).map(a => ({
        ...a,
        is_default: a.id === id
      }));
      const extNotes: ExtendedCustomerFields = {
        profile_photo: profilePhoto,
        country: country,
        state: stateProvince,
        postal_code: postalCode,
        gps_location: gpsLocation,
        preferred_language: prefLang,
        preferred_currency: prefCurrency,
        status: customer.status || 'Active',
        email_verified: customer.email_verified,
        phone_verified: customer.phone_verified,
        admin_notes: customer.admin_notes || '',
        internal_tags: customer.internal_tags || [],
        loyalty_points: customer.loyalty_points ?? 0,
        coupons_used: customer.coupons_used || [],
        refund_history: customer.refund_history || [],
        return_requests: customer.return_requests || [],
        payment_methods: customer.payment_methods || [],
        delivery_history: customer.delivery_history || [],
        login_history: customer.login_history || [],
        wishlist: customer.wishlist || [],
        shopping_cart: customer.shopping_cart || [],
        saved_addresses: updatedAddresses
      };

      const { error: updateError } = await supabase
        .from('customers')
        .update({
          notes: JSON.stringify(extNotes),
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);
      if (updateError) throw updateError;

      const updatedCustomer = {
        ...customer,
        notes: JSON.stringify(extNotes),
        ...extNotes
      };
      
      setCustomer(updatedCustomer);
      localStorage.setItem('customer', JSON.stringify(updatedCustomer));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error setting default address');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customer');
    navigate('/');
  };

  if (!customer) return null;

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'orders', label: t('account.orders'), icon: Package },
    { id: 'profile', label: t('account.profile'), icon: User },
    { id: 'addresses', label: t('account.addresses'), icon: MapPin },
    { id: 'support', label: t('account.support'), icon: HeadphonesIcon },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" dir={dir}>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-bold">{customer.full_name || (lang === 'ar' ? 'عميل' : 'Client')}</p>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                      <Shield className="w-3 h-3" />
                      {lang === 'ar' ? 'مسؤول' : lang === 'fr' ? 'Administrateur' : 'Admin'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500" dir="ltr">{customer.phone}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary-600">{customer.total_orders}</p>
                <p className="text-xs text-gray-500">{t('account.totalOrders')}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-primary-600">{formatPrice(customer.total_spent)}</p>
                <p className="text-xs text-gray-500">{t('account.totalSpent')}</p>
              </div>
            </div>

            <div className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors text-sm ${activeTab === tab.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
              
              {/* Admin Panel quick link */}
              {isAdmin && (
                <Link
                  to="/admin/dashboard"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium transition-colors text-sm border border-indigo-100"
                >
                  <Settings className="w-4 h-4 text-indigo-600" />
                  {lang === 'ar' ? 'لوحة التحكم للمسؤول' : lang === 'fr' ? "Panneau d'administration" : 'Admin Panel'}
                </Link>
              )}

              {/* Administrator Login page quick link */}
              <Link
                to="/admin/login"
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors text-sm border border-slate-950 shadow-sm"
              >
                <Shield className="w-4 h-4 text-indigo-400" />
                {lang === 'ar' ? 'بوابة المسؤولين' : lang === 'fr' ? 'Portail Administrateur' : 'Administrator Portal'}
              </Link>

              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-error-600 hover:bg-error-50 text-sm">
                <LogOut className="w-4 h-4" />
                {t('account.logout')}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'orders' && (
            <div>
              <h2 className="text-xl font-bold mb-4">{t('account.orders')}</h2>
              {loading ? (
                <div className="card p-8 text-center text-gray-500">{t('common.loading')}</div>
              ) : orders.length === 0 ? (
                <div className="card p-8 text-center">
                  <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">{lang === 'ar' ? 'لا توجد طلبات بعد' : 'Aucune commande'}</p>
                  <Link to="/products" className="btn-primary">{t('cart.continueShopping')}</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold text-primary-600" dir="ltr">{order.order_number}</p>
                          <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                        </div>
                        <span className={`badge ${
                          order.status === 'delivered' ? 'bg-accent-100 text-accent-700' :
                          order.status === 'cancelled' ? 'bg-error-100 text-error-700' :
                          order.status === 'shipped' ? 'bg-secondary-100 text-secondary-700' :
                          'bg-primary-100 text-primary-700'
                        }`}>
                          {t(`status.${order.status}` as never)}
                        </span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                        {order.items.map((item, i) => (
                          <img key={i} src={item.image} alt="" className="w-12 h-12 object-cover rounded shrink-0" />
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <p className="text-sm text-gray-500">{order.items.length} {t('cart.items')}</p>
                        <p className="font-bold">{formatPrice(order.total)}</p>
                      </div>
                      <Link to={`/track?order=${order.order_number}`} className="btn-outline w-full mt-3 text-sm">
                        {t('tracking.title')}
                        <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div>
              <h2 className="text-xl font-bold mb-4">{t('account.profile')}</h2>
              <div className="card p-5 space-y-6">
                {saveSuccess && (
                  <div className="flex items-center gap-2 rounded-lg bg-accent-50 px-4 py-3 text-sm text-accent-700">
                    <CheckCircle className="h-4 w-4" />
                    {lang === 'ar' ? 'تم حفظ التغييرات بنجاح' : 'Modifications enregistrées'}
                  </div>
                )}
                {saveError && (
                  <div className="flex items-center gap-2 rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
                    <AlertCircle className="h-4 w-4" />
                    {saveError}
                  </div>
                )}

                {/* Profile Photo Selection */}
                <div>
                  <label className="label">{lang === 'ar' ? 'الصورة الشخصية' : 'Photo de profil'}</label>
                  <div className="flex flex-wrap items-center gap-4">
                    <img
                      src={profilePhoto || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'}
                      alt="Profile"
                      className="w-16 h-16 rounded-full object-cover border border-slate-200"
                    />
                    <div className="space-y-2 flex-1">
                      <div className="flex gap-2">
                        {[
                          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
                          'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
                          'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
                        ].map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setProfilePhoto(url)}
                            className={`w-8 h-8 rounded-full border-2 overflow-hidden transition-all ${profilePhoto === url ? 'border-primary-600 scale-110' : 'border-transparent opacity-75 hover:opacity-100'}`}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                      <input
                        value={profilePhoto}
                        onChange={(e) => setProfilePhoto(e.target.value)}
                        className="input text-xs"
                        placeholder={lang === 'ar' ? 'أو أدخل رابط صورة مخصص...' : 'Ou entrez une URL personnalisée...'}
                      />
                    </div>
                  </div>
                </div>

                {/* Identity Badges */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
                  <div>
                    <strong>{lang === 'ar' ? 'حالة الحساب:' : 'Statut:'}</strong>{' '}
                    <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      customer.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {customer.status || 'Active'}
                    </span>
                  </div>
                  <div>
                    <strong>{lang === 'ar' ? 'نوع الحساب:' : 'Type:'}</strong>{' '}
                    <span className="capitalize font-semibold text-indigo-700">
                      {customer.account_type || 'Retail'}
                    </span>
                  </div>
                  <div>
                    <strong>{lang === 'ar' ? 'تاريخ الإنشاء:' : 'Créé le:'}</strong> {formatDate(customer.created_at)}
                  </div>
                  <div>
                    <strong>{lang === 'ar' ? 'النقاط الولائية:' : 'Loyalty Points:'}</strong>{' '}
                    <span className="font-bold text-emerald-600">{customer.loyalty_points || 0}</span>
                  </div>
                </div>

                {/* Main Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('auth.fullName')}</label>
                    <input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="input"
                      placeholder={lang === 'ar' ? 'الاسم الكامل' : 'Nom complet'}
                    />
                  </div>
                  <div>
                    <label className="label">{t('auth.phone')}</label>
                    <div className="relative">
                      <input defaultValue={customer.phone} className="input bg-gray-50 text-gray-500 cursor-not-allowed" dir="ltr" readOnly />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        ✓ {lang === 'ar' ? 'مؤكد' : 'Vérifié'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('auth.email')}</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        className="input"
                        dir="ltr"
                        placeholder="email@example.com"
                      />
                      {profileEmail && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          ✓ {lang === 'ar' ? 'مؤكد' : 'Vérifié'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="label">{lang === 'ar' ? 'الدولة' : 'Pays'}</label>
                    <input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="input"
                      placeholder={lang === 'ar' ? 'الدولة' : 'Pays'}
                    />
                  </div>
                </div>

                {/* Location Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">{lang === 'ar' ? 'الولاية / المقاطعة' : 'Province / État'}</label>
                    <input
                      value={stateProvince}
                      onChange={(e) => setStateProvince(e.target.value)}
                      className="input"
                      placeholder={lang === 'ar' ? 'الولاية' : 'Wilaya / Province'}
                    />
                  </div>
                  <div>
                    <label className="label">{lang === 'ar' ? 'المدينة' : 'Ville'}</label>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="input"
                      placeholder={lang === 'ar' ? 'المدينة' : 'Ville'}
                    />
                  </div>
                  <div>
                    <label className="label">{lang === 'ar' ? 'الرمز البريدي' : 'Code postal'}</label>
                    <input
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="input"
                      placeholder="16000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="label">{lang === 'ar' ? 'العنوان الكامل' : 'Adresse complète'}</label>
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="input"
                      placeholder={lang === 'ar' ? 'الحي، الشارع، رقم المنزل' : 'Quartier, rue, numéro...'}
                    />
                  </div>
                  <div>
                    <label className="label">{lang === 'ar' ? 'موقع GPS (اختياري)' : 'Coordonnées GPS'}</label>
                    <input
                      value={gpsLocation}
                      onChange={(e) => setGpsLocation(e.target.value)}
                      className="input text-xs"
                      placeholder="36.7525, 3.04197"
                    />
                  </div>
                </div>

                {/* Preferences */}
                <div className="pt-4 border-t border-slate-100">
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-slate-400" />
                      {lang === 'ar' ? 'اللغة المفضلة' : 'Langue préférée'}
                    </label>
                    <select value={prefLang} onChange={(e) => setPrefLang(e.target.value)} className="input">
                      <option value="fr">Français</option>
                      <option value="ar">العربية (Algeria)</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('common.save')}
                </button>
              </div>

              {/* Check for Updates section */}
              <div className="card p-5 bg-slate-50 border border-slate-100 mt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary-100 rounded-xl">
                    <Smartphone className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      {lang === 'ar' ? 'تحديثات التطبيق' : lang === 'fr' ? "Mises à jour de l'application" : 'App Updates'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lang === 'ar' 
                        ? `الإصدار الحالي: v${localStorage.getItem('app_installed_version_name') || '1.0.0'} (${localStorage.getItem('app_installed_version_code') || '100'})` 
                        : `Version actuelle : v${localStorage.getItem('app_installed_version_name') || '1.0.0'} (${localStorage.getItem('app_installed_version_code') || '100'})`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const event = new CustomEvent('app-check-for-updates', { detail: { manual: true } });
                    window.dispatchEvent(event);
                  }}
                  className="btn-secondary w-full sm:w-auto py-2 px-4 text-xs font-bold border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                  {lang === 'ar' ? 'التحقق من وجود تحديثات' : lang === 'fr' ? 'Vérifier les mises à jour' : 'Check for Updates'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'addresses' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{t('account.addresses')}</h2>
                <button
                  onClick={() => setShowAddressForm(!showAddressForm)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors border border-primary-100"
                >
                  <PlusCircle className="w-4 h-4" />
                  {lang === 'ar' ? 'إضافة عنوان جديد' : 'Ajouter une adresse'}
                </button>
              </div>

              {/* Add Address Form */}
              {showAddressForm && (
                <div className="card p-5 mb-5 space-y-4 border-2 border-primary-100 animate-fadeIn">
                  <h3 className="font-bold text-slate-900 border-b pb-2">{lang === 'ar' ? 'عنوان جديد' : 'Nouvelle adresse'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">{lang === 'ar' ? 'تسمية العنوان (مثل المنزل، العمل)' : 'Nom de l\'adresse (ex: Maison, Bureau)'} *</label>
                      <input
                        value={newAddrLabel}
                        onChange={(e) => setNewAddrLabel(e.target.value)}
                        className="input"
                        placeholder={lang === 'ar' ? 'المنزل' : 'Maison'}
                      />
                    </div>
                    <div>
                      <label className="label">{lang === 'ar' ? 'الرمز البريدي' : 'Code postal'}</label>
                      <input
                        value={newAddrPostal}
                        onChange={(e) => setNewAddrPostal(e.target.value)}
                        className="input"
                        placeholder="16000"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">{lang === 'ar' ? 'الولاية / المقاطعة' : 'Province / Wilaya'}</label>
                      <input
                        value={newAddrState}
                        onChange={(e) => setNewAddrState(e.target.value)}
                        className="input"
                        placeholder="Alger"
                      />
                    </div>
                    <div>
                      <label className="label">{lang === 'ar' ? 'المدينة' : 'Ville'} *</label>
                      <input
                        value={newAddrCity}
                        onChange={(e) => setNewAddrCity(e.target.value)}
                        className="input"
                        placeholder="Alger"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">{lang === 'ar' ? 'العنوان الكامل' : 'Adresse complète'} *</label>
                    <input
                      value={newAddrAddress}
                      onChange={(e) => setNewAddrAddress(e.target.value)}
                      className="input"
                      placeholder={lang === 'ar' ? 'رقم الشارع، الحي، الطابق والبيت' : 'Ex: 12 Rue Larbi Ben M\'hidi, Alger'}
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      onClick={() => setShowAddressForm(false)}
                      className="btn-outline px-4 py-2"
                    >
                      {lang === 'ar' ? 'إلغاء' : 'Annuler'}
                    </button>
                    <button
                      onClick={handleAddAddress}
                      disabled={saving}
                      className="btn-primary px-5 py-2 flex items-center gap-1.5"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      {lang === 'ar' ? 'حفظ العنوان' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              )}

              {/* Saved Addresses List */}
              <div className="space-y-3">
                {(customer.saved_addresses || []).length === 0 ? (
                  <div className="card p-8 text-center text-gray-500">
                    <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p>{lang === 'ar' ? 'لا توجد عناوين محفوظة بعد. أضف عنوانك الأول لتسهيل عملية الشراء!' : 'Aucune adresse enregistrée'}</p>
                  </div>
                ) : (
                  (customer.saved_addresses || []).map((addr: SavedAddress) => (
                    <div key={addr.id} className={`card p-4 border transition-all ${addr.is_default ? 'border-primary-300 bg-primary-50/20' : 'border-slate-200'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-primary-600" />
                          <h4 className="font-bold text-slate-900">{addr.label}</h4>
                          {addr.is_default && (
                            <span className="bg-primary-100 text-primary-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {lang === 'ar' ? 'الافتراضي' : 'Par défaut'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {!addr.is_default && (
                            <button
                              onClick={() => handleSetDefaultAddress(addr.id)}
                              className="text-xs text-primary-600 hover:text-primary-700 font-semibold px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 shadow-xs transition-colors"
                            >
                              {lang === 'ar' ? 'تعيين كافتراضي' : 'Définir par défaut'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors"
                            title={lang === 'ar' ? 'حذف العنوان' : 'Supprimer'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-slate-600 pl-7 rtl:pr-7 rtl:pl-0 space-y-0.5">
                        <p>{addr.address}</p>
                        <p>{addr.city}{addr.state ? `, ${addr.state}` : ''}{addr.postal_code ? ` - ${addr.postal_code}` : ''}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div>
              <h2 className="text-xl font-bold mb-4">{t('account.support')}</h2>
              <div className="card p-5 text-center">
                <HeadphonesIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">{lang === 'ar' ? 'هل تحتاج مساعدة؟' : 'Besoin d\'aide?'}</p>
                <Link to="/support" className="btn-primary">{t('nav.support')}</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
