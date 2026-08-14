import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, Edit3, Eye, Calendar, MoveUp, MoveDown, GripVertical,
  Loader2, Save, X, ToggleLeft, ToggleRight, Link2, Palette, AlignLeft,
  AlignCenter, AlignRight, Image as ImageIcon, Laptop, Smartphone,
  Search, Download, Copy, LayoutGrid, List, Activity
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getBanners, saveBanner, deleteBanner, duplicateBanner, updateBannersOrder,
  bulkUpdateBannersStatus, bulkDeleteBanners
} from '../../lib/banners';
import { HomepageBanner, BannerType, BannerTargetPage } from '../../types';
import ImageUploader, { UploadedImage } from '../../components/ImageUploader';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { pathFromUrl } from '../../lib/storage';
import { exportToCSV } from '../../lib/csvHelper';

export interface BannerActivityLog {
  id: string;
  action: string;
  details: string;
  user: string;
  timestamp: string;
}

const LOCAL_STORAGE_BANNER_LOGS_KEY = 'banner_activity_logs_v1';

function loadBannerLogs(): BannerActivityLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BANNER_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addBannerLog(action: string, details: string, user: string = 'المشرف'): BannerActivityLog[] {
  const current = loadBannerLogs();
  const newLog: BannerActivityLog = {
    id: `log-${Date.now()}`,
    action,
    details,
    user,
    timestamp: new Date().toISOString(),
  };
  const updated = [newLog, ...current].slice(0, 100);
  try {
    localStorage.setItem(LOCAL_STORAGE_BANNER_LOGS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export default function AdminBanners() {
  const { lang, dir, formatDate } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';

  const tr = (ar: string, fr: string, en: string = '') => {
    return isAr ? ar : lang === 'fr' ? fr : (en || fr);
  };

  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<BannerActivityLog[]>([]);
  const [showLogsModal, setShowLogsModal] = useState(false);

  // View Layout State (Grid vs Table)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<BannerType | 'all'>('all');
  const [targetFilter, setTargetFilter] = useState<BannerTargetPage | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'scheduled' | 'expired'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<HomepageBanner | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [activeFormTab, setActiveFormTab] = useState<'content_ar' | 'content_fr' | 'content_en' | 'settings'>('content_ar');

  // Image uploader states
  const [desktopImages, setDesktopImages] = useState<UploadedImage[]>([]);
  const [mobileImages, setMobileImages] = useState<UploadedImage[]>([]);
  const [desktopFolder, setDesktopFolder] = useState('');
  const [mobileFolder, setMobileFolder] = useState('');
  const [manualImageUrl, setManualImageUrl] = useState('');

  // Form inputs
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [titleFr, setTitleFr] = useState('');
  const [titleEn, setTitleEn] = useState('');

  const [subtitle, setSubtitle] = useState('');
  const [subtitleAr, setSubtitleAr] = useState('');
  const [subtitleFr, setSubtitleFr] = useState('');
  const [subtitleEn, setSubtitleEn] = useState('');

  const [descriptionAr, setDescriptionAr] = useState('');
  const [descriptionFr, setDescriptionFr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');

  const [bannerType, setBannerType] = useState<BannerType>('hero');
  const [targetPage, setTargetPage] = useState<BannerTargetPage>('homepage');

  const [buttonText, setButtonText] = useState('');
  const [buttonTextAr, setButtonTextAr] = useState('');
  const [buttonTextFr, setButtonTextFr] = useState('');
  const [buttonTextEn, setButtonTextEn] = useState('');

  const [buttonLink, setButtonLink] = useState('');
  const [buttonColor, setButtonColor] = useState('#4f46e5');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textAlignment, setTextAlignment] = useState<'left' | 'center' | 'right'>('center');

  const [active, setActive] = useState(true);
  const [desktopVisibility, setDesktopVisibility] = useState(true);
  const [mobileVisibility, setMobileVisibility] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedBannerIds, setSelectedBannerIds] = useState<Record<string, boolean>>({});

  // Delete modal states
  const [bannerToDelete, setBannerToDelete] = useState<HomepageBanner | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Deriving image upload status
  const isUploading = desktopImages.some((img) => img.uploading) || mobileImages.some((img) => img.uploading);

  useEffect(() => {
    loadBannersData();
    setActivityLogs(loadBannerLogs());
  }, []);

  const loadBannersData = async () => {
    setLoading(true);
    try {
      const data = await getBanners();
      setBanners(data);
    } catch (err: unknown) {
      console.error('[AdminBanners] Error fetching banners:', err);
      setError((err as Error).message || 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  // Check schedule status helper
  const getScheduleStatus = (b: HomepageBanner) => {
    const now = new Date();
    if (!b.active) return 'disabled';
    
    if (b.start_date && new Date(b.start_date) > now) {
      return 'scheduled';
    }
    if (b.end_date && new Date(b.end_date) < now) {
      return 'expired';
    }
    return 'active';
  };

  // Filtered banners memo
  const filteredBanners = useMemo(() => {
    return banners.filter((b) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (b.title || '').toLowerCase().includes(q) ||
                           (b.title_ar || '').toLowerCase().includes(q) ||
                           (b.title_fr || '').toLowerCase().includes(q) ||
                           (b.title_en || '').toLowerCase().includes(q);
        const matchSubtitle = (b.subtitle || '').toLowerCase().includes(q) ||
                              (b.subtitle_ar || '').toLowerCase().includes(q) ||
                              (b.subtitle_fr || '').toLowerCase().includes(q);
        const matchLink = (b.button_link || '').toLowerCase().includes(q);
        if (!matchTitle && !matchSubtitle && !matchLink) return false;
      }

      // 2. Banner Type Filter
      if (typeFilter !== 'all') {
        const bType = b.banner_type || 'hero';
        if (bType !== typeFilter) return false;
      }

      // 3. Target Page Filter
      if (targetFilter !== 'all') {
        const tPage = b.target_page || 'homepage';
        if (tPage !== targetFilter) return false;
      }

      // 4. Status Filter
      if (statusFilter !== 'all') {
        const status = getScheduleStatus(b);
        if (statusFilter === 'active' && status !== 'active') return false;
        if (statusFilter === 'disabled' && status !== 'disabled') return false;
        if (statusFilter === 'scheduled' && status !== 'scheduled') return false;
        if (statusFilter === 'expired' && status !== 'expired') return false;
      }

      return true;
    });
  }, [banners, searchQuery, typeFilter, targetFilter, statusFilter]);

  // Paginated Banners
  const paginatedBanners = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredBanners.slice(startIndex, startIndex + pageSize);
  }, [filteredBanners, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredBanners.length / pageSize) || 1;

  // Selected banner IDs list
  const selectedIds = useMemo(() => {
    return Object.keys(selectedBannerIds).filter((id) => selectedBannerIds[id]);
  }, [selectedBannerIds]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const next: Record<string, boolean> = {};
      paginatedBanners.forEach((b) => { next[b.id] = true; });
      setSelectedBannerIds(next);
    } else {
      setSelectedBannerIds({});
    }
  };

  const handleOpenAdd = () => {
    setEditingBanner(null);
    setTitle('');
    setTitleAr('');
    setTitleFr('');
    setTitleEn('');
    setSubtitle('');
    setSubtitleAr('');
    setSubtitleFr('');
    setSubtitleEn('');
    setDescriptionAr('');
    setDescriptionFr('');
    setDescriptionEn('');
    setBannerType('hero');
    setTargetPage('homepage');
    setButtonText('');
    setButtonTextAr('');
    setButtonTextFr('');
    setButtonTextEn('');
    setButtonLink('');
    setButtonColor('#4f46e5');
    setTextColor('#ffffff');
    setTextAlignment('center');
    setActive(true);
    setDesktopVisibility(true);
    setMobileVisibility(true);
    setStartDate('');
    setEndDate('');
    setDesktopImages([]);
    setMobileImages([]);
    setManualImageUrl('');
    setDesktopFolder(`banners-desktop-${Date.now()}`);
    setMobileFolder(`banners-mobile-${Date.now()}`);
    setActiveFormTab('content_ar');
    setShowModal(true);
  };

  const handleOpenEdit = (banner: HomepageBanner) => {
    setEditingBanner(banner);
    setTitle(banner.title || '');
    setTitleAr(banner.title_ar || '');
    setTitleFr(banner.title_fr || '');
    setTitleEn(banner.title_en || '');

    setSubtitle(banner.subtitle || '');
    setSubtitleAr(banner.subtitle_ar || '');
    setSubtitleFr(banner.subtitle_fr || '');
    setSubtitleEn(banner.subtitle_en || '');

    setDescriptionAr(banner.description_ar || '');
    setDescriptionFr(banner.description_fr || '');
    setDescriptionEn(banner.description_en || '');

    setBannerType(banner.banner_type || 'hero');
    setTargetPage(banner.target_page || 'homepage');

    setButtonText(banner.button_text || '');
    setButtonTextAr(banner.button_text_ar || '');
    setButtonTextFr(banner.button_text_fr || '');
    setButtonTextEn(banner.button_text_en || '');

    setButtonLink(banner.button_link || '');
    setButtonColor(banner.button_color || '#4f46e5');
    setTextColor(banner.text_color || '#ffffff');
    setTextAlignment((banner.text_alignment as 'left' | 'center' | 'right') || 'center');
    setActive(banner.active);
    setDesktopVisibility(banner.desktop_visibility ?? true);
    setMobileVisibility(banner.mobile_visibility ?? true);
    
    // ISO Dates to datetime-local values
    const toDatetimeLocal = (iso: string | null) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    
    setStartDate(toDatetimeLocal(banner.start_date));
    setEndDate(toDatetimeLocal(banner.end_date));

    // Images
    setDesktopImages(banner.image_url ? [{ url: banner.image_url, path: pathFromUrl('cms-images', banner.image_url) ?? '' }] : []);
    setMobileImages(banner.mobile_image_url ? [{ url: banner.mobile_image_url, path: pathFromUrl('cms-images', banner.mobile_image_url) ?? '' }] : []);
    setManualImageUrl(banner.image_url || '');

    setDesktopFolder(`banners-desktop-${Date.now()}`);
    setMobileFolder(`banners-mobile-${Date.now()}`);
    setActiveFormTab('content_ar');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (isUploading) {
      showToast(
        tr('الرجاء الانتظار حتى يكتمل رفع الصور', 'Veuillez patienter pendant le téléchargement des images', 'Please wait for images to complete uploading'),
        'error'
      );
      return;
    }

    const hasError = desktopImages.some(img => img.error) || mobileImages.some(img => img.error);
    if (hasError) {
      showToast(
        tr('يرجى تصحيح أخطاء رفع الصور قبل الحفظ', 'Veuillez corriger les erreurs de téléchargement d\'images avant d\'enregistrer', 'Please fix image upload errors before saving'),
        'error'
      );
      return;
    }

    const finalDesktopUrl = (desktopImages.length > 0 && desktopImages[0].url) ? desktopImages[0].url : manualImageUrl;

    if (!finalDesktopUrl) {
      showToast(
        tr('الرجاء رفع صورة سطح المكتب أو إدخال رابط الصورة', 'Veuillez télécharger une image bureau ou entrer son lien', 'Please upload a desktop image or enter an image URL'),
        'error'
      );
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<HomepageBanner> = {
        title: titleAr || titleFr || titleEn || title || 'Banner',
        title_ar: titleAr || null,
        title_fr: titleFr || null,
        title_en: titleEn || null,
        subtitle: subtitleAr || subtitleFr || subtitleEn || subtitle || null,
        subtitle_ar: subtitleAr || null,
        subtitle_fr: subtitleFr || null,
        subtitle_en: subtitleEn || null,
        description_ar: descriptionAr || null,
        description_fr: descriptionFr || null,
        description_en: descriptionEn || null,
        banner_type: bannerType,
        target_page: targetPage,
        image_url: finalDesktopUrl,
        mobile_image_url: (mobileImages.length > 0 && mobileImages[0].url) ? mobileImages[0].url : null,
        button_text: buttonTextAr || buttonTextFr || buttonTextEn || buttonText || null,
        button_text_ar: buttonTextAr || null,
        button_text_fr: buttonTextFr || null,
        button_text_en: buttonTextEn || null,
        button_link: buttonLink || null,
        button_color: buttonColor,
        text_color: textColor,
        text_alignment: textAlignment,
        active,
        desktop_visibility: desktopVisibility,
        mobile_visibility: mobileVisibility,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        display_order: editingBanner ? editingBanner.display_order : banners.length + 1,
      };

      if (editingBanner) {
        payload.id = editingBanner.id;
      }

      const saved = await saveBanner(payload);
      await loadBannersData();
      
      if (editingBanner) {
        setActivityLogs(addBannerLog('تعديل لافتة', `تم تعديل اللافتة "${saved.title}"`));
        showToast(
          tr('تم تحديث اللافتة بنجاح', 'Bannière mise à jour avec succès', 'Banner updated successfully'),
          'success'
        );
      } else {
        setActivityLogs(addBannerLog('إنشاء لافتة', `تم إنشاء لافتة جديدة "${saved.title}"`));
        showToast(
          tr('تمت إضافة اللافتة بنجاح', 'Bannière ajoutée avec succès', 'Banner added successfully'),
          'success'
        );
      }
      setShowModal(false);
    } catch (err: unknown) {
      console.error('[AdminBanners] Error saving banner:', err);
      showToast((err as Error).message || 'Failed to save banner', 'error');
    } finally {
      setSaving(false);
    }
  };

  const promptDeleteSingle = (banner: HomepageBanner) => {
    setBannerToDelete(banner);
    setDeleteModalError(null);
  };

  const confirmSingleDelete = async () => {
    if (!bannerToDelete) return;
    setIsDeleting(true);
    setDeleteModalError(null);

    try {
      const updated = await deleteBanner(bannerToDelete.id);
      setBanners(updated);
      setActivityLogs(addBannerLog('حذف لافتة', `تم حذف اللافتة "${bannerToDelete.title}"`));
      showToast(
        tr('تم حذف اللافتة بنجاح', 'Bannière supprimée avec succès', 'Banner deleted successfully'),
        'success'
      );
      setBannerToDelete(null);
    } catch (err: unknown) {
      console.error('[AdminBanners] Error deleting banner:', err);
      setDeleteModalError((err as Error).message || 'Failed to delete banner');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicate = async (banner: HomepageBanner) => {
    try {
      const { allBanners } = await duplicateBanner(banner.id);
      setBanners(allBanners);
      setActivityLogs(addBannerLog('تكرار لافتة', `تم تكرار اللافتة "${banner.title}"`));
      showToast(
        tr('تم تكرار اللافتة بنجاح', 'Bannière dupliquée avec succès', 'Banner duplicated successfully'),
        'success'
      );
    } catch (err: unknown) {
      console.error('[AdminBanners] Error duplicating banner:', err);
      showToast((err as Error).message || 'Failed to duplicate banner', 'error');
    }
  };

  const handleToggleActive = async (banner: HomepageBanner) => {
    try {
      await saveBanner({ ...banner, active: !banner.active });
      await loadBannersData();
      setActivityLogs(addBannerLog('تغيير الحالة', `تم ${!banner.active ? 'تفعيل' : 'تعطيل'} اللافتة "${banner.title}"`));
      showToast(
        tr('تم تعديل حالة اللافتة', 'Statut de la bannière mis à jour', 'Banner status updated'),
        'success'
      );
    } catch (err: unknown) {
      console.error('[AdminBanners] Error toggling status:', err);
      showToast((err as Error).message || 'Failed to update status', 'error');
    }
  };

  // Bulk Actions Handlers
  const handleBulkEnable = async () => {
    if (!selectedIds.length) return;
    try {
      const updated = await bulkUpdateBannersStatus(selectedIds, true);
      setBanners(updated);
      setSelectedBannerIds({});
      setActivityLogs(addBannerLog('تفعيل جماعي', `تم تفعيل ${selectedIds.length} لافتات`));
      showToast(tr('تم تفعيل اللافتات المحددة', 'Bannières sélectionnées activées', 'Selected banners enabled'), 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed bulk enable', 'error');
    }
  };

  const handleBulkDisable = async () => {
    if (!selectedIds.length) return;
    try {
      const updated = await bulkUpdateBannersStatus(selectedIds, false);
      setBanners(updated);
      setSelectedBannerIds({});
      setActivityLogs(addBannerLog('تعطيل جماعي', `تم تعطيل ${selectedIds.length} لافتات`));
      showToast(tr('تم تعطيل اللافتات المحددة', 'Bannières sélectionnées désactivées', 'Selected banners disabled'), 'success');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed bulk disable', 'error');
    }
  };

  const promptBulkDelete = () => {
    if (!selectedIds.length) return;
    setShowBulkDeleteModal(true);
    setDeleteModalError(null);
  };

  const confirmBulkDelete = async () => {
    if (!selectedIds.length) return;
    setIsDeleting(true);
    setDeleteModalError(null);

    try {
      const updated = await bulkDeleteBanners(selectedIds);
      setBanners(updated);
      setSelectedBannerIds({});
      setActivityLogs(addBannerLog('حذف جماعي', `تم حذف ${selectedIds.length} لافتات`));
      showToast(
        tr('تم حذف اللافتات المحددة بنجاح', 'Bannières sélectionnées supprimées avec succès', 'Selected banners deleted successfully'),
        'success'
      );
      setShowBulkDeleteModal(false);
    } catch (err: unknown) {
      console.error('[AdminBanners] Error deleting banners:', err);
      setDeleteModalError((err as Error).message || 'Failed to delete banners');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    const listToExport = selectedIds.length > 0
      ? banners.filter((b) => selectedIds.includes(b.id))
      : filteredBanners;

    if (listToExport.length === 0) {
      showToast(tr('لا توجد بيانات للتصدير', 'Aucune donnée à exporter', 'No data to export'), 'error');
      return;
    }

    const exportRows = listToExport.map((b) => ({
      ID: b.id,
      Title_AR: b.title_ar || b.title || '',
      Title_FR: b.title_fr || '',
      Title_EN: b.title_en || '',
      Subtitle_AR: b.subtitle_ar || b.subtitle || '',
      Type: b.banner_type || 'hero',
      TargetPage: b.target_page || 'homepage',
      ImageURL: b.image_url || '',
      ButtonText: b.button_text_ar || b.button_text || '',
      ButtonLink: b.button_link || '',
      DisplayOrder: b.display_order,
      Active: b.active ? 'YES' : 'NO',
      StartDate: b.start_date || '',
      EndDate: b.end_date || '',
    }));

    exportToCSV(exportRows, `banners_export_${new Date().toISOString().split('T')[0]}`);
    setActivityLogs(addBannerLog('تصدير CSV', `تم تصدير ${exportRows.length} لافتة إلى ملف CSV`));
    showToast(tr('تم تصدير ملف CSV بنجاح', 'Fichier CSV exporté avec succès', 'CSV exported successfully'), 'success');
  };

  // Move up / down reorder
  const moveBanner = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const copy = [...banners];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    setBanners(copy);

    try {
      await updateBannersOrder(copy);
      setActivityLogs(addBannerLog('إعادة الترتيب', 'تم تحديث ترتيب اللافتات'));
      showToast(tr('تم تحديث الترتيب بنجاح', 'Ordre mis à jour avec succès', 'Order updated successfully'), 'success');
    } catch (err: unknown) {
      console.error('[AdminBanners] Error updating order:', err);
      showToast((err as Error).message || 'Failed to update order', 'error');
      loadBannersData();
    }
  };

  // Drag and Drop implementation
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const copy = [...banners];
    const item = copy[draggedIndex];
    copy.splice(draggedIndex, 1);
    copy.splice(index, 0, item);
    
    setDraggedIndex(index);
    setBanners(copy);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    try {
      await updateBannersOrder(banners);
      setActivityLogs(addBannerLog('إعادة الترتيب بالسحب', 'تم تغيير ترتيب اللافتات بالسحب والإفلات'));
      showToast(tr('تم تحديث الترتيب بنجاح', 'Ordre mis à jour avec succès', 'Order updated successfully'), 'success');
    } catch (err: unknown) {
      console.error('[AdminBanners] Error saving drag order:', err);
      showToast((err as Error).message || 'Failed to update order', 'error');
      loadBannersData();
    }
  };

  const getTypeBadge = (type?: BannerType) => {
    switch (type) {
      case 'hero':
        return <span className="bg-purple-900/40 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded-full text-[10px] font-semibold">Hero Slider</span>;
      case 'promo':
        return <span className="bg-rose-900/40 text-rose-300 border border-rose-700/50 px-2 py-0.5 rounded-full text-[10px] font-semibold">Promotion</span>;
      case 'category':
        return <span className="bg-indigo-900/40 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-full text-[10px] font-semibold">Category</span>;
      case 'wholesale':
        return <span className="bg-amber-900/40 text-amber-300 border border-amber-700/50 px-2 py-0.5 rounded-full text-[10px] font-semibold">Wholesale</span>;
      case 'retail':
        return <span className="bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded-full text-[10px] font-semibold">Retail Only</span>;
      case 'announcement':
        return <span className="bg-cyan-900/40 text-cyan-300 border border-cyan-700/50 px-2 py-0.5 rounded-full text-[10px] font-semibold">Announcement</span>;
      default:
        return <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px]">Standard</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12" dir={dir}>
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ImageIcon className="h-6 w-6" />
            </span>
            <h1 className="text-xl md:text-2xl font-bold text-slate-100">
              {tr('إدارة اللافتات الإعلانية', 'Gestion des Bannières', 'Banner Management')}
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            {tr(
              'أنشئ وأدر جميع اللافتات الترويجية والشرائح العلوية للمتجر بمرونة كاملة.',
              'Créez et gérez toutes les bannières promotionnelles et carrousels.',
              'Enterprise-grade banner & promo slide manager for your storefront.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowLogsModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <Activity className="h-4 w-4 text-emerald-400" />
            {tr('سجل النشاطات', 'Journal d\'activités', 'Activity Log')}
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            {tr('تصدير CSV', 'Exporter CSV', 'Export CSV')}
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-indigo-400 transition-all duration-200 hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            {tr('إضافة لافتة جديدة', 'Ajouter une bannière', 'Add New Banner')}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs font-semibold text-rose-300 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3 rtl:right-3 ltr:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr('ابحث عن لافتة بالعنوان أو الرابط...', 'Rechercher par titre ou lien...', 'Search banners...')}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-9 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute left-3 rtl:left-3 ltr:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Selectors */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            {/* Banner Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as BannerType | 'all')}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">{tr('جميع الأنواع', 'Tous les types', 'All Types')}</option>
              <option value="hero">Hero Slider</option>
              <option value="promo">Promotion</option>
              <option value="category">Category Banner</option>
              <option value="wholesale">Wholesale Banner</option>
              <option value="retail">Retail Banner</option>
              <option value="announcement">Announcement</option>
            </select>

            {/* Target Page Filter */}
            <select
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value as BannerTargetPage | 'all')}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">{tr('جميع الصفحات', 'Toutes les pages', 'All Pages')}</option>
              <option value="homepage">{tr('الصفحة الرئيسية', 'Page d\'accueil', 'Homepage')}</option>
              <option value="category">{tr('صفحات الأقسام', 'Pages catégories', 'Category Pages')}</option>
              <option value="retail">{tr('التجزئة فقط', 'Détail uniquement', 'Retail Only')}</option>
              <option value="wholesale">{tr('الجملة فقط', 'Gros uniquement', 'Wholesale Only')}</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'disabled' | 'scheduled' | 'expired')}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">{tr('جميع الحالات', 'Tous les statuts', 'All Statuses')}</option>
              <option value="active">{tr('نشط الآن', 'Actif', 'Active')}</option>
              <option value="disabled">{tr('معطل', 'Inactif', 'Disabled')}</option>
              <option value="scheduled">{tr('مجدول مستقبلاً', 'Programmé', 'Scheduled')}</option>
              <option value="expired">{tr('منتهي الجدولة', 'Expiré', 'Expired')}</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-950 rounded-xl border border-slate-800 p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'}`}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'}`}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/40 px-4 py-2 text-xs text-indigo-200 animate-in fade-in duration-150">
            <span className="font-semibold text-indigo-300">
              {selectedIds.length} {tr('لافتة محددة', 'bannières sélectionnées', 'selected banners')}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleBulkEnable}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-500 transition-colors"
              >
                {tr('تفعيل المحدد', 'Activer la sélection', 'Enable Selected')}
              </button>
              <button
                onClick={handleBulkDisable}
                className="rounded-lg bg-slate-700 px-3 py-1.5 font-bold text-slate-200 hover:bg-slate-600 transition-colors"
              >
                {tr('تعطيل المحدد', 'Désactiver la sélection', 'Disable Selected')}
              </button>
              <button
                onClick={handleExportCSV}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 font-bold text-white hover:bg-indigo-500 transition-colors"
              >
                {tr('تصدير المحدد', 'Exporter la sélection', 'Export Selected')}
              </button>
              <button
                onClick={promptBulkDelete}
                className="rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-500 transition-colors flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {tr('حذف المحدد', 'Supprimer', 'Delete Selected')}
              </button>
              <button
                onClick={() => setSelectedBannerIds({})}
                className="rounded-lg px-2.5 py-1.5 text-slate-400 hover:text-slate-200"
              >
                {tr('إلغاء', 'Annuler', 'Cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        </div>
      ) : filteredBanners.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8 max-w-lg mx-auto">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400 mb-4">
            <ImageIcon className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">{tr('لا توجد لافتات مطابقة', 'Aucune bannière trouvée', 'No banners found')}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
            {tr('جرب تغيير خيارات البحث والتصفية أو قم بإضافة لافتة جديدة.', 'Essayez de modifier vos filtres ou ajoutez une nouvelle bannière.', 'Try adjusting search or filters or add a new banner.')}
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {tr('إضافة لافتة جديدة', 'Ajouter une bannière', 'Add New Banner')}
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedBanners.map((b, index) => {
            const status = getScheduleStatus(b);
            const isSelected = !!selectedBannerIds[b.id];
            return (
              <div
                key={b.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`group relative flex flex-col justify-between rounded-2xl border bg-slate-900/90 p-4 transition-all duration-200 shadow-lg ${
                  isSelected ? 'ring-2 ring-indigo-500 border-indigo-500' : draggedIndex === index ? 'opacity-40 border-indigo-400 scale-95' : 'border-slate-800 hover:border-slate-700 hover:shadow-indigo-500/5'
                }`}
              >
                {/* Header info & Select Checkbox */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => setSelectedBannerIds((prev) => ({ ...prev, [b.id]: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 p-0.5" title="Drag to reorder">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    {getTypeBadge(b.banner_type)}
                  </div>

                  <div className="flex items-center gap-1">
                    {status === 'active' && (
                      <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {tr('نشط', 'Actif', 'Active')}
                      </span>
                    )}
                    {status === 'disabled' && (
                      <span className="bg-slate-800 text-slate-400 border border-slate-700/60 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {tr('معطل', 'Inactif', 'Disabled')}
                      </span>
                    )}
                    {status === 'scheduled' && (
                      <span className="bg-blue-950/80 text-blue-300 border border-blue-800/60 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {tr('مجدول', 'Programmé', 'Scheduled')}
                      </span>
                    )}
                    {status === 'expired' && (
                      <span className="bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {tr('منتهي', 'Expiré', 'Expired')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Banner Image Preview */}
                <div className="relative w-full aspect-[21/9] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 mb-3 group/img">
                  <img
                    src={b.image_url}
                    alt={b.title || 'Banner'}
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.onerror = null;
                      target.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=80';
                    }}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-80" />
                  
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-slate-200">
                    <span className="bg-slate-900/80 px-2 py-0.5 rounded-md backdrop-blur-xs font-mono border border-slate-700/50">
                      #{b.display_order}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {b.desktop_visibility !== false && <Laptop className="h-3.5 w-3.5 text-indigo-400" />}
                      {(b.mobile_visibility !== false || b.mobile_image_url) && <Smartphone className="h-3.5 w-3.5 text-emerald-400" />}
                    </div>
                  </div>
                </div>

                {/* Banner Text info */}
                <div className="space-y-1 mb-4">
                  <h4 className="font-bold text-slate-100 text-sm line-clamp-1">
                    {isAr ? b.title_ar || b.title : b.title_fr || b.title}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {isAr ? b.subtitle_ar || b.subtitle : b.subtitle_fr || b.subtitle || '—'}
                  </p>
                  
                  {b.button_link && (
                    <div className="flex items-center gap-1 text-[11px] text-indigo-400 mt-2 truncate">
                      <Link2 className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{b.button_link}</span>
                    </div>
                  )}

                  {(b.start_date || b.end_date) && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">
                        {b.start_date ? formatDate(b.start_date) : '...'} → {b.end_date ? formatDate(b.end_date) : '...'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Controls Footer */}
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-auto">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveBanner(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                      title={tr('نقل للأعلى', 'Monter', 'Move Up')}
                    >
                      <MoveUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveBanner(index, 'down')}
                      disabled={index === filteredBanners.length - 1}
                      className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                      title={tr('نقل للأسفل', 'Descendre', 'Move Down')}
                    >
                      <MoveDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(b)}
                      className={`p-1.5 rounded-lg transition-colors ${b.active ? 'text-indigo-400 hover:bg-indigo-950/40' : 'text-slate-600 hover:bg-slate-800'}`}
                      title={b.active ? tr('تعطيل', 'Désactiver', 'Disable') : tr('تفعيل', 'Activer', 'Enable')}
                    >
                      {b.active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>

                    <button
                      onClick={() => handleDuplicate(b)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-950/40 transition-colors"
                      title={tr('تكرار', 'Dupliquer', 'Duplicate')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleOpenEdit(b)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/40 transition-colors"
                      title={tr('تعديل', 'Modifier', 'Edit')}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => promptDeleteSingle(b)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                      title={tr('حذف', 'Supprimer', 'Delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right rtl:text-right ltr:text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400">
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={paginatedBanners.length > 0 && paginatedBanners.every(b => !!selectedBannerIds[b.id])}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-4">{tr('اللافتة والأنواع', 'Bannière', 'Banner')}</th>
                  <th className="py-3.5 px-4">{tr('العنوان', 'Titre', 'Title')}</th>
                  <th className="py-3.5 px-4">{tr('الصفحة المستهدفة', 'Cible', 'Target Page')}</th>
                  <th className="py-3.5 px-4">{tr('الترتيب', 'Ordre', 'Order')}</th>
                  <th className="py-3.5 px-4">{tr('الحالة', 'Statut', 'Status')}</th>
                  <th className="py-3.5 px-4 text-center">{tr('الإجراءات', 'Actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                {paginatedBanners.map((b) => {
                  const status = getScheduleStatus(b);
                  const isSelected = !!selectedBannerIds[b.id];
                  return (
                    <tr key={b.id} className={`hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-indigo-950/30' : ''}`}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => setSelectedBannerIds((prev) => ({ ...prev, [b.id]: e.target.checked }))}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-16 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0">
                            <img
                              src={b.image_url}
                              alt={b.title || ''}
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.onerror = null;
                                target.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=80';
                              }}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            {getTypeBadge(b.banner_type)}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate font-semibold text-slate-200">
                        {isAr ? b.title_ar || b.title : b.title_fr || b.title}
                      </td>
                      <td className="py-3 px-4 text-slate-400 capitalize">
                        {b.target_page || 'homepage'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        #{b.display_order}
                      </td>
                      <td className="py-3 px-4">
                        {status === 'active' && <span className="text-emerald-400 font-bold">● {tr('نشط', 'Actif', 'Active')}</span>}
                        {status === 'disabled' && <span className="text-slate-500 font-bold">● {tr('معطل', 'Inactif', 'Disabled')}</span>}
                        {status === 'scheduled' && <span className="text-blue-400 font-bold">● {tr('مجدول', 'Programmé', 'Scheduled')}</span>}
                        {status === 'expired' && <span className="text-amber-400 font-bold">● {tr('منتهي', 'Expiré', 'Expired')}</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleToggleActive(b)}
                            className={`p-1.5 rounded-lg ${b.active ? 'text-indigo-400' : 'text-slate-600'}`}
                            title="Toggle active"
                          >
                            {b.active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                          </button>
                          <button onClick={() => handleDuplicate(b)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400" title="Duplicate">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleOpenEdit(b)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400" title="Edit">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => promptDeleteSingle(b)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      {filteredBanners.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>{tr('عرض', 'Afficher', 'Show')}</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>{tr('من أصل', 'sur', 'out of')} {filteredBanners.length} {tr('لافتة', 'bannières', 'banners')}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              {tr('السابق', 'Précédent', 'Previous')}
            </button>
            <span className="font-semibold text-slate-200">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              {tr('التالي', 'Suivant', 'Next')}
            </button>
          </div>
        </div>
      )}

      {/* CREATE / EDIT BANNER MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-slate-800 shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-shrink-0 bg-slate-950/40">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Edit3 className="h-5 w-5" />
                </span>
                <h3 className="text-base md:text-lg font-bold text-slate-100">
                  {editingBanner
                    ? tr('تعديل اللافتة الإعلانية', 'Modifier la bannière', 'Edit Banner')
                    : tr('إضافة لافتة جديدة', 'Ajouter une nouvelle bannière', 'Add New Banner')}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Column 1: Inputs & Config (7 cols) */}
              <div className="lg:col-span-7 space-y-5">
                {/* Form Tabs */}
                <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1">
                  <button
                    type="button"
                    onClick={() => setActiveFormTab('content_ar')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                      activeFormTab === 'content_ar' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    العربية
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFormTab('content_fr')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                      activeFormTab === 'content_fr' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Français
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFormTab('content_en')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                      activeFormTab === 'content_en' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFormTab('settings')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                      activeFormTab === 'settings' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tr('الإعدادات والصور', 'Paramètres', 'Settings & Images')}
                  </button>
                </div>

                {/* ARABIC CONTENT TAB */}
                {activeFormTab === 'content_ar' && (
                  <div className="space-y-4 animate-in fade-in duration-150" dir="rtl">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">العنوان الرئيسي (العربية)</label>
                      <input
                        type="text"
                        value={titleAr}
                        onChange={(e) => setTitleAr(e.target.value)}
                        placeholder="مثال: تخفيضات الصيف الكبرى"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">العنوان الفرعي (العربية)</label>
                      <input
                        type="text"
                        value={subtitleAr}
                        onChange={(e) => setSubtitleAr(e.target.value)}
                        placeholder="مثال: خصومات تصل إلى 50% على جميع المنتجات وشحن مجاني"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">الوصف التفصيلي (العربية)</label>
                      <textarea
                        value={descriptionAr}
                        onChange={(e) => setDescriptionAr(e.target.value)}
                        placeholder="وصف اختياري يظهر داخل تفاصيل اللافتة الإعلانية..."
                        rows={2}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">نص زر الدعوة (العربية)</label>
                      <input
                        type="text"
                        value={buttonTextAr}
                        onChange={(e) => setButtonTextAr(e.target.value)}
                        placeholder="مثال: تسوق العروض الآن"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* FRENCH CONTENT TAB */}
                {activeFormTab === 'content_fr' && (
                  <div className="space-y-4 animate-in fade-in duration-150" dir="ltr">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Titre principal (Français)</label>
                      <input
                        type="text"
                        value={titleFr}
                        onChange={(e) => setTitleFr(e.target.value)}
                        placeholder="Ex: Grandes Soldes d'Été"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Sous-titre (Français)</label>
                      <input
                        type="text"
                        value={subtitleFr}
                        onChange={(e) => setSubtitleFr(e.target.value)}
                        placeholder="Ex: Jusqu'à -50% de réduction sur toute la sélection"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Description (Français)</label>
                      <textarea
                        value={descriptionFr}
                        onChange={(e) => setDescriptionFr(e.target.value)}
                        placeholder="Description optionnelle de la bannière..."
                        rows={2}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Texte du bouton (Français)</label>
                      <input
                        type="text"
                        value={buttonTextFr}
                        onChange={(e) => setButtonTextFr(e.target.value)}
                        placeholder="Ex: Acheter Maintenant"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* ENGLISH CONTENT TAB */}
                {activeFormTab === 'content_en' && (
                  <div className="space-y-4 animate-in fade-in duration-150" dir="ltr">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Headline (English)</label>
                      <input
                        type="text"
                        value={titleEn}
                        onChange={(e) => setTitleEn(e.target.value)}
                        placeholder="e.g. Grand Summer Festival"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Subtitle (English)</label>
                      <input
                        type="text"
                        value={subtitleEn}
                        onChange={(e) => setSubtitleEn(e.target.value)}
                        placeholder="e.g. Up to 50% off on all items with free shipping"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Description (English)</label>
                      <textarea
                        value={descriptionEn}
                        onChange={(e) => setDescriptionEn(e.target.value)}
                        placeholder="Optional English banner summary..."
                        rows={2}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">CTA Button Text (English)</label>
                      <input
                        type="text"
                        value={buttonTextEn}
                        onChange={(e) => setButtonTextEn(e.target.value)}
                        placeholder="e.g. Shop Now"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* SETTINGS AND IMAGES TAB */}
                {activeFormTab === 'settings' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Types & Target Pages */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          {tr('نوع اللافتة', 'Type de bannière', 'Banner Type')}
                        </label>
                        <select
                          value={bannerType}
                          onChange={(e) => setBannerType(e.target.value as BannerType)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="hero">{tr('لافتة سكرول رئيسية (Hero Slider)', 'Bannière Carrousel (Hero)', 'Homepage Hero Slider')}</option>
                          <option value="promo">{tr('لافتة ترويجية عادية', 'Bannière Promotionnelle', 'Promotion Banner')}</option>
                          <option value="category">{tr('لافتة قسم محدد', 'Bannière Catégorie', 'Category Banner')}</option>
                          <option value="wholesale">{tr('لافتة تجار الجملة', 'Bannière Gros', 'Wholesale Banner')}</option>
                          <option value="retail">{tr('لافتة تجزئة', 'Bannière Détail', 'Retail Banner')}</option>
                          <option value="announcement">{tr('شريط إعلاني (Announcement)', 'Bannière d\'Annonce', 'Announcement Banner')}</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          {tr('صفحة العرض / الجمهور', 'Page Cible / Audience', 'Target Page / Audience')}
                        </label>
                        <select
                          value={targetPage}
                          onChange={(e) => setTargetPage(e.target.value as BannerTargetPage)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="homepage">{tr('الصفحة الرئيسية (Homepage)', 'Page d\'Accueil', 'Homepage')}</option>
                          <option value="category">{tr('صفحات الأقسام', 'Pages Catégories', 'Category Pages')}</option>
                          <option value="retail">{tr('زبائن التجزئة فقط', 'Clients Détail Uniquement', 'Retail Only')}</option>
                          <option value="wholesale">{tr('تجار الجملة فقط', 'Clients Gros Uniquement', 'Wholesale Only')}</option>
                          <option value="all">{tr('جميع الصفحات', 'Toutes les pages', 'All Pages')}</option>
                        </select>
                      </div>
                    </div>

                    {/* Real Uploaders */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Desktop image uploader */}
                      <div className="p-3.5 border border-slate-800 rounded-2xl bg-slate-950/60">
                        <label className="block text-xs font-bold text-slate-200 mb-2">
                          🖥️ {tr('صورة سطح المكتب', 'Image Bureau', 'Desktop Image')}
                        </label>
                        <ImageUploader
                          bucket="cms-images"
                          folder={desktopFolder}
                          images={desktopImages}
                          onChange={setDesktopImages}
                          multiple={false}
                          label={tr('رفع صورة سطح المكتب', 'Image bureau', 'Upload Desktop Image')}
                          onNotification={(type, msg) => showToast(msg, type)}
                        />
                        <div className="mt-2 text-[10px] text-slate-400">
                          {tr('أو أدخل رابط صورة مباشر:', 'Ou entrez l\'URL de l\'image :', 'Or enter direct URL:')}
                          <input
                            type="text"
                            value={manualImageUrl}
                            onChange={(e) => setManualImageUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Mobile image uploader */}
                      <div className="p-3.5 border border-slate-800 rounded-2xl bg-slate-950/60">
                        <label className="block text-xs font-bold text-slate-200 mb-2">
                          📱 {tr('صورة الهاتف المحمول (اختيارية)', 'Image Mobile (Optionnelle)', 'Mobile Image (Optional)')}
                        </label>
                        <ImageUploader
                          bucket="cms-images"
                          folder={mobileFolder}
                          images={mobileImages}
                          onChange={setMobileImages}
                          multiple={false}
                          label={tr('رفع صورة الهاتف', 'Image mobile', 'Upload Mobile Image')}
                          onNotification={(type, msg) => showToast(msg, type)}
                        />
                      </div>
                    </div>

                    {/* Routing & Colors */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                          <Link2 className="h-3.5 w-3.5 text-slate-400" />
                          {tr('رابط التوجيه (CTA Link)', 'Lien CTA', 'CTA Link')}
                        </label>
                        <input
                          type="text"
                          value={buttonLink}
                          onChange={(e) => setButtonLink(e.target.value)}
                          placeholder="/products, /category/electronics, http://..."
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                          <Palette className="h-3.5 w-3.5 text-slate-400" />
                          {tr('محاذاة النص', 'Alignement du texte', 'Text Alignment')}
                        </label>
                        <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1 w-fit">
                          <button
                            type="button"
                            onClick={() => setTextAlignment('left')}
                            className={`p-1.5 rounded-lg text-xs ${textAlignment === 'left' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                            title="Left"
                          >
                            <AlignLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextAlignment('center')}
                            className={`p-1.5 rounded-lg text-xs ${textAlignment === 'center' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                            title="Center"
                          >
                            <AlignCenter className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextAlignment('right')}
                            className={`p-1.5 rounded-lg text-xs ${textAlignment === 'right' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                            title="Right"
                          >
                            <AlignRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Colors & Visibility */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          {tr('لون خلفية الزر', 'Couleur du bouton', 'Button Color')}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={buttonColor}
                            onChange={(e) => setButtonColor(e.target.value)}
                            className="w-8 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer p-0.5"
                          />
                          <input
                            type="text"
                            value={buttonColor}
                            onChange={(e) => setButtonColor(e.target.value)}
                            className="w-full text-xs rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 uppercase"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          {tr('لون النص', 'Couleur du texte', 'Text Color')}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="w-8 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer p-0.5"
                          />
                          <input
                            type="text"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="w-full text-xs rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 uppercase"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          {tr('العرض على الحاسوب', 'Visible Bureau', 'Desktop Visibility')}
                        </label>
                        <button
                          type="button"
                          onClick={() => setDesktopVisibility(!desktopVisibility)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                            desktopVisibility ? 'bg-indigo-950/60 text-indigo-300 border-indigo-700' : 'bg-slate-950 text-slate-500 border-slate-800'
                          }`}
                        >
                          <Laptop className="h-4 w-4" />
                          {desktopVisibility ? tr('مفعل', 'Oui', 'Yes') : tr('معطل', 'Non', 'No')}
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          {tr('العرض على الهاتف', 'Visible Mobile', 'Mobile Visibility')}
                        </label>
                        <button
                          type="button"
                          onClick={() => setMobileVisibility(!mobileVisibility)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                            mobileVisibility ? 'bg-indigo-950/60 text-indigo-300 border-indigo-700' : 'bg-slate-950 text-slate-500 border-slate-800'
                          }`}
                        >
                          <Smartphone className="h-4 w-4" />
                          {mobileVisibility ? tr('مفعل', 'Oui', 'Yes') : tr('معطل', 'Non', 'No')}
                        </button>
                      </div>
                    </div>

                    {/* Enable Toggle & Scheduling */}
                    <div className="border-t border-slate-800 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          {tr('حالة اللافتة العامة', 'Statut général', 'General Status')}
                        </label>
                        <button
                          type="button"
                          onClick={() => setActive(!active)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-colors w-full justify-center ${
                            active ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700' : 'bg-slate-950 text-slate-500 border-slate-800'
                          }`}
                        >
                          {active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                          {active ? tr('مفعلة وتنشط بالجدولة', 'Activée', 'Enabled') : tr('معطلة نهائياً', 'Désactivée', 'Disabled')}
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {tr('تاريخ البدء (جدولة)', 'Date de début', 'Start Date')}
                        </label>
                        <input
                          type="datetime-local"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {tr('تاريخ الانتهاء (جدولة)', 'Date de fin', 'End Date')}
                        </label>
                        <input
                          type="datetime-local"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Column 2: Live Mockup Previews (5 cols) */}
              <div className="lg:col-span-5 bg-slate-950/80 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Eye className="h-4 w-4 text-indigo-400" />
                    {tr('معاينة حية وتفاعلية', 'Aperçu en direct', 'Live Interactive Preview')}
                  </h4>
                  
                  <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      className={`p-1 rounded ${previewDevice === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                    >
                      <Laptop className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('mobile')}
                      className={`p-1 rounded ${previewDevice === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Banner Mockup Render */}
                <div className="flex-1 flex items-center justify-center min-h-[200px]">
                  <div
                    className={`relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl transition-all duration-300 shadow-xl ${
                      previewDevice === 'desktop' ? 'w-full aspect-[21/9]' : 'w-[210px] aspect-[9/12]'
                    }`}
                  >
                    {previewDevice === 'desktop' ? (
                      desktopImages[0]?.url || manualImageUrl ? (
                        <img
                          src={desktopImages[0]?.url || manualImageUrl}
                          alt="Desktop preview"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.onerror = null;
                            target.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=80';
                          }}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-center p-4">
                          <ImageIcon className="h-8 w-8 mb-1 opacity-50" />
                          <span className="text-[10px]">{tr('قم برفع صورة لمعاينة النتيجة', 'Chargez une image pour aperçu', 'Upload image to preview')}</span>
                        </div>
                      )
                    ) : (
                      mobileImages[0]?.url ? (
                        <img
                          src={mobileImages[0].url}
                          alt="Mobile preview"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.onerror = null;
                            target.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=80';
                          }}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : desktopImages[0]?.url || manualImageUrl ? (
                        <img
                          src={desktopImages[0]?.url || manualImageUrl}
                          alt="Mobile preview fallback"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.onerror = null;
                            target.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=80';
                          }}
                          className="absolute inset-0 w-full h-full object-cover opacity-80"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-center p-2">
                          <ImageIcon className="h-6 w-6 mb-1 opacity-50" />
                          <span className="text-[8px]">{tr('معاينة الهاتف', 'Aperçu Mobile', 'Mobile Preview')}</span>
                        </div>
                      )
                    )}

                    {(desktopImages[0]?.url || manualImageUrl || mobileImages[0]?.url) && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
                    )}

                    {(desktopImages[0]?.url || manualImageUrl || mobileImages[0]?.url) && (
                      <div
                        className="absolute inset-0 p-4 flex flex-col justify-end"
                        style={{
                          color: textColor,
                          textAlign: textAlignment === 'center' ? 'center' : textAlignment === 'right' ? 'right' : 'left',
                        }}
                      >
                        <div
                          className={`flex flex-col h-full justify-center ${
                            textAlignment === 'center' ? 'items-center' : textAlignment === 'right' ? 'items-end' : 'items-start'
                          }`}
                        >
                          <h4 className={`font-bold leading-tight ${previewDevice === 'desktop' ? 'text-sm' : 'text-xs'}`}>
                            {titleAr || titleFr || titleEn || title || 'عنوان اللافتة'}
                          </h4>
                          <p className={`mt-1 font-light opacity-90 leading-tight max-w-xs ${previewDevice === 'desktop' ? 'text-[10px]' : 'text-[8px]'}`}>
                            {subtitleAr || subtitleFr || subtitleEn || subtitle || 'العنوان الفرعي المخصص للافتة'}
                          </p>
                          {(buttonTextAr || buttonTextFr || buttonTextEn || buttonText) && (
                            <span
                              className="mt-2.5 rounded-lg px-3 py-1 font-bold inline-block text-[10px] shadow-md"
                              style={{ backgroundColor: buttonColor, color: '#ffffff' }}
                            >
                              {buttonTextAr || buttonTextFr || buttonTextEn || buttonText}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 space-y-1 bg-slate-900 p-3 border border-slate-800 rounded-xl">
                  <div className="font-semibold text-slate-300">{tr('بيانات النشر والجدولة:', 'Détails de publication :', 'Publish Details:')}</div>
                  <div>• {tr('نوع اللافتة:', 'Type :', 'Banner Type:')} <span className="font-bold text-indigo-400">{bannerType}</span></div>
                  <div>• {tr('الصفحة المستهدفة:', 'Page :', 'Target Page:')} <span className="font-bold text-slate-200">{targetPage}</span></div>
                  <div>• {tr('الحالة العامة:', 'Statut :', 'Status:')} <span className={active ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{active ? tr('مفعلة', 'Activée', 'Enabled') : tr('معطلة', 'Désactivée', 'Disabled')}</span></div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                {tr('إلغاء', 'Annuler', 'Cancel')}
              </button>
              
              <button
                type="button"
                disabled={saving || isUploading}
                onClick={handleSave}
                className="inline-flex items-center gap-2 justify-center rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tr('جاري الحفظ...', 'Enregistrement...', 'Saving...')}
                  </>
                ) : isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tr('جاري رفع الصور...', 'Téléchargement...', 'Uploading...')}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {tr('حفظ ونشر', 'Enregistrer & Publier', 'Save & Publish')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVITY LOGS MODAL */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  {tr('سجل نشاطات إدارة اللافتات', 'Journal d\'activités des bannières', 'Banner Activity Logs')}
                </h3>
              </div>
              <button onClick={() => setShowLogsModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activityLogs.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-500">
                  {tr('لا توجد نشاطات مسجلة بعد.', 'Aucune activité enregistrée pour le moment.', 'No recorded activity logs yet.')}
                </p>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl border border-slate-800 bg-slate-950/40 text-xs flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-block rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 text-[10px] font-bold mb-1">
                        {log.action}
                      </span>
                      <p className="text-slate-200 font-medium">{log.details}</p>
                      <span className="text-[10px] text-slate-500 mt-1 block">بواسطة: {log.user}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                      {formatDate(log.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
              <button
                onClick={() => setShowLogsModal(false)}
                className="rounded-xl bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                {tr('إغلاق', 'Fermer', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={!!bannerToDelete}
        onClose={() => setBannerToDelete(null)}
        onConfirm={confirmSingleDelete}
        title={tr('تأكيد حذف اللافتة', 'Confirmer la suppression', 'Confirm Banner Deletion')}
        itemName={bannerToDelete ? ((isAr ? bannerToDelete.title_ar || bannerToDelete.title : bannerToDelete.title_fr || bannerToDelete.title) || undefined) : undefined}
        isDeleting={isDeleting}
        error={deleteModalError}
      />

      {/* BULK DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={confirmBulkDelete}
        title={tr(`تأكيد حذف ${selectedIds.length} لافتة`, `Confirmer la suppression de ${selectedIds.length} bannières`, `Confirm Delete ${selectedIds.length} Banners`)}
        description={tr(
          `هل أنت متأكد من رغبتك في حذف ${selectedIds.length} لافتة محددة نهائياً وحذف صورها من التخزين؟ لا يمكن التراجع عن هذا الإجراء.`,
          `Voulez-vous vraiment supprimer définitivement les ${selectedIds.length} bannières sélectionnées et leurs images du stockage ? Cette action est irréversible.`,
          `Are you sure you want to permanently delete the ${selectedIds.length} selected banners and their images from storage? This action cannot be undone.`
        )}
        isDeleting={isDeleting}
        error={deleteModalError}
      />
    </div>
  );
}
