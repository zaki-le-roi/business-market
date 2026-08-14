import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, ShieldCheck, Scale, CreditCard, Receipt, 
  FileText, TrendingUp, AlertCircle, CheckCircle, Clock, 
  ChevronRight, ArrowRightLeft, FileCheck, Landmark, Users, Briefcase
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { Customer, Wilaya } from '../../types';
import { ALL_WILAYAS } from '../../constants/wilayas';

interface CreditTransaction {
  id: string;
  date: string;
  type: 'debit' | 'credit';
  amount: number;
  description: string;
  reference: string;
}

export default function WholesalePortalPage() {
  const { t, lang, formatPrice, dir } = useLanguage();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [wilayasList, setWilayasList] = useState<Wilaya[]>([]);
  
  // Registration Form States
  const [companyName, setCompanyName] = useState('');
  const [registerNum, setRegisterNum] = useState('');
  const [taxId, setTaxId] = useState('');
  const [nis, setNis] = useState('');
  const [businessActivity, setBusinessActivity] = useState('');
  const [wilayaId, setWilayaId] = useState('16');
  const [submitting, setSubmitting] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Mock Credit & Transaction Data
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);

  useEffect(() => {
    async function loadWilayas() {
      try {
        const { data, error } = await supabase
          .from('wilayas')
          .select('*')
          .eq('is_active', true)
          .order('code');
        if (error) throw error;
        if (data && data.length > 0) {
          setWilayasList(data as Wilaya[]);
        } else {
          setWilayasList(ALL_WILAYAS);
        }
      } catch (err) {
        console.error('Error fetching wilayas:', err);
      }
    }
    loadWilayas();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('customer');
    if (saved) {
      const parsed = JSON.parse(saved) as Customer;
      setCustomer(parsed);
      
      // Load current customer values if they exist
      if (parsed.company_name) setCompanyName(parsed.company_name);
      if (parsed.register_number) setRegisterNum(parsed.register_number);
      if (parsed.tax_id) setTaxId(parsed.tax_id);
      if (parsed.nis) setNis(parsed.nis);
      if (parsed.wilaya_id) setWilayaId(parsed.wilaya_id.toString());
      if (parsed.notes) {
        const match = parsed.notes.match(/Business Activity:\s*(.*)/);
        if (match) setBusinessActivity(match[1]);
      }
      
      // Load real credit account and transactions from Supabase for approved wholesale customers
      if (parsed.id && parsed.account_type === 'wholesale' && parsed.wholesale_status === 'approved') {
        (async () => {
          try {
            const { data: acc } = await supabase
              .from('credit_accounts')
              .select('id')
              .eq('customer_id', parsed.id)
              .maybeSingle();

            if (acc) {
              const { data: txs } = await supabase
                .from('credit_transactions')
                .select('*')
                .eq('credit_account_id', acc.id)
                .order('created_at', { ascending: false });

              if (txs && txs.length > 0) {
                setTransactions(txs.map(t => ({
                  id: t.id,
                  date: t.created_at.split('T')[0],
                  type: t.type === 'charge' ? 'debit' : 'credit',
                  amount: t.amount,
                  description: t.description || (t.type === 'charge' ? 'Facture B2B' : 'Paiement Crédit'),
                  reference: t.reference_number || 'N/A'
                })));
              }
            }
          } catch (e) {
            console.warn('Error loading customer credit transactions:', e);
          }
        })();
      }
    }
  }, [lang]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    const saved = localStorage.getItem('customer');
    if (!saved) {
      navigate('/login?redirect=wholesale');
      return;
    }

    const currentCust = JSON.parse(saved) as Customer;

    const payload = {
      company_name: companyName.trim() || null,
      register_number: registerNum.trim() || null,
      tax_id: taxId.trim() || null,
      nis: nis.trim() || null,
      wilaya_id: parseInt(wilayaId) || null,
      account_type: 'wholesale' as const,
      wholesale_status: 'pending' as const, // Under review until approved by the admin
      notes: businessActivity.trim() ? `Business Activity: ${businessActivity.trim()}` : null
    };

    try {
      const { error: dbErr } = await supabase
        .from('customers')
        .update(payload)
        .eq('id', currentCust.id);

      if (dbErr) {
        throw new Error(dbErr.message);
      }

      // Log wholesale activity
      await supabase.from('wholesale_activity_logs').insert({
        customer_id: currentCust.id,
        action: 'wholesale_registration',
        details: `Customer registered for wholesale. Company: ${companyName.trim() || 'N/A'}`,
        created_by: 'Customer'
      });

      // Update local UI session
      const updated = {
        ...currentCust,
        ...payload
      };
      localStorage.setItem('customer', JSON.stringify(updated));
      setCustomer(updated);
      setRegSuccess(true);
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error('Wholesale registration error:', err);
      setErrorMsg(errorObj.message || 'Failed to submit wholesale registration');
    } finally {
      setSubmitting(false);
    }
  };

  const isAr = lang === 'ar';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" dir={dir}>
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 to-secondary-900 px-6 py-8 text-white shadow-lg mb-6">
        <div className="absolute right-0 top-0 opacity-10 translate-x-10 -translate-y-6">
          <Building2 className="w-40 h-40" />
        </div>
        <div className="relative z-10">
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
            {isAr ? 'بوابة الشراء بالجملة' : 'Portail d\'Achat en Gros'}
          </span>
          <h1 className="text-2xl font-black mt-2">
            {isAr ? 'تفعيل الشراء بالجملة والتجزئة' : 'Activation de l\'Achat en Gros'}
          </h1>
          <p className="text-sm text-emerald-100/90 mt-1 max-w-xl">
            {isAr 
              ? 'احصل على أسعار الجملة التفضيلية مباشرة لطلباتك الكبيرة والكميات من متجرنا.' 
              : 'Profitez de prix réduits de gros pour vos commandes de volumes directement sur notre boutique.'}
          </p>
        </div>
      </div>

      {/* Guest or Unregistered State */}
      {!customer && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="font-bold text-lg text-gray-800">
            {isAr ? 'مطلوب حساب تاجر للوصول' : 'Compte Professionnel Requis'}
          </h3>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            {isAr 
              ? 'يرجى تسجيل الدخول أو إنشاء حساب عميل أولاً، ثم تفعيل حساب الجملة الخاص بك.' 
              : 'Veuillez vous connecter ou créer un compte client, puis activer votre compte grossiste.'}
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <Link to="/login?redirect=wholesale" className="btn-primary px-6">
              {t('nav.login')}
            </Link>
            <Link to="/register" className="btn-outline px-6">
              {t('nav.register')}
            </Link>
          </div>
        </div>
      )}

      {customer && (!customer.account_type || customer.account_type === 'retail') && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-bold text-lg text-gray-800 border-b pb-3 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-600" />
            {isAr ? 'تفعيل الشراء بالجملة لحسابك' : 'Activer l\'Achat en Gros pour votre compte'}
          </h3>

          {regSuccess ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-6 rounded-2xl text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h4 className="font-bold text-base">
                {isAr ? 'تم تفعيل حساب الجملة بنجاح!' : 'Compte de gros activé avec succès!'}
              </h4>
              <p className="text-xs mt-2 text-emerald-700 max-w-md mx-auto">
                {isAr 
                  ? 'تم حفظ معلوماتك بنجاح وتفعيل ميزات وأسعار الشراء بالجملة.' 
                  : 'Vos informations ont été enregistrées avec succès et vos fonctionnalités d\'achat en gros sont activées.'}
              </p>
              <button onClick={() => window.location.reload()} className="btn-primary mt-4 text-xs">
                {isAr ? 'عرض ميزات الجملة' : 'Afficher les options de gros'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs font-semibold">{isAr ? 'اسم الشركة / المحل التجاري (اختياري)' : 'Nom de l\'Entreprise / Commerce (Optionnel)'}</label>
                  <input 
                    type="text" 
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Eurl, Sarl, Commerce de détail..."
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="label text-xs font-semibold">{isAr ? 'رقم السجل التجاري (RC) (اختياري)' : 'Numéro de Registre de Commerce (RC) (Optionnel)'}</label>
                  <input 
                    type="text" 
                    value={registerNum}
                    onChange={e => setRegisterNum(e.target.value)}
                    placeholder="e.g. 16/00-1234567B26"
                    className="input text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs font-semibold">{isAr ? 'الرقم الإحصائي الجبائي (NIF) (اختياري)' : 'Numéro d\'Identification Fiscale (NIF) (Optionnel)'}</label>
                  <input 
                    type="text" 
                    value={taxId}
                    onChange={e => setTaxId(e.target.value)}
                    placeholder="15 digits code"
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="label text-xs font-semibold">{isAr ? 'الرقم الإحصائي (NIS) (اختياري)' : 'Numéro d\'Identification Statistique (NIS) (Optionnel)'}</label>
                  <input 
                    type="text" 
                    value={nis}
                    onChange={e => setNis(e.target.value)}
                    placeholder="17 digits code"
                    className="input text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs font-semibold">{isAr ? 'النشاط التجاري الرئيسي (اختياري)' : 'Activité Principale (Optionnel)'}</label>
                  <input 
                    type="text" 
                    value={businessActivity}
                    onChange={e => setBusinessActivity(e.target.value)}
                    placeholder={isAr ? 'تجارة الهواتف، المواد الغذائية، إلخ' : 'Vente de smartphones, cosmétiques, etc.'}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="label text-xs font-semibold">{isAr ? 'الولاية المقر' : 'Wilaya du Siège'}</label>
                  <select 
                    value={wilayaId}
                    onChange={e => setWilayaId(e.target.value)}
                    className="input text-sm bg-white"
                  >
                    {wilayasList.length > 0 ? (
                      wilayasList.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.code} - {lang === 'ar' ? w.name_ar : w.name_fr}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="16">16 - Alger</option>
                        <option value="31">31 - Oran</option>
                        <option value="09">09 - Blida</option>
                        <option value="25">25 - Constantine</option>
                        <option value="19">19 - Sétif</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full text-sm py-3 mt-4">
                {submitting ? (isAr ? 'جاري التفعيل...' : 'Activation en cours...') : (isAr ? 'حفظ البيانات وتفعيل حساب الجملة' : 'Enregistrer et activer le compte de gros')}
              </button>
            </form>
          )}
        </div>
      )}

      {customer && customer.account_type === 'wholesale' && customer.wholesale_status === 'pending' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4 animate-pulse" />
          <h3 className="font-bold text-lg text-gray-800">
            {isAr ? 'حساب الجملة قيد المراجعة' : 'Compte grossiste en cours de vérification'}
          </h3>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            {isAr 
              ? 'لقد تم تقديم طلبك بنجاح. ملفك التجاري قيد المراجعة حالياً من قبل الإدارة وسنتواصل معك فور تفعيل الحساب.' 
              : 'Votre dossier a été soumis avec succès. Notre équipe d\'administration examine actuellement vos données professionnelles. Vous serez notifié dès validation.'}
          </p>
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 mt-6 max-w-sm mx-auto text-left" dir="ltr">
            <span className="text-[10px] text-amber-600 font-bold block mb-1">SUBMITTED BUSINESS DOSSIER:</span>
            <div className="text-xs text-gray-700 font-semibold truncate"><strong>Company:</strong> {customer.company_name}</div>
            <div className="text-xs text-gray-700 font-semibold mt-1"><strong>RC:</strong> {customer.register_number}</div>
            {customer.nis && <div className="text-xs text-gray-700 font-semibold mt-1"><strong>NIS:</strong> {customer.nis}</div>}
          </div>
          <div className="mt-6">
            <Link to="/products" className="btn-outline text-xs px-4 py-2 inline-flex items-center gap-1.5">
              {isAr ? 'تصفح المنتجات بأسعار التجزئة' : 'Parcourir les produits (Détail)'}
            </Link>
          </div>
        </div>
      )}

      {/* FULLY APPROVED WHOLESALE PORTAL METRICS */}
      {customer && customer.account_type === 'wholesale' && customer.wholesale_status === 'approved' && (
        <div className="space-y-6">
          
          {/* Credit Ledger and Limit Bento Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-gradient-to-br from-slate-900 to-slate-850 rounded-2xl p-5 text-white border border-slate-800 shadow-sm relative overflow-hidden">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                {isAr ? 'الحد الائتماني الإجمالي' : 'Limite de Crédit'}
              </span>
              <p className="text-2xl font-black mt-2 text-primary-400">
                {formatPrice(customer.credit_limit || 500000)}
              </p>
              <div className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-primary-400" />
                {isAr ? 'مؤمن ومدعوم بفاتورة الضمان' : 'Garantie commerciale active'}
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-850 rounded-2xl p-5 text-white border border-slate-800 shadow-sm relative overflow-hidden">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                {isAr ? 'الرصيد الائتماني المتاح' : 'Crédit Disponible'}
              </span>
              <p className="text-2xl font-black mt-2 text-emerald-400">
                {formatPrice(customer.credit_balance || 150000)}
              </p>
              <div className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                {isAr ? 'متاح للاستخدام الفوري عند الشراء' : 'Prêt à l\'usage pour vos commandes'}
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-850 rounded-2xl p-5 text-white border border-slate-800 shadow-sm relative overflow-hidden">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                {isAr ? 'المستوى وخصم المجموعة' : 'Catégorie de Partenaire'}
              </span>
              <p className="text-xl font-black mt-3 text-amber-400">
                VIP Gold Merchant
              </p>
              <div className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                {isAr ? 'خصم مبيعات تلقائي ١٥٪' : 'Remise globale de 15% incluse'}
              </div>
            </div>

          </div>

          {/* Wholesale Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold text-sm text-gray-800 border-b pb-3 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              {isAr ? 'خصائص حساب الجملة المتاحة' : 'Fonctionnalités Grossiste Actives'}
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
              <Link to="/products" className="p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-xl transition-all flex flex-col items-center gap-1.5">
                <Building2 className="w-5 h-5 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-900">{isAr ? 'كتالوج الجملة' : 'Catalogue de Gros'}</span>
              </Link>
              
              <div className="p-4 bg-slate-50 border border-gray-100 rounded-xl flex flex-col items-center gap-1.5">
                <Scale className="w-5 h-5 text-slate-700" />
                <span className="text-xs font-bold text-slate-900">{isAr ? 'قائمة MOQ والعبوات' : 'MOQ & Paquetage'}</span>
                <span className="text-[9px] text-slate-500">Min Order Qty</span>
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex flex-col items-center gap-1.5">
                <FileText className="w-5 h-5 text-indigo-700" />
                <span className="text-xs font-bold text-indigo-900">{isAr ? 'طلب عروض الأسعار' : 'Demandes de Devis'}</span>
                <span className="text-[9px] text-indigo-500">PO Generator</span>
              </div>
            </div>
          </div>

          {/* Credit Account Ledger Transactions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold text-sm text-gray-800 border-b pb-3 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-slate-600" />
                {isAr ? 'كشف حركة الحساب والائتمان' : 'Relevé de Compte Crédit'}
              </span>
              <span className="text-xs font-mono bg-slate-100 text-slate-600 py-1 px-2.5 rounded-lg">
                Active Ledger
              </span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-gray-100 text-slate-500 font-bold uppercase">
                    <th className="pb-2.5 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="pb-2.5 text-start">{isAr ? 'البيان' : 'Description'}</th>
                    <th className="pb-2.5 text-start">{isAr ? 'المرجع' : 'Référence'}</th>
                    <th className="pb-2.5 text-end">{isAr ? 'المبلغ' : 'Montant'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-3 text-gray-500 font-mono">{tx.date}</td>
                      <td className="py-3 font-semibold text-gray-800">{tx.description}</td>
                      <td className="py-3 text-slate-500 font-mono uppercase">{tx.reference}</td>
                      <td className={`py-3 text-end font-bold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.type === 'credit' ? '+' : '-'} {formatPrice(tx.amount)}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-400">
                        {isAr ? 'لا توجد حركات ائتمانية بعد' : 'Aucune transaction enregistrée'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Wholesale Documents and Invoices */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold text-sm text-gray-800 border-b pb-3 mb-4 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-primary-600" />
              {isAr ? 'المستندات والفواتير الجاهزة' : 'Documents & Factures de Gros'}
            </h3>

            <div className="space-y-2.5">
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Receipt className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-xs font-bold text-gray-800">
                      {isAr ? 'فاتورة طلبية الجملة #BM-87632' : 'Facture Pro-Forma #BM-87632'}
                    </p>
                    <span className="text-[10px] text-gray-500 font-mono">185,000.00 DA • PDF Download Ready</span>
                  </div>
                </div>
                <button 
                  onClick={() => alert(isAr ? 'تم تحميل الفاتورة بنجاح!' : 'Facture téléchargée!')} 
                  className="p-2 text-primary-600 hover:text-primary-700"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-xs font-bold text-gray-800">
                      {isAr ? 'اتفاقية التسهيلات الائتمانية والدفع الآجل' : 'Contrat de Ligne de Crédit Commercial'}
                    </p>
                    <span className="text-[10px] text-gray-500 font-mono">Signed • Secured Copy</span>
                  </div>
                </div>
                <button 
                  onClick={() => alert(isAr ? 'تم تحميل عقد التسهيلات بنجاح!' : 'Contrat téléchargé!')} 
                  className="p-2 text-primary-600 hover:text-primary-700"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
