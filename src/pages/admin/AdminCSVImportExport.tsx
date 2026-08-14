import { useState, useRef, useEffect } from 'react';
import {
  Upload, Download, FileText, CheckCircle2, AlertTriangle, XCircle,
  Package, ShoppingBag, Users, FolderTree, Database, CreditCard,
  Truck, MapPin, Tag, BarChart3, Shield, Settings, RefreshCw,
  FileSpreadsheet, FileCode
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { Category } from '../../types';
import {
  downloadCSVTemplate,
  downloadInventoryCSVTemplate,
  importProductsFromCSV,
  importInventoryFromCSV,
  ImportProductsResult,
  exportProductsCSV,
  exportOrdersCSV,
  exportCustomersCSV,
  exportCategoriesCSV,
  exportInventoryCSV,
  exportPaymentMethodsCSV,
  exportShippingMethodsCSV,
  exportWilayasCSV,
  exportMarketingCSV,
  exportReportsCSV,
  exportAdminUsersCSV,
  exportSettingsCSV,
} from '../../lib/csvHelper';

export default function AdminCSVImportExport() {
  const { lang } = useLanguage();

  const tr = (ar: string, fr: string, en?: string) => {
    if (lang === 'ar') return ar;
    if (lang === 'fr') return fr;
    return en || fr;
  };

  // State for Import
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'templates'>('import');
  const [importType, setImportType] = useState<'products' | 'inventory'>('products');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [updateBySku, setUpdateBySku] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [autoCreateCategory, setAutoCreateCategory] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportProductsResult | null>(null);
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await supabase.from('categories').select('*').order('name_ar');
        if (data) setCategories(data as Category[]);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel') {
        setSelectedFile(file);
        setImportResult(null);
      } else {
        alert(tr('يرجى تحميل ملف بصيغة CSV فقط', 'Veuillez télécharger un fichier CSV uniquement'));
      }
    }
  };

  const startImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setProgress(0);
    setImportResult(null);

    try {
      let res: ImportProductsResult;
      if (importType === 'inventory') {
        res = await importInventoryFromCSV(selectedFile);
      } else {
        res = await importProductsFromCSV(
          selectedFile,
          { updateBySku, skipDuplicates, autoCreateCategory, selectedCategoryId },
          (p) => setProgress(p)
        );
      }
      setImportResult(res);
    } catch (err) {
      console.error('CSV Import Error:', err);
      setImportResult({
        totalParsed: 0,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        errors: [{ row: 0, error: err instanceof Error ? err.message : 'فشل استيراد ملف CSV / Failed to import CSV' }],
      });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (key: string, fn: () => Promise<void> | void) => {
    setExportingKey(key);
    try {
      await fn();
    } catch (err) {
      console.error(`Export ${key} failed:`, err);
      alert(tr(`فشل تصدير ${key}`, `Échec de l'exportation de ${key}`));
    } finally {
      setExportingKey(null);
    }
  };

  const handleExportAll = async () => {
    setExportingKey('all');
    try {
      await exportProductsCSV();
      await exportOrdersCSV();
      await exportCustomersCSV();
      await exportCategoriesCSV();
      await exportInventoryCSV();
      await exportWilayasCSV();
      await exportMarketingCSV();
      await exportReportsCSV();
    } catch (err) {
      console.error('Export all failed:', err);
    } finally {
      setExportingKey(null);
    }
  };

  const exportModules = [
    {
      key: 'products',
      title: tr('المنتجات', 'Produits', 'Products'),
      desc: tr('تصدير كافة بيانات المنتجات، الأسعار، المخزون، الفئات، الصور والباركود', 'Exporter tous les produits, prix, stock, catégories, images et codes-barres'),
      icon: Package,
      action: exportProductsCSV,
    },
    {
      key: 'orders',
      title: tr('الطلبات والمبيعات', 'Commandes & Ventes', 'Orders & Sales'),
      desc: tr('تصدير كافة الطلبات، تفاصيل الزبائن، حالة الشحن، طرق الدفع والمبالغ', 'Exporter toutes les commandes, détails clients, états de livraison et montants'),
      icon: ShoppingBag,
      action: exportOrdersCSV,
    },
    {
      key: 'customers',
      title: tr('العملاء والزبائن', 'Clients', 'Customers'),
      desc: tr('تصدير أرشيف العملاء، أرقام الهواتف، العناوين، وإحصائيات الإنفاق', 'Exporter les données clients, numéros de téléphone, adresses et statistiques'),
      icon: Users,
      action: exportCustomersCSV,
    },
    {
      key: 'categories',
      title: tr('فئات المنتجات', 'Catégories', 'Categories'),
      desc: tr('تصدير شجرة التصنيفات والروابط والوصف والترتيب', 'Exporter la hiérarchie des catégories, slugs et descriptions'),
      icon: FolderTree,
      action: exportCategoriesCSV,
    },
    {
      key: 'inventory',
      title: tr('المخزون والتقييم', 'Inventaire & Stock', 'Inventory'),
      desc: tr('تصدير تقارير المخزون الحالي، التنبيهات، والقيمة المالية الإجمالية', 'Exporter l état du stock, seuils d alerte et valeur totale en stock'),
      icon: Database,
      action: exportInventoryCSV,
    },
    {
      key: 'payment',
      title: tr('طرق الدفع', 'Moyens de Paiement', 'Payment Methods'),
      desc: tr('تصدير إعدادات طرق الدفع المتاحة (COD، Edahabia، CIB)', 'Exporter la configuration des méthodes de paiement activées'),
      icon: CreditCard,
      action: exportPaymentMethodsCSV,
    },
    {
      key: 'shipping',
      title: tr('طرق وتعريفات الشحن', 'Frais de Livraison', 'Shipping Rates'),
      desc: tr('تصدير أسعار الشحن المنزلي والمكتبي لجميع الولايات ومدد التوصيل', 'Exporter les tarifs de livraison à domicile et à domicile par wilaya'),
      icon: Truck,
      action: exportShippingMethodsCSV,
    },
    {
      key: 'wilayas',
      title: tr('الولايات الـ 58', '58 Wilayas', '58 Wilayas'),
      desc: tr('تصدير قائمة كافة الولايات الجزائرية، الرموز والمناطق الجغرافية', 'Exporter la liste complète des 58 wilayas d Algérie et régions'),
      icon: MapPin,
      action: exportWilayasCSV,
    },
    {
      key: 'marketing',
      title: tr('الكوبونات والتسويق', 'Coupons & Marketing', 'Coupons & Marketing'),
      desc: tr('تصدير قسائم التخفيض، نسبة الخصم، الحدود، والاستخدامات', 'Exporter les codes promos, réductions, limites et utilisations'),
      icon: Tag,
      action: exportMarketingCSV,
    },
    {
      key: 'reports',
      title: tr('التقارير والمؤشرات', 'Rapports & Analytics', 'Reports & Analytics'),
      desc: tr('تصدير ملخص الأداء المالي، إجمالي الأرباح، ومعدل السلة', 'Exporter le bilan financier, chiffre d affaires et panier moyen'),
      icon: BarChart3,
      action: exportReportsCSV,
    },
    {
      key: 'admin_users',
      title: tr('المسؤولون والمدراء', 'Administrateurs', 'Admin Users'),
      desc: tr('تصدير قائمة مدراء اللوحة، الأدوار والصلاحيات', 'Exporter la liste des comptes administrateurs et rôles'),
      icon: Shield,
      action: exportAdminUsersCSV,
    },
    {
      key: 'settings',
      title: tr('إعدادات النظام', 'Paramètres Système', 'System Settings'),
      desc: tr('تصدير متغيرات المتجر، المعلومات العامة والإعدادات الهيكلية', 'Exporter la configuration générale de la boutique'),
      icon: Settings,
      action: exportSettingsCSV,
    },
  ];

  return (
    <div className="space-y-6 text-slate-100">
      {/* Top Header Banner */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-6 text-slate-100 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shadow-inner">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">
                {tr('نظام استيراد وتصدير البيانات (CSV)', 'Système d Importation & Exportation CSV', 'CSV Import & Export System')}
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                {tr(
                  'استورد آلاف المنتجات وحدث المخزون بسرعة، أو قم بتصدير كافة بيانات المتجر بضغطة زر بدعم كامل للغة العربية UTF-8.',
                  'Importez des milliers de produits ou exportez toutes les données en un clic avec support complet de l arabe (UTF-8).'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleExportAll}
            disabled={exportingKey === 'all'}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {exportingKey === 'all' ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {tr('تصدير كافة البيانات (CSV)', 'Tout Exporter (CSV Bundle)')}
          </button>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-800/80 pt-4">
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
              activeTab === 'import'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Upload className="h-4 w-4" />
            {tr('استيراد المنتجات (CSV Import)', 'Importation Produits (CSV)')}
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
              activeTab === 'export'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Download className="h-4 w-4" />
            {tr('تصدير كافة البيانات (CSV Export)', 'Exportation des Données')}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
              activeTab === 'templates'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <FileCode className="h-4 w-4" />
            {tr('نماذج CSV الجاهزة', 'Modèles & Templates CSV')}
          </button>
        </div>
      </div>

      {/* TAB 1: CSV IMPORT PRODUCTS */}
      {activeTab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Upload className="h-5 w-5 text-emerald-400" />
                  {tr('رفع ملف CSV للرفع إلى داتا بيس', 'Téléverser le fichier CSV')}
                </h2>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setImportType('products')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      importType === 'products'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tr('دليل المنتجات', 'Catalogue Produits')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportType('inventory')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      importType === 'inventory'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tr('تعديل المخزون والكميات', 'Ajustement Stock')}
                  </button>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition ${
                  selectedFile
                    ? 'border-emerald-800/80 bg-emerald-950/30'
                    : 'border-slate-800 bg-slate-950/50 hover:border-emerald-500/60 hover:bg-slate-950'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,text/csv,application/vnd.ms-excel"
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950 text-emerald-400 border border-emerald-800">
                      <FileSpreadsheet className="h-8 w-8" />
                    </div>
                    <p className="font-bold text-slate-100 text-base">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB — {tr('جاهز للاستيراد', 'Prêt pour l importation')}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setImportResult(null);
                      }}
                      className="mt-2 text-xs text-rose-400 hover:text-rose-300 underline font-medium cursor-pointer"
                    >
                      {tr('تغيير الملف', 'Changer le fichier')}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 transition group-hover:scale-110">
                      <Upload className="h-7 w-7" />
                    </div>
                    <p className="font-bold text-slate-200 text-sm">
                      {tr('أسقط ملف CSV هنا أو انقر للاختيار من جهازك', 'Déposez votre fichier CSV ici ou cliquez pour parcourir')}
                    </p>
                    <p className="text-xs text-slate-400">
                      {tr('يدعم الاستيراد الجماعي لآلاف المنتجات مع دعم كامل للترميز UTF-8 واللغة العربية', 'Prend en charge des milliers de lignes en UTF-8')}
                    </p>
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="mt-6 space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {tr('خيارات معالجة استيراد المنتجات', 'Options de traitement des doublons')}
                </h3>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateBySku}
                    onChange={(e) => {
                      setUpdateBySku(e.target.checked);
                      if (e.target.checked) setSkipDuplicates(false);
                    }}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-950 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-300">
                    {tr('تحديث بيانات المنتجات الموجودة مطابقة بـ SKU', 'Mettre à jour les produits existants selon le SKU')}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => {
                      setSkipDuplicates(e.target.checked);
                      if (e.target.checked) setUpdateBySku(false);
                    }}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-950 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-300">
                    {tr('تجاهل المنتجات المكررة الموجودة مسبقاً', 'Ignorer les doublons (si le SKU existe déjà)')}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateCategory}
                    onChange={(e) => setAutoCreateCategory(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-950 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-300">
                    {tr('إنشاء الفئات تلقائياً في حال عدم وجودها بنفس الاسم', 'Créer automatiquement les nouvelles catégories si introuvables')}
                  </span>
                </label>

                <div className="pt-3 border-t border-slate-800/80">
                  <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-2">
                    <FolderTree className="h-4 w-4 text-emerald-400" />
                    {tr('تحديد الفئة المستهدفة لجميع المنتجات المستوردة (اختياري)', 'Sélectionner la catégorie cible pour tous les produits importés (Optionnel)')}
                  </label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 focus:border-emerald-500 focus:outline-none transition cursor-pointer"
                  >
                    <option value="">
                      {tr('-- التحديد التلقائي حسب ملف CSV --', '-- Automatique depuis le fichier CSV --')}
                    </option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name_ar || cat.name_fr} {cat.name_fr && cat.name_ar && cat.name_fr !== cat.name_ar ? `(${cat.name_fr})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {tr(
                      'عند تحديد فئة معينة هنا، سيتم إسناد كافة المنتجات المستوردة من هذا الملف إلى هذه الفئة تلقائياً.',
                      'Toutes les lignes de produits importées seront automatiquement liées à la catégorie sélectionnée ci-dessus.'
                    )}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              {importing && (
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-emerald-400">
                    <span>{tr('جاري استيراد ومعالجة البيانات...', 'Importation en cours...')}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Start Import Button */}
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => downloadCSVTemplate('products')}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  {tr('تحميل نموذج المنتجات CSV', 'Télécharger Modèle CSV')}
                </button>
                <button
                  type="button"
                  onClick={startImport}
                  disabled={!selectedFile || importing}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  {importing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {tr('بدء الاستيراد الفوري', 'Lancer l Importation')}
                </button>
              </div>
            </div>

            {/* Import Results Summary Box */}
            {importResult && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-md space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    {tr('نتائج وملخص عملية الاستيراد', 'Résultats de l Importation')}
                  </h3>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-950 text-slate-400 border border-slate-800">
                    {importResult.totalParsed} {tr('صف تم تفحصه', 'lignes analysées')}
                  </span>
                </div>

                {/* Metrics stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-xl bg-emerald-950/60 p-4 border border-emerald-800/60 text-emerald-300">
                    <p className="text-xs font-medium text-emerald-400">{tr('تمت إضافتها جديداً', 'Ajoutés')}</p>
                    <p className="text-2xl font-extrabold text-emerald-100 mt-1">{importResult.insertedCount}</p>
                  </div>
                  <div className="rounded-xl bg-blue-950/60 p-4 border border-blue-800/60 text-blue-300">
                    <p className="text-xs font-medium text-blue-400">{tr('تم تحديثها بـ SKU', 'Mis à jour')}</p>
                    <p className="text-2xl font-extrabold text-blue-100 mt-1">{importResult.updatedCount}</p>
                  </div>
                  <div className="rounded-xl bg-amber-950/60 p-4 border border-amber-800/60 text-amber-300">
                    <p className="text-xs font-medium text-amber-400">{tr('تم تجاهلها', 'Ignorés')}</p>
                    <p className="text-2xl font-extrabold text-amber-100 mt-1">{importResult.skippedCount}</p>
                  </div>
                  <div className="rounded-xl bg-rose-950/60 p-4 border border-rose-800/60 text-rose-300">
                    <p className="text-xs font-medium text-rose-400">{tr('أخطاء الصفوف', 'Erreurs')}</p>
                    <p className="text-2xl font-extrabold text-rose-100 mt-1">{importResult.errorCount}</p>
                  </div>
                </div>

                {/* Detailed Errors Table */}
                {importResult.errors.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      {tr('تفاصيل الأخطاء والصفوف التي تعذر استيرادها:', 'Détails des erreurs lors de l importation :')}
                    </h4>
                    <div className="max-h-60 overflow-y-auto rounded-xl border border-rose-800/60 bg-rose-950/30 p-3 text-xs space-y-2">
                      {importResult.errors.map((err, idx) => (
                        <div key={idx} className="flex items-start gap-2 bg-slate-950 p-2.5 rounded-lg border border-rose-800/60 text-rose-300">
                          <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">
                              {err.row > 0 ? `${tr('الصف', 'Ligne')} #${err.row}` : ''} {(err as { sku?: string }).sku ? `(SKU: ${(err as { sku?: string }).sku})` : ''}:
                            </span>{' '}
                            <span>{err.error}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Info Box */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-md space-y-4">
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-400" />
                {tr('دليل أفق أعمدة ملف CSV', 'Structure requise du fichier CSV')}
              </h3>

              <p className="text-xs text-slate-400 leading-relaxed">
                {tr(
                  'يتعرف النظام تلقائياً على العناوين باللغة العربية والفرنسية والإنجليزية. يُنصح باستخدام الأعمدة التالية لضمان الاستيراد الكامل:',
                  'Le système détecte automatiquement les entêtes en Arabe, Français et Anglais :'
                )}
              </p>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="font-bold text-emerald-400">SKU</span>
                  <span className="text-slate-400 font-mono text-[11px] block mt-0.5">SKU / Code / Barcode</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="font-bold text-emerald-400">Name (Arabic / French)</span>
                  <span className="text-slate-400 font-mono text-[11px] block mt-0.5">Name (Arabic) / Name (French) / Product Name</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="font-bold text-emerald-400">Price & Compare Price</span>
                  <span className="text-slate-400 font-mono text-[11px] block mt-0.5">Price (DZD) / Sale Price (DZD) / Cost Price</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="font-bold text-emerald-400">Stock & Category</span>
                  <span className="text-slate-400 font-mono text-[11px] block mt-0.5">Stock Quantity / Category Name / Brand</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="font-bold text-emerald-400">Images & Barcode</span>
                  <span className="text-slate-400 font-mono text-[11px] block mt-0.5">Image URLs (مفصولة بفواصل) / Barcode</span>
                </div>
              </div>

              <div className="rounded-xl bg-amber-950/40 p-3 border border-amber-800/60 text-xs text-amber-300 leading-relaxed">
                <strong>{tr('ملاحظة هامة:', 'Note importante :')}</strong> {tr('يمكنك استخدام نموذج CSV الجاهز بالنقر على زر تحميل النموذج لتفادي أي أخطاء في العناوين.', 'Utilisez notre modèle pré-formaté pour éviter toute erreur de syntaxe.')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPORT ALL DATA */}
      {activeTab === 'export' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100">
              {tr('اختر القسم لتصدير ملف CSV مباشرة', 'Sélectionnez un module à exporter en CSV')}
            </h2>
            <span className="text-xs text-slate-400">
              {tr('ترميز UTF-8 مع BOM لدعم اللغة العربية في Excel', 'Format UTF-8 BOM compatible Microsoft Excel')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {exportModules.map((m) => {
              const Icon = m.icon;
              const isExporting = exportingKey === m.key;

              return (
                <div
                  key={m.key}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm transition hover:border-emerald-500/50 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-800/60 bg-emerald-950/80 text-emerald-400">
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-mono font-semibold text-slate-500 uppercase">CSV</span>
                    </div>
                    <h3 className="font-bold text-slate-100 text-base">{m.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">{m.desc}</p>
                  </div>

                  <div className="mt-5 border-t border-slate-800/80 pt-3">
                    <button
                      onClick={() => handleExport(m.key, m.action)}
                      disabled={isExporting}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-emerald-600 hover:text-white hover:border-emerald-600 disabled:opacity-50 cursor-pointer"
                    >
                      {isExporting ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {tr('تصدير CSV', 'Exporter CSV')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: DOWNLOAD CSV TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-md space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {tr('نماذج ملفات CSV المجهزة مسبقاً للاستيراد', 'Modèles CSV pré-formatés à télécharger')}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {tr('قم بتحميل النموذج المناسب، وافتح الملف لتعبئة منتجاتك أو بياناتك بنفس التنسيق ثم أعد رفعه للنظام.', 'Téléchargez un modèle, complétez vos données et importez le fichier.')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">{tr('نموذج استيراد المنتجات', 'Modèle Produits')}</h3>
                  <p className="text-xs text-slate-400">Includes SKU, Prices, Stock, Arabic/French names</p>
                </div>
              </div>
              <button
                onClick={() => downloadCSVTemplate('products')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Download className="h-4 w-4" />
                {tr('تحميل نموذج المنتجات', 'Télécharger Modèle CSV')}
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  <FolderTree className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">{tr('نموذج استيراد الفئات', 'Modèle Catégories')}</h3>
                  <p className="text-xs text-slate-400">Includes Category Slugs, Names, Sort order</p>
                </div>
              </div>
              <button
                onClick={() => downloadCSVTemplate('categories')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Download className="h-4 w-4" />
                {tr('تحميل نموذج الفئات', 'Télécharger Modèle CSV')}
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">{tr('نموذج استيراد العملاء', 'Modèle Clients')}</h3>
                  <p className="text-xs text-slate-400">Includes Names, Phone, Email, Segment, Wilaya</p>
                </div>
              </div>
              <button
                onClick={() => downloadCSVTemplate('customers')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Download className="h-4 w-4" />
                {tr('تحميل نموذج العملاء', 'Télécharger Modèle CSV')}
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">{tr('نموذج تعديل المخزون والكميات', 'Modèle Ajustement Stock')}</h3>
                  <p className="text-xs text-slate-400">Includes SKU, Warehouse Code, Quantity, Movement Type</p>
                </div>
              </div>
              <button
                onClick={() => downloadInventoryCSVTemplate()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Download className="h-4 w-4" />
                {tr('تحميل نموذج تعديل المخزون', 'Télécharger Modèle CSV Stock')}
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">{tr('نموذج الولايات وتعاريف الشحن', 'Modèle Wilayas')}</h3>
                  <p className="text-xs text-slate-400">Includes Wilaya Codes, Prices & Delivery Days</p>
                </div>
              </div>
              <button
                onClick={() => downloadCSVTemplate('wilayas')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Download className="h-4 w-4" />
                {tr('تحميل نموذج الولايات', 'Télécharger Modèle CSV')}
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">{tr('نموذج الكوبونات والتخفيضات', 'Modèle Coupons')}</h3>
                  <p className="text-xs text-slate-400">Includes Coupon Code, Discount, Min Order Amount</p>
                </div>
              </div>
              <button
                onClick={() => downloadCSVTemplate('coupons')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Download className="h-4 w-4" />
                {tr('تحميل نموذج الكوبونات', 'Télécharger Modèle CSV')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
