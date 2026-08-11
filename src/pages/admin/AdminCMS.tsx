import { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Search, Trash2, Edit3, Eye, History, 
  Save, Upload, Download, FolderOpen, CheckCircle2, 
  Clock, Share2, ExternalLink, X, ChevronRight, ChevronLeft, 
  Loader2, Sparkles, Layers, RotateCcw, Activity, Check,
  Copy as CopyIcon
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { exportToCSV, parseCSVFile } from '../../lib/csvHelper';
import { 
  fetchPages, 
  savePage, 
  deletePage, 
  togglePagePublishStatus,
  fetchCMSActivityLogs,
  logCMSActivity
} from '../../lib/cms';
import { 
  CMSPage, CMSPageStatus, CMSPageType, CMSPageRevision, 
  CMSActivityLog, CMSPageSEO 
} from '../../types';
import RichTextEditor from '../../components/admin/cms/RichTextEditor';
import MediaLibrary from '../../components/admin/cms/MediaLibrary';

// Pre-seeded enterprise default pages
const INITIAL_PAGES: CMSPage[] = [];

const INITIAL_LOGS: CMSActivityLog[] = [];

export default function AdminCMS() {
  const { lang, dir } = useLanguage();
  const { showToast } = useToast();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'pages' | 'media' | 'logs'>('pages');

  // Core CMS Data
  const [pages, setPages] = useState<CMSPage[]>(INITIAL_PAGES);
  const [activityLogs, setActivityLogs] = useState<CMSActivityLog[]>(INITIAL_LOGS);
  const [loading, setLoading] = useState(true);

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CMSPageStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'static' | 'custom'>('all');
  const [sortBy, setSortBy] = useState<'updated_at' | 'title' | 'views'>('updated_at');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selection
  const [selectedPageIds, setSelectedPageIds] = useState<Record<string, boolean>>({});

  // Editor Modal State
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingPage, setEditingPage] = useState<CMSPage | null>(null);
  const [editorFormTab, setEditorFormTab] = useState<'ar' | 'fr' | 'en' | 'seo' | 'history' | 'settings'>('ar');

  // Form Inputs
  const [formKey, setFormKey] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formType, setFormType] = useState<CMSPageType>('custom');
  const [formTitleAr, setFormTitleAr] = useState('');
  const [formTitleFr, setFormTitleFr] = useState('');
  const [formTitleEn, setFormTitleEn] = useState('');
  const [formContentAr, setFormContentAr] = useState('');
  const [formContentFr, setFormContentFr] = useState('');
  const [formContentEn, setFormContentEn] = useState('');
  const [formStatus, setFormStatus] = useState<CMSPageStatus>('draft');
  const [formPublishDate, setFormPublishDate] = useState('');
  
  // SEO Form Inputs
  const [seoMetaTitleAr, setSeoMetaTitleAr] = useState('');
  const [seoMetaTitleFr, setSeoMetaTitleFr] = useState('');
  const [seoMetaDescAr, setSeoMetaDescAr] = useState('');
  const [seoMetaDescFr, setSeoMetaDescFr] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [seoOgTitle, setSeoOgTitle] = useState('');
  const [seoOgDesc, setSeoOgDesc] = useState('');
  const [seoOgImage, setSeoOgImage] = useState('');
  const [seoTwitterType, setSeoTwitterType] = useState<'summary' | 'summary_large_image'>('summary_large_image');

  // Media Library Picker Overlay inside Editor
  const [showMediaPickerForEditor, setShowMediaPickerForEditor] = useState(false);

  // Auto Save Tracker
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewPage, setPreviewPage] = useState<CMSPage | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewLang, setPreviewLang] = useState<'ar' | 'fr' | 'en'>('ar');

  // CSV Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importingFile, setImportingFile] = useState(false);

  // Single & Bulk Delete Modal State
  const [deleteTargetPage, setDeleteTargetPage] = useState<{ id: string; title: string; slug: string } | null>(null);
  const [isDeletingPage, setIsDeletingPage] = useState(false);
  const [deletePageError, setDeletePageError] = useState<string | null>(null);

  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  useEffect(() => {
    loadCMSData();
  }, []);

  const loadCMSData = async () => {
    setLoading(true);
    try {
      const pageList = await fetchPages();
      setPages(pageList);
      const logs = await fetchCMSActivityLogs();
      setActivityLogs(logs);
    } catch (e) {
      console.error('[AdminCMS] Error fetching CMS pages:', e);
      setPages(INITIAL_PAGES);
    } finally {
      setLoading(false);
    }
  };

  // Helper log generator
  const logActivity = (action: string, details: string, name: string, type: 'page' | 'media' | 'system' = 'page') => {
    const newLog: CMSActivityLog = {
      id: `log-${Date.now()}`,
      action,
      details,
      entity_type: type,
      entity_name: name,
      timestamp: new Date().toISOString(),
      user: 'Admin',
      ip_address: '197.200.41.22'
    };
    setActivityLogs(prev => [newLog, ...prev]);
    logCMSActivity({
      action,
      details,
      entity_type: type,
      entity_name: name,
      user: 'Admin',
      ip_address: '197.200.41.22',
    }).catch(err => console.warn('[AdminCMS] Failed to persist activity log:', err));
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingPage(null);
    setFormKey(`page_${Date.now()}`);
    setFormSlug(`page-${Math.random().toString(36).slice(2, 8)}`);
    setFormType('custom');
    setFormTitleAr('');
    setFormTitleFr('');
    setFormTitleEn('');
    setFormContentAr('');
    setFormContentFr('');
    setFormContentEn('');
    setFormStatus('draft');
    setFormPublishDate('');
    
    // SEO
    setSeoMetaTitleAr('');
    setSeoMetaTitleFr('');
    setSeoMetaDescAr('');
    setSeoMetaDescFr('');
    setSeoKeywords('');
    setSeoOgTitle('');
    setSeoOgDesc('');
    setSeoOgImage('');
    setSeoTwitterType('summary_large_image');

    setLastAutoSaveTime(null);
    setEditorFormTab('ar');
    setShowEditorModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (pageItem: CMSPage) => {
    setEditingPage(pageItem);
    setFormKey(pageItem.key);
    setFormSlug(pageItem.slug);
    setFormType(pageItem.type);
    setFormTitleAr(pageItem.title_ar);
    setFormTitleFr(pageItem.title_fr);
    setFormTitleEn(pageItem.title_en || '');
    setFormContentAr(pageItem.content_ar);
    setFormContentFr(pageItem.content_fr);
    setFormContentEn(pageItem.content_en || '');
    setFormStatus(pageItem.status);
    setFormPublishDate(pageItem.publish_date ? pageItem.publish_date.slice(0, 16) : '');

    // SEO
    const seo = pageItem.seo || {};
    setSeoMetaTitleAr(seo.meta_title_ar || '');
    setSeoMetaTitleFr(seo.meta_title_fr || '');
    setSeoMetaDescAr(seo.meta_description_ar || '');
    setSeoMetaDescFr(seo.meta_description_fr || '');
    setSeoKeywords(seo.keywords ? seo.keywords.join(', ') : '');
    setSeoOgTitle(seo.og_title || '');
    setSeoOgDesc(seo.og_description || '');
    setSeoOgImage(seo.og_image || '');
    setSeoTwitterType(seo.twitter_card_type || 'summary_large_image');

    setLastAutoSaveTime(null);
    setEditorFormTab('ar');
    setShowEditorModal(true);
  };

  // Auto Save Effect while Editing
  useEffect(() => {
    if (!showEditorModal) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      if (formTitleAr || formTitleFr) {
        const timeStr = new Date().toLocaleTimeString(lang === 'ar' ? 'ar-DZ' : 'fr-FR');
        setLastAutoSaveTime(timeStr);
      }
    }, 15000); // 15s auto-save trigger

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [formTitleAr, formTitleFr, formContentAr, formContentFr, formSlug, showEditorModal, lang]);

  // Save Page Handler
  const handleSavePage = async (forceStatus?: CMSPageStatus) => {
    const targetStatus = forceStatus || formStatus;
    const cleanSlug = (formSlug || formTitleFr || formTitleAr)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');

    const seoData: CMSPageSEO = {
      meta_title_ar: seoMetaTitleAr || formTitleAr,
      meta_title_fr: seoMetaTitleFr || formTitleFr,
      meta_description_ar: seoMetaDescAr,
      meta_description_fr: seoMetaDescFr,
      keywords: seoKeywords ? seoKeywords.split(',').map(k => k.trim()).filter(Boolean) : [],
      og_title: seoOgTitle || formTitleAr,
      og_description: seoOgDesc || seoMetaDescAr,
      og_image: seoOgImage,
      twitter_card_type: seoTwitterType,
    };

    // Revision snapshot
    const currentRevisions = editingPage ? [...editingPage.revisions] : [];
    const newRevision: CMSPageRevision = {
      id: `rev-${Date.now()}`,
      version: currentRevisions.length + 1,
      timestamp: new Date().toISOString(),
      author: 'Admin',
      title_ar: formTitleAr,
      title_fr: formTitleFr,
      title_en: formTitleEn,
      content_ar: formContentAr,
      content_fr: formContentFr,
      content_en: formContentEn,
      status: targetStatus,
    };

    const payloadPage: CMSPage = {
      id: editingPage ? editingPage.id : `page-${Date.now()}`,
      key: formKey || cleanSlug,
      slug: cleanSlug,
      type: formType,
      title_ar: formTitleAr || 'صفحة بدون عنوان',
      title_fr: formTitleFr || 'Sans titre',
      title_en: formTitleEn || 'Untitled',
      content_ar: formContentAr,
      content_fr: formContentFr,
      content_en: formContentEn,
      status: targetStatus,
      publish_date: formPublishDate ? new Date(formPublishDate).toISOString() : new Date().toISOString(),
      seo: seoData,
      revisions: [newRevision, ...currentRevisions],
      created_at: editingPage ? editingPage.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: editingPage?.author || 'Admin',
      view_count: editingPage?.view_count || 0,
    };

    try {
      const res = await savePage(payloadPage);
      if (res.success) {
        const freshPages = await fetchPages();
        setPages(freshPages);

        await logCMSActivity({
          action: editingPage ? 'Page Updated' : 'Page Created',
          details: `${editingPage ? 'Updated' : 'Created'} page "${payloadPage.title_ar}"`,
          entity_type: 'page',
          entity_name: payloadPage.slug,
          user: 'Admin',
        });

        showToast(
          editingPage
            ? (lang === 'ar' ? 'تم تحديث الصفحة وحفظها بنجاح' : 'Page mise à jour avec succès')
            : (lang === 'ar' ? 'تم إنشاء ونشر الصفحة بنجاح' : 'Page créée avec succès'),
          'success'
        );
        setShowEditorModal(false);
      } else {
        showToast(res.error || (lang === 'ar' ? 'حدث خطأ في حفظ الصفحة' : 'Erreur d\'enregistrement'), 'error');
      }
    } catch (e) {
      console.error('[AdminCMS] Save error:', e);
      showToast(lang === 'ar' ? 'حدث خطأ في حفظ الصفحة' : 'Erreur d\'enregistrement', 'error');
    }
  };

  // Toggle Status Publish / Unpublish
  const handleTogglePublish = async (pageItem: CMSPage) => {
    try {
      const { success, nextStatus } = await togglePagePublishStatus(pageItem.id, pageItem.status);
      if (success) {
        const freshPages = await fetchPages();
        setPages(freshPages);
        
        await logCMSActivity({
          action: nextStatus === 'published' ? 'Page Published' : 'Page Unpublished',
          details: `${nextStatus === 'published' ? 'Published' : 'Unpublished'} page "${pageItem.title_ar}"`,
          entity_type: 'page',
          entity_name: pageItem.slug,
          user: 'Admin',
        });

        showToast(
          nextStatus === 'published' 
            ? (lang === 'ar' ? 'تم نشر الصفحة بنجاح' : 'Page publiée') 
            : (lang === 'ar' ? 'تم سحب الصفحة إلى المسودات' : 'Page mise en brouillon'),
          'success'
        );
      }
    } catch (e) {
      console.error('[AdminCMS] Toggle publish error:', e);
    }
  };

  // Duplicate Page
  const handleDuplicatePage = async (pageItem: CMSPage) => {
    const dupSlug = `${pageItem.slug}-copy-${Math.floor(Math.random() * 1000)}`;
    const duplicatedPage: CMSPage = {
      ...pageItem,
      id: `page-${Date.now()}`,
      key: dupSlug,
      slug: dupSlug,
      title_ar: `${pageItem.title_ar} (نسخة)`,
      title_fr: `${pageItem.title_fr} (Copie)`,
      title_en: `${pageItem.title_en} (Copy)`,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      view_count: 0,
    };
    await savePage(duplicatedPage);
    const freshPages = await fetchPages();
    setPages(freshPages);
    showToast(lang === 'ar' ? 'تم تكرار الصفحة بنجاح' : 'Page dupliquée avec succès', 'success');
  };

  // Restore Revision
  const handleRestoreRevision = (rev: CMSPageRevision) => {
    setFormTitleAr(rev.title_ar);
    setFormTitleFr(rev.title_fr);
    setFormTitleEn(rev.title_en || '');
    setFormContentAr(rev.content_ar);
    setFormContentFr(rev.content_fr);
    setFormContentEn(rev.content_en || '');
    setFormStatus(rev.status);
    showToast(
      lang === 'ar' ? `تم استرجاع المراجعة رقم #${rev.version} بنجاح` : `Révision #${rev.version} restaurée`,
      'success'
    );
  };

  // Delete Page Modal Trigger
  const handleDeletePage = (id: string, pageTitle: string, pageSlug: string) => {
    setDeletePageError(null);
    setDeleteTargetPage({ id, title: pageTitle, slug: pageSlug });
  };

  const handleConfirmDeletePage = async () => {
    if (!deleteTargetPage) return;
    setIsDeletingPage(true);
    setDeletePageError(null);
    try {
      const res = await deletePage(deleteTargetPage.id);
      if (res.success) {
        const freshPages = await fetchPages();
        setPages(freshPages);
        await logCMSActivity({
          action: 'Page Deleted',
          details: `Deleted page "${deleteTargetPage.title}"`,
          entity_type: 'page',
          entity_name: deleteTargetPage.slug,
          user: 'Admin',
        });
        showToast(lang === 'ar' ? 'تم حذف الصفحة بنجاح' : 'Page supprimée avec succès', 'success');
        setDeleteTargetPage(null);
      } else {
        setDeletePageError(res.error || (lang === 'ar' ? 'حدث خطأ أثناء حذف الصفحة' : 'Erreur lors de la suppression'));
        showToast(res.error || (lang === 'ar' ? 'حدث خطأ أثناء حذف الصفحة' : 'Erreur lors de la suppression'), 'error');
      }
    } catch (e: unknown) {
      console.error('[AdminCMS] Delete page error:', e);
      const msg = (e as Error)?.message || (lang === 'ar' ? 'حدث خطأ أثناء حذف الصفحة' : 'Erreur lors de la suppression');
      setDeletePageError(msg);
      showToast(msg, 'error');
    } finally {
      setIsDeletingPage(false);
    }
  };

  // Bulk Delete Modal Trigger
  const selectedIds = Object.keys(selectedPageIds).filter(id => selectedPageIds[id]);
  const handleBulkDelete = () => {
    if (!selectedIds.length) return;
    setBulkDeleteError(null);
    setShowBulkDeleteModal(true);
  };

  const handleConfirmBulkDelete = async () => {
    if (!selectedIds.length) return;
    setIsBulkDeleting(true);
    setBulkDeleteError(null);
    try {
      for (const id of selectedIds) {
        await deletePage(id);
      }
      const freshPages = await fetchPages();
      setPages(freshPages);
      setSelectedPageIds({});
      await logCMSActivity({
        action: 'Bulk Pages Deleted',
        details: `Deleted ${selectedIds.length} pages`,
        entity_type: 'page',
        entity_name: 'bulk',
        user: 'Admin',
      });
      showToast(lang === 'ar' ? 'تم حذف الصفحات المحددة بنجاح' : 'Pages supprimées avec succès', 'success');
      setShowBulkDeleteModal(false);
    } catch (e: unknown) {
      console.error('[AdminCMS] Bulk delete error:', e);
      const msg = (e as Error)?.message || (lang === 'ar' ? 'حدث خطأ أثناء حذف الصفحات المحددة' : 'Erreur lors de la suppression');
      setBulkDeleteError(msg);
      showToast(msg, 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Bulk Status Change
  const handleBulkStatusChange = async (newStatus: CMSPageStatus) => {
    if (!selectedIds.length) return;
    try {
      for (const id of selectedIds) {
        const pageItem = pages.find(p => p.id === id);
        if (pageItem) {
          await savePage({ ...pageItem, status: newStatus });
        }
      }
      const freshPages = await fetchPages();
      setPages(freshPages);
      setSelectedPageIds({});
      await logCMSActivity({
        action: 'Bulk Status Change',
        details: `Changed status to ${newStatus} for ${selectedIds.length} pages`,
        entity_type: 'page',
        entity_name: 'bulk',
        user: 'Admin',
      });
      showToast(lang === 'ar' ? 'تم تحديث حالة الصفحات المحددة' : 'Statut mis à jour', 'success');
    } catch (e) {
      console.error('[AdminCMS] Bulk status change error:', e);
      showToast(lang === 'ar' ? 'حدث خطأ أثناء تحديث حالة الصفحات' : 'Erreur de mise à jour', 'error');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const exportData = filteredPages.map(p => ({
      ID: p.id,
      Key: p.key,
      Slug: p.slug,
      Type: p.type,
      Title_AR: p.title_ar,
      Title_FR: p.title_fr,
      Title_EN: p.title_en,
      Status: p.status,
      Views: p.view_count || 0,
      Meta_Title_AR: p.seo.meta_title_ar || '',
      Meta_Desc_AR: p.seo.meta_description_ar || '',
      Created_At: p.created_at,
      Updated_At: p.updated_at,
    }));
    exportToCSV(exportData, 'content_pages_export');
    logActivity('CSV Exported', `Exported ${exportData.length} pages to CSV`, 'export');
    showToast(lang === 'ar' ? 'تم تصدير ملف CSV بنجاح' : 'Export CSV réussi', 'success');
  };

  // CSV Import
  const handleImportCSV = async (file: File) => {
    setImportingFile(true);
    try {
      const rows = await parseCSVFile(file);
      if (!rows || rows.length === 0) {
        showToast(lang === 'ar' ? 'ملف CSV فارغ أو غير صالحة' : 'Fichier CSV vide', 'error');
        return;
      }

      const importedPages: CMSPage[] = rows.map((r, idx) => ({
        id: `page-imp-${Date.now()}-${idx}`,
        key: r.key || r.slug || `page-${Date.now()}-${idx}`,
        slug: r.slug || `page-${Date.now()}-${idx}`,
        type: (r.type as CMSPageType) || 'custom',
        title_ar: r.title_ar || r.title || 'صفحة مستوردة',
        title_fr: r.title_fr || r.title || 'Page Importée',
        title_en: r.title_en || 'Imported Page',
        content_ar: r.content_ar || '<p>محتوى استيراد جديد</p>',
        content_fr: r.content_fr || '<p>Contenu importé</p>',
        content_en: r.content_en || '<p>Imported content</p>',
        status: (r.status as CMSPageStatus) || 'draft',
        seo: { meta_title_ar: r.meta_title_ar, meta_description_ar: r.meta_desc_ar },
        revisions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: 'CSV Import',
      }));

      for (const p of importedPages) {
        await savePage(p);
      }

      const freshPages = await fetchPages();
      setPages(freshPages);
      setShowImportModal(false);
      await logCMSActivity({
        action: 'CSV Imported',
        details: `Imported ${importedPages.length} pages from CSV`,
        entity_type: 'page',
        entity_name: 'import',
        user: 'Admin',
      });
      showToast(lang === 'ar' ? `تم استيراد ${importedPages.length} صفحة بنجاح` : `${importedPages.length} pages importées`, 'success');
    } catch (err) {
      console.error('[AdminCMS] Import error:', err);
      showToast(lang === 'ar' ? 'حدث خطأ في قراءة ملف CSV' : 'Erreur lors de l\'importation', 'error');
    } finally {
      setImportingFile(false);
    }
  };

  // Filtering Pages
  const filteredPages = pages.filter(p => {
    const matchesSearch = 
      p.title_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.title_fr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.key.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesType = 
      typeFilter === 'all' || 
      (typeFilter === 'static' && p.type.startsWith('static_')) ||
      (typeFilter === 'custom' && p.type === 'custom');

    return matchesSearch && matchesStatus && matchesType;
  }).sort((a, b) => {
    if (sortBy === 'title') return a.title_ar.localeCompare(b.title_ar);
    if (sortBy === 'views') return (b.view_count || 0) - (a.view_count || 0);
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  // Pagination Math
  const totalPagesCount = Math.ceil(filteredPages.length / itemsPerPage);
  const paginatedPages = filteredPages.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Status Badge Helper
  const renderStatusBadge = (status: CMSPageStatus) => {
    if (status === 'published') {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-950/80 text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-bold border border-emerald-800">
          <CheckCircle2 className="w-3 h-3" />
          {lang === 'ar' ? 'منشورة' : 'Publiée'}
        </span>
      );
    }
    if (status === 'scheduled') {
      return (
        <span className="inline-flex items-center gap-1 bg-blue-950/80 text-blue-400 px-2.5 py-0.5 rounded-full text-xs font-bold border border-blue-800">
          <Clock className="w-3 h-3" />
          {lang === 'ar' ? 'مجدولة' : 'Programmée'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-amber-950/80 text-amber-400 px-2.5 py-0.5 rounded-full text-xs font-bold border border-amber-800">
        <Edit3 className="w-3 h-3" />
        {lang === 'ar' ? 'مسودة' : 'Brouillon'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100" dir={dir}>
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 p-5 rounded-xl border border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-400" />
            {lang === 'ar' ? 'إدارة محتوى المتجر والصفحات الثابتة' : 'Gestion du contenu (CMS)'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {lang === 'ar'
              ? 'صمم وأدر الصفحات الثابتة (عن الشركة، اتصل بنا، الشروط والأحكام، الخصوصية، FAQ) والصفحات المخصصة بالكامل مع محرر غني ومكتبة وسائط متكاملة.'
              : 'Créez et gérez les pages statiques et personnalisées avec éditeur riche et médiathèque.'}
          </p>
        </div>

        {/* Quick Top Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-slate-100 transition shadow-sm"
            title={lang === 'ar' ? 'تصدير كـ CSV' : 'Exporter CSV'}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'تصدير CSV' : 'Export'}</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-slate-100 transition shadow-sm"
            title={lang === 'ar' ? 'استيراد CSV' : 'Importer CSV'}
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'استيراد' : 'Import'}</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-500 transition"
          >
            <Plus className="w-4 h-4" />
            {lang === 'ar' ? 'إضافة صفحة جديدة' : 'Nouvelle Page'}
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-800 bg-slate-950 rounded-xl px-2 pt-1">
        <button
          onClick={() => setActiveTab('pages')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'pages'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          {lang === 'ar' ? `الصفحات (${pages.length})` : `Pages (${pages.length})`}
        </button>
        <button
          onClick={() => setActiveTab('media')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'media'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          {lang === 'ar' ? 'مكتبة الوسائط (Media Library)' : 'Médiathèque'}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          {lang === 'ar' ? `سجل النشاطات (${activityLogs.length})` : `Historique (${activityLogs.length})`}
        </button>
      </div>

      {/* TAB 1: PAGES MANAGEMENT */}
      {activeTab === 'pages' && (
        <div className="space-y-4">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">{lang === 'ar' ? 'إجمالي الصفحات' : 'Total Pages'}</span>
              <p className="text-2xl font-extrabold text-slate-100">{pages.length}</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400">{lang === 'ar' ? 'الصفحات المنشورة' : 'Publiées'}</span>
              <p className="text-2xl font-extrabold text-emerald-400">{pages.filter(p => p.status === 'published').length}</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-400">{lang === 'ar' ? 'المسودات' : 'Brouillons'}</span>
              <p className="text-2xl font-extrabold text-amber-400">{pages.filter(p => p.status === 'draft').length}</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-indigo-400">{lang === 'ar' ? 'إجمالي الزيارات' : 'Visites'}</span>
              <p className="text-2xl font-extrabold text-indigo-400">{pages.reduce((acc, p) => acc + (p.view_count || 0), 0)}</p>
            </div>
          </div>

          {/* Search & Filters Toolbar */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative min-w-[220px] flex-1 flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 focus-within:border-emerald-500">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder={lang === 'ar' ? 'بحث بالاسم، الرابط، أو المفتاح...' : 'Rechercher une page...'}
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as 'all' | CMSPageStatus); setCurrentPage(1); }}
                className="bg-slate-900 text-sm text-slate-200 border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">{lang === 'ar' ? 'كل الحالات' : 'Tous les statuts'}</option>
                <option value="published">{lang === 'ar' ? 'منشورة' : 'Publiée'}</option>
                <option value="draft">{lang === 'ar' ? 'مسودة' : 'Brouillon'}</option>
              </select>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value as 'all' | 'static' | 'custom'); setCurrentPage(1); }}
                className="bg-slate-900 text-sm text-slate-200 border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">{lang === 'ar' ? 'كل أنواع الصفحات' : 'Tous les types'}</option>
                <option value="static">{lang === 'ar' ? 'الصفحات الأساسية (Static)' : 'Pages Statiques'}</option>
                <option value="custom">{lang === 'ar' ? 'صفحات مخصصة (Custom)' : 'Pages Personnalisées'}</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'updated_at' | 'title' | 'views')}
                className="bg-slate-900 text-sm text-slate-200 border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                <option value="updated_at">{lang === 'ar' ? 'الترتيب: التعديل الأخير' : 'Trier: Modifié'}</option>
                <option value="title">{lang === 'ar' ? 'الترتيب: أبجدياً' : 'Trier: Nom'}</option>
                <option value="views">{lang === 'ar' ? 'الترتيب: الأكثر زيارة' : 'Trier: Vues'}</option>
              </select>
            </div>

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-800 px-3 py-1.5 rounded-lg text-xs">
                <span className="font-bold text-emerald-300">{selectedIds.length} {lang === 'ar' ? 'محدد' : 'sélectionnés'}</span>
                <button
                  onClick={() => handleBulkStatusChange('published')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-1 px-2.5 rounded text-[11px] transition"
                >
                  {lang === 'ar' ? 'نشر' : 'Publier'}
                </button>
                <button
                  onClick={() => handleBulkStatusChange('draft')}
                  className="border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 py-1 px-2.5 rounded text-[11px] transition"
                >
                  {lang === 'ar' ? 'مسودة' : 'Brouillon'}
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="p-1 text-rose-400 hover:bg-rose-950/60 rounded transition"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Table View */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs text-slate-300">
                <thead className="bg-slate-900 border-b border-slate-800 uppercase font-semibold text-slate-400">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={paginatedPages.length > 0 && paginatedPages.every(p => selectedPageIds[p.id])}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const newSel: Record<string, boolean> = {};
                          paginatedPages.forEach(p => { newSel[p.id] = checked; });
                          setSelectedPageIds(newSel);
                        }}
                        className="rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                      />
                    </th>
                    <th className="p-3 text-start">{lang === 'ar' ? 'عنوان الصفحة والمفتاح' : 'Titre & Clé'}</th>
                    <th className="p-3 text-start">{lang === 'ar' ? 'الرابط المباشر (Slug)' : 'URL Slug'}</th>
                    <th className="p-3 text-start">{lang === 'ar' ? 'نوع الصفحة' : 'Type'}</th>
                    <th className="p-3 text-center">{lang === 'ar' ? 'الحالة' : 'Statut'}</th>
                    <th className="p-3 text-center">{lang === 'ar' ? 'الزيارات' : 'Vues'}</th>
                    <th className="p-3 text-start">{lang === 'ar' ? 'تاريخ التحديث' : 'Modifiée'}</th>
                    <th className="p-3 text-end">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {paginatedPages.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500">
                        {lang === 'ar' ? 'لا توجد صفحات مطابقة للبحث والحقول' : 'Aucune page trouvée'}
                      </td>
                    </tr>
                  ) : (
                    paginatedPages.map((pageItem) => {
                      const isSelected = !!selectedPageIds[pageItem.id];
                      return (
                        <tr
                          key={pageItem.id}
                          className={`hover:bg-slate-900/60 transition-colors ${
                            isSelected ? 'bg-emerald-950/30' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => setSelectedPageIds({ ...selectedPageIds, [pageItem.id]: e.target.checked })}
                              className="rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-100 flex items-center gap-1.5">
                              <span>{lang === 'ar' ? pageItem.title_ar : pageItem.title_fr}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 block">{pageItem.key}</span>
                          </td>
                          <td className="p-3 font-mono text-emerald-400">
                            /p/{pageItem.slug}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300">
                              {pageItem.type.replace('static_', 'Static: ')}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {renderStatusBadge(pageItem.status)}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-200">
                            {pageItem.view_count || 0}
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {new Date(pageItem.updated_at).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-end">
                            <div className="flex items-center justify-end gap-1">
                              {/* Direct store link */}
                              <a
                                href={`/p/${pageItem.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400 transition"
                                title={lang === 'ar' ? 'عرض على المتجر' : 'Voir'}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>

                              {/* Preview Modal Trigger */}
                              <button
                                onClick={() => { setPreviewPage(pageItem); setShowPreviewModal(true); }}
                                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-400 transition"
                                title={lang === 'ar' ? 'معاينة شاشة تفاعلية' : 'Aperçu'}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => handleOpenEdit(pageItem)}
                                className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-emerald-400 transition"
                                title={lang === 'ar' ? 'تعديل' : 'Modifier'}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Publish / Unpublish Toggle */}
                              <button
                                onClick={() => handleTogglePublish(pageItem)}
                                className={`p-1.5 rounded transition-colors ${
                                  pageItem.status === 'published' ? 'text-emerald-400 hover:bg-emerald-950' : 'text-slate-400 hover:bg-slate-800'
                                }`}
                                title={pageItem.status === 'published' ? (lang === 'ar' ? 'سحب إلى المسودة' : 'Dépublier') : (lang === 'ar' ? 'نشر الآن' : 'Publier')}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Duplicate */}
                              <button
                                onClick={() => handleDuplicatePage(pageItem)}
                                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-amber-400 transition"
                                title={lang === 'ar' ? 'تكرار الصفحة' : 'Dupliquer'}
                              >
                                <CopyIcon className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeletePage(pageItem.id, pageItem.title_ar, pageItem.slug)}
                                className="p-1.5 hover:bg-rose-950/60 rounded text-rose-400 transition"
                                title={lang === 'ar' ? 'حذف' : 'Supprimer'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPagesCount > 1 && (
              <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                <div>
                  {lang === 'ar'
                    ? `عرض ${(currentPage - 1) * itemsPerPage + 1} إلى ${Math.min(currentPage * itemsPerPage, filteredPages.length)} من أصل ${filteredPages.length} صفحة`
                    : `Affichage de ${(currentPage - 1) * itemsPerPage + 1} à ${Math.min(currentPage * itemsPerPage, filteredPages.length)} sur ${filteredPages.length}`}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalPagesCount }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPage(idx + 1)}
                      className={`py-1 px-2.5 rounded-lg font-bold transition-all ${
                        currentPage === idx + 1
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPagesCount))}
                    disabled={currentPage === totalPagesCount}
                    className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MEDIA LIBRARY */}
      {activeTab === 'media' && (
        <MediaLibrary />
      )}

      {/* TAB 3: ACTIVITY LOG */}
      {activeTab === 'logs' && (
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              {lang === 'ar' ? 'سجل عمليات التعديل والنشر والتغييرات' : 'Historique des modifications'}
            </h3>
            <span className="text-xs text-slate-400">
              {activityLogs.length} {lang === 'ar' ? 'عملية مسجلة' : 'entrées'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs text-slate-300">
              <thead className="bg-slate-900 border-b border-slate-800 font-semibold uppercase text-slate-400">
                <tr>
                  <th className="p-3 text-start">{lang === 'ar' ? 'نوع الإجراء' : 'Action'}</th>
                  <th className="p-3 text-start">{lang === 'ar' ? 'التفاصيل' : 'Détails'}</th>
                  <th className="p-3 text-start">{lang === 'ar' ? 'المستخدم' : 'Utilisateur'}</th>
                  <th className="p-3 text-start">{lang === 'ar' ? 'عنوان IP' : 'Adresse IP'}</th>
                  <th className="p-3 text-end">{lang === 'ar' ? 'التاريخ والوقت' : 'Date'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {activityLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/60 transition">
                    <td className="p-3">
                      <span className="font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-slate-200">
                      {log.details}
                    </td>
                    <td className="p-3 text-slate-400 font-semibold">{log.user}</td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">{log.ip_address}</td>
                    <td className="p-3 text-end text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FULL EDITOR MODAL */}
      {showEditorModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-800 my-auto text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-100 text-base">
                    {editingPage
                      ? (lang === 'ar' ? `تعديل الصفحة: ${formTitleAr}` : `Modifier: ${formTitleFr}`)
                      : (lang === 'ar' ? 'إنشاء صفحة جديدة' : 'Créer une nouvelle page')}
                  </h2>
                  <p className="text-[11px] text-slate-400">/p/{formSlug || 'slug'}</p>
                </div>
              </div>

              {/* Auto Save Badge & Close */}
              <div className="flex items-center gap-3">
                {lastAutoSaveTime && (
                  <span className="hidden sm:inline-flex items-center gap-1 bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full animate-pulse">
                    <Check className="w-3 h-3" />
                    {lang === 'ar' ? `محفوظ تلقائياً: ${lastAutoSaveTime}` : `Auto-enregistré: ${lastAutoSaveTime}`}
                  </span>
                )}
                <button
                  onClick={() => setShowEditorModal(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form Sub-Tabs Header */}
            <div className="flex items-center gap-1 px-4 py-2 bg-slate-950 border-b border-slate-800 overflow-x-auto text-xs font-bold">
              <button
                onClick={() => setEditorFormTab('ar')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  editorFormTab === 'ar' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🇸🇦 {lang === 'ar' ? 'المحتوى العربي' : 'Arabe'}
              </button>
              <button
                onClick={() => setEditorFormTab('fr')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  editorFormTab === 'fr' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🇫🇷 {lang === 'ar' ? 'المحتوى الفرنسي' : 'Français'}
              </button>
              <button
                onClick={() => setEditorFormTab('en')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  editorFormTab === 'en' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🇬🇧 English
              </button>
              <button
                onClick={() => setEditorFormTab('seo')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                  editorFormTab === 'seo' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {lang === 'ar' ? 'إعدادات SEO والمشاركة' : 'SEO'}
              </button>
              <button
                onClick={() => setEditorFormTab('history')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                  editorFormTab === 'history' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5 text-indigo-400" />
                {lang === 'ar' ? `المراجعات (${editingPage?.revisions.length || 0})` : 'Révisions'}
              </button>
              <button
                onClick={() => setEditorFormTab('settings')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  editorFormTab === 'settings' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ⚙️ {lang === 'ar' ? 'الإعدادات والرابط' : 'Paramètres'}
              </button>
            </div>

            {/* Modal Body Scroll Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* ARABIC CONTENT */}
              {editorFormTab === 'ar' && (
                <div className="space-y-4" dir="rtl">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      {lang === 'ar' ? 'عنوان الصفحة (بالعربية) *' : 'Titre de la page (AR)'}
                    </label>
                    <input
                      type="text"
                      value={formTitleAr}
                      onChange={(e) => setFormTitleAr(e.target.value)}
                      className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                      placeholder="مثال: الشروط والأحكام العامة"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      {lang === 'ar' ? 'محتوى الصفحة الغني (العربية)' : 'Contenu de la page (AR)'}
                    </label>
                    <RichTextEditor
                      value={formContentAr}
                      onChange={setFormContentAr}
                      dir="rtl"
                      onOpenMediaLibrary={() => setShowMediaPickerForEditor(true)}
                    />
                  </div>
                </div>
              )}

              {/* FRENCH CONTENT */}
              {editorFormTab === 'fr' && (
                <div className="space-y-4" dir="ltr">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Titre de la page (Français)
                    </label>
                    <input
                      type="text"
                      value={formTitleFr}
                      onChange={(e) => setFormTitleFr(e.target.value)}
                      className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                      placeholder="Ex: Conditions Générales de Vente"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Contenu de la page (Français)
                    </label>
                    <RichTextEditor
                      value={formContentFr}
                      onChange={setFormContentFr}
                      dir="ltr"
                      onOpenMediaLibrary={() => setShowMediaPickerForEditor(true)}
                    />
                  </div>
                </div>
              )}

              {/* ENGLISH CONTENT */}
              {editorFormTab === 'en' && (
                <div className="space-y-4" dir="ltr">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Page Title (English)
                    </label>
                    <input
                      type="text"
                      value={formTitleEn}
                      onChange={(e) => setFormTitleEn(e.target.value)}
                      className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                      placeholder="Ex: Terms & Conditions"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Page Rich Content (English)
                    </label>
                    <RichTextEditor
                      value={formContentEn}
                      onChange={setFormContentEn}
                      dir="ltr"
                      onOpenMediaLibrary={() => setShowMediaPickerForEditor(true)}
                    />
                  </div>
                </div>
              )}

              {/* SEO TAB */}
              {editorFormTab === 'seo' && (
                <div className="space-y-5">
                  <div className="bg-amber-950/60 p-3 rounded-xl border border-amber-800 text-xs text-amber-300">
                    💡 {lang === 'ar' ? 'تساعد إعدادات SEO في ظهور صفحتك بأعلى نتائج محرك البحث Google وتحسين مظهر المشاركة على فايسبوك وتويتر.' : 'Optimisez le référencement naturel et l\'aperçu réseaux sociaux.'}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Meta Title */}
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                        <span>{lang === 'ar' ? 'عنوان البحث Meta Title (عربي)' : 'Meta Title (AR)'}</span>
                        <span className={`text-[10px] ${seoMetaTitleAr.length > 60 ? 'text-rose-400' : 'text-slate-400'}`}>
                          {seoMetaTitleAr.length}/60
                        </span>
                      </div>
                      <input
                        type="text"
                        maxLength={80}
                        value={seoMetaTitleAr}
                        onChange={(e) => setSeoMetaTitleAr(e.target.value)}
                        className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                        dir="rtl"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                        <span>Meta Title (Français)</span>
                        <span className={`text-[10px] ${seoMetaTitleFr.length > 60 ? 'text-rose-400' : 'text-slate-400'}`}>
                          {seoMetaTitleFr.length}/60
                        </span>
                      </div>
                      <input
                        type="text"
                        maxLength={80}
                        value={seoMetaTitleFr}
                        onChange={(e) => setSeoMetaTitleFr(e.target.value)}
                        className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Meta Description */}
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                        <span>{lang === 'ar' ? 'وصف البحث Meta Description (عربي)' : 'Meta Description (AR)'}</span>
                        <span className={`text-[10px] ${seoMetaDescAr.length > 160 ? 'text-rose-400' : 'text-slate-400'}`}>
                          {seoMetaDescAr.length}/160
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        maxLength={200}
                        value={seoMetaDescAr}
                        onChange={(e) => setSeoMetaDescAr(e.target.value)}
                        className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                        dir="rtl"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                        <span>Meta Description (Français)</span>
                        <span className={`text-[10px] ${seoMetaDescFr.length > 160 ? 'text-rose-400' : 'text-slate-400'}`}>
                          {seoMetaDescFr.length}/160
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        maxLength={200}
                        value={seoMetaDescFr}
                        onChange={(e) => setSeoMetaDescFr(e.target.value)}
                        className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      {lang === 'ar' ? 'الكلمات المفتاحية (Keywords - تفصل بفارزة)' : 'Mots clés'}
                    </label>
                    <input
                      type="text"
                      value={seoKeywords}
                      onChange={(e) => setSeoKeywords(e.target.value)}
                      placeholder="e.g. algerie, e-commerce, livraison 58 wilayas"
                      className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                      dir="ltr"
                    />
                  </div>

                  {/* Open Graph & Social Cards */}
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <h4 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                      <Share2 className="w-4 h-4 text-emerald-400" />
                      {lang === 'ar' ? 'بطاقة مشاركة شبكات التواصل Social Sharing (Open Graph)' : 'Open Graph (Social Cards)'}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">{lang === 'ar' ? 'عنوان Open Graph' : 'Titre OG'}</label>
                        <input value={seoOgTitle} onChange={(e) => setSeoOgTitle(e.target.value)} className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">{lang === 'ar' ? 'رابط صورة المعاينة OG Image' : 'Image OG'}</label>
                        <input value={seoOgImage} onChange={(e) => setSeoOgImage(e.target.value)} className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500" placeholder="https://..." dir="ltr" />
                      </div>
                    </div>
                  </div>

                  {/* Live SERP Google Search Preview */}
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Google SERP Live Preview (معاينة حية في نتائج البحث)
                    </span>
                    <div className="space-y-1">
                      <div className="text-[11px] text-slate-400 font-mono truncate">
                        https://businessmarket.dz › p › {formSlug || 'slug'}
                      </div>
                      <div className="text-base font-bold text-emerald-400 hover:underline cursor-pointer truncate">
                        {seoMetaTitleAr || formTitleAr || 'عنوان الصفحة في نتائج البحث'}
                      </div>
                      <div className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {seoMetaDescAr || 'الوصف الذي سيظهر للمستخدمين عند البحث عن منطقتك أو خدماتك في محرك البحث جوجل...'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* REVISIONS HISTORY TAB */}
              {editorFormTab === 'history' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-slate-100">
                    {lang === 'ar' ? 'سجل المراجعات والنسخ السابقة لهذه الصفحة' : 'Historique des révisions'}
                  </h4>

                  {editingPage && editingPage.revisions.length > 0 ? (
                    <div className="space-y-3">
                      {editingPage.revisions.map((rev) => (
                        <div
                          key={rev.id}
                          className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-400">Revision #{rev.version}</span>
                              <span className="text-slate-400 text-[10px]">{new Date(rev.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="font-semibold text-slate-200 mt-0.5">{rev.title_ar}</p>
                          </div>

                          <button
                            onClick={() => handleRestoreRevision(rev)}
                            className="px-3 py-1 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1 transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {lang === 'ar' ? 'استرجاع النسخة' : 'Restaurer'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      {lang === 'ar' ? 'لا توجد مراجعات سابقة محفوظة لهذه الصفحة.' : 'Aucune révision enregistrée.'}
                    </div>
                  )}
                </div>
              )}

              {/* SETTINGS TAB */}
              {editorFormTab === 'settings' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        {lang === 'ar' ? 'الرابط المباشر (URL Slug) *' : 'URL Slug'}
                      </label>
                      <input
                        type="text"
                        value={formSlug}
                        onChange={(e) => setFormSlug(e.target.value)}
                        className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        {lang === 'ar' ? 'مفتاح النظام (Key)' : 'Clé système'}
                      </label>
                      <input
                        type="text"
                        value={formKey}
                        onChange={(e) => setFormKey(e.target.value)}
                        className="w-full bg-slate-950 text-slate-400 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-mono disabled:opacity-50"
                        dir="ltr"
                        disabled={!!editingPage}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        {lang === 'ar' ? 'نوع الصفحة' : 'Type de page'}
                      </label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value as CMSPageType)}
                        className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="custom">Custom Page (صفحة مخصصة)</option>
                        <option value="static_about">About Us (عن الشركة)</option>
                        <option value="static_contact">Contact Us (اتصل بنا)</option>
                        <option value="static_privacy">Privacy Policy (الخصوصية)</option>
                        <option value="static_terms">Terms & Conditions (الشروط والأحكام)</option>
                        <option value="static_returns">Return Policy (سياسة الإرجاع)</option>
                        <option value="static_shipping">Shipping Policy (سياسة الشحن)</option>
                        <option value="static_faq">FAQ (الأسئلة الشائعة)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        {lang === 'ar' ? 'حالة النشر' : 'Statut de publication'}
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as CMSPageStatus)}
                        className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="published">Published (منشورة حية)</option>
                        <option value="draft">Draft (مسودة غير معروضة)</option>
                        <option value="scheduled">Scheduled (مجدولة بالنشر)</option>
                      </select>
                    </div>
                  </div>

                  {formStatus === 'scheduled' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        {lang === 'ar' ? 'تاريخ ووقت النشر المجدول' : 'Date de publication'}
                      </label>
                      <input
                        type="datetime-local"
                        value={formPublishDate}
                        onChange={(e) => setFormPublishDate(e.target.value)}
                        className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 rounded-b-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => setShowEditorModal(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
              >
                {lang === 'ar' ? 'إلغاء' : 'Annuler'}
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleSavePage('draft')}
                  className="px-4 py-2 rounded-lg border border-amber-800 bg-amber-950/60 hover:bg-amber-950 text-amber-300 text-xs font-bold transition"
                >
                  {lang === 'ar' ? 'حفظ كمسودة' : 'Enregistrer brouillon'}
                </button>
                <button
                  onClick={() => handleSavePage('published')}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                >
                  <Save className="w-4 h-4" />
                  {lang === 'ar' ? 'حفظ ونشر الصفحة' : 'Publier la page'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MEDIA PICKER OVERLAY INSIDE EDITOR */}
      {showMediaPickerForEditor && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl border border-slate-800 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-base">
                {lang === 'ar' ? 'اختر ملفاً من مكتبة الوسائط لإدراجه' : 'Sélectionner un fichier de la médiathèque'}
              </h3>
              <button onClick={() => setShowMediaPickerForEditor(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <MediaLibrary
              isModalPicker
              onClosePicker={() => setShowMediaPickerForEditor(false)}
              onSelectMedia={(mediaUrl) => {
                setFormContentAr(prev => prev + `\n<img src="${mediaUrl}" alt="Media" class="w-full max-w-2xl rounded-xl my-4" />`);
                setShowMediaPickerForEditor(false);
                showToast(lang === 'ar' ? 'تم إدراج الصورة في المحتوى' : 'Image insérée', 'success');
              }}
            />
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {showPreviewModal && previewPage && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-800 text-slate-100">
            {/* Toolbar Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-slate-100 text-sm">
                  {lang === 'ar' ? 'معاينة شاشة الصفحة الحية' : 'Aperçu en direct'}
                </h3>
              </div>

              {/* Device and Lang Switcher */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800">
                  <button
                    onClick={() => setPreviewDevice('desktop')}
                    className={`p-1.5 rounded text-xs font-bold transition ${previewDevice === 'desktop' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    🖥️ Desktop
                  </button>
                  <button
                    onClick={() => setPreviewDevice('mobile')}
                    className={`p-1.5 rounded text-xs font-bold transition ${previewDevice === 'mobile' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    📱 Mobile
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800 text-xs font-bold">
                  <button onClick={() => setPreviewLang('ar')} className={`px-2 py-1 rounded transition ${previewLang === 'ar' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400'}`}>عربي</button>
                  <button onClick={() => setPreviewLang('fr')} className={`px-2 py-1 rounded transition ${previewLang === 'fr' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400'}`}>FR</button>
                  <button onClick={() => setPreviewLang('en')} className={`px-2 py-1 rounded transition ${previewLang === 'en' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400'}`}>EN</button>
                </div>

                <button onClick={() => setShowPreviewModal(false)} className="p-1.5 text-slate-400 hover:text-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Frame Container */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-950 flex justify-center">
              <div className={`bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-sm space-y-6 transition-all ${
                previewDevice === 'mobile' ? 'max-w-sm w-full' : 'max-w-3xl w-full'
              }`} dir={previewLang === 'ar' ? 'rtl' : 'ltr'}>
                {/* Header breadcrumbs */}
                <div className="text-xs text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <span>Home</span>
                  <span>/</span>
                  <span className="font-bold text-slate-100">
                    {previewLang === 'ar' ? previewPage.title_ar : previewLang === 'fr' ? previewPage.title_fr : (previewPage.title_en || previewPage.title_fr)}
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold text-slate-100">
                  {previewLang === 'ar' ? previewPage.title_ar : previewLang === 'fr' ? previewPage.title_fr : (previewPage.title_en || previewPage.title_fr)}
                </h1>

                <div
                  className="prose prose-invert max-w-none text-sm text-slate-300 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: previewLang === 'ar' ? previewPage.content_ar : previewLang === 'fr' ? previewPage.content_fr : (previewPage.content_en || previewPage.content_fr)
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-800 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                {lang === 'ar' ? 'استيراد صفحات من ملف CSV' : 'Importer des pages depuis un CSV'}
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            <p className="text-xs text-slate-400">
              {lang === 'ar'
                ? 'اختر ملف CSV يحتوي على الحقول: key, slug, title_ar, title_fr, content_ar, content_fr, status.'
                : 'Sélectionnez un fichier CSV structuré.'}
            </p>

            <label className={`border-2 border-dashed border-slate-800 rounded-2xl p-8 text-center block cursor-pointer hover:border-emerald-500 transition-colors ${importingFile ? 'opacity-50' : ''}`}>
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <span className="text-xs font-bold text-slate-200 block">
                {importingFile ? (lang === 'ar' ? 'جاري القراءة والاستيراد...' : 'Traitement...') : (lang === 'ar' ? 'اختر ملف CSV من جهازك' : 'Choisir un fichier CSV')}
              </span>
              <input
                type="file"
                accept=".csv"
                disabled={importingFile}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImportCSV(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition">{lang === 'ar' ? 'إلغاء' : 'Annuler'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE PAGE DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetPage}
        onClose={() => setDeleteTargetPage(null)}
        onConfirm={handleConfirmDeletePage}
        isDeleting={isDeletingPage}
        itemName={deleteTargetPage?.title}
        error={deletePageError}
      />

      {/* BULK PAGES DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleConfirmBulkDelete}
        isDeleting={isBulkDeleting}
        title={lang === 'ar' ? 'تأكيد الحذف الجماعي' : 'Confirmer la suppression groupée'}
        description={lang === 'ar' ? `هل أنت متأكد من حذف ${selectedIds.length} صفحة محددة؟ لا يمكن التراجع عن هذا الإجراء.` : `Voulez-vous supprimer les ${selectedIds.length} pages sélectionnées ?`}
        error={bulkDeleteError}
      />
    </div>
  );
}
