import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Mail, Phone, MapPin, Send, FileText, Globe 
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { fetchPageBySlug, recordPageView } from '../../lib/cms';
import { CMSPage } from '../../types';

export default function CMSPageViewer() {
  const { slug } = useParams<{ slug: string }>();
  const { lang, dir } = useLanguage();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [page, setPage] = useState<CMSPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [submittingContact, setSubmittingContact] = useState(false);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      if (!slug) return;
      const fetched = await fetchPageBySlug(slug);
      if (fetched) {
        setPage(fetched);
        
        // Record page view with session ID
        let sessionId = localStorage.getItem('cms_view_session_id');
        if (!sessionId) {
          sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          localStorage.setItem('cms_view_session_id', sessionId);
        }
        recordPageView(fetched.id, sessionId);
      } else {
        // Fallback static compliance pages if missing from DB
        const s = (slug || '').toLowerCase();
        if (s.includes('privacy')) {
          setPage({
            id: 'privacy-fallback',
            key: 'privacy-policy',
            slug: 'privacy-policy',
            type: 'static_privacy',
            title_ar: 'سياسة الخصوصية وحماية البيانات',
            title_fr: 'Politique de Confidentialité',
            title_en: 'Privacy Policy',
            content_ar: '<h2>سياسة الخصوصية</h2><p>نحن في بيزنس ماركت نلتزم بحماية بياناتك الشخصية وفقاً للقوانين الجزائرية المعمول بها. نحن نجمع معلوماتك الأساسية مثل الاسم ورقم الهاتف والعنوان فقط لغرض توصيل الطلبات وإدارة حسابك والتواصل معك بشأن المبيعات.</p><p>لن يتم مشاركة بياناتك الشخصية مع أي أطراف ثالثة باستثناء شركات الشحن المعتمدة لدينا لتوصيل طلبك.</p>',
            content_fr: '<h2>Politique de Confidentialité</h2><p>Business Market s\'engage à protéger vos données personnelles. Nous collectons votre nom, numéro de téléphone et adresse uniquement pour le traitement et la livraison de vos commandes.</p>',
            content_en: '<h2>Privacy Policy</h2><p>Business Market is committed to protecting your privacy. We collect essential information such as name, phone, and address strictly for order fulfillment and account support.</p>',
            status: 'published',
            seo: {},
            revisions: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } else if (s.includes('term') || s.includes('condition')) {
          setPage({
            id: 'terms-fallback',
            key: 'terms-and-conditions',
            slug: 'terms-and-conditions',
            type: 'static_terms',
            title_ar: 'الشروط والأحكام',
            title_fr: 'Conditions Générales d\'Utilisation',
            title_en: 'Terms & Conditions',
            content_ar: '<h2>الشروط والأحكام</h2><p>مرحباً بك في منصة بيزنس ماركت. استخدامك للموقع واستعمال خدمات الشراء يعبر عن موافقتك الكاملة على هذه الشروط والأحكام.</p><p>جميع الأسعار معروضة بالدينار الجزائري (DZD). يحق لنا تعديل الأسعار والمنتجات المتاحة دون إشعار مسبق.</p>',
            content_fr: '<h2>Conditions Générales</h2><p>Bienvenue sur Business Market. Tous nos prix sont affichés en Dinars Algériens (DZD). Les conditions régissent les achats et services de la plateforme.</p>',
            content_en: '<h2>Terms & Conditions</h2><p>Welcome to Business Market. All transactions are priced in Algerian Dinar (DZD).</p>',
            status: 'published',
            seo: {},
            revisions: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } else if (s.includes('return') || s.includes('refund')) {
          setPage({
            id: 'return-fallback',
            key: 'return-policy',
            slug: 'return-policy',
            type: 'custom',
            title_ar: 'سياسة الإرجاع والاستبدال',
            title_fr: 'Politique de Retour et Remboursement',
            title_en: 'Return & Refund Policy',
            content_ar: '<h2>سياسة الإرجاع والاستبدال</h2><p>يمكنك طلب إرجاع أو استبدال المنتج خلال 7 أيام من تاريخ الاستلام بشرط أن يكون المنتج في حالته الأصلية وتغليفه الأصلي.</p>',
            content_fr: '<h2>Politique de Retour</h2><p>Vous pouvez retourner tout produit sous 7 jours après réception s\'il est dans son emballage d\'origine.</p>',
            content_en: '<h2>Return Policy</h2><p>Items can be returned or exchanged within 7 days of delivery in their original condition.</p>',
            status: 'published',
            seo: {},
            revisions: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } else if (s.includes('ship') || s.includes('deliver')) {
          setPage({
            id: 'shipping-fallback',
            key: 'shipping-policy',
            slug: 'shipping-policy',
            type: 'custom',
            title_ar: 'سياسة الشحن والتوصيل',
            title_fr: 'Politique de Livraison',
            title_en: 'Shipping & Delivery Policy',
            content_ar: '<h2>سياسة الشحن والتوصيل</h2><p>نوفر التوصيل لجميع ولايات الجزائر الـ 58 عبر شركائنا المعتمدين (يليدين، مايسترو، زد أكسبرس). يتم التوصيل للمنزل أو إلى المكتب (Stop-Desk) بحسب اختيارك.</p>',
            content_fr: '<h2>Politique de Livraison</h2><p>Nous livrons dans les 58 Wilayas d\'Algérie via nos partenaires Yalidine, Maystro et ZR Express (A domicile ou Stop-Desk).</p>',
            content_en: '<h2>Shipping Policy</h2><p>We deliver across all 58 Algerian Wilayas via official carrier integrations with Home delivery and Stop-Desk options.</p>',
            status: 'published',
            seo: {},
            revisions: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch {
      // Fallback or handle offline
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingContact(true);
    setTimeout(() => {
      setSubmittingContact(false);
      showToast(
        lang === 'ar' ? 'تم ارسال رسالتك بنجاح! سنتواصل معك قريباً.' : 'Votre message a été envoyé avec succès !',
        'success'
      );
      setContactForm({ name: '', email: '', phone: '', subject: '', message: '' });
    }, 600);
  };

  const getTitle = () => {
    if (!page) return '';
    return lang === 'ar' ? page.title_ar : lang === 'fr' ? page.title_fr : (page.title_en || page.title_fr);
  };

  const getContent = () => {
    if (!page) return '';
    return lang === 'ar' ? page.content_ar : lang === 'fr' ? page.content_fr : (page.content_en || page.content_fr);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">{lang === 'ar' ? 'جاري تحميل الصفحة...' : 'Chargement de la page...'}</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center" dir={dir}>
        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
          {lang === 'ar' ? 'الصفحة غير موجودة' : 'Page introuvable'}
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          {lang === 'ar' ? 'عذراً، لم نتمكن من العثور على الصفحة المطلوبة.' : 'Désolé, la page demandée n\'existe pas.'}
        </p>
        <button onClick={() => navigate('/')} className="btn-primary">
          {lang === 'ar' ? 'العودة للرئيسية' : 'Retour à l\'accueil'}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4 sm:px-6" dir={dir}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Link to="/" className="hover:text-emerald-600 transition-colors">{lang === 'ar' ? 'الرئيسية' : 'Accueil'}</Link>
          <span>/</span>
          <span className="text-slate-800 dark:text-white font-medium">{getTitle()}</span>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-10 border border-slate-200 dark:border-slate-700 shadow-sm space-y-8">
          {/* Header */}
          <div className="border-b border-slate-100 dark:border-slate-700 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {getTitle()}
              </h1>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'آخر تحديث:' : 'Dernière mise à jour:'} {new Date(page.updated_at).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR')}
              </p>
            </div>
          </div>

          {/* Render Rich HTML Content */}
          <div 
            className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 text-sm leading-relaxed space-y-4"
            dangerouslySetInnerHTML={{ __html: getContent() }}
          />

          {/* Contact Page Special Form */}
          {(page.key === 'contact-us' || page.type === 'static_contact') && (
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-emerald-600" />
                  {lang === 'ar' ? 'أرسل لنا رسالة مباشرة' : 'Envoyez-nous un message'}
                </h3>
                <form onSubmit={handleContactSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {lang === 'ar' ? 'الاسم الكامل' : 'Nom complet'}
                    </label>
                    <input
                      type="text"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      className="input text-xs dark:bg-slate-900 dark:border-slate-700"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        {lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                      </label>
                      <input
                        type="email"
                        required
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        className="input text-xs dark:bg-slate-900 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        {lang === 'ar' ? 'رقم الهاتف' : 'Téléphone'}
                      </label>
                      <input
                        type="tel"
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                        className="input text-xs dark:bg-slate-900 dark:border-slate-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {lang === 'ar' ? 'الموضوع' : 'Sujet'}
                    </label>
                    <input
                      type="text"
                      required
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                      className="input text-xs dark:bg-slate-900 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      {lang === 'ar' ? 'الرسالة' : 'Message'}
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      className="input text-xs dark:bg-slate-900 dark:border-slate-700"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingContact}
                    className="btn-primary w-full py-2.5 text-xs font-bold"
                  >
                    <Send className="w-4 h-4" />
                    {submittingContact ? (lang === 'ar' ? 'جاري الإرسال...' : 'Envoi en cours...') : (lang === 'ar' ? 'إرسال الرسالة' : 'Envoyer')}
                  </button>
                </form>
              </div>

              {/* Store Contact Info */}
              <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white text-base">
                  {lang === 'ar' ? 'معلومات الاتصال المباشر' : 'Coordonnées'}
                </h3>
                <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>+213 555 000 000 / +213 23 00 00 00</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>contact@businessmarket.dz</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{lang === 'ar' ? 'الجزائر العاصمة، الجزائر' : 'Alger, Algérie'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>www.businessmarket.dz</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
