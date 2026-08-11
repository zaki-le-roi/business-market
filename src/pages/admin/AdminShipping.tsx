import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Truck,
  Loader2,
  Search,
  RefreshCw,
  FileText,
  Printer,
  MapPin,
  CheckCircle2,
  DollarSign,
  Building2,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  Download,
  Upload,
  FileSpreadsheet,
  Check,
  XCircle,
  AlertCircle,
  Info,
  FileCheck
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getShippingProviders,
  createShippingProvider,
  deleteShippingProvider,
  updateShippingProvider,
  batchUpsertShippingProviders,
  getShippingRates,
  upsertShippingRate,
  getShippingSettings,
  updateShippingSettings,
  getShipments,
  getShipmentTrackingEvents,
  updateShipmentStatus,
  createShippingManifest,
  getShippingManifests,
  getTreasuryAccounts,
  createCodSettlement,
  reconcileCodSettlement,
  getCodSettlements
} from '../../lib/shipping/manager';
import {
  ShippingProvider,
  ShippingRate,
  ShippingSettings,
  ShippingManifest,
  Shipment,
  ShipmentTrackingEvent,
  TreasuryAccount,
  CodSettlement,
  ShipmentStatus
} from '../../lib/shipping/types';

export default function AdminShipping() {
  const { lang, formatPrice } = useLanguage();
  const { showToast } = useToast();

  const tr = (ar: string, fr: string, en?: string) => {
    if (lang === 'ar') return ar;
    if (lang === 'fr') return fr;
    return en || fr;
  };

  // Active Tab State
  const [activeTab, setActiveTab] = useState<
    'providers' | 'rates' | 'manifests' | 'shipments' | 'cod' | 'settings'
  >('providers');

  // Loading state
  const [loading, setLoading] = useState(true);

  // Data States
  const [providers, setProviders] = useState<ShippingProvider[]>([]);
  const [providersDbError, setProvidersDbError] = useState<string | null>(null);
  const [rates, setRates] = useState<(ShippingRate & { wilaya_name_ar?: string; wilaya_name_fr?: string; wilaya_code?: string })[]>([]);
  const [manifests, setManifests] = useState<(ShippingManifest & { provider_name_ar?: string; provider_name_fr?: string })[]>([]);
  const [shipments, setShipments] = useState<(Shipment & { order_number?: string; provider_name_ar?: string; provider_name_fr?: string })[]>([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([]);
  const [codSettlements, setCodSettlements] = useState<(CodSettlement & { provider_name_ar?: string; provider_name_fr?: string; treasury_name_ar?: string })[]>([]);
  const [settings, setSettings] = useState<ShippingSettings | null>(null);

  // Search & Filters
  const [providerSearch, setProviderSearch] = useState('');
  const [rateWilayaSearch, setRateWilayaSearch] = useState('');
  const [rateProviderFilter, setRateProviderFilter] = useState('all');
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Selected Items for Manifest / COD Settlement
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);

  // Modals & Tracking view
  const [selectedShipmentForTracking, setSelectedShipmentForTracking] = useState<Shipment | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<ShipmentTrackingEvent[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);

  // Manifest Creation Modal
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [manifestProviderId, setManifestProviderId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [manifestNotes, setManifestNotes] = useState('');
  const [creatingManifest, setCreatingManifest] = useState(false);

  // Rate Editing Modal
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null);
  const [editHomeFee, setEditHomeFee] = useState<number>(600);
  const [editDeskFee, setEditDeskFee] = useState<number>(400);
  const [editReturnFee, setEditReturnFee] = useState<number>(200);

  // COD Settlement Modal
  const [showCodModal, setShowCodModal] = useState(false);
  const [codProviderId, setCodProviderId] = useState('');
  const [creatingCodSettlement, setCreatingCodSettlement] = useState(false);

  // Add Provider Modal State
  const [showAddProviderModal, setShowAddProviderModal] = useState(false);
  const [newProviderForm, setNewProviderForm] = useState({
    code: '',
    name_ar: '',
    name_fr: '',
    supports_home_delivery: true,
    supports_stop_desk: true,
    supports_cod: true,
    tracking_url_template: ''
  });
  const [creatingProvider, setCreatingProvider] = useState(false);

  // Edit Provider Modal State
  const [editingProvider, setEditingProvider] = useState<ShippingProvider | null>(null);
  const [editProviderForm, setEditProviderForm] = useState({
    id: '',
    code: '',
    name_ar: '',
    name_fr: '',
    supports_home_delivery: true,
    supports_stop_desk: true,
    supports_cod: true,
    tracking_url_template: ''
  });
  const [updatingProvider, setUpdatingProvider] = useState(false);

  // CSV Import / Export State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvRawFile, setCsvRawFile] = useState<File | null>(null);
  const [parsedCsvRows, setParsedCsvRows] = useState<
    Array<{
      rowIndex: number;
      code: string;
      name_ar: string;
      name_fr: string;
      supports_home_delivery: boolean;
      supports_stop_desk: boolean;
      supports_cod: boolean;
      tracking_url_template: string;
      is_valid: boolean;
      is_update: boolean;
      error_reason?: string;
    }>
  >([]);
  const [isImporting, setIsImporting] = useState(false);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!providers || providers.length === 0) {
      showToast(
        tr('لا توجد شركات شحن مضافة للتصدير', 'Aucun transporteur à exporter', 'No shipping providers available for export'),
        'error'
      );
      return;
    }

    const headers = [
      'code',
      'name_ar',
      'name_fr',
      'supports_home_delivery',
      'supports_stop_desk',
      'supports_cod',
      'is_active',
      'is_default',
      'tracking_url_template'
    ];

    const escapeCsv = (val: string | number | boolean | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [headers.join(',')];

    providers.forEach((p) => {
      const row = [
        escapeCsv(p.code),
        escapeCsv(p.name_ar),
        escapeCsv(p.name_fr),
        escapeCsv(p.supports_home_delivery ?? true),
        escapeCsv(p.supports_stop_desk ?? true),
        escapeCsv(p.supports_cod ?? true),
        escapeCsv(p.is_active ?? true),
        escapeCsv(p.is_default ?? false),
        escapeCsv(p.tracking_url_template || '')
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `shipping_providers_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(
      tr('تم تصدير شركات الشحن بنجاح!', 'Transporteurs exportés avec succès !', 'Shipping providers exported successfully!'),
      'success'
    );
  };

  // CSV Template Download Handler
  const handleDownloadTemplate = () => {
    const headers = [
      'code',
      'name_ar',
      'name_fr',
      'supports_home_delivery',
      'supports_stop_desk',
      'supports_cod',
      'tracking_url_template'
    ];

    const csvContent = '\uFEFF' + headers.join(',') + '\r\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'shipping_providers_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(tr('تم تحميل قالب CSV بنجاح', 'Modèle CSV téléchargé avec succès', 'CSV template downloaded successfully'), 'success');
  };

  // Helper function to safely parse a CSV line accounting for quotes
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // File Select & Validation Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      showToast(tr('يرجى اختيار ملف بصيغة CSV (.csv) فقط', 'Veuillez sélectionner un fichier CSV (.csv)', 'Please select a .csv file only'), 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let content = (event.target?.result as string) || '';
        if (content.startsWith('\uFEFF')) {
          content = content.slice(1);
        }

        const rawLines = content.split(/\r\n|\n|\r/);
        const lines = rawLines.filter((l) => l.trim().length > 0);

        if (lines.length < 2) {
          showToast(tr('ملف CSV فارغ أو لا يحتوي على بيانات', 'Le fichier CSV est vide', 'CSV file is empty or has no data'), 'error');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/^["']|["']$/g, '').trim());

        const codeIdx = headers.indexOf('code');
        const nameArIdx = headers.indexOf('name_ar');
        const nameFrIdx = headers.indexOf('name_fr');

        if (codeIdx === -1 || nameArIdx === -1 || nameFrIdx === -1) {
          showToast(
            tr(
              'عناوين الأعمدة غير صالحة. الأعمدة المطلوبة: code, name_ar, name_fr',
              'En-têtes CSV invalides. Colonnes requises: code, name_ar, name_fr',
              'Invalid CSV headers. Required columns: code, name_ar, name_fr'
            ),
            'error'
          );
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const homeIdx = headers.indexOf('supports_home_delivery');
        const deskIdx = headers.indexOf('supports_stop_desk');
        const codIdx = headers.indexOf('supports_cod');
        const trackIdx = headers.indexOf('tracking_url_template');

        const existingCodes = new Set(providers.map((p) => p.code.toLowerCase()));
        const seenCodesInFile = new Set<string>();

        const rows: Array<{
          rowIndex: number;
          code: string;
          name_ar: string;
          name_fr: string;
          supports_home_delivery: boolean;
          supports_stop_desk: boolean;
          supports_cod: boolean;
          tracking_url_template: string;
          is_valid: boolean;
          is_update: boolean;
          error_reason?: string;
        }> = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;

          const cols = parseCSVLine(line);
          const rawCode = (cols[codeIdx] || '').trim();
          const rawNameAr = (cols[nameArIdx] || '').trim();
          const rawNameFr = (cols[nameFrIdx] || '').trim();

          const formattedCode = rawCode.toLowerCase().replace(/\s+/g, '_');

          let isValid = true;
          let errorReason = '';

          if (!formattedCode) {
            isValid = false;
            errorReason = tr('كود الشركة مطلوب', 'Code requis', 'Provider code is required');
          } else if (!rawNameAr) {
            isValid = false;
            errorReason = tr('الاسم بالعربية مطلوب', 'Nom en arabe requis', 'Arabic name is required');
          } else if (!rawNameFr) {
            isValid = false;
            errorReason = tr('الاسم بالفرنسية مطلوب', 'Nom en français requis', 'French name is required');
          } else if (seenCodesInFile.has(formattedCode)) {
            isValid = false;
            errorReason = tr('كود مكرر داخل هذا الملف', 'Code dupliqué dans ce fichier', 'Duplicate code inside file');
          }

          if (formattedCode) {
            seenCodesInFile.add(formattedCode);
          }

          const parseBool = (idx: number, defVal: boolean) => {
            if (idx === -1 || idx >= cols.length || !cols[idx]) return defVal;
            const v = cols[idx].toLowerCase().trim();
            return ['true', '1', 'yes', 'y', 'نعم', 'vrai'].includes(v);
          };

          const isUpdate = existingCodes.has(formattedCode);

          rows.push({
            rowIndex: i + 1,
            code: formattedCode,
            name_ar: rawNameAr,
            name_fr: rawNameFr,
            supports_home_delivery: parseBool(homeIdx, true),
            supports_stop_desk: parseBool(deskIdx, true),
            supports_cod: parseBool(codIdx, true),
            tracking_url_template: trackIdx !== -1 && trackIdx < cols.length ? (cols[trackIdx] || '').trim() : '',
            is_valid: isValid,
            is_update: isUpdate,
            error_reason: errorReason
          });
        }

        setParsedCsvRows(rows);
        setCsvRawFile(file);
        setShowImportModal(true);
      } catch (err) {
        console.error('CSV Parse Error:', err);
        showToast(tr('فشل قراءة ملف CSV', 'Échec de la lecture du fichier CSV', 'Failed to read CSV file'), 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Confirm Import Handler
  const handleConfirmImport = async () => {
    const validRows = parsedCsvRows.filter((r) => r.is_valid);
    if (validRows.length === 0) {
      showToast(tr('لا توجد أي صفوف صالحة للاستيراد', 'Aucune ligne valide à importer', 'No valid rows to import'), 'error');
      return;
    }

    setIsImporting(true);
    try {
      const payloads = validRows.map((r) => ({
        code: r.code,
        name_ar: r.name_ar,
        name_fr: r.name_fr,
        supports_home_delivery: r.supports_home_delivery,
        supports_stop_desk: r.supports_stop_desk,
        supports_cod: r.supports_cod,
        is_active: true,
        tracking_url_template: r.tracking_url_template
      }));

      const res = await batchUpsertShippingProviders(payloads);

      if (res.success) {
        showToast(
          tr(
            `تم استيراد ${res.insertedCount} شركة بنجاح وتحديث قاعدة البيانات!`,
            `${res.insertedCount} transporteurs importés avec succès !`,
            `Successfully imported ${res.insertedCount} providers!`
          ),
          'success'
        );
        setShowImportModal(false);
        setParsedCsvRows([]);
        setCsvRawFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadAllData(); // Re-fetch directly from Supabase
      } else {
        showToast(tr(`فشل الاستيراد في Supabase: ${res.error || ''}`, `Échec de l'importation: ${res.error || ''}`), 'error');
      }
    } catch (err: unknown) {
      const e = err as Error;
      showToast(tr(`خطأ في العملية: ${e.message}`, `Erreur: ${e.message}`), 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const openEditProviderModal = (provider: ShippingProvider) => {
    setEditingProvider(provider);
    setEditProviderForm({
      id: provider.id,
      code: provider.code,
      name_ar: provider.name_ar,
      name_fr: provider.name_fr,
      supports_home_delivery: provider.supports_home_delivery ?? true,
      supports_stop_desk: provider.supports_stop_desk ?? true,
      supports_cod: provider.supports_cod ?? true,
      tracking_url_template: provider.tracking_url_template || ''
    });
  };

  const handleEditProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProviderForm.name_ar || !editProviderForm.name_fr) {
      showToast(tr('يرجى ملء جميع الحقول المطلوبة', 'Veuillez remplir tous les champs requis'), 'error');
      return;
    }
    setUpdatingProvider(true);
    const res = await updateShippingProvider(editProviderForm.id, {
      name_ar: editProviderForm.name_ar,
      name_fr: editProviderForm.name_fr,
      supports_home_delivery: editProviderForm.supports_home_delivery,
      supports_stop_desk: editProviderForm.supports_stop_desk,
      supports_cod: editProviderForm.supports_cod,
      tracking_url_template: editProviderForm.tracking_url_template
    });
    setUpdatingProvider(false);
    if (res.success) {
      showToast(tr('تم تحديث بيانات شركة الشحن بنجاح!', 'Transporteur mis à jour avec succès !'), 'success');
      setEditingProvider(null);
      loadAllData();
    } else {
      showToast(tr(`فشل التحديث: ${res.error || ''}`, `Échec de la mise à jour: ${res.error || ''}`), 'error');
    }
  };

  const handleAddProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProviderForm.code || !newProviderForm.name_ar || !newProviderForm.name_fr) {
      showToast(tr('يرجى ملء جميع الحقول المطلوبة', 'Veuillez remplir tous les champs requis'), 'error');
      return;
    }
    setCreatingProvider(true);
    const res = await createShippingProvider(newProviderForm);
    setCreatingProvider(false);
    if (res.success) {
      showToast(tr('تمت إضافة شركة الشحن بنجاح!', 'Transporteur ajouté avec succès !'), 'success');
      setShowAddProviderModal(false);
      setNewProviderForm({
        code: '',
        name_ar: '',
        name_fr: '',
        supports_home_delivery: true,
        supports_stop_desk: true,
        supports_cod: true,
        tracking_url_template: ''
      });
      loadAllData();
    } else {
      showToast(tr(`فشل إضافة الشركة: ${res.error || ''}`, `Échec de l'ajout: ${res.error || ''}`), 'error');
    }
  };

  const handleDeleteProvider = async (id: string, name: string) => {
    if (!window.confirm(tr(`هل أنت تأكد من حذف شركة الشحن "${name}"؟`, `Voulez-vous vraiment supprimer le transporteur "${name}" ?`))) return;
    const res = await deleteShippingProvider(id);
    if (res.success) {
      showToast(tr('تم حذف شركة الشحن بنجاح', 'Transporteur supprimé'), 'success');
      loadAllData();
    } else {
      showToast(tr(`فشل الحذف: ${res.error || ''}`, `Échec de la suppression: ${res.error || ''}`), 'error');
    }
  };

  // 1. Load Data from Supabase
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [provsRes, rts, manifs, ships, treas, cods, sets] = await Promise.all([
        getShippingProviders(),
        getShippingRates(),
        getShippingManifests(),
        getShipments(),
        getTreasuryAccounts(),
        getCodSettlements(),
        getShippingSettings()
      ]);

      if (provsRes.error) {
        setProvidersDbError(provsRes.error);
        setProviders([]);
      } else {
        setProvidersDbError(null);
        setProviders(provsRes.providers);
      }

      setRates(rts);
      setManifests(manifs);
      setShipments(ships);
      setTreasuryAccounts(treas);
      setCodSettlements(cods);
      setSettings(sets);

      if (provsRes.providers && provsRes.providers.length > 0) {
        setManifestProviderId(provsRes.providers[0].id);
        setCodProviderId(provsRes.providers[0].id);
      }
    } catch (err) {
      console.error('Error loading shipping data:', err);
      showToast('Error loading shipping data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handle Provider Toggle
  const handleToggleProvider = async (provider: ShippingProvider) => {
    const res = await updateShippingProvider(provider.id, { is_active: !provider.is_active });
    if (res.success) {
      showToast(tr('تم تحديث حالة مزود الشحن', 'Statut du transporteur mis à jour'), 'success');
      loadAllData();
    } else {
      showToast(tr(`فشل تحديث الحالة: ${res.error || ''}`, `Échec de la mise à jour: ${res.error || ''}`), 'error');
    }
  };

  // Handle Default Provider Change
  const handleSetDefaultProvider = async (providerId: string) => {
    let hasError = false;
    for (const p of providers) {
      const res = await updateShippingProvider(p.id, { is_default: p.id === providerId });
      if (!res.success) {
        hasError = true;
        showToast(tr(`فشل تعيين الافتراضي: ${res.error || ''}`, `Échec de la mise à jour: ${res.error || ''}`), 'error');
        break;
      }
    }
    if (!hasError) {
      await updateShippingSettings({ default_provider_id: providerId });
      showToast(tr('تم تعيين مزود الشحن الافتراضي بنجاح', 'Transporteur par défaut mis à jour'), 'success');
      loadAllData();
    }
  };

  // Handle Rate Update
  const handleSaveRate = async () => {
    if (!editingRate) return;
    const success = await upsertShippingRate({
      provider_id: editingRate.provider_id,
      wilaya_id: editingRate.wilaya_id,
      home_fee: editHomeFee,
      desk_fee: editDeskFee,
      return_fee: editReturnFee
    });

    if (success) {
      showToast(tr('تم حفظ أسعار الشحن بنجاح', 'Tarifs de livraison enregistrés'), 'success');
      setEditingRate(null);
      loadAllData();
    } else {
      showToast(tr('فشل حفظ الأسعار', 'Échec de l\'enregistrement des tarifs'), 'error');
    }
  };

  // Handle Status Update via RPC (Stock-Safe & Idempotent)
  const handleUpdateShipmentStatus = async (shipmentId: string, newStatus: ShipmentStatus) => {
    const res = await updateShipmentStatus(shipmentId, newStatus, 'Admin Operations', `Status updated to ${newStatus}`, 'Admin');
    if (res.success) {
      if (res.stockRestored) {
        showToast(tr('تم تحديث حالة الشحنة واسترجاع المخزون بنجاح!', 'Statut mis à jour et stock réintégré !'), 'success');
      } else {
        showToast(tr('تم تحديث حالة الشحنة بنجاح', 'Statut de la livraison mis à jour'), 'success');
      }
      loadAllData();
      if (selectedShipmentForTracking?.id === shipmentId) {
        loadTrackingEvents(shipmentId);
      }
    } else {
      showToast(tr(`فشل تحديث حالة الشحنة: ${res.error || ''}`, `Échec du changement de statut: ${res.error || ''}`), 'error');
    }
  };

  // View Tracking Timeline
  const loadTrackingEvents = async (shipmentId: string) => {
    setLoadingTracking(true);
    const evs = await getShipmentTrackingEvents(shipmentId);
    setTrackingEvents(evs);
    setLoadingTracking(false);
  };

  // Handle Manifest Creation
  const handleCreateManifest = async () => {
    if (selectedShipmentIds.length === 0) {
      showToast(tr('يرجى تحديد شحنة واحدة على الأقل للمانفيست', 'Veuillez sélectionner au moins un colis'), 'error');
      return;
    }
    if (!manifestProviderId) {
      showToast(tr('يرجى تحديد شركة الشحن', 'Veuillez choisir un transporteur'), 'error');
      return;
    }

    setCreatingManifest(true);
    const manifest = await createShippingManifest(
      manifestProviderId,
      selectedShipmentIds,
      { driverName, driverPhone, vehiclePlate, notes: manifestNotes },
      'Admin'
    );

    setCreatingManifest(false);
    if (manifest) {
      showToast(tr(`تم إنشاء المانفيست ${manifest.manifest_number} بنجاح!`, `Manifeste ${manifest.manifest_number} créé !`), 'success');
      setShowManifestModal(false);
      setSelectedShipmentIds([]);
      setDriverName('');
      setDriverPhone('');
      setVehiclePlate('');
      setManifestNotes('');
      loadAllData();
    } else {
      showToast(tr('فشل إنشاء المانفيست', 'Échec de la création du manifeste'), 'error');
    }
  };

  // Handle COD Settlement Creation
  const handleCreateCodSettlement = async () => {
    if (selectedShipmentIds.length === 0) {
      showToast(tr('يرجى تحديد الشحنات المسلمة للتسوية', 'Veuillez sélectionner les colis livrés'), 'error');
      return;
    }
    setCreatingCodSettlement(true);
    const settlement = await createCodSettlement(codProviderId, selectedShipmentIds);
    setCreatingCodSettlement(false);

    if (settlement) {
      showToast(tr(`تم إنشاء تسوية الدفع ${settlement.settlement_number} بنجاح`, `Règlement COD ${settlement.settlement_number} créé`), 'success');
      setShowCodModal(false);
      setSelectedShipmentIds([]);
      loadAllData();
    } else {
      showToast(tr('فشل إنشاء التسوية', 'Échec de la création du règlement'), 'error');
    }
  };

  // Handle COD Reconciliation & Deposit into Treasury
  const handleReconcileCod = async (settlementId: string, treasuryAccountId: string) => {
    const res = await reconcileCodSettlement(settlementId, treasuryAccountId, 'Admin');
    if (res.success) {
      showToast(tr(`تم إيداع مبلغ ${formatPrice(res.netPayout || 0)} في الخزينة وتحديث الماليّة!`, `Versé au compte trésorerie: ${formatPrice(res.netPayout || 0)}`), 'success');
      loadAllData();
    } else {
      showToast(tr(`فشل إيداع التسوية: ${res.error || ''}`, `Échec du dépôt: ${res.error || ''}`), 'error');
    }
  };

  // Handle Settings Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    const success = await updateShippingSettings(settings);
    if (success) {
      showToast(tr('تم حفظ إعدادات الشحن العامة بنجاح', 'Paramètres de livraison enregistrés'), 'success');
      loadAllData();
    } else {
      showToast(tr('فشل حفظ الإعدادات', 'Échec de l\'enregistrement des paramètres'), 'error');
    }
  };

  // Filtered Lists
  const filteredProviders = providers.filter(p =>
    (p.name_ar || '').toLowerCase().includes(providerSearch.toLowerCase()) ||
    (p.name_fr || '').toLowerCase().includes(providerSearch.toLowerCase()) ||
    (p.code || '').toLowerCase().includes(providerSearch.toLowerCase())
  );

  const filteredRates = rates.filter(r => {
    if (rateProviderFilter !== 'all' && r.provider_id !== rateProviderFilter) return false;
    if (rateWilayaSearch.trim()) {
      const q = rateWilayaSearch.trim().toLowerCase();
      const matchAr = (r.wilaya_name_ar || '').toLowerCase().includes(q);
      const matchFr = (r.wilaya_name_fr || '').toLowerCase().includes(q);
      const matchCode = String(r.wilaya_id).includes(q) || (r.wilaya_code || '').includes(q);
      if (!matchAr && !matchFr && !matchCode) return false;
    }
    return true;
  });

  const filteredShipments = shipments.filter(s => {
    if (shipmentStatusFilter !== 'all' && s.status !== shipmentStatusFilter) return false;
    if (shipmentSearch.trim()) {
      const q = shipmentSearch.trim().toLowerCase();
      const matchTrack = (s.tracking_number || '').toLowerCase().includes(q);
      const matchOrder = (s.order_number || '').toLowerCase().includes(q);
      const matchName = (s.recipient_name || '').toLowerCase().includes(q);
      const matchPhone = (s.recipient_phone || '').toLowerCase().includes(q);
      if (!matchTrack && !matchOrder && !matchName && !matchPhone) return false;
    }
    return true;
  });

  const paginatedShipments = filteredShipments.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-6 rounded-2xl shadow-xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-950/80 text-emerald-400 rounded-xl border border-emerald-800/60 shadow-inner">
              <Truck className="w-6 h-6" />
            </div>
            {tr('إدارة الشحن واللوجستيات', 'Gestion de Livraison & Logistique', 'Shipping & Logistics Management')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {tr(
              'إدارة شركات الشحن المعتمدة، جدول أسعار 58 ولاية، متابعة الشحنات والمانفيست وتصفية الحسابات COD',
              'Gestion des transporteurs, grille des 58 Wilayas, suivi des colis, manifestes et réconciliation COD',
              'Carrier management, 58 Wilaya pricing grid, package tracking, manifests & COD settlements'
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl text-xs font-semibold transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            {tr('تحديث البيانات', 'Actualiser', 'Refresh')}
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800/80 shadow-lg flex items-center gap-4">
          <div className="p-3 bg-emerald-950/80 text-emerald-400 rounded-xl border border-emerald-800/60 shadow-inner">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-100">
              {providers.filter(p => p.is_active).length}
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {tr('شركات الشحن النشطة', 'Transporteurs actifs', 'Active Carriers')}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800/80 shadow-lg flex items-center gap-4">
          <div className="p-3 bg-blue-950/80 text-blue-400 rounded-xl border border-blue-800/60 shadow-inner">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-100">
              {rates.length > 0 ? new Set(rates.filter(r => r.is_active).map(r => r.wilaya_id)).size : 0}
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {tr('الولايات المغطاة', 'Wilayas couvertes', 'Covered Wilayas')}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800/80 shadow-lg flex items-center gap-4">
          <div className="p-3 bg-purple-950/80 text-purple-400 rounded-xl border border-purple-800/60 shadow-inner">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-100">
              {shipments.filter(s => ['pending', 'prepared', 'manifested', 'shipped', 'in_transit', 'out_for_delivery'].includes(s.status)).length}
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {tr('الشحنات النشطة', 'Colis en cours', 'Active Shipments')}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800/80 shadow-lg flex items-center gap-4">
          <div className="p-3 bg-amber-950/80 text-amber-400 rounded-xl border border-amber-800/60 shadow-inner">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-slate-100">
              {formatPrice(shipments.filter(s => s.status === 'delivered' && s.cod_status === 'pending').reduce((sum, s) => sum + Number(s.cod_amount || 0), 0))}
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {tr('مستحقات COD المعلقة', 'Encaissements COD en attente', 'Pending COD')}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800 shadow-lg">
        <button
          onClick={() => setActiveTab('providers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'providers'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
          }`}
        >
          <Building2 className="w-4 h-4" />
          {tr('شركات الشحن (Providers)', 'Transporteurs')}
          <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full font-bold ${
            activeTab === 'providers' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            {providers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('rates')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'rates'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
          }`}
        >
          <MapPin className="w-4 h-4" />
          {tr('أسعار 58 ولاية (Rates)', 'Tarifs 58 Wilayas')}
        </button>

        <button
          onClick={() => setActiveTab('shipments')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'shipments'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
          }`}
        >
          <Truck className="w-4 h-4" />
          {tr('الشحنات والتتبع (Shipments)', 'Colis & Suivi')}
          <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full font-bold ${
            activeTab === 'shipments' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            {shipments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('manifests')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'manifests'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
          }`}
        >
          <FileText className="w-4 h-4" />
          {tr('المانفيست (Manifests)', 'Manifestes')}
          <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full font-bold ${
            activeTab === 'manifests' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            {manifests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('cod')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'cod'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          {tr('تسوية الدفع COD (Settlements)', 'Réconciliation COD')}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          {tr('الإعدادات العامة (Settings)', 'Paramètres')}
        </button>
      </div>

      {/* Main Content Loading Skeleton */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900 rounded-2xl border border-slate-800 shadow-lg">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
          <p className="text-xs text-slate-400 font-medium">{tr('جاري تحميل بيانات الشحن من قاعدة البيانات...', 'Chargement des données...')}</p>
        </div>
      ) : (
        <>
          {/* TAB 1: SHIPPING PROVIDERS */}
          {activeTab === 'providers' && (
            <div className="space-y-4">
              {/* CSV Import / Export Tool Card */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-md space-y-3">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-950/80 text-emerald-400 rounded-xl border border-emerald-800/60 shadow-sm shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        {tr('استيراد وتصدير بيانات شركات الشحن (CSV)', 'Import / Export CSV Transporteurs', 'CSV Import / Export')}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {tr(
                          'تصدير قائمة الشركات، تحميل قالب جاهز، أو استيراد ملف CSV جديد للتحديث المباشر في Supabase.',
                          'Exportez les transporteurs, téléchargez un modèle ou importez un CSV pour mettre à jour Supabase.'
                        )}
                      </p>
                    </div>
                  </div>

                  {/* CSV Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv,text/csv"
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto shrink-0">
                    <button
                      onClick={handleDownloadTemplate}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold border border-slate-800 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      {tr('تحميل قالب CSV', 'Modèle CSV', 'Download Template')}
                    </button>

                    <button
                      onClick={handleExportCSV}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      {tr('تصدير CSV', 'Exporter CSV', 'Export CSV')}
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {tr('استيراد CSV', 'Importer CSV', 'Import CSV')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={providerSearch}
                    onChange={(e) => setProviderSearch(e.target.value)}
                    placeholder={tr('بحث عن شركة شحن...', 'Rechercher un transporteur...', 'Search provider...')}
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>

                <button
                  onClick={() => setShowAddProviderModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {tr('إضافة شركة شحن', 'Ajouter un transporteur', 'Add Shipping Provider')}
                </button>
              </div>

              {providersDbError ? (
                <div className="bg-rose-950/30 border border-rose-900/50 rounded-2xl p-6 text-slate-100 space-y-3 shadow-md">
                  <div className="flex items-center gap-2.5 font-bold text-base text-slate-100">
                    <div className="p-1.5 bg-rose-900/50 text-rose-400 rounded-lg border border-rose-800/60">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    {tr('خطأ في الاتصال بقاعدة البيانات (Supabase)', 'Erreur de base de données Supabase', 'Database Error')}
                  </div>
                  <div className="font-mono text-xs bg-slate-950/90 p-3 rounded-xl text-rose-300 border border-rose-900/40 break-all leading-relaxed">
                    {providersDbError}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {tr(
                      'تعذر تحميل شركات الشحن لأن الجدول public.shipping_providers غير موجود في قاعدة بيانات Supabase. يرجى التأكد من تشغيل الترحيل (Migration).',
                      'Impossible de charger les transporteurs car la table public.shipping_providers n\'existe pas dans Supabase.',
                      'Could not load carriers because table public.shipping_providers does not exist in Supabase.'
                    )}
                  </p>
                </div>
              ) : filteredProviders.length === 0 ? (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center max-w-lg mx-auto shadow-lg my-8">
                  <div className="w-16 h-16 bg-slate-950 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-800 shadow-inner">
                    <Building2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-100 mb-2">
                    {tr('لا توجد شركات شحن مضافة', 'Aucun transporteur configuré', 'No shipping providers added')}
                  </h3>
                  <p className="text-sm text-slate-400 mb-6 leading-relaxed max-w-sm mx-auto">
                    {tr(
                      'قم بإضافة أول شركة شحن لبدء ضبط خيارات التوصيل وأسعار الولايات 58.',
                      'Ajoutez votre premier transporteur pour commencer à configurer la livraison et les tarifs des 58 Wilayas.',
                      'Add your first shipping provider to configure delivery options and 58 Wilaya pricing.'
                    )}
                  </p>
                  <button
                    onClick={() => setShowAddProviderModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    {tr('إضافة شركة شحن', 'Ajouter un transporteur', 'Add Shipping Provider')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredProviders.map((provider) => (
                    <div
                      key={provider.id}
                      className={`bg-slate-900 p-5 rounded-2xl border transition-all duration-200 shadow-md hover:shadow-lg relative flex flex-col justify-between ${
                        provider.is_default ? 'border-emerald-500/80 ring-2 ring-emerald-500/20' : 'border-slate-800'
                      }`}
                    >
                      {provider.is_default && (
                        <div className="absolute -top-3 left-4 bg-emerald-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          {tr('الافتراضي', 'Par défaut', 'Default')}
                        </div>
                      )}

                      <div>
                        {/* Header info */}
                        <div className="flex items-start justify-between mb-4 pt-1">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-200 font-bold text-base tracking-wider uppercase shadow-inner">
                              {provider.code.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-100 text-base leading-snug">
                                {lang === 'ar' ? provider.name_ar : provider.name_fr}
                              </h3>
                              <span className="inline-block text-[11px] font-mono font-medium text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md mt-0.5 border border-slate-800">
                                {provider.code}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditProviderModal(provider)}
                              className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                              title={tr('تعديل', 'Modifier', 'Edit')}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {!provider.is_default && (
                              <button
                                onClick={() => handleDeleteProvider(provider.id, lang === 'ar' ? provider.name_ar : provider.name_fr)}
                                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                                title={tr('حذف', 'Supprimer', 'Delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Capabilities Card Body */}
                        <div className="space-y-2 text-xs bg-slate-950/70 rounded-xl p-3 border border-slate-800/80 mb-4">
                          <div className="flex items-center justify-between text-slate-300 font-medium">
                            <span>{tr('توصيل للمنزل:', 'A domicile:', 'Home Delivery:')}</span>
                            {provider.supports_home_delivery ? (
                              <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                                {tr('مدعوم', 'Supporté', 'Supported')}
                              </span>
                            ) : (
                              <span className="bg-slate-800/80 text-slate-500 border border-slate-700/50 font-normal px-2 py-0.5 rounded-md text-[11px]">
                                {tr('غير مدعوم', 'Non supporté', 'Not Supported')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-slate-300 font-medium">
                            <span>{tr('توصيل المكتب (Stop Desk):', 'Stop Desk:')}</span>
                            {provider.supports_stop_desk ? (
                              <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                                {tr('مدعوم', 'Supporté', 'Supported')}
                              </span>
                            ) : (
                              <span className="bg-slate-800/80 text-slate-500 border border-slate-700/50 font-normal px-2 py-0.5 rounded-md text-[11px]">
                                {tr('غير مدعوم', 'Non supporté', 'Not Supported')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-slate-300 font-medium">
                            <span>{tr('الدفع عند الاستلام (COD):', 'Paiement COD:')}</span>
                            {provider.supports_cod ? (
                              <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                                {tr('مدعوم', 'Supporté', 'Supported')}
                              </span>
                            ) : (
                              <span className="bg-slate-800/80 text-slate-500 border border-slate-700/50 font-normal px-2 py-0.5 rounded-md text-[11px]">
                                {tr('غير مدعوم', 'Non supporté', 'Not Supported')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs font-medium">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                          <input
                            type="checkbox"
                            checked={provider.is_active}
                            onChange={() => handleToggleProvider(provider)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-slate-950 border-slate-700"
                          />
                          <span className={provider.is_active ? 'text-slate-100 font-semibold' : 'text-slate-500'}>
                            {provider.is_active ? tr('نشط', 'Actif', 'Active') : tr('غير نشط', 'Inactif', 'Inactive')}
                          </span>
                        </label>

                        {!provider.is_default && (
                          <button
                            onClick={() => handleSetDefaultProvider(provider.id)}
                            className="text-emerald-400 hover:text-emerald-300 font-semibold hover:underline transition cursor-pointer"
                          >
                            {tr('تعيين كافتراضي', 'Définir par défaut', 'Set Default')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 58 WILAYAS RATES */}
          {activeTab === 'rates' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={rateWilayaSearch}
                      onChange={(e) => setRateWilayaSearch(e.target.value)}
                      placeholder={tr('بحث برقم أو اسم الولاية...', 'Filtrer par wilaya...')}
                      className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <select
                    value={rateProviderFilter}
                    onChange={(e) => setRateProviderFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none"
                  >
                    <option value="all">{tr('جميع الشركات', 'Tous les transporteurs')}</option>
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{lang === 'ar' ? p.name_ar : p.name_fr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right sm:text-left">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">{tr('رقم الولاية', 'N° Wilaya')}</th>
                        <th className="px-4 py-3">{tr('الولاية', 'Wilaya')}</th>
                        <th className="px-4 py-3">{tr('توصيل المنزل (Home)', 'Tarif Domicile')}</th>
                        <th className="px-4 py-3">{tr('المكتب (Stop Desk)', 'Tarif Bureau')}</th>
                        <th className="px-4 py-3">{tr('رسوم الإرجاع (Return)', 'Frais Retour')}</th>
                        <th className="px-4 py-3 text-center">{tr('إجراءات', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-200">
                      {filteredRates.slice(0, 58).map((rate) => (
                        <tr key={rate.id} className="hover:bg-slate-800/50 transition">
                          <td className="px-4 py-3 font-mono font-bold text-slate-100">
                            {String(rate.wilaya_id).padStart(2, '0')}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-100">
                            {lang === 'ar' ? rate.wilaya_name_ar : rate.wilaya_name_fr}
                          </td>
                          <td className="px-4 py-3 font-semibold text-emerald-400">
                            {formatPrice(rate.home_fee)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-blue-400">
                            {formatPrice(rate.desk_fee)}
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {formatPrice(rate.return_fee)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                setEditingRate(rate);
                                setEditHomeFee(rate.home_fee);
                                setEditDeskFee(rate.desk_fee);
                                setEditReturnFee(rate.return_fee);
                              }}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                            >
                              {tr('تعديل السعر', 'Modifier')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SHIPMENTS & TRACKING */}
          {activeTab === 'shipments' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={shipmentSearch}
                      onChange={(e) => setShipmentSearch(e.target.value)}
                      placeholder={tr('بحث برقم التتبع أو رقم الطلب...', 'Rechercher par N° de suivi ou commande...')}
                      className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <select
                    value={shipmentStatusFilter}
                    onChange={(e) => setShipmentStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none"
                  >
                    <option value="all">{tr('جميع الحالات', 'Tous les statuts')}</option>
                    <option value="pending">{tr('قيد الانتظار (Pending)', 'En attente')}</option>
                    <option value="manifested">{tr('في المانفيست (Manifested)', 'En manifeste')}</option>
                    <option value="shipped">{tr('تم الشحن (Shipped)', 'Expédié')}</option>
                    <option value="delivered">{tr('تم التسليم (Delivered)', 'Livré')}</option>
                    <option value="returned">{tr('مرتجع (Returned)', 'Retourné')}</option>
                    <option value="cancelled">{tr('ملغى (Cancelled)', 'Annulé')}</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowManifestModal(true)}
                    disabled={selectedShipmentIds.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    {tr('إنشاء مانفيست للمحدد', 'Créer Manifeste')} ({selectedShipmentIds.length})
                  </button>

                  <button
                    onClick={() => setShowCodModal(true)}
                    disabled={selectedShipmentIds.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition cursor-pointer"
                  >
                    <DollarSign className="w-4 h-4" />
                    {tr('إنشاء تسوية COD', 'Créer Règlement COD')}
                  </button>
                </div>
              </div>

              {filteredShipments.length === 0 ? (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center max-w-lg mx-auto shadow-lg my-6">
                  <div className="w-16 h-16 bg-slate-950 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-800">
                    <Truck className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-100 mb-2">
                    {tr('لا توجد شحنات مسجلة', 'Aucun colis trouvé', 'No shipments found')}
                  </h3>
                  <p className="text-xs text-slate-400 mb-2 leading-relaxed">
                    {tr('عند إرسال طلبيات الزبائن وتوليد شحنات التوصيل، ستظهر جميع الشحنات والتتبع هنا.', 'Toutes les expéditions apparaîtront ici.', 'All generated shipments will appear here.')}
                  </p>
                </div>
              ) : (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right sm:text-left">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedShipmentIds.length === paginatedShipments.length && paginatedShipments.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedShipmentIds(paginatedShipments.map(s => s.id));
                                } else {
                                  setSelectedShipmentIds([]);
                                }
                              }}
                              className="rounded text-emerald-600 focus:ring-emerald-500 bg-slate-950 border-slate-700"
                            />
                          </th>
                          <th className="px-4 py-3">{tr('رقم التتبع', 'N° Suivi')}</th>
                          <th className="px-4 py-3">{tr('الطلب', 'Commande')}</th>
                          <th className="px-4 py-3">{tr('المستلم', 'Destinataire')}</th>
                          <th className="px-4 py-3">{tr('النوع', 'Type')}</th>
                          <th className="px-4 py-3">{tr('مبلغ COD', 'Montant COD')}</th>
                          <th className="px-4 py-3">{tr('حالة الشحنة', 'Statut')}</th>
                          <th className="px-4 py-3 text-center">{tr('تحديث الحالة', 'Changer Statut')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-slate-200">
                        {paginatedShipments.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-800/50 transition">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedShipmentIds.includes(s.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedShipmentIds(prev => [...prev, s.id]);
                                  } else {
                                    setSelectedShipmentIds(prev => prev.filter(id => id !== s.id));
                                  }
                                }}
                                className="rounded text-emerald-600 focus:ring-emerald-500 bg-slate-950 border-slate-700"
                              />
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-100">
                              <button
                                onClick={() => {
                                  setSelectedShipmentForTracking(s);
                                  loadTrackingEvents(s.id);
                                }}
                                className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                {s.tracking_number}
                              </button>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-400">{s.order_number}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-100">{s.recipient_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{s.recipient_phone}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${
                                s.delivery_type === 'home' 
                                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60' 
                                  : 'bg-blue-950/80 text-blue-400 border-blue-800/60'
                              }`}>
                                {s.delivery_type === 'home' ? tr('منزل Home', 'Domicile') : tr('مكتب Stop Desk', 'Bureau')}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-100">
                              {formatPrice(s.cod_amount)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border ${
                                s.status === 'delivered' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60' :
                                s.status === 'shipped' ? 'bg-blue-950/80 text-blue-400 border-blue-800/60' :
                                s.status === 'returned' ? 'bg-amber-950/80 text-amber-400 border-amber-800/60' :
                                s.status === 'cancelled' ? 'bg-rose-950/80 text-rose-400 border-rose-800/60' :
                                'bg-slate-800 text-slate-300 border-slate-700'
                              }`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <select
                                value={s.status}
                                onChange={(e) => handleUpdateShipmentStatus(s.id, e.target.value as ShipmentStatus)}
                                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none"
                              >
                                <option value="pending">pending</option>
                                <option value="prepared">prepared</option>
                                <option value="manifested">manifested</option>
                                <option value="shipped">shipped</option>
                                <option value="in_transit">in_transit</option>
                                <option value="out_for_delivery">out_for_delivery</option>
                                <option value="delivered">delivered</option>
                                <option value="returned">returned (Restores Stock)</option>
                                <option value="cancelled">cancelled (Restores Stock)</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950 text-xs text-slate-400">
                    <span>
                      {tr(
                        `عرض ${Math.min(filteredShipments.length, (page - 1) * ITEMS_PER_PAGE + 1)} إلى ${Math.min(filteredShipments.length, page * ITEMS_PER_PAGE)} من ${filteredShipments.length} شحنة`,
                        `Affichage ${Math.min(filteredShipments.length, (page - 1) * ITEMS_PER_PAGE + 1)} à ${Math.min(filteredShipments.length, page * ITEMS_PER_PAGE)} sur ${filteredShipments.length}`
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 transition cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <span className="font-semibold text-slate-200">{page}</span>
                      <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={page * ITEMS_PER_PAGE >= filteredShipments.length}
                        className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 transition cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MANIFESTS */}
          {activeTab === 'manifests' && (
            <div className="space-y-4">
              {manifests.length === 0 ? (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center max-w-lg mx-auto shadow-lg my-6">
                  <div className="w-16 h-16 bg-slate-950 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-800">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-100 mb-2">
                    {tr('لا توجد بيانات شحن (مانفيست)', 'Aucun manifeste créé', 'No shipping manifests found')}
                  </h3>
                  <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                    {tr('يمكنك إنشاء بيان شحن (Manifest) جديد عن طريق تحديد الشحنات المطلوبة في لسان "الشحنات والتتبع".', 'Sélectionnez des colis dans la liste des expéditions pour créer un manifeste.', 'Select shipments in the Shipments tab to generate a manifest.')}
                  </p>
                  <button
                    onClick={() => setActiveTab('shipments')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition cursor-pointer"
                  >
                    <Truck className="w-4 h-4" />
                    {tr('الانتقال لقائمة الشحنات', 'Voir les expéditions', 'Go to Shipments')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {manifests.map((manif) => (
                    <div key={manif.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <div className="font-mono font-bold text-slate-100 text-base">{manif.manifest_number}</div>
                          <div className="text-xs text-slate-400">
                            {lang === 'ar' ? manif.provider_name_ar : manif.provider_name_fr}
                          </div>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded-full">
                          {manif.status}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-300">
                        <div className="flex justify-between">
                          <span>{tr('عدد الطلبات:', 'Nombre de commandes:')}</span>
                          <span className="font-bold text-slate-100">{manif.order_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{tr('إجمالي COD:', 'Total COD:')}</span>
                          <span className="font-bold text-emerald-400">{formatPrice(manif.total_cod_amount)}</span>
                        </div>
                        {manif.driver_name && (
                          <div className="flex justify-between">
                            <span>{tr('السائق:', 'Chauffeur:')}</span>
                            <span>{manif.driver_name} ({manif.driver_phone})</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => window.print()}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          {tr('طباعة المانفيست', 'Imprimer le manifeste')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: COD SETTLEMENTS */}
          {activeTab === 'cod' && (
            <div className="space-y-4">
              {codSettlements.length === 0 ? (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center max-w-lg mx-auto shadow-lg my-6">
                  <div className="w-16 h-16 bg-slate-950 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-800">
                    <DollarSign className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-100 mb-2">
                    {tr('لا توجد تسويات مالية COD', 'Aucun règlement COD', 'No COD settlements found')}
                  </h3>
                  <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                    {tr('تسمح تسويات COD بتجميع المبالغ المحصلة من شركات التوصيل وإيداعها مباشرة في حسابات الخزينة.', 'Les règlements COD permettent de réconcilier les fonds collectés par les transporteurs.', 'COD settlements allow reconciliations of collected funds into treasury accounts.')}
                  </p>
                  <button
                    onClick={() => setActiveTab('shipments')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition cursor-pointer"
                  >
                    <Truck className="w-4 h-4" />
                    {tr('تحديد شحنات مسلمة لتسويتها', 'Sélectionner des colis livrés', 'Select Delivered Shipments')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {codSettlements.map((cs) => (
                    <div key={cs.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <div className="font-mono font-bold text-slate-100 text-base">{cs.settlement_number}</div>
                          <div className="text-xs text-slate-400">
                            {lang === 'ar' ? cs.provider_name_ar : cs.provider_name_fr}
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          cs.status === 'deposited' 
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60' 
                            : 'bg-amber-950/80 text-amber-400 border-amber-800/60'
                        }`}>
                          {cs.status}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <div className="flex justify-between">
                          <span>{tr('إجمالي تحصيل COD:', 'Total collecté:')}</span>
                          <span className="font-bold text-slate-100">{formatPrice(cs.gross_cod_collected)}</span>
                        </div>
                        <div className="flex justify-between text-rose-400">
                          <span>{tr('خصم رسوم الشحن:', 'Frais déduits:')}</span>
                          <span>-{formatPrice(cs.total_shipping_fees_deducted)}</span>
                        </div>
                        <div className="flex justify-between text-base font-bold text-emerald-400 pt-1 border-t border-slate-800">
                          <span>{tr('صافي المبلغ المحول:', 'Net à verser:')}</span>
                          <span>{formatPrice(cs.net_payout_amount)}</span>
                        </div>
                      </div>

                      {cs.status !== 'deposited' ? (
                        <div className="space-y-2 pt-2">
                          <label className="block text-xs font-medium text-slate-300">
                            {tr('اختر حساب الخزينة للإيداع:', 'Compte de trésorerie:')}
                          </label>
                          <select
                            id={`treasury-select-${cs.id}`}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none"
                          >
                            {treasuryAccounts.map(ta => (
                              <option key={ta.id} value={ta.id}>
                                {lang === 'ar' ? ta.name_ar : ta.name_fr} ({formatPrice(ta.balance)})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const selectEl = document.getElementById(`treasury-select-${cs.id}`) as HTMLSelectElement;
                              if (selectEl?.value) {
                                handleReconcileCod(cs.id, selectEl.value);
                              }
                            }}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {tr('تأكيد الإيداع في الخزينة', 'Confirmer le versement')}
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1 pt-2">
                          <CheckCircle2 className="w-4 h-4" />
                          {tr('تم إيداع المبلغ في الخزينة وتوثيق المالية', 'Montant déposé avec succès')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === 'settings' && settings && (
            <form onSubmit={handleSaveSettings} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg space-y-6 max-w-2xl text-slate-100">
              <h2 className="text-lg font-bold text-slate-100 border-b border-slate-800 pb-3">
                {tr('إعدادات الشحن العامة', 'Paramètres Généraux de Livraison')}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('شركة الشحن الافتراضية:', 'Transporteur par défaut:')}
                  </label>
                  <select
                    value={settings.default_provider_id || ''}
                    onChange={(e) => setSettings({ ...settings, default_provider_id: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none"
                  >
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{lang === 'ar' ? p.name_ar : p.name_fr}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('الحد الأدنى للشحن المجاني (دج):', 'Seuil de livraison gratuite (DZD):')}
                  </label>
                  <input
                    type="number"
                    value={settings.free_shipping_min_amount}
                    onChange={(e) => setSettings({ ...settings, free_shipping_min_amount: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={settings.enable_home_delivery}
                      onChange={(e) => setSettings({ ...settings, enable_home_delivery: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-slate-950 border-slate-700"
                    />
                    {tr('تفعيل التوصيل للمنزل', 'Activer livraison à domicile')}
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={settings.enable_stop_desk}
                      onChange={(e) => setSettings({ ...settings, enable_stop_desk: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-slate-950 border-slate-700"
                    />
                    {tr('تفعيل توصيل المكتب Stop Desk', 'Activer Stop Desk')}
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  {tr('حفظ الإعدادات', 'Enregistrer')}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* TRACKING MODAL */}
      {selectedShipmentForTracking && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-800 relative text-slate-100">
            <button
              onClick={() => setSelectedShipmentForTracking(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-400" />
              {tr('تتبع الشحنة:', 'Suivi du colis:')} {selectedShipmentForTracking.tracking_number}
            </h3>

            {loadingTracking ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {trackingEvents.map((ev, idx) => (
                  <div key={ev.id || idx} className="flex items-start gap-3 border-l-2 border-emerald-500 pl-3 py-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 -ml-[17px]" />
                    <div>
                      <div className="text-xs font-bold text-slate-100">{ev.status}</div>
                      <div className="text-xs text-slate-300">{ev.description}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {new Date(ev.event_timestamp).toLocaleString()} • {ev.location}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MANIFEST MODAL */}
      {showManifestModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-800 text-slate-100">
            <h3 className="text-base font-bold text-slate-100">
              {tr('إنشاء مانفيست جديد', 'Créer un nouveau manifeste')}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{tr('شركة الشحن:', 'Transporteur:')}</label>
                <select
                  value={manifestProviderId}
                  onChange={(e) => setManifestProviderId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                >
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{lang === 'ar' ? p.name_ar : p.name_fr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{tr('اسم السائق:', 'Nom du chauffeur:')}</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{tr('هاتف السائق:', 'Téléphone chauffeur:')}</label>
                <input
                  type="text"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{tr('لوحة ترقيم المركبة:', 'Plaque véhicule:')}</label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowManifestModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 cursor-pointer"
              >
                {tr('إلغاء', 'Annuler')}
              </button>
              <button
                onClick={handleCreateManifest}
                disabled={creatingManifest}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                {creatingManifest && <Loader2 className="w-4 h-4 animate-spin" />}
                {tr('تأكيد المانفيست', 'Confirmer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RATE EDIT MODAL */}
      {editingRate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-800 text-slate-100">
            <h3 className="text-base font-bold text-slate-100">
              {tr('تعديل أسعار الشحن للولاية', 'Modifier les tarifs')}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{tr('توصيل المنزل Home (دج):', 'Domicile (DZD):')}</label>
                <input
                  type="number"
                  value={editHomeFee}
                  onChange={(e) => setEditHomeFee(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{tr('توصيل المكتب Stop Desk (دج):', 'Bureau (DZD):')}</label>
                <input
                  type="number"
                  value={editDeskFee}
                  onChange={(e) => setEditDeskFee(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{tr('رسوم الإرجاع Return (دج):', 'Retour (DZD):')}</label>
                <input
                  type="number"
                  value={editReturnFee}
                  onChange={(e) => setEditReturnFee(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingRate(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 cursor-pointer"
              >
                {tr('إلغاء', 'Annuler')}
              </button>
              <button
                onClick={handleSaveRate}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-emerald-600/20"
              >
                {tr('حفظ', 'Enregistrer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COD SETTLEMENT MODAL */}
      {showCodModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-800 text-slate-100">
            <h3 className="text-base font-bold text-slate-100">
              {tr('إنشاء تسوية COD جديدة', 'Nouveau règlement COD')}
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{tr('شركة الشحن:', 'Transporteur:')}</label>
              <select
                value={codProviderId}
                onChange={(e) => setCodProviderId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
              >
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{lang === 'ar' ? p.name_ar : p.name_fr}</option>
                ))}
              </select>
            </div>

            <p className="text-xs text-slate-400">
              {tr(`سيتم تجميع ${selectedShipmentIds.length} شحنة مختارة في تسوية مالية واحدة.`, `Total de ${selectedShipmentIds.length} colis sélectionnés.`)}
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCodModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 cursor-pointer"
              >
                {tr('إلغاء', 'Annuler')}
              </button>
              <button
                onClick={handleCreateCodSettlement}
                disabled={creatingCodSettlement}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
              >
                {creatingCodSettlement && <Loader2 className="w-4 h-4 animate-spin" />}
                {tr('تأكيد التسوية', 'Confirmer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SHIPPING PROVIDER MODAL */}
      {showAddProviderModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-800 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-950/80 text-emerald-400 rounded-xl border border-emerald-800/60">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {tr('إضافة شركة شحن جديدة', 'Ajouter un transporteur', 'Add Shipping Provider')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {tr('أدخل بيانات شركة الشحن لتوليد جداول أسعار الولايات تلقائياً', 'Saisissez les détails du transporteur')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddProviderModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProviderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {tr('كود الشركة (رمز فريد بالإنجليزية):', 'Code du transporteur:')}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. express_dz, fast_ship"
                  value={newProviderForm.code}
                  onChange={(e) => setNewProviderForm({ ...newProviderForm, code: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('الاسم بالعربية:', 'Nom en Arabe:')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="سريع إكسبريس"
                    value={newProviderForm.name_ar}
                    onChange={(e) => setNewProviderForm({ ...newProviderForm, name_ar: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('الاسم بالفرنسية:', 'Nom en Français:')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Sarie Express"
                    value={newProviderForm.name_fr}
                    onChange={(e) => setNewProviderForm({ ...newProviderForm, name_fr: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {tr('قالب رابط التتبع (اختياري):', 'Lien de suivi (Optionnel):')}
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/track/{tracking}"
                  value={newProviderForm.tracking_url_template}
                  onChange={(e) => setNewProviderForm({ ...newProviderForm, tracking_url_template: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-2.5 pt-3 border-t border-slate-800 text-xs font-medium text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="font-bold text-slate-100 text-xs mb-1">
                  {tr('إمكانيات خدمات التوصيل:', 'Services de livraison:')}
                </p>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newProviderForm.supports_home_delivery}
                    onChange={(e) => setNewProviderForm({ ...newProviderForm, supports_home_delivery: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-slate-950 border-slate-700"
                  />
                  <span>{tr('يدعم التوصيل للمنزل (Home Delivery)', 'Supporte la livraison à domicile')}</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newProviderForm.supports_stop_desk}
                    onChange={(e) => setNewProviderForm({ ...newProviderForm, supports_stop_desk: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-slate-950 border-slate-700"
                  />
                  <span>{tr('يدعم التوصيل للمكتب (Stop Desk)', 'Supporte le Stop Desk')}</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newProviderForm.supports_cod}
                    onChange={(e) => setNewProviderForm({ ...newProviderForm, supports_cod: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-slate-950 border-slate-700"
                  />
                  <span>{tr('يدعم تحصيل الأموال عند الاستلام (COD)', 'Supporte le paiement COD')}</span>
                </label>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddProviderModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>
                <button
                  type="submit"
                  disabled={creatingProvider}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  {creatingProvider && <Loader2 className="w-4 h-4 animate-spin" />}
                  {tr('إضافة وتوليد الأسعار', 'Ajouter & Générer tarifs')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Provider Modal */}
      {editingProvider && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-800 space-y-5 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-950/80 text-emerald-400 rounded-xl border border-emerald-800/60">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-base">
                    {tr('تعديل بيانات شركة الشحن', 'Modifier le transporteur', 'Edit Provider')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {tr('تحديث خيارات التوصيل ورابط التتبع', 'Mettre à jour les informations du transporteur')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingProvider(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditProviderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {tr('كود الشركة (غير قابل للتعديل):', 'Code du transporteur:')}
                </label>
                <input
                  type="text"
                  disabled
                  value={editProviderForm.code}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('الاسم بالعربية:', 'Nom en Arabe:')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editProviderForm.name_ar}
                    onChange={(e) => setEditProviderForm({ ...editProviderForm, name_ar: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('الاسم بالفرنسية:', 'Nom en Français:')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editProviderForm.name_fr}
                    onChange={(e) => setEditProviderForm({ ...editProviderForm, name_fr: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {tr('قالب رابط التتبع (اختياري):', 'Lien de suivi (Optionnel):')}
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/track/{tracking}"
                  value={editProviderForm.tracking_url_template}
                  onChange={(e) => setEditProviderForm({ ...editProviderForm, tracking_url_template: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-2.5 pt-3 border-t border-slate-800 text-xs font-medium text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="font-bold text-slate-100 text-xs mb-1">
                  {tr('إمكانيات خدمات التوصيل:', 'Services de livraison:')}
                </p>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editProviderForm.supports_home_delivery}
                    onChange={(e) => setEditProviderForm({ ...editProviderForm, supports_home_delivery: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-slate-950 border-slate-700"
                  />
                  <span>{tr('يدعم التوصيل للمنزل (Home Delivery)', 'Supporte la livraison à domicile')}</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editProviderForm.supports_stop_desk}
                    onChange={(e) => setEditProviderForm({ ...editProviderForm, supports_stop_desk: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-slate-950 border-slate-700"
                  />
                  <span>{tr('يدعم التوصيل للمكتب (Stop Desk)', 'Supporte le Stop Desk')}</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editProviderForm.supports_cod}
                    onChange={(e) => setEditProviderForm({ ...editProviderForm, supports_cod: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-slate-950 border-slate-700"
                  />
                  <span>{tr('يدعم تحصيل الأموال عند الاستلام (COD)', 'Supporte le paiement COD')}</span>
                </label>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingProvider(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>
                <button
                  type="submit"
                  disabled={updatingProvider}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  {updatingProvider && <Loader2 className="w-4 h-4 animate-spin" />}
                  {tr('حفظ التعديلات', 'Enregistrer les modifications', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-800 space-y-5 text-slate-100 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-950/80 text-emerald-400 rounded-xl border border-emerald-800/60">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-base">
                    {tr('معاينة واستيراد ملف CSV', 'Aperçu et Importation CSV', 'CSV Import Preview')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {csvRawFile?.name ? `${csvRawFile.name} (${(csvRawFile.size / 1024).toFixed(1)} KB)` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setParsedCsvRows([]);
                  setCsvRawFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Chips */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium">
                <span className="text-slate-400">{tr('إجمالي الصفوف:', 'Total lignes:')}</span>
                <span className="font-bold text-slate-100">{parsedCsvRows.length}</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/50 border border-emerald-800/60 rounded-xl text-xs font-medium text-emerald-300">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{tr('صفوف صالحة للاستيراد:', 'Lignes valides:')}</span>
                <span className="font-bold text-emerald-200">{parsedCsvRows.filter((r) => r.is_valid).length}</span>
              </div>

              {parsedCsvRows.filter((r) => !r.is_valid).length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs font-medium text-rose-300">
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>{tr('صفوف بها أخطاء (سيتم تجاهلها):', 'Lignes avec erreurs:')}</span>
                  <span className="font-bold text-rose-200">{parsedCsvRows.filter((r) => !r.is_valid).length}</span>
                </div>
              )}
            </div>

            {/* Table Preview Container */}
            <div className="overflow-y-auto overflow-x-auto border border-slate-800 rounded-xl bg-slate-950 max-h-72 flex-1">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 sticky top-0 text-slate-400 font-semibold">
                  <tr>
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">{tr('كود الشركة', 'Code')}</th>
                    <th className="p-3">{tr('الاسم بالعربية', 'Nom Arabe')}</th>
                    <th className="p-3">{tr('الاسم بالفرنسية', 'Nom Français')}</th>
                    <th className="p-3 text-center">{tr('توصيل للمنزل', 'Domicile')}</th>
                    <th className="p-3 text-center">{tr('توصيل للمكتب', 'Desk')}</th>
                    <th className="p-3 text-center">{tr('الدفع عند الاستلام', 'COD')}</th>
                    <th className="p-3 text-center">{tr('الحالة', 'Statut')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300 font-medium">
                  {parsedCsvRows.map((row) => (
                    <tr key={row.rowIndex} className={row.is_valid ? 'hover:bg-slate-900/50' : 'bg-rose-950/20 hover:bg-rose-950/30'}>
                      <td className="p-3 text-center font-mono text-slate-500">{row.rowIndex}</td>
                      <td className="p-3 font-mono text-slate-200">{row.code || '—'}</td>
                      <td className="p-3 font-bold text-slate-100">{row.name_ar || '—'}</td>
                      <td className="p-3 text-slate-300">{row.name_fr || '—'}</td>
                      <td className="p-3 text-center">
                        {row.supports_home_delivery ? (
                          <span className="inline-block px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded text-[10px]">
                            {tr('نعم', 'Oui')}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-slate-900 text-slate-500 rounded text-[10px]">
                            {tr('لا', 'Non')}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {row.supports_stop_desk ? (
                          <span className="inline-block px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded text-[10px]">
                            {tr('نعم', 'Oui')}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-slate-900 text-slate-500 rounded text-[10px]">
                            {tr('لا', 'Non')}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {row.supports_cod ? (
                          <span className="inline-block px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded text-[10px]">
                            {tr('نعم', 'Oui')}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-slate-900 text-slate-500 rounded text-[10px]">
                            {tr('لا', 'Non')}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {row.is_valid ? (
                          row.is_update ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-950/80 text-blue-400 border border-blue-800/60 rounded-full text-[11px] font-semibold">
                              <Info className="w-3 h-3" />
                              {tr('تحديث موجود', 'Mise à jour')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded-full text-[11px] font-semibold">
                              <Check className="w-3 h-3" />
                              {tr('جديد', 'Nouveau')}
                            </span>
                          )
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-950/90 text-rose-300 border border-rose-800/60 rounded-full text-[11px] font-semibold"
                            title={row.error_reason}
                          >
                            <AlertCircle className="w-3 h-3 text-rose-400" />
                            {row.error_reason}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Warning if invalid rows present */}
            {parsedCsvRows.some((r) => !r.is_valid) && (
              <div className="p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl flex items-center gap-2.5 text-xs text-amber-200 shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {tr(
                    'تنبيه: الصفوف التي تحتوي على أخطاء سيتم تخطيها تلقائياً واستيراد الصفوف الصالحة فقط إلى Supabase.',
                    'Remarque: Les lignes avec erreurs seront ignorées automatiquement.'
                  )}
                </span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-3 pt-2 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setParsedCsvRows([]);
                  setCsvRawFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                {tr('إلغاء', 'Annuler')}
              </button>
              <button
                type="button"
                disabled={isImporting || parsedCsvRows.filter((r) => r.is_valid).length === 0}
                onClick={handleConfirmImport}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{tr('جاري الاستيراد في Supabase...', 'Importation en cours...')}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>
                      {tr(
                        `تأكيد واستيراد (${parsedCsvRows.filter((r) => r.is_valid).length}) شركة إلى Supabase`,
                        `Confirmer & Importer (${parsedCsvRows.filter((r) => r.is_valid).length}) transporteurs`
                      )}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
