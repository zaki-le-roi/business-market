import { Link } from 'react-router-dom';
import {
  ShieldCheck, Trash2, ExternalLink,
  CheckCircle, HelpCircle, Mail, Globe, Lock
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function DataDeletionInstructionsPage() {
  const { tr } = useLanguage();

  const callbackUrl = `${window.location.origin}/api/meta/data-deletion`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link to="/" className="hover:text-emerald-400 transition-colors">
            {tr('الرئيسية', 'Accueil')}
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-semibold">
            {tr('تعليمات حذف بيانات Meta', 'Instructions de suppression des données Meta')}
          </span>
        </div>

        {/* Hero Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full text-xs font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>{tr('حماية البيانات والخصوصية', 'Protection des données & Confidentialité')}</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
                {tr(
                  'تعليمات حذف البيانات الخاصة بتطبيقات Meta (Facebook & Instagram)',
                  'Instructions de suppression des données Meta (Facebook & Instagram)'
                )}
              </h1>

              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {tr(
                  'يلتزم متجر Business Market بحماية بياناتك الخصوصية وحقك الكامل في مسح أو طلب إزالة كافة البيانات المرتبطة بحسابك على Meta وفق الشروط القانونية لمعهد حماية البيانات وMeta Developer Terms.',
                  'Business Market s\'engage à respecter la confidentialité de vos données et votre droit de demander la suppression complète des informations liées à votre compte Meta.'
                )}
              </p>
            </div>

            <div className="shrink-0 p-5 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-2xl">
              <Trash2 className="w-12 h-12" />
            </div>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-8 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-100">
              {tr('خطوات حذف بيانات التطبيق عبر Facebook', 'Étapes pour supprimer vos données via Facebook')}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Step 1 */}
            <div className="flex items-start gap-4 p-5 bg-slate-950 rounded-2xl border border-slate-800/80">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center text-sm shrink-0">
                1
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-200">
                  {tr('الانتقال إلى إعدادات الحساب في Facebook', 'Accéder aux paramètres de votre compte Facebook')}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tr(
                    'قم بتسجيل الدخول إلى حسابك على Facebook، واذهب إلى "الإعدادات والخصوصية" (Settings & Privacy) ثم اختَر "الإعدادات" (Settings).',
                    'Connectez-vous à votre compte Facebook, allez dans "Paramètres et confidentialité", puis cliquez sur "Paramètres".'
                  )}
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-4 p-5 bg-slate-950 rounded-2xl border border-slate-800/80">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center text-sm shrink-0">
                2
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-200">
                  {tr('إلغاء ربط تطبيق Business Market', 'Supprimer l\'application Business Market')}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tr(
                    'انتقل إلى قسم "التطبيقات ومواقع الويب" (Apps and Websites). ابحث عن "Business Market" واضغط على زر "إزالة" (Remove).',
                    'Rendez-vous dans la section "Applications et sites web". Recherchez "Business Market" et cliquez sur "Supprimer".'
                  )}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-4 p-5 bg-slate-950 rounded-2xl border border-slate-800/80">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center text-sm shrink-0">
                3
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-200">
                  {tr('إرسال طلب حذف البيانات المباشر', 'Envoyer une demande de suppression')}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tr(
                    'في القائمة السفلية للتطبيقات المزالة، اضغط على "عرض التطبيقات المزالة" ثم اختر "إرسال طلب" (Send Request) بجانب Business Market.',
                    'Dans la rubrique des applications supprimées, cliquez sur "Envoyer une demande" à côté de Business Market.'
                  )}
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start gap-4 p-5 bg-slate-950 rounded-2xl border border-slate-800/80">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center text-sm shrink-0">
                4
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-200">
                  {tr('استلام رمز التأكيد وتتبع الحالة', 'Obtenir un code de confirmation et suivre le statut')}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tr(
                    'سيقوم سيرفرنا بتلقي الطلب آلياً ويمسح كامل البيانات فوراً ويصدر لك رمز تأكيد فريد (Confirmation Code). يمكنك التحقق من حالة الحذف في أي وقت.',
                    'Notre serveur traitera automatiquement la demande, supprimera vos données et générera un code de confirmation unique pour le suivi.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Endpoints Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <Globe className="w-6 h-6 text-blue-400" />
            <h2 className="text-lg font-bold text-slate-100">
              {tr('روابط الربط الرسمية لـ Meta Commerce', 'URLs officielles pour l\'intégration Meta')}
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">Data Deletion Callback URL:</span>
                <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-[10px] font-mono">POST (Signed Request)</span>
              </div>
              <div className="font-mono text-emerald-400 text-xs bg-slate-900 p-2.5 rounded-xl border border-slate-800 break-all">
                {callbackUrl}
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">Data Deletion Instructions URL:</span>
                <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md text-[10px] font-mono">HTTPS GET</span>
              </div>
              <div className="font-mono text-emerald-400 text-xs bg-slate-900 p-2.5 rounded-xl border border-slate-800 break-all">
                {window.location.href}
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
            <Link
              to="/data-deletion-status"
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl text-xs transition-all shadow-lg shadow-emerald-950/50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{tr('الانتقال لصفحة استعلام حالة الحذف', 'Vérifier le statut de suppression')}</span>
            </Link>

            <a
              href="https://www.facebook.com/settings?tab=applications"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span>Facebook Apps Settings</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Alternative Support Option */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-800 text-slate-300 rounded-xl">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-200">
                {tr('هل تحتاج إلى مساعدة إضافية أو طلب حذف يدوي؟', 'Besoin d\'aide ou d\'une demande manuelle ?')}
              </h4>
              <p className="text-[11px] text-slate-400">
                {tr('يمكنك التواصل المباشر مع مسؤول الحماية عبر البريد الإلكتروني.', 'Vous pouvez contacter directement notre équipe de support.')}
              </p>
            </div>
          </div>

          <Link
            to="/support"
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl transition-colors shrink-0"
          >
            <Mail className="w-4 h-4" />
            <span>{tr('الاتصال بالدعم الفني', 'Contacter le support')}</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
