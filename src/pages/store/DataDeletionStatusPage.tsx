import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck, Search, CheckCircle2, Clock, AlertTriangle, ArrowRight,
  Copy, Check, FileText
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';

interface DeletionRecord {
  id: string;
  confirmation_code: string;
  meta_user_id: string;
  status: string;
  requested_at: string;
  completed_at: string;
  details?: Record<string, unknown>;
}

export default function DataDeletionStatusPage() {
  const { tr, isRTL } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const codeParam = searchParams.get('code') || '';

  const [inputCode, setInputCode] = useState(codeParam);
  const [record, setRecord] = useState<DeletionRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchStatus = useCallback(async (codeToSearch: string) => {
    if (!codeToSearch.trim()) return;
    setLoading(true);
    setError(null);
    setRecord(null);

    try {
      // 1. First try API endpoint
      const res = await fetch(`/api/meta/data-deletion-status?code=${encodeURIComponent(codeToSearch.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.record) {
          setRecord(data.record);
          setLoading(false);
          return;
        }
      }

      // 2. Direct Supabase RPC query fallback (never exposes meta_user_id)
      const { data, error: sbErr } = await supabase
        .rpc('get_meta_deletion_status', { p_code: codeToSearch.trim() });

      if (sbErr) {
        throw new Error(sbErr.message);
      }

      if (data && (Array.isArray(data) ? data.length > 0 : data)) {
        const item = Array.isArray(data) ? data[0] : data;
        setRecord(item as DeletionRecord);
      } else {
        setError(
          tr(
            'لم يتم العثور على طلب حذف بيانات بهذا الرمز. يرجى التأكد من الرمز وإعادة المحاولة.',
            'Aucune demande de suppression de données trouvée avec ce code. Veuillez vérifier le code.'
          )
        );
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || tr('فشل الاستعلام عن حالة الحذف.', 'Échec de la vérification du statut.'));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    if (codeParam) {
      setInputCode(codeParam);
      fetchStatus(codeParam);
    }
  }, [codeParam, fetchStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      setSearchParams({ code: inputCode.trim() });
      fetchStatus(inputCode.trim());
    }
  };

  const copyConfirmationCode = () => {
    if (record?.confirmation_code) {
      navigator.clipboard.writeText(record.confirmation_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const maskUserId = (uid: string) => {
    if (!uid || uid.length <= 6) return '****';
    return `${uid.substring(0, 3)}****${uid.substring(uid.length - 3)}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link to="/" className="hover:text-emerald-400 transition-colors">
            {tr('الرئيسية', 'Accueil')}
          </Link>
          <span>/</span>
          <Link to="/data-deletion-instructions" className="hover:text-emerald-400 transition-colors">
            {tr('تعليمات حذف البيانات', 'Instructions de suppression')}
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-semibold">{tr('حالة حذف البيانات', 'Statut de suppression')}</span>
        </div>

        {/* Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center sm:text-start">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 relative z-10">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl shrink-0">
              <ShieldCheck className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">
                {tr('التحقق من حالة حذف بيانات Meta', 'Vérification du statut de suppression des données Meta')}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {tr(
                  'أدخل رمز التأكيد الممنوح لك عند إرسال طلب حذف البيانات لمتابعة حالة معالجة البيانات وتأكيد إزالتها.',
                  'Saisissez le code de confirmation fourni lors de votre demande pour vérifier le statut de suppression de vos données.'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3.5' : 'left-3.5'} w-5 h-5 text-slate-500`} />
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder={tr('أدخل رمز التأكيد (مثال: DEL-A1B2C3D4E5F6)', 'Entrez le code (ex: DEL-A1B2C3D4E5F6)')}
                className={`w-full bg-slate-950 border border-slate-800 rounded-xl py-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none ${
                  isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !inputCode.trim()}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {loading ? tr('جاري البحث...', 'Recherche...') : tr('استعلام', 'Rechercher')}
            </button>
          </div>
        </form>

        {/* Results Display */}
        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <Clock className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <p className="text-sm text-slate-400">{tr('جاري الاستعلام عن سجلات السيرفر...', 'Vérification en cours...')}</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-rose-950/40 border border-rose-900/60 rounded-2xl p-6 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-base font-bold text-rose-200">{tr('لم يتم العثور على طلب الحذف', 'Demande non trouvée')}</h3>
            <p className="text-xs text-rose-300/80 max-w-md mx-auto">{error}</p>
          </div>
        )}

        {record && !loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            {/* Status Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs text-emerald-300 font-semibold uppercase tracking-wider">
                    {tr('حالة معالجة البيانات', 'Statut de traitement')}
                  </div>
                  <div className="text-lg font-bold text-emerald-400">
                    {record.status === 'completed'
                      ? tr('تمت عملية حذف البيانات بنجاح', 'Suppression terminée avec succès')
                      : tr('قيد المعالجة', 'En cours de traitement')}
                  </div>
                </div>
              </div>

              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-bold">
                {record.status.toUpperCase()}
              </span>
            </div>

            {/* Record Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 font-medium">{tr('رمز التأكيد الفريد', 'Code de confirmation')}</span>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-mono text-sm font-bold text-slate-100">{record.confirmation_code}</span>
                  <button
                    onClick={copyConfirmationCode}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title={tr('نسخ الرمز', 'Copier')}
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 font-medium">{tr('معرف حساب Meta / Facebook', 'ID Utilisateur Meta')}</span>
                <p className="font-mono text-xs font-bold text-emerald-400 pt-1">
                  {record.meta_user_id ? maskUserId(record.meta_user_id) : tr('محمي ومسجّل آمنًا', 'Protégé et sécurisé')}
                </p>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 font-medium">{tr('تاريخ تقديم الطلب', 'Date de la demande')}</span>
                <p className="font-mono text-xs font-semibold text-slate-200 pt-1">
                  {new Date(record.requested_at).toLocaleString()}
                </p>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 font-medium">{tr('تاريخ اكتمال المسح', 'Date de finalisation')}</span>
                <p className="font-mono text-xs font-semibold text-slate-200 pt-1">
                  {record.completed_at ? new Date(record.completed_at).toLocaleString() : '—'}
                </p>
              </div>
            </div>

            {/* Regulatory Statement */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-400 space-y-2 leading-relaxed">
              <div className="flex items-center gap-2 text-slate-200 font-bold">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>{tr('إشعار الحماية والامتثال القانوني', 'Notice de conformité & protection')}</span>
              </div>
              <p>
                {tr(
                  'وفقاً لسياسة حماية البيانات الخاصة بشركة Meta والجمهورية الجزائرية (القانون رقم 18-07 المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي)، تم مسح كافة البيانات الشخصية والرموز والربط المرتبط بحساب Meta الموضح أعلاه من قاعدة بيانات Business Market بشكل نهائي وغير قابل للاسترجاع.',
                  'Conformément aux politiques de confidentialité de Meta et aux lois sur la protection des données personnelles, toutes les données associées à ce compte Meta ont été supprimées définitivement de nos serveurs.'
                )}
              </p>
            </div>
          </div>
        )}

        {/* Helpful links */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-800">
          <Link to="/data-deletion-instructions" className="hover:text-emerald-400 flex items-center gap-1 transition-colors">
            <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? '' : 'rotate-180'}`} />
            {tr('طريقة تقديم طلب حذف آخر', 'Comment soumettre une autre demande')}
          </Link>

          <Link to="/support" className="hover:text-emerald-400 transition-colors">
            {tr('الدعم الفني والاتصال', 'Contact Support')}
          </Link>
        </div>

      </div>
    </div>
  );
}
