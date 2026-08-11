import { useState, useEffect, useMemo } from 'react';
import {
  Megaphone, Tag, Bell, Image as ImageIcon,
  Activity, Plus, Search, Edit2, Trash2, CheckCircle2, Ban,
  Download, Upload, Copy, Check,
  X, ChevronLeft, ChevronRight, Flame, Star, Send
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { supabase } from '../../lib/supabase';
import { Product, Category, Customer } from '../../types';
import { exportToCSV, parseCSVFile } from '../../lib/csvHelper';
import {
  fetchCouponsFromDB, upsertCouponInDB, deleteCouponFromDB,
  fetchPromotionsFromDB, upsertPromotionInDB, deletePromotionFromDB,
  fetchNotificationsFromDB, upsertNotificationInDB, deleteNotificationFromDB,
  fetchMarketingLogsFromDB, addMarketingLogToDB,
  ExtendedCoupon, Promotion, MarketingNotification, MarketingActivityLog
} from '../../lib/marketingStore';
import { ensureAuthenticatedAdmin } from '../../lib/storage';
import AdminBanners from './AdminBanners';

export default function AdminMarketing() {
  const { lang, formatPrice, dir } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string, en: string = '') => (isAr ? ar : lang === 'fr' ? fr : en || fr);

  // Tabs
  type MarketingTab = 'coupons' | 'promotions' | 'featured' | 'banners' | 'notifications' | 'activity';
  const [activeTab, setActiveTab] = useState<MarketingTab>('coupons');

  // Products and Categories data from DB
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Local Marketing State
  const [coupons, setCoupons] = useState<ExtendedCoupon[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [notifications, setNotifications] = useState<MarketingNotification[]>([]);
  const [activityLogs, setActivityLogs] = useState<MarketingActivityLog[]>([]);

  // Search, Filters & Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'disabled' | 'scheduled'>('all');
  const [groupFilter, setGroupFilter] = useState<'all' | 'retail' | 'wholesale'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Copy Feedback Code
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal States
  // Delete Confirmation Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'coupon' | 'promotion' | 'notification' | 'bulk_coupons' | 'bulk_promotions';
    id?: string;
    title?: string;
    error?: string | null;
  }>({ isOpen: false, type: 'coupon' });
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // 1. Coupon Modal
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<ExtendedCoupon | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed' | 'free_shipping',
    discount_value: 10,
    min_order_amount: 0,
    max_discount_amount: 0,
    usage_limit: 0,
    per_customer_limit: 1,
    starts_at: '',
    expires_at: '',
    customer_group_restriction: 'all' as 'all' | 'retail' | 'wholesale',
    is_active: true,
  });

  // 2. Promotion Modal
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [promotionForm, setPromotionForm] = useState({
    title_ar: '',
    title_fr: '',
    type: 'flash_sale' as Promotion['type'],
    discount_type: 'percentage' as 'percentage' | 'fixed' | 'free_shipping',
    discount_value: 15,
    starts_at: '',
    ends_at: '',
    is_active: true,
    target_type: 'all_products' as 'all_products' | 'specific_products' | 'specific_categories',
    selected_products: [] as string[],
    selected_categories: [] as string[],
    buy_x: 2,
    get_y: 1,
    bundle_price: 0,
  });

  // 3. Notification Modal
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState<MarketingNotification | null>(null);
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    target_group: 'all' as 'all' | 'retail' | 'wholesale' | 'selected',
    selected_customer_ids: [] as string[],
    scheduled_at: '',
    send_immediately: true,
  });

  // Initial Data Load
  useEffect(() => {
    loadAllMarketingData();
    fetchProductsAndCategories();
    fetchCustomers();
  }, []);

  const loadAllMarketingData = async () => {
    try {
      const [cData, pData, nData, lData] = await Promise.all([
        fetchCouponsFromDB(),
        fetchPromotionsFromDB(),
        fetchNotificationsFromDB(),
        fetchMarketingLogsFromDB()
      ]);
      setCoupons(cData);
      setPromotions(pData);
      setNotifications(nData);
      setActivityLogs(lData);
    } catch (e) {
      console.warn('Error loading marketing data from Supabase:', e);
    }
  };

  // Reset pagination & selections on tab change or filter change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds({});
  }, [activeTab, searchQuery, statusFilter, groupFilter, typeFilter]);

  const fetchProductsAndCategories = async () => {
    setLoadingProducts(true);
    try {
      const { data: prodData } = await supabase.from('products').select('*').order('name_ar');
      const { data: catData } = await supabase.from('categories').select('*').order('name_ar');
      
      if (prodData && prodData.length > 0) {
        setProducts(prodData as Product[]);
        localStorage.setItem('local_admin_products', JSON.stringify(prodData));
      } else {
        const saved = localStorage.getItem('local_admin_products');
        if (saved) setProducts(JSON.parse(saved));
      }

      if (catData) setCategories(catData as Category[]);
    } catch (e) {
      console.warn('Error fetching products/categories for marketing:', e);
      const saved = localStorage.getItem('local_admin_products');
      if (saved) setProducts(JSON.parse(saved));
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data } = await supabase.from('customers').select('*').limit(200);
      if (data) setCustomers(data as Customer[]);
    } catch {
      // ignore
    }
  };

  // Log action wrapper
  const logAction = async (action: string, details: string) => {
    await addMarketingLogToDB(action, details, tr('المشرف', 'Admin'));
    const updatedLogs = await fetchMarketingLogsFromDB();
    setActivityLogs(updatedLogs);
  };

  // Helper for datetime-local string
  const toDatetimeLocal = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  // Copy code handler
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(tr('تم نسخ كود الخصم', 'Code promo copié', 'Promo code copied'), 'success');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // ==================== COUPONS HANDLERS ====================
  const handleOpenAddCoupon = () => {
    setEditingCoupon(null);
    const now = new Date();
    const nextMonth = new Date(Date.now() + 30 * 86400000);
    setCouponForm({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      min_order_amount: 0,
      max_discount_amount: 0,
      usage_limit: 100,
      per_customer_limit: 1,
      starts_at: toDatetimeLocal(now.toISOString()),
      expires_at: toDatetimeLocal(nextMonth.toISOString()),
      customer_group_restriction: 'all',
      is_active: true,
    });
    setShowCouponModal(true);
  };

  const handleOpenEditCoupon = (coupon: ExtendedCoupon) => {
    setEditingCoupon(coupon);
    setCouponForm({
      code: coupon.code,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_amount: coupon.min_order_amount || 0,
      max_discount_amount: coupon.max_discount_amount || 0,
      usage_limit: coupon.usage_limit || 0,
      per_customer_limit: coupon.per_customer_limit || 1,
      starts_at: toDatetimeLocal(coupon.starts_at),
      expires_at: toDatetimeLocal(coupon.expires_at),
      customer_group_restriction: (coupon.customer_group_restriction as 'all' | 'retail' | 'wholesale') || 'all',
      is_active: coupon.is_active,
    });
    setShowCouponModal(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.code.trim()) {
      showToast(tr('يرجى إدخال كود الخصم', 'Veuillez saisir le code promo', 'Please enter coupon code'), 'error');
      return;
    }

    const isAuthOk = await ensureAuthenticatedAdmin();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user && !isAuthOk) {
      showToast(tr('جلسة العمل غير صالحة، يرجى إعادة تسجيل الدخول', 'Session non valide, veuillez vous reconnecter'), 'error');
      return;
    }

    const couponPayload: Partial<ExtendedCoupon> = {
      code: couponForm.code.trim().toUpperCase(),
      description: couponForm.description.trim() || null,
      discount_type: couponForm.discount_type,
      discount_value: Number(couponForm.discount_value) || 0,
      min_order_amount: Number(couponForm.min_order_amount) || 0,
      max_discount_amount: Number(couponForm.max_discount_amount) > 0 ? Number(couponForm.max_discount_amount) : null,
      usage_limit: Number(couponForm.usage_limit) > 0 ? Number(couponForm.usage_limit) : null,
      per_customer_limit: Number(couponForm.per_customer_limit) || 1,
      starts_at: couponForm.starts_at ? new Date(couponForm.starts_at).toISOString() : null,
      expires_at: couponForm.expires_at ? new Date(couponForm.expires_at).toISOString() : null,
      customer_group_restriction: couponForm.customer_group_restriction,
      is_active: couponForm.is_active,
    };

    if (editingCoupon && editingCoupon.id && !editingCoupon.id.startsWith('coup-')) {
      couponPayload.id = editingCoupon.id;
    }

    const res = await upsertCouponInDB(couponPayload);
    if (!res.success) {
      showToast(tr('فشل حفظ كود الخصم في قاعدة البيانات: ', 'Échec de la sauvegarde du coupon dans la base de données: ') + (res.error || ''), 'error');
      return;
    }

    const updatedCoupons = await fetchCouponsFromDB();
    setCoupons(updatedCoupons);

    if (editingCoupon) {
      await logAction('Modification Coupon', `Mise à jour du coupon ${couponPayload.code}`);
      showToast(tr('تم تحديث كود الخصم بنجاح', 'Coupon mis à jour avec succès', 'Coupon updated successfully'), 'success');
    } else {
      await logAction('Création Coupon', `Création du nouveau coupon ${couponPayload.code}`);
      showToast(tr('تم إنشاء كود الخصم بنجاح', 'Coupon créé avec succès', 'Coupon created successfully'), 'success');
    }

    setShowCouponModal(false);
  };

  const handleToggleCouponActive = async (id: string) => {
    const target = coupons.find(c => c.id === id);
    if (!target) return;

    const isAuthOk = await ensureAuthenticatedAdmin();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user && !isAuthOk) {
      showToast(tr('جلسة العمل غير صالحة', 'Session non valide'), 'error');
      return;
    }

    const nextState = !target.is_active;
    const res = await upsertCouponInDB({ id: target.id, is_active: nextState });
    if (!res.success) {
      showToast(tr('فشل تغيير حالة كود الخصم', 'Échec de la modification du statut'), 'error');
      return;
    }

    const updated = await fetchCouponsFromDB();
    setCoupons(updated);
    await logAction('Statut Coupon', `${nextState ? 'Activation' : 'Désactivation'} du coupon ${target.code}`);
    showToast(tr('تم تغيير حالة كود الخصم', 'Statut du coupon modifié', 'Coupon status toggled'), 'info');
  };

  const handleDeleteCoupon = (id: string) => {
    const target = coupons.find(c => c.id === id);
    if (!target) return;
    setDeleteModal({
      isOpen: true,
      type: 'coupon',
      id: target.id,
      title: target.code,
      error: null,
    });
  };

  // ==================== PROMOTIONS HANDLERS ====================
  const handleOpenAddPromotion = () => {
    setEditingPromotion(null);
    const now = new Date();
    const nextWeek = new Date(Date.now() + 7 * 86400000);
    setPromotionForm({
      title_ar: '',
      title_fr: '',
      type: 'flash_sale',
      discount_type: 'percentage',
      discount_value: 15,
      starts_at: toDatetimeLocal(now.toISOString()),
      ends_at: toDatetimeLocal(nextWeek.toISOString()),
      is_active: true,
      target_type: 'all_products',
      selected_products: [],
      selected_categories: [],
      buy_x: 2,
      get_y: 1,
      bundle_price: 0,
    });
    setShowPromotionModal(true);
  };

  const handleOpenEditPromotion = (prom: Promotion) => {
    setEditingPromotion(prom);
    setPromotionForm({
      title_ar: prom.title_ar,
      title_fr: prom.title_fr,
      type: prom.type,
      discount_type: prom.discount_type,
      discount_value: prom.discount_value,
      starts_at: toDatetimeLocal(prom.starts_at),
      ends_at: toDatetimeLocal(prom.ends_at),
      is_active: prom.is_active,
      target_type: prom.target_type,
      selected_products: prom.product_ids || [],
      selected_categories: prom.category_ids || [],
      buy_x: prom.buy_x || 2,
      get_y: prom.get_y || 1,
      bundle_price: prom.bundle_price || 0,
    });
    setShowPromotionModal(true);
  };

  const handleSavePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotionForm.title_ar.trim() && !promotionForm.title_fr.trim()) {
      showToast(tr('يرجى إدخال عنوان العرض', 'Veuillez saisir le titre de la promotion', 'Please enter promotion title'), 'error');
      return;
    }

    const isAuthOk = await ensureAuthenticatedAdmin();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user && !isAuthOk) {
      showToast(tr('جلسة العمل غير صالحة، يرجى إعادة تسجيل الدخول', 'Session non valide, veuillez vous reconnecter'), 'error');
      return;
    }

    const promPayload: Partial<Promotion> = {
      title_ar: promotionForm.title_ar.trim() || promotionForm.title_fr.trim(),
      title_fr: promotionForm.title_fr.trim() || promotionForm.title_ar.trim(),
      type: promotionForm.type,
      discount_type: promotionForm.discount_type,
      discount_value: Number(promotionForm.discount_value) || 0,
      starts_at: promotionForm.starts_at ? new Date(promotionForm.starts_at).toISOString() : new Date().toISOString(),
      ends_at: promotionForm.ends_at ? new Date(promotionForm.ends_at).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString(),
      is_active: promotionForm.is_active,
      target_type: promotionForm.target_type,
      product_ids: promotionForm.selected_products,
      category_ids: promotionForm.selected_categories,
      buy_x: Number(promotionForm.buy_x) || 1,
      get_y: Number(promotionForm.get_y) || 1,
      bundle_price: Number(promotionForm.bundle_price) || 0,
    };

    if (editingPromotion && editingPromotion.id && !editingPromotion.id.startsWith('prom-')) {
      promPayload.id = editingPromotion.id;
    }

    const res = await upsertPromotionInDB(promPayload);
    if (!res.success) {
      showToast(tr('فشل حفظ العرض في قاعدة البيانات: ', 'Échec de la sauvegarde de la promotion: ') + (res.error || ''), 'error');
      return;
    }

    const updatedPromotions = await fetchPromotionsFromDB();
    setPromotions(updatedPromotions);

    if (editingPromotion) {
      await logAction('Modification Promotion', `Mise à jour de la promotion ${promPayload.title_fr}`);
      showToast(tr('تم تحديث العرض بنجاح', 'Promotion mise à jour avec succès', 'Promotion updated successfully'), 'success');
    } else {
      await logAction('Création Promotion', `Création de la promotion ${promPayload.title_fr}`);
      showToast(tr('تم إنشاء العرض بنجاح', 'Promotion créée avec succès', 'Promotion created successfully'), 'success');
    }

    setShowPromotionModal(false);
  };

  const handleTogglePromotionActive = async (id: string) => {
    const target = promotions.find(p => p.id === id);
    if (!target) return;

    const isAuthOk = await ensureAuthenticatedAdmin();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user && !isAuthOk) {
      showToast(tr('جلسة العمل غير صالحة', 'Session non valide'), 'error');
      return;
    }

    const nextState = !target.is_active;
    const res = await upsertPromotionInDB({ id: target.id, is_active: nextState });
    if (!res.success) {
      showToast(tr('فشل تغيير حالة العرض', 'Échec de la modification du statut'), 'error');
      return;
    }

    const updated = await fetchPromotionsFromDB();
    setPromotions(updated);
    await logAction('Statut Promotion', `${nextState ? 'Activation' : 'Désactivation'} de la promotion ${target.title_fr}`);
    showToast(tr('تم تغيير حالة العرض', 'Statut de la promotion modifié', 'Promotion status updated'), 'info');
  };

  const handleDeletePromotion = (id: string) => {
    const target = promotions.find(p => p.id === id);
    if (!target) return;
    setDeleteModal({
      isOpen: true,
      type: 'promotion',
      id: target.id,
      title: isAr ? target.title_ar : target.title_fr,
      error: null,
    });
  };

  // ==================== FEATURED PRODUCTS HANDLERS ====================
  const handleToggleProductBadge = async (productId: string, key: 'is_featured' | 'is_flash_sale') => {
    const target = products.find(p => p.id === productId);
    if (!target) return;

    const nextVal = !target[key];
    const updatedProducts = products.map(p => p.id === productId ? { ...p, [key]: nextVal } : p);
    setProducts(updatedProducts);
    localStorage.setItem('local_admin_products', JSON.stringify(updatedProducts));

    try {
      await supabase.from('products').update({ [key]: nextVal }).eq('id', productId);
    } catch (e) {
      console.warn('Supabase product badge sync note:', e);
    }

    const badgeLabel = key === 'is_featured' ? 'Produit En Vedette (Featured)' : 'Vente Flash';
    await logAction('Badge Produit', `${nextVal ? 'Ajout' : 'Retrait'} du badge ${badgeLabel} pour le produit ${target.name_fr}`);
    showToast(tr('تم تحديث الشارة للمنتج', 'Badge du produit mis à jour', 'Product badge updated'), 'success');
  };

  // ==================== NOTIFICATIONS HANDLERS ====================
  const handleOpenAddNotification = () => {
    setEditingNotification(null);
    setNotificationForm({
      title: '',
      message: '',
      target_group: 'all',
      selected_customer_ids: [],
      scheduled_at: toDatetimeLocal(new Date().toISOString()),
      send_immediately: true,
    });
    setShowNotificationModal(true);
  };

  const handleSaveNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
      showToast(tr('يرجى ملء كافة حقول الإشعار', 'Veuillez remplir le titre et le message', 'Please fill title and message'), 'error');
      return;
    }

    const isAuthOk = await ensureAuthenticatedAdmin();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user && !isAuthOk) {
      showToast(tr('جلسة العمل غير صالحة، يرجى إعادة تسجيل الدخول', 'Session non valide, veuillez vous reconnecter'), 'error');
      return;
    }

    const notifPayload: Partial<MarketingNotification> = {
      title: notificationForm.title.trim(),
      message: notificationForm.message.trim(),
      target_group: notificationForm.target_group,
      selected_customer_ids: notificationForm.selected_customer_ids,
      scheduled_at: !notificationForm.send_immediately && notificationForm.scheduled_at ? new Date(notificationForm.scheduled_at).toISOString() : null,
      sent_at: notificationForm.send_immediately ? new Date().toISOString() : null,
      status: notificationForm.send_immediately ? 'sent' : 'scheduled',
    };

    if (editingNotification && editingNotification.id && !editingNotification.id.startsWith('notif-')) {
      notifPayload.id = editingNotification.id;
    }

    const res = await upsertNotificationInDB(notifPayload);
    if (!res.success) {
      showToast(tr('فشل حفظ الإشعار في قاعدة البيانات: ', 'Échec de la sauvegarde de la notification: ') + (res.error || ''), 'error');
      return;
    }

    const updatedNotifs = await fetchNotificationsFromDB();
    setNotifications(updatedNotifs);

    const targetDesc = notifPayload.target_group === 'all' ? 'Tous les clients' : notifPayload.target_group === 'retail' ? 'Clients Retail' : 'Clients Wholesale';
    await logAction('Notification Marketing', `${notifPayload.status === 'sent' ? 'Envoi immédiat' : 'Programmation'} de notification: "${notifPayload.title}" à ${targetDesc}`);

    showToast(
      notifPayload.status === 'sent' 
        ? tr('تم إرسال الإشعار بنجاح للعملاء', 'Notification envoyée avec succès', 'Notification sent successfully')
        : tr('تم جدولة الإشعار بنجاح', 'Notification programmée avec succès', 'Notification scheduled successfully'),
      'success'
    );
    setShowNotificationModal(false);
  };

  const handleDeleteNotification = (id: string) => {
    const target = notifications.find(n => n.id === id);
    if (!target) return;
    setDeleteModal({
      isOpen: true,
      type: 'notification',
      id: target.id,
      title: target.title,
      error: null,
    });
  };

  // ==================== CSV IMPORT & EXPORT HANDLERS ====================
  const handleExportCSV = () => {
    if (activeTab === 'coupons') {
      const exportData = coupons.map(c => ({
        Code: c.code,
        Description: c.description || '',
        Type: c.discount_type,
        Value: c.discount_value,
        MinOrderAmount: c.min_order_amount,
        MaxDiscountAmount: c.max_discount_amount || '',
        UsageLimit: c.usage_limit || '',
        UsedCount: c.used_count,
        PerCustomerLimit: c.per_customer_limit,
        StartsAt: c.starts_at || '',
        ExpiresAt: c.expires_at || '',
        GroupRestriction: c.customer_group_restriction || 'all',
        IsActive: c.is_active ? 'YES' : 'NO',
      }));
      exportToCSV(exportData, `Coupons_Export_${new Date().toISOString().substring(0, 10)}`);
      logAction('Export CSV', `Exportation de ${coupons.length} coupons au format CSV`);
      showToast(tr('تم تصدير أكواد الخصم إلى ملف CSV', 'Coupons exportés en CSV', 'Coupons exported to CSV'), 'success');
    } else if (activeTab === 'promotions') {
      const exportData = promotions.map(p => ({
        TitleAR: p.title_ar,
        TitleFR: p.title_fr,
        Type: p.type,
        DiscountType: p.discount_type,
        DiscountValue: p.discount_value,
        StartsAt: p.starts_at,
        EndsAt: p.ends_at,
        IsActive: p.is_active ? 'YES' : 'NO',
        TargetType: p.target_type,
      }));
      exportToCSV(exportData, `Promotions_Export_${new Date().toISOString().substring(0, 10)}`);
      logAction('Export CSV', `Exportation de ${promotions.length} promotions au format CSV`);
      showToast(tr('تم تصدير العروض إلى ملف CSV', 'Promotions exportées en CSV', 'Promotions exported to CSV'), 'success');
    } else if (activeTab === 'featured') {
      const exportData = products.filter(p => p.is_featured || p.is_flash_sale).map(p => ({
        SKU: p.sku,
        NameAR: p.name_ar,
        NameFR: p.name_fr,
        Price: p.price,
        IsFeatured: p.is_featured ? 'YES' : 'NO',
        IsFlashSale: p.is_flash_sale ? 'YES' : 'NO',
      }));
      exportToCSV(exportData, `Featured_Products_Export_${new Date().toISOString().substring(0, 10)}`);
      showToast(tr('تم تصدير المنتجات المميزة إلى ملف CSV', 'Produits en vedette exportés', 'Featured products exported'), 'success');
    } else if (activeTab === 'notifications') {
      const exportData = notifications.map(n => ({
        Title: n.title,
        Message: n.message,
        TargetGroup: n.target_group,
        Status: n.status,
        SentAt: n.sent_at || '',
        ScheduledAt: n.scheduled_at || '',
      }));
      exportToCSV(exportData, `Notifications_Export_${new Date().toISOString().substring(0, 10)}`);
      showToast(tr('تم تصدير الإشعارات إلى ملف CSV', 'Notifications exportées', 'Notifications exported'), 'success');
    }
  };

  const handleImportCSVFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rows = await parseCSVFile(file);
      if (rows.length === 0) {
        showToast(tr('الملف فارغ أو غير صالح', 'Fichier vide ou invalide', 'File is empty or invalid'), 'error');
        return;
      }

      if (activeTab === 'coupons') {
        const isAuthOk = await ensureAuthenticatedAdmin();
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.user && !isAuthOk) {
          showToast(tr('جلسة العمل غير صالحة', 'Session non valide'), 'error');
          return;
        }

        const importedCoupons: Partial<ExtendedCoupon>[] = rows.map((r, i) => ({
          code: (r['code'] || r['code_promo'] || `CODE_${i}`).toUpperCase().trim(),
          description: r['description'] || null,
          discount_type: (r['type'] === 'fixed' || r['type'] === 'free_shipping') ? r['type'] : 'percentage',
          discount_value: Number(r['value'] || r['discountvalue'] || 10),
          min_order_amount: Number(r['minorderamount'] || 0),
          max_discount_amount: Number(r['maxdiscountamount'] || 0) || null,
          usage_limit: Number(r['usagelimit'] || 0) || null,
          per_customer_limit: Number(r['percustomerlimit'] || 1),
          starts_at: r['startsat'] ? new Date(r['startsat']).toISOString() : new Date().toISOString(),
          expires_at: r['expiresat'] ? new Date(r['expiresat']).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString(),
          customer_group_restriction: (r['grouprestriction'] as 'all' | 'retail' | 'wholesale') || 'all',
          is_active: r['isactive']?.toUpperCase() !== 'NO',
        }));

        for (const c of importedCoupons) {
          await upsertCouponInDB(c);
        }

        const updated = await fetchCouponsFromDB();
        setCoupons(updated);
        await logAction('Import CSV', `Importation de ${importedCoupons.length} coupons depuis le fichier ${file.name}`);
        showToast(tr(`تم استيراد ${importedCoupons.length} كود خصم بنجاح`, `${importedCoupons.length} coupons importés avec succès`, `Imported ${importedCoupons.length} coupons`), 'success');
      }
    } catch (err) {
      console.error('CSV import error:', err);
      showToast(tr('خطأ أثناء قراءة ملف CSV', 'Erreur lors de l\'importation CSV', 'CSV import error'), 'error');
    } finally {
      e.target.value = '';
    }
  };

  // ==================== BULK ACTIONS HANDLERS ====================
  const selectedCount = useMemo(() => Object.values(selectedIds).filter(Boolean).length, [selectedIds]);

  const handleSelectAll = (ids: string[]) => {
    const allSelected = ids.every(id => selectedIds[id]);
    const updated = { ...selectedIds };
    ids.forEach(id => {
      updated[id] = !allSelected;
    });
    setSelectedIds(updated);
  };

  const handleBulkAction = async (action: 'enable' | 'disable' | 'delete' | 'export') => {
    const selectedList = Object.keys(selectedIds).filter(id => selectedIds[id]);
    if (selectedList.length === 0) {
      showToast(tr('لم يتم تحديد أي عنصر', 'Aucun élément sélectionné', 'No item selected'), 'error');
      return;
    }

    if (activeTab === 'coupons') {
      if (action === 'enable' || action === 'disable') {
        const nextActive = action === 'enable';
        await ensureAuthenticatedAdmin();
        for (const cId of selectedList) {
          await upsertCouponInDB({ id: cId, is_active: nextActive });
        }
        const updated = await fetchCouponsFromDB();
        setCoupons(updated);
        await logAction('Action Groupée', `${nextActive ? 'Activation' : 'Désactivation'} de ${selectedList.length} coupons`);
        showToast(tr('تم تحديث العناصر المحددة', 'Éléments mis à jour', 'Selected items updated'), 'success');
      } else if (action === 'delete') {
        setDeleteModal({
          isOpen: true,
          type: 'bulk_coupons',
          title: `${selectedList.length} ${tr('أكواد خصم', 'coupons', 'coupons')}`,
          error: null,
        });
        return;
      } else if (action === 'export') {
        const targets = coupons.filter(c => selectedList.includes(c.id));
        exportToCSV(targets.map(c => ({ Code: c.code, Type: c.discount_type, Value: c.discount_value })), 'Selected_Coupons');
      }
    } else if (activeTab === 'promotions') {
      if (action === 'enable' || action === 'disable') {
        const nextActive = action === 'enable';
        await ensureAuthenticatedAdmin();
        for (const pId of selectedList) {
          await upsertPromotionInDB({ id: pId, is_active: nextActive });
        }
        const updated = await fetchPromotionsFromDB();
        setPromotions(updated);
        await logAction('Action Groupée', `${nextActive ? 'Activation' : 'Désactivation'} de ${selectedList.length} promotions`);
        showToast(tr('تم تحديث العروض المحددة', 'Promotions mises à jour', 'Selected promotions updated'), 'success');
      } else if (action === 'delete') {
        setDeleteModal({
          isOpen: true,
          type: 'bulk_promotions',
          title: `${selectedList.length} ${tr('عروض', 'promotions', 'promotions')}`,
          error: null,
        });
        return;
      }
    }
    setSelectedIds({});
  };

  const handleConfirmDelete = async () => {
    const { type, id } = deleteModal;
    setIsDeletingItem(true);
    try {
      const isAuthOk = await ensureAuthenticatedAdmin();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user && !isAuthOk) {
        setDeleteModal(prev => ({ ...prev, error: tr('جلسة غير صالحة', 'Session non valide') }));
        return;
      }

      if (type === 'coupon' && id) {
        const target = coupons.find(c => c.id === id);
        const res = await deleteCouponFromDB(id);
        if (!res.success) {
          setDeleteModal(prev => ({ ...prev, error: res.error || tr('فشل الحذف', 'Échec de la suppression') }));
          return;
        }
        const updated = await fetchCouponsFromDB();
        setCoupons(updated);
        if (target) await logAction('Suppression Coupon', `Suppression du coupon ${target.code}`);
        showToast(tr('تم حذف كود الخصم', 'Coupon supprimé', 'Coupon deleted'), 'success');
      } else if (type === 'promotion' && id) {
        const target = promotions.find(p => p.id === id);
        const res = await deletePromotionFromDB(id);
        if (!res.success) {
          setDeleteModal(prev => ({ ...prev, error: res.error || tr('فشل الحذف', 'Échec de la suppression') }));
          return;
        }
        const updated = await fetchPromotionsFromDB();
        setPromotions(updated);
        if (target) await logAction('Suppression Promotion', `Suppression de la promotion ${target.title_fr}`);
        showToast(tr('تم حذف العرض', 'Promotion supprimée', 'Promotion deleted'), 'success');
      } else if (type === 'notification' && id) {
        const target = notifications.find(n => n.id === id);
        const res = await deleteNotificationFromDB(id);
        if (!res.success) {
          setDeleteModal(prev => ({ ...prev, error: res.error || tr('فشل الحذف', 'Échec de la suppression') }));
          return;
        }
        const updated = await fetchNotificationsFromDB();
        setNotifications(updated);
        if (target) await logAction('Suppression Notification', `Suppression de la notification "${target.title}"`);
        showToast(tr('تم حذف الإشعار', 'Notification supprimée', 'Notification deleted'), 'success');
      } else if (type === 'bulk_coupons') {
        const selectedList = Object.keys(selectedIds).filter(key => selectedIds[key]);
        for (const cId of selectedList) {
          await deleteCouponFromDB(cId);
        }
        const updated = await fetchCouponsFromDB();
        setCoupons(updated);
        await logAction('Suppression Groupée', `Suppression de ${selectedList.length} coupons`);
        showToast(tr('تم حذف العناصر المحددة', 'Éléments supprimés', 'Selected items deleted'), 'success');
        setSelectedIds({});
      } else if (type === 'bulk_promotions') {
        const selectedList = Object.keys(selectedIds).filter(key => selectedIds[key]);
        for (const pId of selectedList) {
          await deletePromotionFromDB(pId);
        }
        const updated = await fetchPromotionsFromDB();
        setPromotions(updated);
        await logAction('Suppression Groupée', `Suppression de ${selectedList.length} promotions`);
        showToast(tr('تم حذف العروض المحددة', 'Promotions supprimées', 'Selected promotions deleted'), 'success');
        setSelectedIds({});
      }
      setDeleteModal({ isOpen: false, type: 'coupon' });
    } catch (e: unknown) {
      console.error(e);
      const msg = (e as Error)?.message || tr('حدث خطأ أثناء الحذف', 'Erreur de suppression', 'Error deleting item');
      setDeleteModal(prev => ({ ...prev, error: msg }));
      showToast(msg, 'error');
    } finally {
      setIsDeletingItem(false);
    }
  };

  // ==================== FILTERED & PAGINATED DATA ====================
  const filteredCoupons = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = new Date();

    return coupons.filter(c => {
      // Search
      const matchesSearch = !query || c.code.toLowerCase().includes(query) || (c.description && c.description.toLowerCase().includes(query));

      // Status
      const isExpired = c.expires_at ? new Date(c.expires_at) < now : false;
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = c.is_active && !isExpired;
      else if (statusFilter === 'expired') matchesStatus = isExpired;
      else if (statusFilter === 'disabled') matchesStatus = !c.is_active;

      // Group Restriction
      let matchesGroup = true;
      if (groupFilter !== 'all') matchesGroup = c.customer_group_restriction === groupFilter || c.customer_group_restriction === 'all';

      // Type Filter
      let matchesType = true;
      if (typeFilter !== 'all') matchesType = c.discount_type === typeFilter;

      return matchesSearch && matchesStatus && matchesGroup && matchesType;
    });
  }, [coupons, searchQuery, statusFilter, groupFilter, typeFilter]);

  const filteredPromotions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = new Date();

    return promotions.filter(p => {
      const matchesSearch = !query || p.title_ar.toLowerCase().includes(query) || p.title_fr.toLowerCase().includes(query);
      const isEnded = new Date(p.ends_at) < now;
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = p.is_active && !isEnded;
      else if (statusFilter === 'expired') matchesStatus = isEnded;
      else if (statusFilter === 'disabled') matchesStatus = !p.is_active;

      let matchesType = true;
      if (typeFilter !== 'all') matchesType = p.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [promotions, searchQuery, statusFilter, typeFilter]);

  const filteredFeaturedProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter(p => {
      const matchesSearch = !query || p.name_ar.toLowerCase().includes(query) || p.name_fr.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query);
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = p.is_featured || p.is_flash_sale;
      return matchesSearch && matchesStatus;
    });
  }, [products, searchQuery, statusFilter]);

  const filteredNotifications = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return notifications.filter(n => {
      const matchesSearch = !query || n.title.toLowerCase().includes(query) || n.message.toLowerCase().includes(query);
      let matchesStatus = true;
      if (statusFilter !== 'all') matchesStatus = n.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [notifications, searchQuery, statusFilter]);

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return activityLogs.filter(l => !query || l.action.toLowerCase().includes(query) || l.details.toLowerCase().includes(query) || l.user.toLowerCase().includes(query));
  }, [activityLogs, searchQuery]);

  // Current active dataset for pagination
  const activeDataset = useMemo(() => {
    if (activeTab === 'coupons') return filteredCoupons;
    if (activeTab === 'promotions') return filteredPromotions;
    if (activeTab === 'featured') return filteredFeaturedProducts;
    if (activeTab === 'notifications') return filteredNotifications;
    return filteredLogs;
  }, [activeTab, filteredCoupons, filteredPromotions, filteredFeaturedProducts, filteredNotifications, filteredLogs]);

  const totalPages = Math.max(1, Math.ceil(activeDataset.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return activeDataset.slice(start, start + pageSize);
  }, [activeDataset, currentPage, pageSize]);

  return (
    <div className="space-y-6 pb-12" dir={dir}>
      {/* HEADER & METRICS SUMMARY */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Megaphone className="w-7 h-7 text-emerald-400" />
            <span>{tr('إدارة التسويق والعروض', 'Gestion du Marketing & Promotions', 'Marketing & Promotions Management')}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {tr('إنشاء وإدارة أكواد الخصم، الحملات الترويجية، البانرات، والإشعارات للعملاء', 'Gérez vos coupons, campagnes promotionnelles, bannières et notifications clients', 'Manage discount coupons, promo campaigns, banners, and customer notifications')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>{tr('استيراد CSV', 'Importer CSV', 'Import CSV')}</span>
            <input type="file" accept=".csv" onChange={handleImportCSVFile} className="hidden" />
          </label>

          <button
            onClick={handleExportCSV}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>{tr('تصدير CSV', 'Exporter CSV', 'Export CSV')}</span>
          </button>

          {activeTab === 'coupons' && (
            <button
              onClick={handleOpenAddCoupon}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{tr('إنشاء كود خصم', 'Nouveau Coupon', 'New Coupon')}</span>
            </button>
          )}

          {activeTab === 'promotions' && (
            <button
              onClick={handleOpenAddPromotion}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{tr('إضافة عرض جديد', 'Nouvelle Promotion', 'New Promotion')}</span>
            </button>
          )}

          {activeTab === 'notifications' && (
            <button
              onClick={handleOpenAddNotification}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>{tr('إرسال إشعار للعملاء', 'Envoyer Notification', 'Send Notification')}</span>
            </button>
          )}
        </div>
      </div>

      {/* QUICK METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">{tr('إجمالي أكواد الخصم النشطة', 'Coupons Actifs', 'Active Coupons')}</span>
            <span className="text-xl font-bold text-slate-100 font-mono mt-0.5 block">
              {coupons.filter(c => c.is_active).length} / {coupons.length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">{tr('العروض الترويجية الحالية', 'Promotions Actives', 'Active Promotions')}</span>
            <span className="text-xl font-bold text-slate-100 font-mono mt-0.5 block">
              {promotions.filter(p => p.is_active).length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800/80 flex items-center justify-center text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">{tr('المنتجات المميزة', 'Produits en Vedette', 'Featured Products')}</span>
            <span className="text-xl font-bold text-slate-100 font-mono mt-0.5 block">
              {products.filter(p => p.is_featured).length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-800/80 flex items-center justify-center text-indigo-400">
            <Star className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">{tr('الإشعارات المرسلة', 'Notifications Envoyées', 'Notifications Sent')}</span>
            <span className="text-xl font-bold text-slate-100 font-mono mt-0.5 block">
              {notifications.filter(n => n.status === 'sent').length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/80 flex items-center justify-center text-blue-400">
            <Bell className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('coupons')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
            activeTab === 'coupons' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>{tr('أكواد الخصم (Coupons)', 'Coupons de Réduction', 'Coupons')}</span>
          <span className="bg-slate-900/60 text-slate-300 px-1.5 py-0.5 rounded-md text-[10px] font-mono">{coupons.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('promotions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
            activeTab === 'promotions' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>{tr('العروض والتخفيضات', 'Promotions & Ventes Flash', 'Promotions')}</span>
          <span className="bg-slate-900/60 text-slate-300 px-1.5 py-0.5 rounded-md text-[10px] font-mono">{promotions.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('featured')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
            activeTab === 'featured' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Star className="w-4 h-4" />
          <span>{tr('المنتجات المميزة', 'Produits en Vedette', 'Featured Products')}</span>
          {loadingProducts && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
        </button>

        <button
          onClick={() => setActiveTab('banners')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
            activeTab === 'banners' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>{tr('البانرات الإعلانية', 'Bannières Publicitaires', 'Banners')}</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
            activeTab === 'notifications' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>{tr('الإشعارات التسويقية', 'Notifications Push', 'Push Notifications')}</span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
            activeTab === 'activity' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{tr('سجل النشاطات', 'Journal d\'Activités', 'Activity Log')}</span>
        </button>
      </div>

      {/* SEARCH, FILTERS & BULK ACTIONS BAR (When not on Banners tab) */}
      {activeTab !== 'banners' && (
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr('بحث بالاسم، الكود أو التفاصيل...', 'Recherche par nom, code ou détails...', 'Search code, name or details...')}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs outline-none focus:border-emerald-500 text-slate-100 placeholder-slate-500 font-medium"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'expired' | 'disabled' | 'scheduled')}
                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none font-semibold focus:border-emerald-500"
              >
                <option value="all">{tr('جميع الحالات', 'Tous les Statuts', 'All Statuses')}</option>
                <option value="active">{tr('نشط حالياً', 'Actifs uniquement', 'Active only')}</option>
                <option value="expired">{tr('منتهي الصلاحية', 'Expirés', 'Expired')}</option>
                <option value="disabled">{tr('معطل', 'Désactivés', 'Disabled')}</option>
              </select>

              {/* Group Filter for Coupons */}
              {activeTab === 'coupons' && (
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value as 'all' | 'retail' | 'wholesale')}
                  className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none font-semibold focus:border-emerald-500"
                >
                  <option value="all">{tr('كافة الفئات', 'Toutes les catégories clients', 'All Customer Groups')}</option>
                  <option value="retail">{tr('التجزئة فقط (Retail)', 'Retail uniquement', 'Retail only')}</option>
                  <option value="wholesale">{tr('الجملة فقط (Wholesale)', 'Wholesale uniquement', 'Wholesale only')}</option>
                </select>
              )}

              {/* Type Filter */}
              {activeTab === 'coupons' && (
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none font-semibold focus:border-emerald-500"
                >
                  <option value="all">{tr('جميع أنواع الخصم', 'Tous les types de réduction', 'All Discount Types')}</option>
                  <option value="percentage">{tr('نسبة مئوية (%)', 'Pourcentage (%)', 'Percentage (%)')}</option>
                  <option value="fixed">{tr('مبلغ ثابت (DA)', 'Montant fixe (DA)', 'Fixed Amount (DA)')}</option>
                  <option value="free_shipping">{tr('شحن مجاني', 'Livraison gratuite', 'Free Shipping')}</option>
                </select>
              )}

              {activeTab === 'promotions' && (
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none font-semibold focus:border-emerald-500"
                >
                  <option value="all">{tr('جميع أنواع العروض', 'Tous les types de promo', 'All Promo Types')}</option>
                  <option value="flash_sale">{tr('تخفيضات خاطفة (Flash Sale)', 'Vente Flash', 'Flash Sale')}</option>
                  <option value="buy_x_get_y">{tr('اشتري X واحصل على Y', 'Achetez X obtenez Y', 'Buy X Get Y')}</option>
                  <option value="bundle">{tr('باقة منتجات (Bundle)', 'Offre Bundle', 'Bundle Offer')}</option>
                </select>
              )}

              {/* Items per page */}
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none font-semibold focus:border-emerald-500"
              >
                <option value={10}>10 / صفحة</option>
                <option value={20}>20 / صفحة</option>
                <option value={50}>50 / صفحة</option>
              </select>
            </div>
          </div>

          {/* BULK ACTIONS BAR (When elements selected) */}
          {selectedCount > 0 && (
            <div className="bg-emerald-950/60 border border-emerald-800/80 p-2.5 rounded-xl flex items-center justify-between text-xs font-semibold text-emerald-300">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{tr(`تم تحديد ${selectedCount} عنصر`, `${selectedCount} éléments sélectionnés`, `${selectedCount} items selected`)}</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkAction('enable')}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 px-2.5 py-1 rounded-lg transition text-[11px]"
                >
                  {tr('تفعيل', 'Activer', 'Enable')}
                </button>
                <button
                  onClick={() => handleBulkAction('disable')}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 px-2.5 py-1 rounded-lg transition text-[11px]"
                >
                  {tr('تعطيل', 'Désactiver', 'Disable')}
                </button>
                <button
                  onClick={() => handleBulkAction('export')}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 px-2.5 py-1 rounded-lg transition text-[11px]"
                >
                  {tr('تصدير المحدد', 'Exporter', 'Export')}
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="bg-rose-950/80 hover:bg-rose-900/80 border border-rose-800 text-rose-300 px-2.5 py-1 rounded-lg transition text-[11px]"
                >
                  {tr('حذف المحدد', 'Supprimer', 'Delete')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 1: COUPONS MANAGEMENT */}
      {activeTab === 'coupons' && (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right md:text-left text-xs sm:text-sm text-slate-300">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={paginatedData.length > 0 && (paginatedData as ExtendedCoupon[]).every((c) => selectedIds[c.id])}
                      onChange={() => handleSelectAll((paginatedData as ExtendedCoupon[]).map((c) => c.id))}
                      className="rounded accent-emerald-500"
                    />
                  </th>
                  <th className="p-3.5">{tr('كود الخصم الوصف', 'Code Promo & Description', 'Code & Description')}</th>
                  <th className="p-3.5">{tr('قيمة ونوع الخصم', 'Type & Valeur', 'Type & Value')}</th>
                  <th className="p-3.5">{tr('القيود والاستخدام', 'Limites & Minimum', 'Limits & Min Order')}</th>
                  <th className="p-3.5">{tr('الفئة المستهدفة', 'Groupe Cible', 'Target Group')}</th>
                  <th className="p-3.5">{tr('تاريخ الصلاحية', 'Dates de Validité', 'Validity Dates')}</th>
                  <th className="p-3.5 text-center">{tr('الحالة', 'Statut', 'Status')}</th>
                  <th className="p-3.5 text-center">{tr('إجراءات', 'Actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {(paginatedData as ExtendedCoupon[]).map((c) => {
                  const isExpired = c.expires_at ? new Date(c.expires_at).getTime() <= Date.now() : false;
                  return (
                    <tr key={c.id} className="hover:bg-slate-900/40 transition">
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={!!selectedIds[c.id]}
                          onChange={() => setSelectedIds(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                          className="rounded accent-emerald-500"
                        />
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-400 text-sm bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                            {c.code}
                          </span>
                          <button
                            onClick={() => handleCopyCode(c.code)}
                            title="Copier le code"
                            className="p-1 hover:bg-slate-800 text-slate-400 rounded transition"
                          >
                            {copiedCode === c.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {c.description && <p className="text-[11px] text-slate-400 mt-1">{c.description}</p>}
                      </td>

                      <td className="p-3.5">
                        <span className="font-bold text-slate-100 block">
                          {c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : c.discount_type === 'fixed' ? `${formatPrice(c.discount_value)}` : 'Livraison Gratuite'}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase">{c.discount_type}</span>
                      </td>

                      <td className="p-3.5">
                        <p className="text-[11px] text-slate-300">
                          {tr('أدنى طلب', 'Min', 'Min')}: <span className="font-bold text-emerald-400">{formatPrice(c.min_order_amount || 0)}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {tr('الاستخدام', 'Utilisation', 'Usage')}: <span className="font-bold text-slate-200">{c.used_count}</span> / {c.usage_limit ? c.usage_limit : '∞'}
                        </p>
                      </td>

                      <td className="p-3.5">
                        <span className="bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                          {c.customer_group_restriction === 'retail' ? 'Retail Only' : c.customer_group_restriction === 'wholesale' ? 'Wholesale Only' : 'Tous les Clients'}
                        </span>
                      </td>

                      <td className="p-3.5 text-[11px]">
                        <p className="text-slate-300">{c.starts_at ? c.starts_at.substring(0, 10) : 'N/A'}</p>
                        <p className="text-slate-500 text-[10px]">{tr('إلى', 'Jusqu\'au', 'To')}: {c.expires_at ? c.expires_at.substring(0, 10) : 'Permanente'}</p>
                      </td>

                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isExpired
                              ? 'bg-amber-950/80 text-amber-400 border-amber-800/80'
                              : c.is_active
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          {isExpired ? 'Expiré' : c.is_active ? 'Actif' : 'Désactivé'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleToggleCouponActive(c.id)}
                            title={c.is_active ? 'Désactiver' : 'Activer'}
                            className={`p-1.5 rounded-xl border transition ${
                              c.is_active ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' : 'bg-slate-900 border-slate-800 text-emerald-400 hover:bg-slate-800'
                            }`}
                          >
                            {c.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => handleOpenEditCoupon(c)}
                            title="Modifier"
                            className="p-1.5 hover:bg-slate-800 text-blue-400 rounded-xl transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteCoupon(c.id)}
                            title="Supprimer"
                            className="p-1.5 hover:bg-rose-950/60 text-rose-400 rounded-xl transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                      {tr('لا توجد أكواد خصم تطابق خيارات البحث', 'Aucun coupon ne correspond à votre recherche', 'No coupons match your search')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: PROMOTIONS MANAGEMENT */}
      {activeTab === 'promotions' && (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right md:text-left text-xs sm:text-sm text-slate-300">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={paginatedData.length > 0 && (paginatedData as Promotion[]).every((p) => selectedIds[p.id])}
                      onChange={() => handleSelectAll((paginatedData as Promotion[]).map((p) => p.id))}
                      className="rounded accent-emerald-500"
                    />
                  </th>
                  <th className="p-3.5">{tr('عنوان وتفاصيل العرض', 'Titre de la Promotion', 'Title & Details')}</th>
                  <th className="p-3.5">{tr('نوع الحملة', 'Type de Promotion', 'Campaign Type')}</th>
                  <th className="p-3.5">{tr('قيمة الخصم', 'Réduction', 'Discount Value')}</th>
                  <th className="p-3.5">{tr('تاريخ البدء والنهاية', 'Période de la Promo', 'Start & End Dates')}</th>
                  <th className="p-3.5 text-center">{tr('الحالة', 'Statut', 'Status')}</th>
                  <th className="p-3.5 text-center">{tr('إجراءات', 'Actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {(paginatedData as Promotion[]).map((p) => {
                  const isEnded = p.ends_at ? new Date(p.ends_at).getTime() <= Date.now() : false;
                  return (
                    <tr key={p.id} className="hover:bg-slate-900/40 transition">
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={!!selectedIds[p.id]}
                          onChange={() => setSelectedIds(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                          className="rounded accent-emerald-500"
                        />
                      </td>

                      <td className="p-3.5">
                        <p className="font-bold text-slate-100">{p.title_ar || p.title_fr}</p>
                        <p className="text-[11px] text-slate-400">{p.title_fr}</p>
                      </td>

                      <td className="p-3.5">
                        <span className="bg-slate-900 border border-slate-800 text-indigo-300 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase">
                          {p.type === 'flash_sale' ? '⚡ Vente Flash' : p.type === 'buy_x_get_y' ? '🎁 Buy X Get Y' : p.type === 'bundle' ? '📦 Bundle' : 'Discount'}
                        </span>
                      </td>

                      <td className="p-3.5 font-bold text-emerald-400">
                        {p.discount_type === 'percentage' ? `-${p.discount_value}%` : `-${formatPrice(p.discount_value)}`}
                      </td>

                      <td className="p-3.5 text-[11px]">
                        <p className="text-slate-300">{p.starts_at.substring(0, 16).replace('T', ' ')}</p>
                        <p className="text-slate-500 text-[10px]">إلى: {p.ends_at.substring(0, 16).replace('T', ' ')}</p>
                      </td>

                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isEnded
                              ? 'bg-amber-950/80 text-amber-400 border-amber-800/80'
                              : p.is_active
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          {isEnded ? 'Terminé' : p.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleTogglePromotionActive(p.id)}
                            className="p-1.5 hover:bg-slate-800 text-emerald-400 rounded-xl transition"
                          >
                            {p.is_active ? <Ban className="w-4 h-4 text-amber-400" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => handleOpenEditPromotion(p)}
                            className="p-1.5 hover:bg-slate-800 text-blue-400 rounded-xl transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeletePromotion(p.id)}
                            className="p-1.5 hover:bg-rose-950/60 text-rose-400 rounded-xl transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 text-xs">
                      {tr('لا توجد عروض ترويجية بعد', 'Aucune promotion trouvée', 'No promotions found')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: FEATURED PRODUCTS & MARKETING BADGES */}
      {activeTab === 'featured' && (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>{tr('إدارة الشارات التسويقية والمنتجات المميزة بالمتجر', 'Gestion des badges marketing et produits en vedette', 'Manage store marketing badges and featured products')}</span>
            <span className="font-mono text-emerald-400 font-bold">{paginatedData.length} produits</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right md:text-left text-xs sm:text-sm text-slate-300">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase">
                  <th className="p-3.5">{tr('المنتج', 'Produit', 'Product')}</th>
                  <th className="p-3.5">{tr('رمز SKU', 'SKU', 'SKU')}</th>
                  <th className="p-3.5">{tr('السعر', 'Prix', 'Price')}</th>
                  <th className="p-3.5 text-center">{tr('مميز (Featured)', 'En Vedette', 'Featured')}</th>
                  <th className="p-3.5 text-center">{tr('عرض خاطف (Flash Sale)', 'Vente Flash', 'Flash Sale')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {(paginatedData as Product[]).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/40 transition">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100'}
                          alt={p.name_fr}
                          className="w-10 h-10 rounded-xl object-cover bg-slate-900 border border-slate-800 shrink-0"
                        />
                        <div>
                          <p className="font-bold text-slate-100">{p.name_ar || p.name_fr}</p>
                          <p className="text-[10px] text-slate-400">{p.name_fr}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5 font-mono text-xs text-slate-400">{p.sku}</td>

                    <td className="p-3.5 font-bold text-emerald-400">{formatPrice(p.price)}</td>

                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleToggleProductBadge(p.id, 'is_featured')}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto ${
                          p.is_featured
                            ? 'bg-amber-950/80 text-amber-400 border-amber-800/80'
                            : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${p.is_featured ? 'fill-amber-400' : ''}`} />
                        <span>{p.is_featured ? 'En Vedette' : 'Normal'}</span>
                      </button>
                    </td>

                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleToggleProductBadge(p.id, 'is_flash_sale')}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto ${
                          p.is_flash_sale
                            ? 'bg-rose-950/80 text-rose-400 border-rose-800/80'
                            : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                        }`}
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>{p.is_flash_sale ? 'Flash Sale' : 'Non'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: BANNERS MANAGEMENT */}
      {activeTab === 'banners' && (
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-sm">
          <AdminBanners />
        </div>
      )}

      {/* TAB CONTENT 5: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right md:text-left text-xs sm:text-sm text-slate-300">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase">
                  <th className="p-3.5">{tr('عنوان ونص الإشعار', 'Titre & Message', 'Title & Message')}</th>
                  <th className="p-3.5">{tr('الجمهور المستهدف', 'Cible', 'Target Audience')}</th>
                  <th className="p-3.5">{tr('تاريخ الإرسال / الجدولة', 'Date d\'Envoi', 'Date Sent/Scheduled')}</th>
                  <th className="p-3.5 text-center">{tr('الحالة', 'Statut', 'Status')}</th>
                  <th className="p-3.5 text-center">{tr('إجراءات', 'Actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {(paginatedData as MarketingNotification[]).map((n) => (
                  <tr key={n.id} className="hover:bg-slate-900/40 transition">
                    <td className="p-3.5">
                      <p className="font-bold text-slate-100">{n.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                    </td>

                    <td className="p-3.5">
                      <span className="bg-slate-900 border border-slate-800 text-blue-300 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                        {n.target_group === 'all' ? 'Tous les clients' : n.target_group === 'retail' ? 'Clients Retail' : 'Clients Wholesale'}
                      </span>
                    </td>

                    <td className="p-3.5 text-xs text-slate-400">
                      {n.sent_at ? n.sent_at.substring(0, 16).replace('T', ' ') : n.scheduled_at ? `Programmé: ${n.scheduled_at.substring(0, 16).replace('T', ' ')}` : 'N/A'}
                    </td>

                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          n.status === 'sent'
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                            : 'bg-amber-950/80 text-amber-400 border-amber-800/80'
                        }`}
                      >
                        {n.status === 'sent' ? 'Envoyé' : 'Programmé'}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleDeleteNotification(n.id)}
                        className="p-1.5 hover:bg-rose-950/60 text-rose-400 rounded-xl transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                      {tr('لا توجد إشعارات مسجلة', 'Aucune notification trouvée', 'No notifications recorded')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 6: ACTIVITY LOGS */}
      {activeTab === 'activity' && (
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-slate-100">{tr('سجل نشاطات وتغييرات قسم التسويق', 'Historique des Actions Marketing', 'Marketing System Activity Log')}</h3>
            </div>
            <span className="text-xs text-slate-500">{filteredLogs.length} événements</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredLogs.map((log) => (
              <div key={log.id} className="bg-slate-900 border border-slate-800/80 p-3 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-100 block">{log.action}</span>
                  <span className="text-slate-400">{log.details}</span>
                </div>
                <div className="text-right text-[10px]">
                  <span className="text-slate-500 block">{log.timestamp.replace('T', ' ').substring(0, 16)}</span>
                  <span className="font-bold text-emerald-400">{log.user}</span>
                </div>
              </div>
            ))}

            {filteredLogs.length === 0 && (
              <p className="text-center text-slate-500 p-6 text-xs">{tr('لا توجد نشاطات مسجلة بعد', 'Aucune activité enregistrée', 'No activities recorded yet')}</p>
            )}
          </div>
        </div>
      )}

      {/* PAGINATION FOOTER */}
      {activeTab !== 'banners' && totalPages > 1 && (
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400">
          <span>
            {tr('عرض الصفحات', 'Page', 'Page')} {currentPage} {tr('من إجمالي', 'sur', 'of')} {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 disabled:opacity-40 text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="px-3 font-mono font-bold text-slate-200">{currentPage} / {totalPages}</span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 disabled:opacity-40 text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT COUPON */}
      {showCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-950 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-400" />
                <span>{editingCoupon ? tr('تحديث كود الخصم', 'Modifier le Coupon', 'Edit Coupon') : tr('إنشاء كود خصم جديد', 'Nouveau Coupon', 'Create Coupon')}</span>
              </h2>
              <button onClick={() => setShowCouponModal(false)} className="p-1 text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-3.5 text-xs font-semibold text-slate-300">
              <div>
                <label className="block text-slate-400 mb-1">{tr('كود الخصم (Code Promo) *', 'Code Promo *', 'Coupon Code *')}</label>
                <input
                  type="text"
                  required
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="مثال: SUMMER2026, WELCOME10..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none font-mono font-bold text-slate-100 focus:border-emerald-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{tr('الوصف (اختياري)', 'Description (Optionnel)', 'Description')}</label>
                <input
                  type="text"
                  value={couponForm.description}
                  onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                  placeholder="خصم 10% للعملاء الجدد..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none text-slate-100 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{tr('نوع الخصم', 'Type de Réduction', 'Discount Type')}</label>
                  <select
                    value={couponForm.discount_type}
                    onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value as 'percentage' | 'fixed' | 'free_shipping' })}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 outline-none font-bold focus:border-emerald-500"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (DA)</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">{tr('قيمة الخصم', 'Valeur', 'Discount Value')}</label>
                  <input
                    type="number"
                    disabled={couponForm.discount_type === 'free_shipping'}
                    value={couponForm.discount_value}
                    onChange={(e) => setCouponForm({ ...couponForm, discount_value: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none font-mono font-bold text-slate-100 focus:border-emerald-500 disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{tr('الحد الأدنى للطلب (DA)', 'Min d\'Achat (DA)', 'Min Order Amount')}</label>
                  <input
                    type="number"
                    value={couponForm.min_order_amount}
                    onChange={(e) => setCouponForm({ ...couponForm, min_order_amount: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none font-mono text-slate-100 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">{tr('أقصى مبلغ خصم (DA)', 'Plafond Réduction (DA)', 'Max Discount Cap')}</label>
                  <input
                    type="number"
                    value={couponForm.max_discount_amount}
                    onChange={(e) => setCouponForm({ ...couponForm, max_discount_amount: Number(e.target.value) })}
                    placeholder="0 = بدون حد"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none font-mono text-slate-100 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{tr('تاريخ التفعيل', 'Date de Début', 'Starts At')}</label>
                  <input
                    type="datetime-local"
                    value={couponForm.starts_at}
                    onChange={(e) => setCouponForm({ ...couponForm, starts_at: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none text-slate-100 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">{tr('تاريخ الانتهاء', 'Date d\'Expiration', 'Expires At')}</label>
                  <input
                    type="datetime-local"
                    value={couponForm.expires_at}
                    onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none text-slate-100 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{tr('إجمالي الاستخدام المسموح', 'Limite Totale', 'Total Usage Limit')}</label>
                  <input
                    type="number"
                    value={couponForm.usage_limit}
                    onChange={(e) => setCouponForm({ ...couponForm, usage_limit: Number(e.target.value) })}
                    placeholder="0 = غير محدود"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none font-mono text-slate-100 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">{tr('حد لكل زبون', 'Limite par Client', 'Per Customer Limit')}</label>
                  <input
                    type="number"
                    value={couponForm.per_customer_limit}
                    onChange={(e) => setCouponForm({ ...couponForm, per_customer_limit: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none font-mono text-slate-100 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{tr('فئة العملاء المسموح لها', 'Groupe de Clients Autorisé', 'Allowed Customer Group')}</label>
                <select
                  value={couponForm.customer_group_restriction}
                  onChange={(e) => setCouponForm({ ...couponForm, customer_group_restriction: e.target.value as 'all' | 'retail' | 'wholesale' })}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 outline-none font-bold focus:border-emerald-500"
                >
                  <option value="all">جميع العملاء (Tous les clients)</option>
                  <option value="retail">عملاء التجزئة فقط (Retail Only)</option>
                  <option value="wholesale">تجار الجملة فقط (Wholesale B2B Only)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="coupon_active"
                  checked={couponForm.is_active}
                  onChange={(e) => setCouponForm({ ...couponForm, is_active: e.target.checked })}
                  className="rounded accent-emerald-500 w-4 h-4"
                />
                <label htmlFor="coupon_active" className="text-slate-200 cursor-pointer font-bold">
                  {tr('تفعيل كود الخصم فوراً', 'Activer ce coupon immédiatement', 'Enable coupon immediately')}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCouponModal(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm"
                >
                  حفظ كود الخصم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT PROMOTION */}
      {showPromotionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-950 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <span>{editingPromotion ? tr('تحديث العرض', 'Modifier la Promotion', 'Edit Promotion') : tr('إضافة عرض ترويجي جديد', 'Nouvelle Promotion', 'New Promotion')}</span>
              </h2>
              <button onClick={() => setShowPromotionModal(false)} className="p-1 text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePromotion} className="space-y-3.5 text-xs font-semibold text-slate-300">
              <div>
                <label className="block text-slate-400 mb-1">عنوان العرض (بالعربية) *</label>
                <input
                  type="text"
                  required
                  value={promotionForm.title_ar}
                  onChange={(e) => setPromotionForm({ ...promotionForm, title_ar: e.target.value })}
                  placeholder="مثال: تخفيضات الصيف الكبرى..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none text-slate-100 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">عنوان العرض (بالفرنسية) *</label>
                <input
                  type="text"
                  required
                  value={promotionForm.title_fr}
                  onChange={(e) => setPromotionForm({ ...promotionForm, title_fr: e.target.value })}
                  placeholder="Ex: Grandes Soldes d'Été..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none text-slate-100 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">نوع العرض</label>
                  <select
                    value={promotionForm.type}
                    onChange={(e) => setPromotionForm({ ...promotionForm, type: e.target.value as Promotion['type'] })}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 outline-none font-bold focus:border-emerald-500"
                  >
                    <option value="flash_sale">⚡ Vente Flash</option>
                    <option value="product_discount">Product Discount</option>
                    <option value="category_discount">Category Discount</option>
                    <option value="buy_x_get_y">Buy X Get Y</option>
                    <option value="bundle">Bundle Offer</option>
                  </select>
                  {categories.length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-1">{categories.length} {tr('فئة متاحة للربط', 'catégories disponibles', 'categories available')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">قيمة الخصم (% أو DA)</label>
                  <input
                    type="number"
                    value={promotionForm.discount_value}
                    onChange={(e) => setPromotionForm({ ...promotionForm, discount_value: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none font-mono font-bold text-slate-100 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">تاريخ ووقت البدء</label>
                  <input
                    type="datetime-local"
                    value={promotionForm.starts_at}
                    onChange={(e) => setPromotionForm({ ...promotionForm, starts_at: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none text-slate-100 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">تاريخ ووقت الانتهاء</label>
                  <input
                    type="datetime-local"
                    value={promotionForm.ends_at}
                    onChange={(e) => setPromotionForm({ ...promotionForm, ends_at: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none text-slate-100 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="prom_active"
                  checked={promotionForm.is_active}
                  onChange={(e) => setPromotionForm({ ...promotionForm, is_active: e.target.checked })}
                  className="rounded accent-emerald-500 w-4 h-4"
                />
                <label htmlFor="prom_active" className="text-slate-200 cursor-pointer font-bold">
                  تفعيل هذا العرض فوراً
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPromotionModal(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm"
                >
                  حفظ العرض
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SEND NOTIFICATION */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-950 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-400" />
                <span>{tr('إرسال إشعار تسويقي للعملاء', 'Envoyer une Notification', 'Send Push Notification')}</span>
              </h2>
              <button onClick={() => setShowNotificationModal(false)} className="p-1 text-slate-400 hover:text-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNotification} className="space-y-3.5 text-xs font-semibold text-slate-300">
              <div>
                <label className="block text-slate-400 mb-1">عنوان الإشعار *</label>
                <input
                  type="text"
                  required
                  value={notificationForm.title}
                  onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
                  placeholder="تخفيضات موسم الصيف وصلت! ☀️"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none text-slate-100 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">نص الإشعار *</label>
                <textarea
                  required
                  rows={3}
                  value={notificationForm.message}
                  onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                  placeholder="استمتع بتخفيضات تصل إلى 30% على كافة المنتجات..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none text-slate-100 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">الجمهور المستهدف</label>
                <select
                  value={notificationForm.target_group}
                  onChange={(e) => setNotificationForm({ ...notificationForm, target_group: e.target.value as 'all' | 'retail' | 'wholesale' | 'selected' })}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 outline-none font-bold focus:border-emerald-500"
                >
                  <option value="all">جميع العملاء (Tous les clients)</option>
                  <option value="retail">عملاء التجزئة فقط (Retail)</option>
                  <option value="wholesale">تجار الجملة (Wholesale B2B)</option>
                </select>
                {customers.length > 0 && (
                  <p className="text-[10px] text-slate-500 mt-1">{customers.length} {tr('عميل مسجل في النظام', 'clients enregistrés', 'registered customers')}</p>
                )}
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="send_now"
                    name="send_type"
                    checked={notificationForm.send_immediately}
                    onChange={() => setNotificationForm({ ...notificationForm, send_immediately: true })}
                    className="accent-emerald-500"
                  />
                  <label htmlFor="send_now" className="text-slate-200 cursor-pointer font-bold">
                    إرسال فوري الآن
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="send_sched"
                    name="send_type"
                    checked={!notificationForm.send_immediately}
                    onChange={() => setNotificationForm({ ...notificationForm, send_immediately: false })}
                    className="accent-emerald-500"
                  />
                  <label htmlFor="send_sched" className="text-slate-200 cursor-pointer font-bold">
                    جدولة الإرسال في وقت لاحق
                  </label>
                </div>
              </div>

              {!notificationForm.send_immediately && (
                <div>
                  <label className="block text-slate-400 mb-1">تاريخ ووقت الإرسال المجدول</label>
                  <input
                    type="datetime-local"
                    value={notificationForm.scheduled_at}
                    onChange={(e) => setNotificationForm({ ...notificationForm, scheduled_at: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 outline-none text-slate-100 focus:border-emerald-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNotificationModal(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm"
                >
                  {notificationForm.send_immediately ? 'إرسال الآن' : 'جدولة الإرسال'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARKETING DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeletingItem}
        itemName={deleteModal.title}
        error={deleteModal.error}
      />
    </div>
  );
}
