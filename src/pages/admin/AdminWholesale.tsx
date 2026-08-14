import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, Layers, DollarSign, FileText, Settings, Building2, XCircle,
  Plus, Edit, Trash2, Check, X, AlertCircle, TrendingUp, Download, Upload, Loader2, ShoppingCart,
  Search, ChevronLeft, ChevronRight, CheckCircle2, RefreshCw, Percent, Eye, RotateCcw, CheckSquare, Phone, MessageSquare
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { 
  Customer, Product, CustomerGroup, PriceList, PriceListEntry, 
  CustomerPriceOverride, PurchaseOrder, PaymentTerms, WholesaleInvoice, WholesaleSettings,
  WholesaleActivityLog, parseCustomerExtended
} from '../../types';
import { exportToCSV, parseCSVFile } from '../../lib/csvHelper';
import { loadWholesaleStore, saveWholesaleStore, WholesaleStoreData, CustomerCreditData } from '../../lib/wholesaleStore';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';

export default function AdminWholesale() {
  const { lang, formatPrice, dir, formatDate } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  // Tabs
  type TabType = 'wholesale_customers' | 'groups' | 'pricelists' | 'overrides' | 'purchase_orders' | 'invoices' | 'settings' | 'reports';
  const [activeTab, setActiveTab] = useState<TabType>('wholesale_customers');

  const tabs: { id: TabType; label: string; icon: typeof Users }[] = [
    { id: 'wholesale_customers', label: tr('عملاء الجملة (B2B)', 'Clients Wholesale B2B'), icon: Building2 },
    { id: 'groups', label: tr('مجموعات الشرائح والخصم', 'Groupes Tarifaires'), icon: Users },
    { id: 'pricelists', label: tr('قوائم الأسعار', 'Listes de Prix'), icon: Layers },
    { id: 'overrides', label: tr('الأسعار المخصصة', 'Prix Spécifiques'), icon: DollarSign },
    { id: 'purchase_orders', label: tr('طلبات الشراء B2B', "Bons d'Achat B2B"), icon: ShoppingCart },
    { id: 'invoices', label: tr('فواتير ائتمان الجملة', 'Factures Crédit'), icon: FileText },
    { id: 'settings', label: tr('إعدادات الجملة', 'Paramètres Wholesale'), icon: Settings },
    { id: 'reports', label: tr('تقارير المبيعات', 'Rapports B2B'), icon: TrendingUp },
  ];

  // Data State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'group' | 'pricelist' | 'pricelist_item' | 'override' | 'reject_po' | 'po' | 'invoice' | 'term';
    id?: string;
    title?: string;
    error?: string | null;
  }>({ isOpen: false, type: 'group' });
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [priceEntries, setPriceEntries] = useState<PriceListEntry[]>([]);
  const [overrides, setOverrides] = useState<CustomerPriceOverride[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms[]>([]);
  const [invoices, setInvoices] = useState<WholesaleInvoice[]>([]);

  // Wholesale Settings State
  const [wholesaleSettings, setWholesaleSettings] = useState<WholesaleSettings>({
    min_order_amount: 50000,
    credit_limit_default: 100000,
    auto_approve_po: false,
    default_payment_terms_days: 30,
    wholesale_terms_notes: '1. Le paiement doit être effectué dans le délai convenu.\n2. Tout retard entraînera la suspension du compte crédit.',
  });

  // UI / Search / Pagination State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [accountStatusFilter, setAccountStatusFilter] = useState<string>('all'); // 'all' | 'Active' | 'Suspended' | 'Blocked' | 'trash'
  const [paymentTermsFilter, setPaymentTermsFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // File import refs
  const importFileRef = useRef<HTMLInputElement>(null);
  const customerImportFileRef = useRef<HTMLInputElement>(null);

  // Selection & Details Modal States
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [customerDetailsModal, setCustomerDetailsModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailsTab, setDetailsTab] = useState<'info' | 'orders' | 'overrides' | 'notes' | 'logs'>('info');
  const [quickOverrideForm, setQuickOverrideForm] = useState({ product_id: '', custom_price: 0 });

  // Modal Visibility States
  const [groupModal, setGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [groupForm, setGroupForm] = useState({ name_ar: '', name_fr: '', discount_percentage: 0 });

  const [priceListModal, setPriceListModal] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null);
  const [priceListForm, setPriceListForm] = useState({ name: '', is_active: true });

  const [priceEntryModal, setPriceEntryModal] = useState(false);
  const [editingPriceEntry, setEditingPriceEntry] = useState<PriceListEntry | null>(null);
  const [priceEntryForm, setPriceEntryForm] = useState({ price_list_id: '', product_id: '', wholesale_price: 0 });

  const [overrideModal, setOverrideModal] = useState(false);
  const [editingOverride, setEditingOverride] = useState<CustomerPriceOverride | null>(null);
  const [overrideForm, setOverrideForm] = useState({ customer_id: '', product_id: '', custom_price: 0 });

  const [creditModal, setCreditModal] = useState(false);
  const [creditForm, setCreditForm] = useState({ customer_id: '', credit_limit: 0, credit_balance: 0, customer_group_id: '' });

  const [poModal, setPoModal] = useState(false);
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
  const [poForm, setPoForm] = useState({ po_number: '', customer_id: '', total_amount: 0, notes: '', payment_terms_id: '' });

  const [invoiceModal, setInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<WholesaleInvoice | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({ invoice_number: '', order_id: '', customer_id: '', total_amount: 0, due_date: '', status: 'unpaid' as 'unpaid' | 'paid' | 'overdue' });

  const [paymentTermModal, setPaymentTermModal] = useState(false);
  const [editingPaymentTerm, setEditingPaymentTerm] = useState<PaymentTerms | null>(null);
  const [paymentTermForm, setPaymentTermForm] = useState({ label: '', days: 30, is_active: true });

  const [wholesaleCustomerModal, setWholesaleCustomerModal] = useState(false);
  const [editingWholesaleCustomer, setEditingWholesaleCustomer] = useState<Customer | null>(null);
  const [wholesaleCustomerForm, setWholesaleCustomerForm] = useState({
    company_name: '',
    full_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    wilaya_id: 16,
    register_number: '',
    tax_id: '',
    nis: '',
    vat_number: '',
    customer_group_id: '',
    price_list_id: '',
    payment_terms_id: '',
    credit_limit: 100000,
    credit_balance: 100000,
    wholesale_status: 'approved' as 'pending' | 'approved' | 'rejected',
    status: 'Active' as 'Active' | 'Suspended' | 'Blocked',
    notes: '',
    admin_notes: '',
  });

  /* --------------------------- Helper: Snapshot for Storage --------------------------- */
  const getStoreSnapshot = (overridesObj?: Partial<WholesaleStoreData>): WholesaleStoreData => {
    return {
      groups: overridesObj?.groups ?? groups,
      customer_credits: overridesObj?.customer_credits ?? customers.map(c => ({
        customer_id: c.id,
        customer_group_id: c.customer_group_id || '',
        credit_limit: c.credit_limit || 0,
        credit_balance: c.credit_balance || 0,
        company_name: c.company_name || '',
        account_type: c.account_type || 'wholesale',
        wholesale_status: c.wholesale_status || 'approved'
      })),
      price_lists: overridesObj?.price_lists ?? priceLists,
      price_entries: overridesObj?.price_entries ?? priceEntries,
      overrides: overridesObj?.overrides ?? overrides,
      purchase_orders: overridesObj?.purchase_orders ?? purchaseOrders,
      payment_terms: overridesObj?.payment_terms ?? paymentTerms,
      invoices: overridesObj?.invoices ?? invoices,
      settings: overridesObj?.settings ?? wholesaleSettings
    };
  };

  /* --------------------------- Default Fallbacks --------------------------- */
  const DEFAULT_CUSTOMERS: Customer[] = [];
  const DEFAULT_PRODUCTS: Product[] = [];

  /* --------------------------- Helper: Persistence & Activity Logging --------------------------- */
  const persistCustomersData = async (newCustomersList: Customer[]) => {
    setCustomers(newCustomersList);
    try {
      localStorage.setItem('local_wholesale_customers', JSON.stringify(newCustomersList));
    } catch (e) {
      console.warn('Failed to save local_wholesale_customers', e);
    }
    const updatedStore = getStoreSnapshot({
      customer_credits: newCustomersList.map(c => ({
        customer_id: c.id,
        customer_group_id: c.customer_group_id || '',
        credit_limit: c.credit_limit || 0,
        credit_balance: c.credit_balance || 0,
        company_name: c.company_name || '',
        account_type: c.account_type || 'wholesale',
        wholesale_status: c.wholesale_status || 'approved'
      }))
    });
    await saveWholesaleStore(updatedStore);
  };

  const logCustomerActivity = (c: Customer, action: string, details: string): WholesaleActivityLog[] => {
    const entry: WholesaleActivityLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      action,
      details,
      timestamp: new Date().toISOString(),
      user: 'Admin'
    };
    return [entry, ...(c.activity_log || [])];
  };

  /* --------------------------- Load Data --------------------------- */
  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [custRes, prodRes] = await Promise.all([
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('created_at', { ascending: false })
      ]);

      const store = await loadWholesaleStore();

      let rawCustomers: Customer[] = (custRes.data as Customer[]) || [];
      const localCustsStr = localStorage.getItem('local_wholesale_customers');
      let localCusts: Customer[] = [];
      if (localCustsStr) {
        try { localCusts = JSON.parse(localCustsStr); } catch (e) { console.warn(e); }
      }

      // Merge Supabase customers and local storage customers
      if (rawCustomers.length === 0 && localCusts.length > 0) {
        rawCustomers = localCusts;
      } else if (rawCustomers.length > 0 && localCusts.length > 0) {
        const map = new Map<string, Customer>();
        // First set local storage customers
        localCusts.forEach(c => map.set(c.id, c));
        // Override with raw Supabase customers
        rawCustomers.forEach(c => {
          const local = map.get(c.id);
          const ext = parseCustomerExtended(c);
          const localExt = local ? parseCustomerExtended(local) : null;

          const merged: Customer = {
            ...(local || {}),
            ...c, // Supabase data takes priority over stale local storage
            company_name: c.company_name || ext.company_name || local?.company_name || localExt?.company_name || c.full_name || '',
            wholesale_status: c.wholesale_status || ext.wholesale_status || local?.wholesale_status || localExt?.wholesale_status || 'approved',
            status: c.status || ext.status || local?.status || localExt?.status || 'Active',
            is_deleted: c.is_deleted ?? ext.is_deleted ?? local?.is_deleted ?? localExt?.is_deleted ?? false,
            deleted_at: c.deleted_at || ext.deleted_at || local?.deleted_at || localExt?.deleted_at || null,
            vat_number: c.vat_number || ext.vat_number || local?.vat_number || localExt?.vat_number || null,
            admin_notes: c.admin_notes || ext.admin_notes || local?.admin_notes || localExt?.admin_notes || '',
            activity_log: (c.activity_log && c.activity_log.length > 0)
              ? c.activity_log
              : (ext.activity_log && ext.activity_log.length > 0)
              ? ext.activity_log
              : (local?.activity_log && local.activity_log.length > 0)
              ? local.activity_log
              : (localExt?.activity_log && localExt.activity_log.length > 0)
              ? localExt.activity_log
              : [],
          };
          map.set(c.id, merged);
        });
        rawCustomers = Array.from(map.values());
      } else if (rawCustomers.length === 0) {
        rawCustomers = DEFAULT_CUSTOMERS;
      }

      let rawProducts: Product[] = (prodRes.data as Product[]) || [];
      if (rawProducts.length === 0) {
        const localProds = localStorage.getItem('local_admin_products');
        if (localProds) {
          try { rawProducts = JSON.parse(localProds); } catch { rawProducts = DEFAULT_PRODUCTS; }
        } else {
          rawProducts = DEFAULT_PRODUCTS;
        }
      }
      setProducts(rawProducts);

      const creditMap = new Map<string, CustomerCreditData>();
      (store.customer_credits || []).forEach(cc => creditMap.set(cc.customer_id, cc));

      const updatedCustomers = rawCustomers.map(c => {
        const cc = creditMap.get(c.id);
        const ext = parseCustomerExtended(c);
        return {
          ...c,
          account_type: c.account_type || 'wholesale',
          customer_group_id: c.customer_group_id || cc?.customer_group_id || '',
          credit_limit: c.credit_limit ?? cc?.credit_limit ?? wholesaleSettings.credit_limit_default,
          credit_balance: c.credit_balance ?? cc?.credit_balance ?? wholesaleSettings.credit_limit_default,
          company_name: c.company_name || ext.company_name || cc?.company_name || c.full_name || '',
          wholesale_status: c.wholesale_status || ext.wholesale_status || (cc?.wholesale_status as 'approved' | 'pending' | 'rejected') || 'approved',
          status: c.status || ext.status || 'Active',
          is_deleted: c.is_deleted ?? ext.is_deleted ?? false,
          deleted_at: c.deleted_at || ext.deleted_at || null,
          vat_number: c.vat_number || ext.vat_number || null,
          admin_notes: c.admin_notes || ext.admin_notes || '',
          activity_log: (c.activity_log && c.activity_log.length > 0)
            ? c.activity_log
            : (ext.activity_log && ext.activity_log.length > 0)
            ? ext.activity_log
            : [
                {
                  id: 'init-log-1',
                  action: tr('إنشاء حساب التاجر', 'Création du compte B2B'),
                  details: tr('تم إدراج العميل في سجل الجملة B2B', 'Client enregistré dans le système B2B'),
                  timestamp: c.created_at || new Date().toISOString(),
                  user: 'System'
                }
              ]
        };
      });

      setCustomers(updatedCustomers);
      localStorage.setItem('local_wholesale_customers', JSON.stringify(updatedCustomers));

      setGroups(store.groups && store.groups.length > 0 ? store.groups : [
        { id: 'group-vip-1', name_ar: 'تجار الجملة المميزين (VIP)', name_fr: 'Grossistes VIP', discount_percentage: 15, created_at: new Date().toISOString() },
        { id: 'group-std-1', name_ar: 'تجار الجملة العاديين', name_fr: 'Grossistes Standard', discount_percentage: 8, created_at: new Date().toISOString() }
      ]);
      setPriceLists(store.price_lists && store.price_lists.length > 0 ? store.price_lists : [
        { id: 'pl-summer-2026', name: 'قائمة أسعار صيف 2026 - B2B', is_active: true, created_at: new Date().toISOString() }
      ]);
      setPriceEntries(store.price_entries || []);
      setOverrides(store.overrides || []);
      setPurchaseOrders(store.purchase_orders || []);
      setPaymentTerms(store.payment_terms && store.payment_terms.length > 0 ? store.payment_terms : [
        { id: 'pt-30', label: 'دفع خلال 30 يوم (Net 30)', days: 30, is_active: true },
        { id: 'pt-60', label: 'دفع خلال 60 يوم (Net 60)', days: 60, is_active: true }
      ]);
      setInvoices(store.invoices || []);
      if (store.settings) {
        setWholesaleSettings((prev: WholesaleSettings) => ({ ...prev, ...store.settings }));
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset pagination when search/tab changes
  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery('');
    setStatusFilter('all');
    setGroupFilter('all');
    setAccountStatusFilter('all');
    setPaymentTermsFilter('all');
    setSelectedCustomerIds([]);
  }, [activeTab]);

  /* --------------------------- CRUD 0: Wholesale B2B Customers --------------------------- */
  const openWholesaleCustomerModal = (c: Customer | null) => {
    setEditingWholesaleCustomer(c);
    if (c) {
      setWholesaleCustomerForm({
        company_name: c.company_name || c.full_name || '',
        full_name: c.full_name || '',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        city: c.city || '',
        wilaya_id: c.wilaya_id || 16,
        register_number: c.register_number || '',
        tax_id: c.tax_id || '',
        nis: c.nis || '',
        vat_number: c.vat_number || '',
        customer_group_id: c.customer_group_id || groups[0]?.id || '',
        price_list_id: c.price_list_id || priceLists[0]?.id || '',
        payment_terms_id: c.payment_terms_id || paymentTerms[0]?.id || '',
        credit_limit: c.credit_limit ?? wholesaleSettings.credit_limit_default,
        credit_balance: c.credit_balance ?? wholesaleSettings.credit_limit_default,
        wholesale_status: c.wholesale_status || 'approved',
        status: c.status || 'Active',
        notes: c.notes || '',
        admin_notes: c.admin_notes || ''
      });
    } else {
      setWholesaleCustomerForm({
        company_name: '',
        full_name: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        wilaya_id: 16,
        register_number: '',
        tax_id: '',
        nis: '',
        vat_number: '',
        customer_group_id: groups[0]?.id || '',
        price_list_id: priceLists[0]?.id || '',
        payment_terms_id: paymentTerms[0]?.id || '',
        credit_limit: wholesaleSettings.credit_limit_default,
        credit_balance: wholesaleSettings.credit_limit_default,
        wholesale_status: 'approved',
        status: 'Active',
        notes: '',
        admin_notes: ''
      });
    }
    setWholesaleCustomerModal(true);
  };

  const handleSaveWholesaleCustomer = async () => {
    if (!wholesaleCustomerForm.company_name.trim() && !wholesaleCustomerForm.full_name.trim()) {
      showToast(tr('يرجى كتابة اسم الشركة أو اسم مسؤول الاتصال', 'Veuillez remplir le nom de la société ou du contact'), 'error');
      return;
    }
    if (!wholesaleCustomerForm.phone.trim()) {
      showToast(tr('يرجى كتابة رقم الهاتف', 'Veuillez saisir un numéro de téléphone'), 'error');
      return;
    }

    try {
      setSaving(true);
      const actionName = editingWholesaleCustomer ? 'Toutes modifications sauvegardées' : 'Création du compte B2B';
      const actionAr = editingWholesaleCustomer ? 'تحديث بيانات الحساب' : 'إضافة حساب جديد';

      const existingLogs = editingWholesaleCustomer?.activity_log || [];
      const newLogs = [
        {
          id: 'log-' + Date.now(),
          action: isAr ? actionAr : actionName,
          details: tr('تمت عملية حفظ وبيانات العميل في قاعدة البيانات بنجاح', 'Enregistrement réussi des données du client'),
          timestamp: new Date().toISOString(),
          user: 'Admin'
        },
        ...existingLogs
      ];

      const payload: Partial<Customer> = {
        company_name: wholesaleCustomerForm.company_name.trim(),
        full_name: wholesaleCustomerForm.full_name.trim() || wholesaleCustomerForm.company_name.trim(),
        phone: wholesaleCustomerForm.phone.trim(),
        email: wholesaleCustomerForm.email.trim() || null,
        address: wholesaleCustomerForm.address.trim() || null,
        city: wholesaleCustomerForm.city.trim() || null,
        wilaya_id: Number(wholesaleCustomerForm.wilaya_id) || 16,
        register_number: wholesaleCustomerForm.register_number.trim() || null,
        tax_id: wholesaleCustomerForm.tax_id.trim() || null,
        nis: wholesaleCustomerForm.nis.trim() || null,
        vat_number: wholesaleCustomerForm.vat_number.trim() || null,
        customer_group_id: wholesaleCustomerForm.customer_group_id || null,
        price_list_id: wholesaleCustomerForm.price_list_id || null,
        payment_terms_id: wholesaleCustomerForm.payment_terms_id || null,
        credit_limit: Number(wholesaleCustomerForm.credit_limit) || 0,
        credit_balance: Number(wholesaleCustomerForm.credit_balance) || 0,
        account_type: 'wholesale',
        wholesale_status: wholesaleCustomerForm.wholesale_status,
        status: wholesaleCustomerForm.status,
        notes: wholesaleCustomerForm.notes.trim() || null,
        admin_notes: wholesaleCustomerForm.admin_notes.trim() || null,
        activity_log: newLogs,
        updated_at: new Date().toISOString()
      };

      let newCustomers = [...customers];

      if (editingWholesaleCustomer) {
        try {
          await supabase.from('customers').update(payload).eq('id', editingWholesaleCustomer.id);
        } catch (e) {
          console.warn('Supabase customer update warning:', e);
        }
        newCustomers = newCustomers.map(c => c.id === editingWholesaleCustomer.id ? { ...c, ...payload } : c);
      } else {
        const newCust: Customer = {
          id: 'b2b-cust-' + Date.now(),
          phone: wholesaleCustomerForm.phone.trim(),
          email: wholesaleCustomerForm.email.trim() || null,
          full_name: wholesaleCustomerForm.full_name.trim() || wholesaleCustomerForm.company_name.trim(),
          company_name: wholesaleCustomerForm.company_name.trim(),
          wilaya_id: Number(wholesaleCustomerForm.wilaya_id) || 16,
          address: wholesaleCustomerForm.address.trim() || null,
          city: wholesaleCustomerForm.city.trim() || null,
          is_verified: true,
          is_guest: false,
          total_orders: 0,
          total_spent: 0,
          segment: 'vip',
          notes: wholesaleCustomerForm.notes.trim() || null,
          admin_notes: wholesaleCustomerForm.admin_notes.trim() || null,
          customer_group_id: wholesaleCustomerForm.customer_group_id || null,
          price_list_id: wholesaleCustomerForm.price_list_id || null,
          payment_terms_id: wholesaleCustomerForm.payment_terms_id || null,
          credit_limit: Number(wholesaleCustomerForm.credit_limit) || 0,
          credit_balance: Number(wholesaleCustomerForm.credit_balance) || 0,
          account_type: 'wholesale',
          wholesale_status: wholesaleCustomerForm.wholesale_status,
          status: wholesaleCustomerForm.status,
          register_number: wholesaleCustomerForm.register_number.trim() || null,
          tax_id: wholesaleCustomerForm.tax_id.trim() || null,
          nis: wholesaleCustomerForm.nis.trim() || null,
          vat_number: wholesaleCustomerForm.vat_number.trim() || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...payload
        };

        try {
          await supabase.from('customers').insert([newCust]);
        } catch (e) {
          console.warn('Supabase customer insert warning:', e);
        }
        newCustomers.unshift(newCust);
      }

      await persistCustomersData(newCustomers);

      showToast(
        editingWholesaleCustomer 
          ? tr('تم تحديث بيانات تاجر الجملة بنجاح', 'Grossiste mis à jour avec succès')
          : tr('تم إضافة تاجر الجملة بنجاح', 'Nouveau grossiste enregistré avec succès'),
        'success'
      );
      setWholesaleCustomerModal(false);
    } catch (err) {
      console.error('Error saving customer:', err);
      showToast(err instanceof Error ? err.message : 'Error saving customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateWholesaleStatus = async (customer: Customer, newStatus: 'approved' | 'pending' | 'rejected') => {
    try {
      setSaving(true);
      const nowIso = new Date().toISOString();
      const actionText = newStatus === 'approved' ? 'موافقة الاعتماد B2B' : newStatus === 'rejected' ? 'رفض الاعتماد B2B' : 'تحويل إلى قيد المراجعة';
      const newLogs = logCustomerActivity(customer, actionText, tr(`تم تغيير حالة الاعتماد إلى ${newStatus}`, `Statut d'approbation changé en ${newStatus}`));
      const ext = parseCustomerExtended(customer);

      const extPayload = {
        admin_notes: customer.admin_notes || ext.admin_notes || '',
        wholesale_status: newStatus,
        status: customer.status || ext.status || 'Active',
        is_deleted: customer.is_deleted ?? ext.is_deleted ?? false,
        deleted_at: customer.deleted_at || ext.deleted_at || null,
        activity_log: newLogs,
        company_name: customer.company_name || ext.company_name || customer.full_name || '',
        vat_number: customer.vat_number || ext.vat_number || null,
        credit_limit: customer.credit_limit ?? ext.credit_limit ?? 0,
        credit_balance: customer.credit_balance ?? ext.credit_balance ?? 0,
      };

      const dbPayload = {
        wholesale_status: newStatus,
        notes: JSON.stringify(extPayload),
        updated_at: nowIso,
      };

      try {
        const { error } = await supabase.from('customers').update(dbPayload).eq('id', customer.id);
        if (error) {
          await supabase.from('customers').update({ notes: dbPayload.notes, updated_at: nowIso }).eq('id', customer.id);
        }
      } catch (e) {
        console.warn('Supabase status update warning:', e);
      }
      
      const newCustomers = customers.map(c => c.id === customer.id ? { ...c, wholesale_status: newStatus, activity_log: newLogs, updated_at: nowIso } : c);
      await persistCustomersData(newCustomers);
      
      showToast(
        newStatus === 'approved' 
          ? tr('تمت موافقة الاعتماد لتاجر الجملة', 'Compte grossiste approuvé')
          : newStatus === 'rejected'
          ? tr('تم رفض اعتماد الحساب', 'Compte grossiste refusé')
          : tr('تم تغيير الحالة إلى قيد المراجعة', 'Statut mis en attente'),
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error updating status', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAccountStatus = async (customer: Customer, newAccountStatus: 'Active' | 'Suspended' | 'Blocked') => {
    try {
      setSaving(true);
      const nowIso = new Date().toISOString();
      const actionText = `تغيير حالة الحساب إلى ${newAccountStatus}`;
      const newLogs = logCustomerActivity(customer, actionText, tr(`تم تغيير حالة الحساب إلى ${newAccountStatus}`, `Statut du compte changé en ${newAccountStatus}`));
      const ext = parseCustomerExtended(customer);

      const extPayload = {
        admin_notes: customer.admin_notes || ext.admin_notes || '',
        wholesale_status: customer.wholesale_status || ext.wholesale_status || 'approved',
        status: newAccountStatus,
        is_deleted: customer.is_deleted ?? ext.is_deleted ?? false,
        deleted_at: customer.deleted_at || ext.deleted_at || null,
        activity_log: newLogs,
        company_name: customer.company_name || ext.company_name || customer.full_name || '',
        vat_number: customer.vat_number || ext.vat_number || null,
        credit_limit: customer.credit_limit ?? ext.credit_limit ?? 0,
        credit_balance: customer.credit_balance ?? ext.credit_balance ?? 0,
      };

      const dbPayload = {
        status: newAccountStatus,
        notes: JSON.stringify(extPayload),
        updated_at: nowIso,
      };

      try {
        const { error } = await supabase.from('customers').update(dbPayload).eq('id', customer.id);
        if (error) {
          await supabase.from('customers').update({ notes: dbPayload.notes, updated_at: nowIso }).eq('id', customer.id);
        }
      } catch (e) {
        console.warn('Supabase account status update warning:', e);
      }
      
      const newCustomers = customers.map(c => c.id === customer.id ? { ...c, status: newAccountStatus, activity_log: newLogs, updated_at: nowIso } : c);
      await persistCustomersData(newCustomers);
      
      showToast(tr(`تم تغيير حالة الحساب إلى ${newAccountStatus}`, `Statut du compte mis à jour: ${newAccountStatus}`), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error updating account status', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDeleteWholesaleCustomer = async (id: string) => {
    const cust = customers.find(c => c.id === id);
    if (!cust) return;
    try {
      setSaving(true);
      const nowIso = new Date().toISOString();
      const newLogs = logCustomerActivity(cust, 'حذف مؤقت (سلة المهملات)', tr('تم نقل العميل إلى سلة المهملات (Soft Delete)', 'Placé dans la corbeille (Soft Delete)'));
      const ext = parseCustomerExtended(cust);

      const extPayload = {
        admin_notes: cust.admin_notes || ext.admin_notes || '',
        wholesale_status: cust.wholesale_status || ext.wholesale_status || 'approved',
        status: cust.status || ext.status || 'Active',
        is_deleted: true,
        deleted_at: nowIso,
        activity_log: newLogs,
        company_name: cust.company_name || ext.company_name || cust.full_name || '',
        vat_number: cust.vat_number || ext.vat_number || null,
        credit_limit: cust.credit_limit ?? ext.credit_limit ?? 0,
        credit_balance: cust.credit_balance ?? ext.credit_balance ?? 0,
      };

      const dbPayload = {
        is_deleted: true,
        deleted_at: nowIso,
        notes: JSON.stringify(extPayload),
        updated_at: nowIso,
      };

      try {
        const { error } = await supabase.from('customers').update(dbPayload).eq('id', id);
        if (error) {
          await supabase.from('customers').update({ notes: dbPayload.notes, updated_at: nowIso }).eq('id', id);
        }
      } catch (e) {
        console.warn('Supabase soft delete warning:', e);
      }
      const newCustomers = customers.map(c => c.id === id ? { ...c, is_deleted: true, deleted_at: nowIso, activity_log: newLogs, updated_at: nowIso } : c);
      await persistCustomersData(newCustomers);
      showToast(tr('تم نقل العميل إلى سلة المهملات', 'Client placé dans la corbeille'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error soft deleting customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreWholesaleCustomer = async (id: string) => {
    const cust = customers.find(c => c.id === id);
    if (!cust) return;
    try {
      setSaving(true);
      const nowIso = new Date().toISOString();
      const newLogs = logCustomerActivity(cust, 'استعادة الحساب', tr('تم استعادة العميل من سلة المهملات', 'Client restauré de la corbeille'));
      const ext = parseCustomerExtended(cust);

      const extPayload = {
        admin_notes: cust.admin_notes || ext.admin_notes || '',
        wholesale_status: cust.wholesale_status || ext.wholesale_status || 'approved',
        status: cust.status || ext.status || 'Active',
        is_deleted: false,
        deleted_at: null,
        activity_log: newLogs,
        company_name: cust.company_name || ext.company_name || cust.full_name || '',
        vat_number: cust.vat_number || ext.vat_number || null,
        credit_limit: cust.credit_limit ?? ext.credit_limit ?? 0,
        credit_balance: cust.credit_balance ?? ext.credit_balance ?? 0,
      };

      const dbPayload = {
        is_deleted: false,
        deleted_at: null,
        notes: JSON.stringify(extPayload),
        updated_at: nowIso,
      };

      try {
        const { error } = await supabase.from('customers').update(dbPayload).eq('id', id);
        if (error) {
          await supabase.from('customers').update({ notes: dbPayload.notes, updated_at: nowIso }).eq('id', id);
        }
      } catch (e) {
        console.warn('Supabase restore warning:', e);
      }
      const newCustomers = customers.map(c => c.id === id ? { ...c, is_deleted: false, deleted_at: null, activity_log: newLogs, updated_at: nowIso } : c);
      await persistCustomersData(newCustomers);
      showToast(tr('تم استعادة حساب العميل بنجاح', 'Client restauré avec succès'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error restoring customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePermanentDeleteWholesaleCustomer = async (id: string) => {
    const cust = customers.find(c => c.id === id);
    if (!cust) return;
    try {
      setSaving(true);
      try {
        await supabase.from('customers').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase permanent delete warning:', e);
      }
      const newCustomers = customers.filter(c => c.id !== id);
      await persistCustomersData(newCustomers);
      showToast(tr('تم الحذف النهائي لبيانات العميل', 'Client supprimé définitivement'), 'success');
      if (selectedCustomer?.id === id) {
        setCustomerDetailsModal(false);
        setSelectedCustomer(null);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error deleting customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* Bulk Actions for Wholesale Customers */
  const handleBulkAction = async (action: 'approve' | 'reject' | 'activate' | 'suspend' | 'delete' | 'restore' | 'permanent_delete' | 'export') => {
    if (selectedCustomerIds.length === 0) {
      showToast(tr('يرجى تحديد عميل واحد على الأقل', 'Veuillez sélectionner au moins un client'), 'error');
      return;
    }

    const selectedCusts = customers.filter(c => selectedCustomerIds.includes(c.id));
    if (selectedCusts.length === 0) {
      showToast(tr('لم يتم العثور على العملاء المحددين', 'Aucun client sélectionné trouvé'), 'error');
      return;
    }

    // Export Selected customers ONLY to CSV
    if (action === 'export') {
      const dataToExport = selectedCusts.map(c => ({
        'ID': c.id,
        'Company Name': c.company_name || '',
        'Representative Name': c.full_name || '',
        'Phone': c.phone || '',
        'Email': c.email || '',
        'RC': c.register_number || '',
        'NIF': c.tax_id || '',
        'NIS': c.nis || '',
        'VAT': c.vat_number || '',
        'Wilaya ID': c.wilaya_id || 16,
        'City': c.city || '',
        'Credit Limit': c.credit_limit || 0,
        'Credit Balance': c.credit_balance || 0,
        'Approval Status': c.wholesale_status || 'approved',
        'Account Status': c.status || 'Active',
        'Is Deleted': c.is_deleted ? 'Yes' : 'No'
      }));
      exportToCSV(dataToExport, `Selected_B2B_Wholesale_Customers_${new Date().toISOString().split('T')[0]}`);
      showToast(tr(`تم تصدير ${selectedCusts.length} عميل محدد إلى CSV بنجاح`, `${selectedCusts.length} clients exportés en CSV avec succès`), 'success');
      return;
    }

    try {
      setSaving(true);
      let updatedList = [...customers];
      const nowIso = new Date().toISOString();
      const count = selectedCusts.length;

      if (action === 'permanent_delete') {
        try {
          const { error } = await supabase.from('customers').delete().in('id', selectedCustomerIds);
          if (error) {
            console.warn('Supabase permanent delete error:', error.message);
          }
        } catch (dbErr) {
          console.warn('Supabase permanent delete exception:', dbErr);
        }
        updatedList = updatedList.filter(c => !selectedCustomerIds.includes(c.id));
      } else {
        let actionTitle = '';
        let targetWholesaleStatus: 'approved' | 'rejected' | undefined = undefined;
        let targetStatus: 'Active' | 'Suspended' | undefined = undefined;
        let targetIsDeleted: boolean | undefined = undefined;
        let targetDeletedAt: string | null | undefined = undefined;

        if (action === 'approve') {
          actionTitle = 'اعتماد جماعي B2B';
          targetWholesaleStatus = 'approved';
        } else if (action === 'reject') {
          actionTitle = 'رفض اعتماد جماعي B2B';
          targetWholesaleStatus = 'rejected';
        } else if (action === 'activate') {
          actionTitle = 'تنشيط حساب جماعي';
          targetStatus = 'Active';
        } else if (action === 'suspend') {
          actionTitle = 'تعليق حساب جماعي';
          targetStatus = 'Suspended';
        } else if (action === 'delete') {
          actionTitle = 'حذف جماعي (سلة المهملات)';
          targetIsDeleted = true;
          targetDeletedAt = nowIso;
        } else if (action === 'restore') {
          actionTitle = 'استعادة جماعية من سلة المهملات';
          targetIsDeleted = false;
          targetDeletedAt = null;
        }

        // Send updates to Supabase for each selected customer
        for (const cust of selectedCusts) {
          const ext = parseCustomerExtended(cust);
          const newLogs = logCustomerActivity(cust, actionTitle, tr('إجراء جماعي من لوحة التحكم B2B', 'Action groupée depuis le panneau B2B'));

          const nextWholesaleStatus = targetWholesaleStatus ?? (cust.wholesale_status || ext.wholesale_status || 'approved');
          const nextStatus = targetStatus ?? (cust.status || ext.status || 'Active');
          const nextIsDeleted = targetIsDeleted ?? (cust.is_deleted ?? ext.is_deleted ?? false);
          const nextDeletedAt = targetDeletedAt !== undefined ? targetDeletedAt : (cust.deleted_at || ext.deleted_at || null);

          const extPayload = {
            admin_notes: cust.admin_notes || ext.admin_notes || '',
            wholesale_status: nextWholesaleStatus,
            status: nextStatus,
            is_deleted: nextIsDeleted,
            deleted_at: nextDeletedAt,
            activity_log: newLogs,
            company_name: cust.company_name || ext.company_name || cust.full_name || '',
            vat_number: cust.vat_number || ext.vat_number || null,
            credit_limit: cust.credit_limit ?? ext.credit_limit ?? 0,
            credit_balance: cust.credit_balance ?? ext.credit_balance ?? 0,
          };

          const dbPayload: Record<string, unknown> = {
            notes: JSON.stringify(extPayload),
            updated_at: nowIso,
          };
          if (targetWholesaleStatus !== undefined) dbPayload.wholesale_status = targetWholesaleStatus;
          if (targetStatus !== undefined) dbPayload.status = targetStatus;
          if (targetIsDeleted !== undefined) {
            dbPayload.is_deleted = targetIsDeleted;
            dbPayload.deleted_at = targetDeletedAt;
          }

          try {
            const { error } = await supabase.from('customers').update(dbPayload).eq('id', cust.id);
            if (error) {
              await supabase.from('customers').update({ notes: dbPayload.notes as string, updated_at: nowIso }).eq('id', cust.id);
            }
          } catch (dbErr) {
            console.warn(`Supabase update error for customer ${cust.id}:`, dbErr);
          }

          updatedList = updatedList.map(c => {
            if (c.id === cust.id) {
              return {
                ...c,
                wholesale_status: nextWholesaleStatus,
                status: nextStatus,
                is_deleted: nextIsDeleted,
                deleted_at: nextDeletedAt,
                activity_log: newLogs,
                updated_at: nowIso,
              };
            }
            return c;
          });
        }
      }

      await persistCustomersData(updatedList);
      setSelectedCustomerIds([]);

      let successMsg = '';
      if (action === 'approve') successMsg = tr(`تم موافقة واعتماد ${count} عميل محدد بنجاح`, `Approbation accordée à ${count} client(s) avec succès`);
      else if (action === 'reject') successMsg = tr(`تم رفض اعتماد ${count} عميل محدد بنجاح`, `${count} client(s) refusé(s) avec succès`);
      else if (action === 'activate') successMsg = tr(`تم تنشيط حسابات ${count} عميل محدد بنجاح`, `${count} compte(s) activé(s) avec succès`);
      else if (action === 'suspend') successMsg = tr(`تم تجميد حسابات ${count} عميل محدد بنجاح`, `${count} compte(s) suspendu(s) avec succès`);
      else if (action === 'delete') successMsg = tr(`تم نقل ${count} عميل إلى سلة المهملات بنجاح`, `${count} client(s) placé(s) dans la corbeille avec succès`);
      else if (action === 'restore') successMsg = tr(`تم استعادة ${count} عميل من سلة المهملات بنجاح`, `${count} client(s) restauré(s) avec succès`);
      else if (action === 'permanent_delete') successMsg = tr(`تم الحذف النهائي لـ ${count} عميل بنجاح`, `${count} client(s) supprimé(s) définitivement`);

      showToast(successMsg, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Error executing bulk action:', err);
      showToast(tr(`فشل تنفيذ الإجراء الجماعي: ${msg}`, `Échec de l'action groupée: ${msg}`), 'error');
    } finally {
      setSaving(false);
    }
  };

  /* CSV Import / Export for Wholesale Customers */
  const handleImportCustomerCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSaving(true);
      const rows = await parseCSVFile(file);
      if (!rows || rows.length === 0) {
        showToast(tr('ملف CSV فارغ أو غير صالح', 'Fichier CSV vide ou invalide'), 'error');
        return;
      }

      const importedCustomers: Customer[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const companyName = row['Company Name'] || row['company_name'] || row['الشركة'] || row['اسم الشركة'] || '';
        const fullName = row['Representative Name'] || row['full_name'] || row['المسؤول'] || row['الاسم'] || companyName;
        const phone = row['Phone'] || row['phone'] || row['الهاتف'] || row['رقم الهاتف'] || '';

        if (!companyName && !fullName && !phone) continue;

        const newCust: Customer = {
          id: 'b2b-csv-' + Date.now() + '-' + i,
          phone: phone || `05000000${i}`,
          email: row['Email'] || row['email'] || row['البريد'] || null,
          full_name: fullName,
          company_name: companyName || fullName,
          wilaya_id: Number(row['Wilaya ID'] || row['wilaya_id'] || row['الولاية']) || 16,
          address: row['Address'] || row['address'] || row['العنوان'] || null,
          city: row['City'] || row['city'] || row['المدينة'] || null,
          is_verified: true,
          is_guest: false,
          total_orders: 0,
          total_spent: 0,
          segment: 'vip',
          register_number: row['RC'] || row['register_number'] || row['السجل التجاري'] || null,
          tax_id: row['NIF'] || row['tax_id'] || row['الرقم الجبائي'] || null,
          nis: row['NIS'] || row['nis'] || null,
          vat_number: row['VAT'] || row['vat_number'] || null,
          customer_group_id: groups[0]?.id || null,
          price_list_id: priceLists[0]?.id || null,
          payment_terms_id: paymentTerms[0]?.id || null,
          credit_limit: Number(row['Credit Limit'] || row['credit_limit']) || wholesaleSettings.credit_limit_default,
          credit_balance: Number(row['Credit Balance'] || row['credit_balance']) || wholesaleSettings.credit_limit_default,
          account_type: 'wholesale',
          wholesale_status: 'approved',
          status: 'Active',
          notes: 'مستورد من ملف CSV',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          activity_log: [
            {
              id: 'init-csv-' + Date.now(),
              action: 'استيراد CSV',
              details: 'تم استيراد العميل عبر ملف CSV',
              timestamp: new Date().toISOString(),
              user: 'Admin'
            }
          ]
        };

        await supabase.from('customers').insert([newCust]);
        importedCustomers.push(newCust);
      }

      if (importedCustomers.length > 0) {
        const newCustList = [...importedCustomers, ...customers];
        await persistCustomersData(newCustList);
        showToast(tr(`تم استيراد ${importedCustomers.length} تاجر جملة بنجاح`, `${importedCustomers.length} grossistes importés avec succès`), 'success');
      } else {
        showToast(tr('لم يتم العثور على صفوف معتمدة للاستيراد', 'Aucun enregistrement valide trouvé'), 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error importing CSV', 'error');
    } finally {
      setSaving(false);
      if (customerImportFileRef.current) customerImportFileRef.current.value = '';
    }
  };

  const handleExportCustomerCSV = () => {
    const dataToExport = filteredWholesaleCustomers.map(c => ({
      'ID': c.id,
      'Company Name': c.company_name || '',
      'Representative Name': c.full_name || '',
      'Phone': c.phone || '',
      'Email': c.email || '',
      'RC (Register Number)': c.register_number || '',
      'NIF (Tax ID)': c.tax_id || '',
      'NIS': c.nis || '',
      'VAT Number': c.vat_number || '',
      'Wilaya ID': c.wilaya_id || 16,
      'City': c.city || '',
      'Address': c.address || '',
      'Group ID': c.customer_group_id || '',
      'Price List ID': c.price_list_id || '',
      'Payment Terms ID': c.payment_terms_id || '',
      'Credit Limit': c.credit_limit || 0,
      'Credit Balance': c.credit_balance || 0,
      'Wholesale Approval Status': c.wholesale_status || 'approved',
      'Account Status': c.status || 'Active',
      'Notes': c.notes || '',
      'Admin Notes': c.admin_notes || '',
      'Created At': c.created_at || ''
    }));

    exportToCSV(dataToExport, `B2B_Wholesale_Customers_${new Date().toISOString().split('T')[0]}`);
    showToast(tr(`تم تصدير ${filteredWholesaleCustomers.length} عميل إلى ملف CSV`, `${filteredWholesaleCustomers.length} clients exportés en CSV`), 'success');
  };

  /* Helper for adding Price Overrides from Details Drawer */
  const handleSaveQuickOverride = async () => {
    if (!selectedCustomer) return;
    if (!quickOverrideForm.product_id || quickOverrideForm.custom_price <= 0) {
      showToast(tr('يرجى اختيار المنتج وتحديد السعر المخصص', 'Veuillez choisir un produit et spécifier le prix'), 'error');
      return;
    }

    try {
      setSaving(true);
      const newOverride: CustomerPriceOverride = {
        id: 'override-' + Date.now(),
        customer_id: selectedCustomer.id,
        product_id: quickOverrideForm.product_id,
        custom_price: Number(quickOverrideForm.custom_price),
        created_at: new Date().toISOString()
      };

      const updatedOverrides = [newOverride, ...overrides];
      setOverrides(updatedOverrides);
      const updatedStore = getStoreSnapshot({ overrides: updatedOverrides });
      await saveWholesaleStore(updatedStore);

      // Add activity log to customer
      const newLogs = logCustomerActivity(selectedCustomer, 'إضافة سعر مخصص للمنتج', `تحديد سعر مخصص ${quickOverrideForm.custom_price} د.ج للمنتج ID: ${quickOverrideForm.product_id}`);
      const payload = { activity_log: newLogs, updated_at: new Date().toISOString() };
      await supabase.from('customers').update(payload).eq('id', selectedCustomer.id);

      const newCustomers = customers.map(c => c.id === selectedCustomer.id ? { ...c, ...payload } : c);
      await persistCustomersData(newCustomers);
      setSelectedCustomer(prev => prev ? { ...prev, ...payload } : null);

      setQuickOverrideForm({ product_id: '', custom_price: 0 });
      showToast(tr('تم إضافة السعر المخصص للعميل بنجاح', 'Prix spécifique ajouté avec succès'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving override', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* Helper for saving Notes from Details Drawer */
  const handleSaveDetailsNotes = async (notesVal: string, adminNotesVal: string) => {
    if (!selectedCustomer) return;
    try {
      setSaving(true);
      const newLogs = logCustomerActivity(selectedCustomer, 'تحديث الملاحظات الإدارية', 'تحديث نص الملاحظات والملاحظات الداخلية');
      const payload = { notes: notesVal, admin_notes: adminNotesVal, activity_log: newLogs, updated_at: new Date().toISOString() };
      
      await supabase.from('customers').update(payload).eq('id', selectedCustomer.id);
      const newCustomers = customers.map(c => c.id === selectedCustomer.id ? { ...c, ...payload } : c);
      await persistCustomersData(newCustomers);
      setSelectedCustomer(prev => prev ? { ...prev, ...payload } : null);
      showToast(tr('تم حفظ الملاحظات بنجاح', 'Notes enregistrées avec succès'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving notes', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------- CRUD 1: Customer Groups --------------------------- */
  const openGroupModal = (g: CustomerGroup | null) => {
    setEditingGroup(g);
    if (g) {
      setGroupForm({ name_ar: g.name_ar, name_fr: g.name_fr, discount_percentage: g.discount_percentage });
    } else {
      setGroupForm({ name_ar: '', name_fr: '', discount_percentage: 0 });
    }
    setGroupModal(true);
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name_ar.trim() && !groupForm.name_fr.trim()) {
      showToast(tr('يرجى إدخال اسم المجموعة باللغة العربية أو الفرنسية', 'Veuillez saisir le nom du groupe (AR ou FR)'), 'error');
      return;
    }
    if (groupForm.discount_percentage < 0 || groupForm.discount_percentage > 100) {
      showToast(tr('نسبة الخصم يجب أن تكون بين 0 و 100%', 'La remise doit être entre 0 et 100%'), 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name_ar: groupForm.name_ar || groupForm.name_fr,
        name_fr: groupForm.name_fr || groupForm.name_ar,
        discount_percentage: Number(groupForm.discount_percentage)
      };

      if (editingGroup) {
        const { error: dbErr } = await supabase.from('customer_groups').update(payload).eq('id', editingGroup.id);
        if (dbErr) throw new Error(dbErr.message);
      } else {
        const { error: dbErr } = await supabase.from('customer_groups').insert([payload]);
        if (dbErr) throw new Error(dbErr.message);
      }

      await loadAllData();

      showToast(
        editingGroup
          ? tr('تم تحديث المجموعة بنجاح', 'Groupe mis à jour avec succès')
          : tr('تم إنشاء المجموعة بنجاح', 'Groupe créé avec succès'),
        'success'
      );
      setGroupModal(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving customer group', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = (id: string) => {
    const target = groups.find(g => g.id === id);
    setDeleteModal({
      isOpen: true,
      type: 'group',
      id,
      title: target ? (isAr ? target.name_ar : target.name_fr) : id,
      error: null,
    });
  };

  /* --------------------------- CRUD 2: Customer Credit & Group Assignment --------------------------- */
  const openCreditModal = (c: Customer) => {
    setCreditForm({
      customer_id: c.id,
      credit_limit: c.credit_limit || 0,
      credit_balance: c.credit_balance || 0,
      customer_group_id: c.customer_group_id || ''
    });
    setCreditModal(true);
  };

  const handleSaveCredit = async () => {
    if (creditForm.credit_limit < 0 || creditForm.credit_balance < 0) {
      showToast(tr('المبالغ يجب أن تكون أكبر من أو تساوي الصفر', 'Les montants doivent être positifs ou nuls'), 'error');
      return;
    }

    try {
      setSaving(true);

      const targetCustomer = customers.find(c => c.id === creditForm.customer_id);
      if (!targetCustomer) {
        showToast(tr('لم يتم العثور على العميل', 'Client introuvable'), 'error');
        return;
      }

      // 1. Update customer record
      const { error: custErr } = await supabase.from('customers').update({
        credit_limit: Number(creditForm.credit_limit),
        credit_balance: Number(creditForm.credit_balance),
        customer_group_id: creditForm.customer_group_id || null,
        account_type: 'wholesale',
        wholesale_status: 'approved'
      }).eq('id', creditForm.customer_id);

      if (custErr) throw new Error(custErr.message);

      // 2. Ensure credit account exists/updated
      const { error: accErr } = await supabase.from('credit_accounts').upsert({
        customer_id: creditForm.customer_id,
        credit_limit: Number(creditForm.credit_limit),
        credit_balance: Number(creditForm.credit_balance),
        available_credit: Math.max(0, Number(creditForm.credit_limit) - Number(creditForm.credit_balance)),
        is_active: true
      }, { onConflict: 'customer_id' });

      if (accErr) console.warn('Credit account upsert warning:', accErr);

      // Log activity
      await supabase.from('wholesale_activity_logs').insert({
        customer_id: creditForm.customer_id,
        action: 'credit_limit_change',
        details: `Limit set to ${creditForm.credit_limit} DZD, balance ${creditForm.credit_balance} DZD`,
        created_by: 'Admin'
      });

      await loadAllData();

      showToast(tr('تم تحديث بيانات الائتمان والمجموعة للعميل بنجاح', 'Crédit et groupe du client mis à jour'), 'success');
      setCreditModal(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error updating credit', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------- CRUD 3: Price Lists --------------------------- */
  const openPriceListModal = (pl: PriceList | null) => {
    setEditingPriceList(pl);
    if (pl) {
      setPriceListForm({ name: pl.name, is_active: pl.is_active });
    } else {
      setPriceListForm({ name: '', is_active: true });
    }
    setPriceListModal(true);
  };

  const handleSavePriceList = async () => {
    if (!priceListForm.name.trim()) {
      showToast(tr('يرجى كتابة اسم قائمة الأسعار', 'Veuillez saisir le nom du catalogue'), 'error');
      return;
    }

    try {
      setSaving(true);
      let newPriceLists = [...priceLists];

      if (editingPriceList) {
        newPriceLists = newPriceLists.map(pl => pl.id === editingPriceList.id ? {
          ...pl,
          name: priceListForm.name.trim(),
          is_active: priceListForm.is_active
        } : pl);
      } else {
        const newPl: PriceList = {
          id: 'pl-' + Date.now(),
          name: priceListForm.name.trim(),
          is_active: priceListForm.is_active,
          created_at: new Date().toISOString()
        };
        newPriceLists.unshift(newPl);
      }

      const updatedStore = getStoreSnapshot({ price_lists: newPriceLists });
      await saveWholesaleStore(updatedStore);

      setPriceLists(newPriceLists);
      showToast(
        editingPriceList
          ? tr('تم تحديث قائمة الأسعار', 'Catalogue mis à jour')
          : tr('تم إنشاء قائمة الأسعار', 'Catalogue créé'),
        'success'
      );
      setPriceListModal(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving price list', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePriceList = (id: string) => {
    const target = priceLists.find(pl => pl.id === id);
    setDeleteModal({
      isOpen: true,
      type: 'pricelist',
      id,
      title: target ? target.name : id,
      error: null,
    });
  };

  /* --------------------------- CRUD 4: Price List Entries --------------------------- */
  const openPriceEntryModal = (entry: PriceListEntry | null) => {
    setEditingPriceEntry(entry);
    if (entry) {
      setPriceEntryForm({
        price_list_id: entry.price_list_id,
        product_id: entry.product_id,
        wholesale_price: entry.wholesale_price
      });
    } else {
      setPriceEntryForm({
        price_list_id: priceLists[0]?.id || '',
        product_id: products[0]?.id || '',
        wholesale_price: 0
      });
    }
    setPriceEntryModal(true);
  };

  const handleSavePriceEntry = async () => {
    if (!priceEntryForm.price_list_id) {
      showToast(tr('يرجى اختيار قائمة أسعار', 'Veuillez sélectionner un catalogue'), 'error');
      return;
    }
    if (!priceEntryForm.product_id) {
      showToast(tr('يرجى اختيار منتج', 'Veuillez sélectionner un produit'), 'error');
      return;
    }
    if (priceEntryForm.wholesale_price < 0) {
      showToast(tr('سعر الجملة يجب ألا يكون بالسالب', 'Le prix de gros doit être positif'), 'error');
      return;
    }

    try {
      setSaving(true);
      let newEntries = [...priceEntries];

      if (editingPriceEntry) {
        newEntries = newEntries.map(e => e.id === editingPriceEntry.id ? {
          ...e,
          price_list_id: priceEntryForm.price_list_id,
          product_id: priceEntryForm.product_id,
          wholesale_price: Number(priceEntryForm.wholesale_price)
        } : e);
      } else {
        const newEntry: PriceListEntry = {
          id: 'pe-' + Date.now(),
          price_list_id: priceEntryForm.price_list_id,
          product_id: priceEntryForm.product_id,
          wholesale_price: Number(priceEntryForm.wholesale_price),
          created_at: new Date().toISOString()
        };
        newEntries.unshift(newEntry);
      }

      const updatedStore = getStoreSnapshot({ price_entries: newEntries });
      await saveWholesaleStore(updatedStore);

      setPriceEntries(newEntries);
      showToast(
        editingPriceEntry
          ? tr('تم تحديث سعر المنتج في القائمة', 'Prix du produit mis à jour')
          : tr('تم إضافة سعر المنتج إلى القائمة', 'Prix ajouté au catalogue'),
        'success'
      );
      setPriceEntryModal(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving price entry', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePriceEntry = (id: string) => {
    setDeleteModal({
      isOpen: true,
      type: 'pricelist_item',
      id,
      error: null,
    });
  };

  /* --------------------------- CRUD 5: Customer Price Overrides --------------------------- */
  const openOverrideModal = (ov: CustomerPriceOverride | null) => {
    setEditingOverride(ov);
    if (ov) {
      setOverrideForm({
        customer_id: ov.customer_id,
        product_id: ov.product_id,
        custom_price: ov.custom_price
      });
    } else {
      setOverrideForm({
        customer_id: customers[0]?.id || '',
        product_id: products[0]?.id || '',
        custom_price: 0
      });
    }
    setOverrideModal(true);
  };

  const handleSaveOverride = async () => {
    if (!overrideForm.customer_id) {
      showToast(tr('يرجى اختيار عميل', 'Veuillez sélectionner un client'), 'error');
      return;
    }
    if (!overrideForm.product_id) {
      showToast(tr('يرجى اختيار منتج', 'Veuillez sélectionner un produit'), 'error');
      return;
    }
    if (overrideForm.custom_price < 0) {
      showToast(tr('السعر يجب ألا يكون بالسالب', 'Le prix doit être positif'), 'error');
      return;
    }

    try {
      setSaving(true);
      let newOverrides = [...overrides];

      if (editingOverride) {
        newOverrides = newOverrides.map(o => o.id === editingOverride.id ? {
          ...o,
          customer_id: overrideForm.customer_id,
          product_id: overrideForm.product_id,
          custom_price: Number(overrideForm.custom_price)
        } : o);
      } else {
        const newOv: CustomerPriceOverride = {
          id: 'ov-' + Date.now(),
          customer_id: overrideForm.customer_id,
          product_id: overrideForm.product_id,
          custom_price: Number(overrideForm.custom_price),
          created_at: new Date().toISOString()
        };
        newOverrides.unshift(newOv);
      }

      const updatedStore = getStoreSnapshot({ overrides: newOverrides });
      await saveWholesaleStore(updatedStore);

      setOverrides(newOverrides);
      showToast(
        editingOverride
          ? tr('تم تحديث السعر المخصص للعميل', 'Prix spécifique mis à jour')
          : tr('تم إضافة السعر المخصص للعميل', 'Prix spécifique ajouté'),
        'success'
      );
      setOverrideModal(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving override', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOverride = (id: string) => {
    setDeleteModal({
      isOpen: true,
      type: 'override',
      id,
      error: null,
    });
  };

  /* --------------------------- CRUD 6: Purchase Orders --------------------------- */
  const openPoModal = (po: PurchaseOrder | null) => {
    setEditingPo(po);
    if (po) {
      setPoForm({
        po_number: po.po_number,
        customer_id: po.customer_id,
        total_amount: po.total_amount,
        notes: po.notes || '',
        payment_terms_id: po.payment_terms_id || ''
      });
    } else {
      setPoForm({
        po_number: 'PO-' + Math.floor(100000 + Math.random() * 900000),
        customer_id: customers[0]?.id || '',
        total_amount: 0,
        notes: '',
        payment_terms_id: paymentTerms[0]?.id || ''
      });
    }
    setPoModal(true);
  };

  const handleSavePo = async () => {
    if (!poForm.customer_id) {
      showToast(tr('يرجى اختيار العميل', 'Veuillez sélectionner un client'), 'error');
      return;
    }
    if (poForm.total_amount <= 0) {
      showToast(tr('يرجى كتابة مبلغ إجمالي صحيح أكبر من الصفر', 'Saisissez un montant valide supérieur à 0'), 'error');
      return;
    }

    try {
      setSaving(true);
      let newPos = [...purchaseOrders];

      if (editingPo) {
        newPos = newPos.map(po => po.id === editingPo.id ? {
          ...po,
          po_number: poForm.po_number || po.po_number,
          customer_id: poForm.customer_id,
          total_amount: Number(poForm.total_amount),
          notes: poForm.notes,
          payment_terms_id: poForm.payment_terms_id || undefined
        } : po);
      } else {
        const newPo: PurchaseOrder = {
          id: 'po-' + Date.now(),
          po_number: poForm.po_number || ('PO-' + Math.floor(100000 + Math.random() * 900000)),
          customer_id: poForm.customer_id,
          total_amount: Number(poForm.total_amount),
          status: wholesaleSettings.auto_approve_po ? 'approved' : 'pending',
          notes: poForm.notes,
          payment_terms_id: poForm.payment_terms_id || undefined,
          created_at: new Date().toISOString()
        };
        newPos.unshift(newPo);
      }

      const updatedStore = getStoreSnapshot({ purchase_orders: newPos });
      await saveWholesaleStore(updatedStore);

      setPurchaseOrders(newPos);
      showToast(
        editingPo
          ? tr('تم تحديث طلب الشراء', 'Bon d\'achat mis à jour')
          : tr('تم تقديم طلب الشراء بنجاح', 'Bon d\'achat créé avec succès'),
        'success'
      );
      setPoModal(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving purchase order', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApprovePO = async (po: PurchaseOrder) => {
    try {
      setSaving(true);
      const newPos = purchaseOrders.map(p => p.id === po.id ? { ...p, status: 'approved' as const } : p);

      const newInv: WholesaleInvoice = {
        id: 'inv-' + Date.now(),
        invoice_number: 'INV-' + Math.floor(100000 + Math.random() * 900000),
        order_id: po.id,
        customer_id: po.customer_id,
        total_amount: po.total_amount,
        due_date: new Date(Date.now() + (wholesaleSettings.default_payment_terms_days || 30) * 24 * 3600 * 1000).toISOString(),
        status: 'unpaid',
        created_at: new Date().toISOString()
      };
      const newInvoices = [newInv, ...invoices];

      const updatedCustomers = customers.map(c => {
        if (c.id === po.customer_id) {
          const currentBal = c.credit_balance ?? 100000;
          return { ...c, credit_balance: Math.max(0, currentBal - po.total_amount) };
        }
        return c;
      });

      const updatedStore = getStoreSnapshot({
        purchase_orders: newPos,
        invoices: newInvoices,
        customer_credits: updatedCustomers.map(c => ({
          customer_id: c.id,
          customer_group_id: c.customer_group_id || '',
          credit_limit: c.credit_limit || 0,
          credit_balance: c.credit_balance || 0,
          company_name: c.company_name || '',
          account_type: 'wholesale' as const,
          wholesale_status: 'approved' as const
        }))
      });

      await saveWholesaleStore(updatedStore);

      setPurchaseOrders(newPos);
      setInvoices(newInvoices);
      setCustomers(updatedCustomers);
      showToast(tr('تم قبول طلب الشراء وإصدار فاتورة ائتمان بنجاح', 'Bon d\'achat approuvé et facture générée'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error approving purchase order', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectPO = (poId: string) => {
    const target = purchaseOrders.find(p => p.id === poId);
    setDeleteModal({
      isOpen: true,
      type: 'reject_po',
      id: poId,
      title: target ? target.po_number : poId,
      error: null,
    });
  };

  const handleDeletePO = (poId: string) => {
    const target = purchaseOrders.find(p => p.id === poId);
    setDeleteModal({
      isOpen: true,
      type: 'po',
      id: poId,
      title: target ? target.po_number : poId,
      error: null,
    });
  };

  /* --------------------------- CRUD 7: Invoices --------------------------- */
  const openInvoiceModal = (inv: WholesaleInvoice | null) => {
    setEditingInvoice(inv);
    if (inv) {
      setInvoiceForm({
        invoice_number: inv.invoice_number,
        order_id: inv.order_id || '',
        customer_id: inv.customer_id,
        total_amount: inv.total_amount,
        due_date: inv.due_date ? inv.due_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        status: inv.status
      });
    } else {
      setInvoiceForm({
        invoice_number: 'INV-' + Math.floor(100000 + Math.random() * 900000),
        order_id: '',
        customer_id: customers[0]?.id || '',
        total_amount: 0,
        due_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        status: 'unpaid'
      });
    }
    setInvoiceModal(true);
  };

  const handleSaveInvoice = async () => {
    if (!invoiceForm.customer_id) {
      showToast(tr('يرجى اختيار العميل', 'Veuillez sélectionner un client'), 'error');
      return;
    }
    if (invoiceForm.total_amount <= 0) {
      showToast(tr('يرجى إدخال مبلغ الفاتورة بشكل صحيح', 'Saisissez un montant valide'), 'error');
      return;
    }

    try {
      setSaving(true);
      let newInvoices = [...invoices];

      if (editingInvoice) {
        newInvoices = newInvoices.map(inv => inv.id === editingInvoice.id ? {
          ...inv,
          invoice_number: invoiceForm.invoice_number || inv.invoice_number,
          order_id: invoiceForm.order_id || '',
          customer_id: invoiceForm.customer_id,
          total_amount: Number(invoiceForm.total_amount),
          due_date: new Date(invoiceForm.due_date).toISOString(),
          status: invoiceForm.status
        } : inv);
      } else {
        const newInv: WholesaleInvoice = {
          id: 'inv-' + Date.now(),
          invoice_number: invoiceForm.invoice_number || ('INV-' + Math.floor(100000 + Math.random() * 900000)),
          order_id: invoiceForm.order_id || '',
          customer_id: invoiceForm.customer_id,
          total_amount: Number(invoiceForm.total_amount),
          due_date: new Date(invoiceForm.due_date).toISOString(),
          status: invoiceForm.status,
          created_at: new Date().toISOString()
        };
        newInvoices.unshift(newInv);
      }

      const updatedStore = getStoreSnapshot({ invoices: newInvoices });
      await saveWholesaleStore(updatedStore);

      setInvoices(newInvoices);
      showToast(
        editingInvoice
          ? tr('تم تحديث الفاتورة بنجاح', 'Facture mise à jour avec succès')
          : tr('تم إنشاء الفاتورة بنجاح', 'Facture créée avec succès'),
        'success'
      );
      setInvoiceModal(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkInvoicePaid = async (invId: string) => {
    try {
      setSaving(true);
      const newInvoices = invoices.map(i => i.id === invId ? { ...i, status: 'paid' as const } : i);
      const updatedStore = getStoreSnapshot({ invoices: newInvoices });
      await saveWholesaleStore(updatedStore);

      setInvoices(newInvoices);
      showToast(tr('تم تحديث الفاتورة كمدفوعة بالكامل', 'Facture marquée comme payée'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error marking invoice paid', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInvoice = (invId: string) => {
    const target = invoices.find(i => i.id === invId);
    setDeleteModal({
      isOpen: true,
      type: 'invoice',
      id: invId,
      title: target ? target.invoice_number : invId,
      error: null,
    });
  };

  /* --------------------------- CRUD 8: Payment Terms & Wholesale Config --------------------------- */
  const openPaymentTermModal = (pt: PaymentTerms | null) => {
    setEditingPaymentTerm(pt);
    if (pt) {
      setPaymentTermForm({ label: pt.label, days: pt.days, is_active: pt.is_active });
    } else {
      setPaymentTermForm({ label: '', days: 30, is_active: true });
    }
    setPaymentTermModal(true);
  };

  const handleSavePaymentTerm = async () => {
    if (!paymentTermForm.label.trim()) {
      showToast(tr('يرجى تحديد مسمى شرط الدفع', 'Veuillez saisir le libellé de la condition de paiement'), 'error');
      return;
    }

    try {
      setSaving(true);
      let newTerms = [...paymentTerms];

      if (editingPaymentTerm) {
        newTerms = newTerms.map(pt => pt.id === editingPaymentTerm.id ? {
          ...pt,
          label: paymentTermForm.label.trim(),
          days: Number(paymentTermForm.days),
          is_active: paymentTermForm.is_active
        } : pt);
      } else {
        const newPt: PaymentTerms = {
          id: 'pt-' + Date.now(),
          label: paymentTermForm.label.trim(),
          days: Number(paymentTermForm.days),
          is_active: paymentTermForm.is_active,
        };
        newTerms.unshift(newPt);
      }

      const updatedStore = getStoreSnapshot({ payment_terms: newTerms });
      await saveWholesaleStore(updatedStore);

      setPaymentTerms(newTerms);
      showToast(
        editingPaymentTerm
          ? tr('تم تحديث شرط الدفع', 'Condition de paiement mise à jour')
          : tr('تم إدراج شرط الدفع الجديد', 'Condition de paiement créée'),
        'success'
      );
      setPaymentTermModal(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving payment term', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePaymentTerm = (id: string) => {
    const target = paymentTerms.find(pt => pt.id === id);
    setDeleteModal({
      isOpen: true,
      type: 'term',
      id,
      title: target ? target.label : id,
      error: null,
    });
  };

  const handleConfirmDelete = async () => {
    const { type, id } = deleteModal;
    if (!id) return;
    setIsDeletingItem(true);
    try {
      setSaving(true);
      if (type === 'group') {
        const newGroups = groups.filter(g => g.id !== id);
        const updatedCustomers = customers.map(c => c.customer_group_id === id ? { ...c, customer_group_id: '' } : c);
        const updatedStore = getStoreSnapshot({
          groups: newGroups,
          customer_credits: updatedCustomers.map(c => ({
            customer_id: c.id,
            customer_group_id: c.customer_group_id || '',
            credit_limit: c.credit_limit || 0,
            credit_balance: c.credit_balance || 0,
            company_name: c.company_name || '',
            account_type: c.account_type || 'wholesale',
            wholesale_status: c.wholesale_status || 'approved'
          }))
        });
        await saveWholesaleStore(updatedStore);
        setGroups(newGroups);
        setCustomers(updatedCustomers);
        showToast(tr('تم حذف المجموعة بنجاح', 'Groupe supprimé avec succès'), 'success');
      } else if (type === 'pricelist') {
        const newPriceLists = priceLists.filter(pl => pl.id !== id);
        const newEntries = priceEntries.filter(e => e.price_list_id !== id);
        const updatedStore = getStoreSnapshot({ price_lists: newPriceLists, price_entries: newEntries });
        await saveWholesaleStore(updatedStore);
        setPriceLists(newPriceLists);
        setPriceEntries(newEntries);
        showToast(tr('تم حذف قائمة الأسعار بنجاح', 'Catalogue supprimé avec succès'), 'success');
      } else if (type === 'pricelist_item') {
        const newEntries = priceEntries.filter(e => e.id !== id);
        const updatedStore = getStoreSnapshot({ price_entries: newEntries });
        await saveWholesaleStore(updatedStore);
        setPriceEntries(newEntries);
        showToast(tr('تم حذف سعر المنتج من القائمة', 'Tarif supprimé'), 'success');
      } else if (type === 'override') {
        const newOverrides = overrides.filter(o => o.id !== id);
        const updatedStore = getStoreSnapshot({ overrides: newOverrides });
        await saveWholesaleStore(updatedStore);
        setOverrides(newOverrides);
        showToast(tr('تم حذف السعر المخصص', 'Prix spécifique supprimé'), 'success');
      } else if (type === 'reject_po') {
        const newPos = purchaseOrders.map(p => p.id === id ? { ...p, status: 'rejected' as const } : p);
        const updatedStore = getStoreSnapshot({ purchase_orders: newPos });
        await saveWholesaleStore(updatedStore);
        setPurchaseOrders(newPos);
        showToast(tr('تم رفض طلب الشراء', 'Bon d\'achat rejeté'), 'info');
      } else if (type === 'po') {
        const newPos = purchaseOrders.filter(p => p.id !== id);
        const updatedStore = getStoreSnapshot({ purchase_orders: newPos });
        await saveWholesaleStore(updatedStore);
        setPurchaseOrders(newPos);
        showToast(tr('تم حذف طلب الشراء بنجاح', 'Bon d\'achat supprimé'), 'success');
      } else if (type === 'invoice') {
        const newInvoices = invoices.filter(i => i.id !== id);
        const updatedStore = getStoreSnapshot({ invoices: newInvoices });
        await saveWholesaleStore(updatedStore);
        setInvoices(newInvoices);
        showToast(tr('تم حذف الفاتورة بنجاح', 'Facture supprimée'), 'success');
      } else if (type === 'term') {
        const newTerms = paymentTerms.filter(pt => pt.id !== id);
        const updatedStore = getStoreSnapshot({ payment_terms: newTerms });
        await saveWholesaleStore(updatedStore);
        setPaymentTerms(newTerms);
        showToast(tr('تم حذف شرط الدفع', 'Condition supprimée'), 'success');
      }
      setDeleteModal({ isOpen: false, type: 'group' });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : tr('حدث خطأ أثناء الحذف', 'Erreur de suppression');
      setDeleteModal(prev => ({ ...prev, error: msg }));
      showToast(msg, 'error');
    } finally {
      setIsDeletingItem(false);
      setSaving(false);
    }
  };

  const handleSaveWholesaleSettings = async () => {
    try {
      setSaving(true);
      const updatedStore = getStoreSnapshot({ settings: wholesaleSettings });
      await saveWholesaleStore(updatedStore);
      showToast(tr('تم حفظ إعدادات الجملة بنجاح', 'Paramètres Wholesale enregistrés avec succès'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving wholesale settings', 'error');
    } finally {
      setSaving(false);
    }
  };


  /* --------------------------- CSV Import & Export --------------------------- */
  const handleExportCSV = () => {
    if (activeTab === 'groups') {
      const data = groups.map(g => ({
        'ID': g.id,
        'Name AR': g.name_ar,
        'Name FR': g.name_fr,
        'Discount %': g.discount_percentage,
        'Created At': g.created_at
      }));
      exportToCSV(data, 'wholesale_customer_groups');
    } else if (activeTab === 'pricelists') {
      const data = priceEntries.map(e => {
        const pl = priceLists.find(p => p.id === e.price_list_id);
        const prod = products.find(p => p.id === e.product_id);
        return {
          'Price List Name': pl?.name || e.price_list_id,
          'Product SKU': prod?.sku || '',
          'Product Name': prod ? (isAr ? prod.name_ar : prod.name_fr) : e.product_id,
          'Wholesale Price (DZD)': e.wholesale_price,
          'Retail Price (DZD)': prod?.price || 0
        };
      });
      exportToCSV(data, 'wholesale_price_lists');
    } else if (activeTab === 'overrides') {
      const data = overrides.map(o => {
        const cust = customers.find(c => c.id === o.customer_id);
        const prod = products.find(p => p.id === o.product_id);
        return {
          'Customer Name': cust?.full_name || cust?.phone || o.customer_id,
          'Customer Phone': cust?.phone || '',
          'Product SKU': prod?.sku || '',
          'Product Name': prod ? (isAr ? prod.name_ar : prod.name_fr) : o.product_id,
          'Custom Agreed Price (DZD)': o.custom_price
        };
      });
      exportToCSV(data, 'wholesale_price_overrides');
    } else if (activeTab === 'purchase_orders') {
      const data = purchaseOrders.map(po => {
        const cust = customers.find(c => c.id === po.customer_id);
        return {
          'PO Number': po.po_number,
          'Customer Name': cust?.full_name || cust?.phone || po.customer_id,
          'Total Amount (DZD)': po.total_amount,
          'Status': po.status,
          'Notes': po.notes || '',
          'Date': po.created_at
        };
      });
      exportToCSV(data, 'wholesale_purchase_orders');
    } else if (activeTab === 'invoices') {
      const data = invoices.map(inv => {
        const cust = customers.find(c => c.id === inv.customer_id);
        return {
          'Invoice Number': inv.invoice_number,
          'Customer Name': cust?.full_name || cust?.phone || inv.customer_id,
          'Total Amount (DZD)': inv.total_amount,
          'Due Date': inv.due_date,
          'Status': inv.status,
          'Created At': inv.created_at
        };
      });
      exportToCSV(data, 'wholesale_invoices');
    } else {
      // General B2B report export
      const data = customers.filter(c => c.account_type === 'wholesale').map(c => ({
        'Customer Name': c.full_name || c.phone,
        'Company': c.company_name || '',
        'Phone': c.phone,
        'Email': c.email || '',
        'Credit Limit (DZD)': c.credit_limit || 0,
        'Credit Balance (DZD)': c.credit_balance || 0,
        'Total Spent (DZD)': c.total_spent || 0,
        'Total Orders': c.total_orders || 0
      }));
      exportToCSV(data, 'wholesale_b2b_report');
    }
  };

  const handleImportCSVFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const parsed = await parseCSVFile(file);
      if (!parsed || parsed.length === 0) {
        showToast(tr('الملف فارغ أو غير صالح', 'Fichier vide ou invalide'), 'error');
        return;
      }

      let importedCount = 0;
      const defaultPriceListId = priceLists[0]?.id;

      if (!defaultPriceListId) {
        showToast(tr('يرجى إنشاء قائمة أسعار أولاً قبل الاستيراد', 'Veuillez d\'abord créer un catalogue de prix'), 'error');
        return;
      }

      for (const row of parsed) {
        const sku = row['Product SKU'] || row['SKU'] || row['sku'];
        const price = Number(row['Wholesale Price (DZD)'] || row['Wholesale Price'] || row['price'] || row['wholesale_price']);

        if (sku && !isNaN(price)) {
          const product = products.find(p => p.sku === sku);
          if (product) {
            await supabase.from('price_list_entries').insert({
              price_list_id: defaultPriceListId,
              product_id: product.id,
              wholesale_price: price
            });
            importedCount++;
          }
        }
      }

      showToast(tr(`تم استيراد ${importedCount} سعر بنجاح في القائمة`, `${importedCount} tarifs importés avec succès`), 'success');
      await loadAllData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error importing CSV', 'error');
    } finally {
      setLoading(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  // Helpers
  const getCustomerName = (id: string) => {
    const c = customers.find(item => item.id === id);
    return c ? (c.full_name || c.phone) : id;
  };

  const getProductName = (id: string) => {
    const p = products.find(item => item.id === id);
    return p ? (isAr ? p.name_ar : p.name_fr) : id;
  };

  const getGroupName = (id: string | null | undefined) => {
    if (!id) return '-';
    const g = groups.find(item => item.id === id);
    return g ? (isAr ? g.name_ar : g.name_fr) : id;
  };

  const getPriceListName = (id: string) => {
    return priceLists.find(item => item.id === id)?.name || id;
  };

  /* --------------------------- Filtered Lists & Pagination --------------------------- */
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      const q = searchQuery.toLowerCase();
      return g.name_ar.toLowerCase().includes(q) || g.name_fr.toLowerCase().includes(q);
    });
  }, [groups, searchQuery]);

  const filteredWholesaleCustomers = useMemo(() => {
    return customers.filter(c => {
      const isWholesale = c.account_type === 'wholesale';
      if (!isWholesale) return false;

      // Handle Soft Delete / Trash view
      if (accountStatusFilter === 'trash') {
        if (!c.is_deleted) return false;
      } else {
        if (c.is_deleted) return false;
        if (accountStatusFilter !== 'all' && (c.status || 'Active') !== accountStatusFilter) {
          return false;
        }
      }

      // Handle Approval Status filter
      if (statusFilter !== 'all' && (c.wholesale_status || 'approved') !== statusFilter) {
        return false;
      }

      // Handle Group filter
      if (groupFilter !== 'all' && c.customer_group_id !== groupFilter) {
        return false;
      }

      // Handle Payment Terms filter
      if (paymentTermsFilter !== 'all' && c.payment_terms_id !== paymentTermsFilter) {
        return false;
      }

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const matchesSearch = 
        (c.full_name && c.full_name.toLowerCase().includes(q)) || 
        (c.company_name && c.company_name.toLowerCase().includes(q)) || 
        (c.phone && c.phone.includes(q)) || 
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.register_number && c.register_number.toLowerCase().includes(q)) ||
        (c.tax_id && c.tax_id.toLowerCase().includes(q)) ||
        (c.nis && c.nis.toLowerCase().includes(q)) ||
        (c.vat_number && c.vat_number.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q));

      return matchesSearch;
    });
  }, [customers, accountStatusFilter, statusFilter, groupFilter, paymentTermsFilter, searchQuery]);

  const filteredPriceEntries = useMemo(() => {
    return priceEntries.filter(e => {
      const pl = priceLists.find(p => p.id === e.price_list_id);
      const prod = products.find(p => p.id === e.product_id);
      const q = searchQuery.toLowerCase();

      const matchesSearch = !q || 
        (pl && pl.name.toLowerCase().includes(q)) ||
        (prod && (prod.name_ar.toLowerCase().includes(q) || prod.name_fr.toLowerCase().includes(q) || prod.sku.toLowerCase().includes(q)));

      return matchesSearch;
    });
  }, [priceEntries, priceLists, products, searchQuery]);

  const filteredOverrides = useMemo(() => {
    return overrides.filter(o => {
      const cust = customers.find(c => c.id === o.customer_id);
      const prod = products.find(p => p.id === o.product_id);
      const q = searchQuery.toLowerCase();

      return !q || 
        (cust && ((cust.full_name && cust.full_name.toLowerCase().includes(q)) || cust.phone.includes(q))) ||
        (prod && (prod.name_ar.toLowerCase().includes(q) || prod.name_fr.toLowerCase().includes(q) || prod.sku.toLowerCase().includes(q)));
    });
  }, [overrides, customers, products, searchQuery]);

  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(po => {
      const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
      const cust = customers.find(c => c.id === po.customer_id);
      const q = searchQuery.toLowerCase();

      const matchesSearch = !q || 
        po.po_number.toLowerCase().includes(q) ||
        (cust && ((cust.full_name && cust.full_name.toLowerCase().includes(q)) || cust.phone.includes(q)));

      return matchesStatus && matchesSearch;
    });
  }, [purchaseOrders, statusFilter, customers, searchQuery]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      const cust = customers.find(c => c.id === inv.customer_id);
      const q = searchQuery.toLowerCase();

      const matchesSearch = !q || 
        inv.invoice_number.toLowerCase().includes(q) ||
        (cust && ((cust.full_name && cust.full_name.toLowerCase().includes(q)) || cust.phone.includes(q)));

      return matchesStatus && matchesSearch;
    });
  }, [invoices, statusFilter, customers, searchQuery]);

  // Current active dataset for pagination
  const currentDatasetLength = useMemo(() => {
    if (activeTab === 'wholesale_customers') return filteredWholesaleCustomers.length;
    if (activeTab === 'groups') return filteredGroups.length + filteredWholesaleCustomers.length;
    if (activeTab === 'pricelists') return filteredPriceEntries.length;
    if (activeTab === 'overrides') return filteredOverrides.length;
    if (activeTab === 'purchase_orders') return filteredPurchaseOrders.length;
    if (activeTab === 'invoices') return filteredInvoices.length;
    return 0;
  }, [activeTab, filteredGroups, filteredWholesaleCustomers, filteredPriceEntries, filteredOverrides, filteredPurchaseOrders, filteredInvoices]);

  const totalPages = Math.ceil(currentDatasetLength / itemsPerPage) || 1;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div dir={dir} className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-950/80 border border-emerald-800/80 rounded-xl text-emerald-400 shadow-lg shadow-emerald-950/50">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              {tr('نظام إدارة الجملة B2B المتكامل', 'Système Complet Wholesale B2B')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {tr('إدارة قوائم الأسعار، المجموعات، الاعتمادات المالية، الفواتير والطلبات', 'Gérez les prix, groupes, lignes de crédit, factures et bons d\'achat.')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input 
            type="file" 
            ref={importFileRef} 
            onChange={handleImportCSVFile} 
            accept=".csv" 
            className="hidden" 
          />
          <button 
            onClick={() => importFileRef.current?.click()} 
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition shadow"
          >
            <Upload className="w-4 h-4 text-slate-400" />
            {tr('استيراد أسعار CSV', 'Importer CSV')}
          </button>
          <button 
            onClick={handleExportCSV} 
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition shadow"
          >
            <Download className="w-4 h-4 text-slate-400" />
            {tr('تصدير بيانات Tab إلى CSV', 'Exporter CSV')}
          </button>
          <button 
            onClick={loadAllData} 
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition shadow"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            {tr('تحديث', 'Actualiser')}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-950/80 border border-rose-800/80 text-rose-300 px-4 py-3 rounded-xl text-sm shadow-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span className="flex-1">{error}</span>
          <button className="p-1 hover:bg-rose-900/60 rounded-lg text-rose-300" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-lg">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Global Search and Filter Bar for Active Tab */}
      {activeTab !== 'settings' && activeTab !== 'reports' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-5 h-5 absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={tr('البحث بالاسم، الكود، العميل أو رقم الطلب/الفاتورة...', 'Rechercher par nom, code, client, PO/Facture...')}
                className="w-full bg-slate-900 border border-slate-800 text-slate-100 text-sm rounded-xl ps-11 pe-10 py-2.5 focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Group Filter for Groups tab */}
            {activeTab === 'groups' && (
              <select 
                value={groupFilter} 
                onChange={e => setGroupFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">{tr('جميع المجموعات', 'Tous les groupes')}</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{isAr ? g.name_ar : g.name_fr}</option>
                ))}
              </select>
            )}

            {/* Status Filter for POs & Invoices */}
            {(activeTab === 'purchase_orders' || activeTab === 'invoices') && (
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">{tr('جميع الحالات', 'Tous les statuts')}</option>
                {activeTab === 'purchase_orders' ? (
                  <>
                    <option value="pending">{tr('قيد المراجعة', 'En attente')}</option>
                    <option value="approved">{tr('معتمد وفوتِر', 'Approuvé')}</option>
                    <option value="rejected">{tr('مرفوض', 'Refusé')}</option>
                  </>
                ) : (
                  <>
                    <option value="unpaid">{tr('غير مدفوعة', 'Unpaid')}</option>
                    <option value="paid">{tr('مدفوعة بالكامل', 'Paid')}</option>
                    <option value="overdue">{tr('متأخرة عن الاستحقاق', 'Overdue')}</option>
                  </>
                )}
              </select>
            )}
          </div>
        </div>
      )}

      {/* TAB 0: WHOLESALE CUSTOMERS (B2B DIRECT MANAGEMENT) */}
      {activeTab === 'wholesale_customers' && (
        <div className="space-y-6">
          <input 
            type="file" 
            ref={customerImportFileRef} 
            onChange={handleImportCustomerCSV} 
            accept=".csv" 
            className="hidden" 
          />

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            {/* Header with main action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                  {tr('سجل عملاء وتجار الجملة المعتمدين (B2B Wholesale Accounts)', 'Registre des Comptes Grossistes B2B')}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {tr('إدارة تفاصيل الشركات، السجل التجاري (RC)، الرقم الجبائي (NIF)، الاعتمادات المالية، وشروط الدفع', 'Gérez les données légales, fiscales, plafonds de crédit et statuts d\'approbation B2B.')}
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button 
                  onClick={() => customerImportFileRef.current?.click()} 
                  className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition shadow"
                >
                  <Upload className="w-4 h-4 text-slate-400" />
                  {tr('استيراد CSV', 'Importer CSV')}
                </button>

                <button 
                  onClick={handleExportCustomerCSV} 
                  className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition shadow"
                >
                  <Download className="w-4 h-4 text-slate-400" />
                  {tr('تصدير CSV', 'Exporter CSV')}
                </button>

                <button 
                  onClick={() => openWholesaleCustomerModal(null)} 
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950/60 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  {tr('إضافة تاجر جملة جديد', 'Nouveau Grossiste B2B')}
                </button>
              </div>
            </div>

            {/* Detailed Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              {/* Approval status filter */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">{tr('حالة الاعتماد B2B', 'Statut B2B')}</label>
                <select 
                  value={statusFilter} 
                  onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  <option value="all">{tr('جميع الحالات', 'Tous les statuts')}</option>
                  <option value="approved">{tr('معتمد (Approved)', 'Approuvés')}</option>
                  <option value="pending">{tr('قيد المراجعة (Pending)', 'En attente')}</option>
                  <option value="rejected">{tr('مرفوض (Rejected)', 'Refusés')}</option>
                </select>
              </div>

              {/* Account status filter (Active, Suspended, Blocked, Trash) */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">{tr('حالة الحساب / الأرشيف', 'Statut Compte')}</label>
                <select 
                  value={accountStatusFilter} 
                  onChange={e => { setAccountStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  <option value="all">{tr('جميع الحسابات النشطة', 'Tous les comptes actifs')}</option>
                  <option value="Active">{tr('نشط (Active)', 'Actif')}</option>
                  <option value="Suspended">{tr('موقوف مؤقتاً (Suspended)', 'Suspendu')}</option>
                  <option value="Blocked">{tr('محظور (Blocked)', 'Bloqué')}</option>
                  <option value="trash">{tr('سلة المهملات (Trash)', 'Corbeille')}</option>
                </select>
              </div>

              {/* Customer Group filter */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">{tr('المجموعة / الشريحة', 'Groupe Tarifaire')}</label>
                <select 
                  value={groupFilter} 
                  onChange={e => { setGroupFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">{tr('جميع المجموعات', 'Tous les groupes')}</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{isAr ? g.name_ar : g.name_fr}</option>
                  ))}
                </select>
              </div>

              {/* Payment terms filter */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">{tr('شروط وأجَل الدفع', 'Échéances')}</label>
                <select 
                  value={paymentTermsFilter} 
                  onChange={e => { setPaymentTermsFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">{tr('جميع شروط الدفع', 'Toutes les échéances')}</option>
                  {paymentTerms.map(pt => (
                    <option key={pt.id} value={pt.id}>{pt.label}</option>
                  ))}
                </select>
              </div>

              {/* Items per page */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">{tr('عدد السجلات في الصفحة', 'Affichage')}</label>
                <select 
                  value={itemsPerPage} 
                  onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-emerald-500"
                >
                  <option value={10}>10 {tr('سجلات', 'lignes')}</option>
                  <option value={25}>25 {tr('سجل', 'lignes')}</option>
                  <option value={50}>50 {tr('سجل', 'lignes')}</option>
                  <option value={100}>100 {tr('سجل', 'lignes')}</option>
                </select>
              </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedCustomerIds.length > 0 && (() => {
              const selectedCusts = customers.filter(c => selectedCustomerIds.includes(c.id));
              const hasDeleted = selectedCusts.some(c => c.is_deleted);
              const hasActive = selectedCusts.some(c => !c.is_deleted);

              return (
                <div className="bg-emerald-950/90 border border-emerald-800 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-fadeIn">
                  <div className="text-xs text-emerald-200 font-medium flex items-center gap-2 flex-wrap">
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                    <span><strong>{selectedCustomerIds.length}</strong> {tr('عملاء محددون', 'sélectionnés')}</span>
                    
                    {selectedCustomerIds.length < filteredWholesaleCustomers.length && (
                      <button 
                        onClick={() => setSelectedCustomerIds(filteredWholesaleCustomers.map(c => c.id))}
                        className="text-[11px] bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-lg transition font-semibold"
                      >
                        {tr(`تحديد الكل (${filteredWholesaleCustomers.length})`, `Tout sélect. (${filteredWholesaleCustomers.length})`)}
                      </button>
                    )}

                    <button 
                      onClick={() => setSelectedCustomerIds([])}
                      className="text-xs text-slate-400 hover:text-slate-100 underline font-semibold px-1"
                    >
                      {tr('إلغاء التحديد', 'Désélectionner')}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button 
                      onClick={() => handleBulkAction('approve')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow"
                    >
                      {tr('اعتماد المحددين', 'Approuver')}
                    </button>
                    <button 
                      onClick={() => handleBulkAction('reject')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-semibold transition"
                    >
                      {tr('رفض المحددين', 'Refuser')}
                    </button>
                    <button 
                      onClick={() => handleBulkAction('activate')}
                      className="px-3 py-1.5 bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800/60 rounded-lg text-xs font-semibold transition"
                    >
                      {tr('تنشيط الحسابات', 'Activer')}
                    </button>
                    <button 
                      onClick={() => handleBulkAction('suspend')}
                      className="px-3 py-1.5 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-semibold transition"
                    >
                      {tr('تجميد الحسابات', 'Suspendre')}
                    </button>
                    <button 
                      onClick={() => handleBulkAction('export')}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
                    >
                      {tr('تصدير المحددين', 'Exporter')}
                    </button>

                    {hasDeleted && (
                      <button 
                        onClick={() => handleBulkAction('restore')}
                        className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {tr('استعادة المحددين', 'Restaurer')}
                      </button>
                    )}

                    {hasActive && (
                      <button 
                        onClick={() => handleBulkAction('delete')}
                        className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {tr('حذف المحددين', 'Supprimer')}
                      </button>
                    )}

                    {hasDeleted && (
                      <button 
                        onClick={() => handleBulkAction('permanent_delete')}
                        className="px-3 py-1.5 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/60 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {tr('حذف نهائي', 'Supprimer déf.')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Customers Table */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-300 text-start">
                  <thead className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 text-start w-8">
                        {(() => {
                          const paginatedCustomers = filteredWholesaleCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                          const isCurrentPageFullySelected = paginatedCustomers.length > 0 && paginatedCustomers.every(c => selectedCustomerIds.includes(c.id));
                          return (
                            <input 
                              type="checkbox"
                              checked={isCurrentPageFullySelected}
                              onChange={e => {
                                if (e.target.checked) {
                                  const currentPageIds = paginatedCustomers.map(c => c.id);
                                  setSelectedCustomerIds(prev => Array.from(new Set([...prev, ...currentPageIds])));
                                } else {
                                  const currentPageIds = new Set(paginatedCustomers.map(c => c.id));
                                  setSelectedCustomerIds(prev => prev.filter(id => !currentPageIds.has(id)));
                                }
                              }}
                              className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-950"
                            />
                          );
                        })()}
                      </th>
                      <th className="py-3.5 px-4 text-start">{tr('الشركة والمسؤول', 'Société / Représentant')}</th>
                      <th className="py-3.5 px-4 text-start">{tr('الاتصال والعنوان', 'Contact & Adresse')}</th>
                      <th className="py-3.5 px-4 text-start">{tr('البيانات الجبائية (RC/NIF/NIS/VAT)', 'Fiscalité')}</th>
                      <th className="py-3.5 px-4 text-start">{tr('الاعتماد / حالة الحساب', 'Statuts B2B')}</th>
                      <th className="py-3.5 px-4 text-start">{tr('المجموعة والتسهيلات', 'Groupe & Conditions')}</th>
                      <th className="py-3.5 px-4 text-start">{tr('الحد الائتماني المتاح', 'Limite Crédit')}</th>
                      <th className="py-3.5 px-4 text-center">{tr('إجراءات ERP', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredWholesaleCustomers.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-500">
                          <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-400" />
                          <p>{tr('لا يوجد عملاء جملة مطابقون للبحث أو الفلاتر المطبقة', 'Aucun compte grossiste trouvé.')}</p>
                        </td>
                      </tr>
                    )}
                    {filteredWholesaleCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(c => {
                      const isSelected = selectedCustomerIds.includes(c.id);
                      return (
                        <tr key={c.id} className={`hover:bg-slate-900/50 transition-colors ${isSelected ? 'bg-emerald-950/20' : ''}`}>
                          <td className="py-3.5 px-4">
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedCustomerIds(prev => [...prev, c.id]);
                                } else {
                                  setSelectedCustomerIds(prev => prev.filter(id => id !== c.id));
                                }
                              }}
                              className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-950"
                            />
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-100 flex items-center gap-1.5">
                              <span className="hover:text-emerald-400 cursor-pointer transition" onClick={() => { setSelectedCustomer(c); setCustomerDetailsModal(true); }}>
                                {c.company_name || c.full_name || tr('بدون اسم شركة', 'Sans société')}
                              </span>
                              {c.is_deleted && (
                                <span className="bg-rose-950/80 text-rose-300 border border-rose-800/80 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                  {tr('محذوف', 'Corbeille')}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Users className="w-3 h-3 text-slate-500" />
                              <span>{c.full_name || '—'}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs space-y-0.5">
                            <div className="font-mono text-slate-200 font-semibold">{c.phone || '—'}</div>
                            {c.email && <div className="text-slate-400">{c.email}</div>}
                            <div className="text-slate-500">{c.city ? `${c.city} (${c.wilaya_id || ''})` : `الولاية ${c.wilaya_id || ''}`}</div>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-mono">
                            <div className="text-slate-300"><span className="text-slate-500">RC:</span> {c.register_number || '—'}</div>
                            <div className="text-slate-400"><span className="text-slate-500">NIF:</span> {c.tax_id || '—'}</div>
                            {c.vat_number && <div className="text-emerald-400 font-semibold"><span className="text-slate-500">TVA:</span> {c.vat_number}</div>}
                          </td>
                          <td className="py-3.5 px-4 space-y-1">
                            {/* Approval status */}
                            <div className="flex items-center gap-1">
                              {c.wholesale_status === 'approved' ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 font-bold px-2.5 py-0.5 rounded-full text-xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  {tr('معتمد', 'Approuvé')}
                                </span>
                              ) : c.wholesale_status === 'rejected' ? (
                                <span className="inline-flex items-center gap-1 bg-rose-950/80 text-rose-400 border border-rose-800/80 font-bold px-2.5 py-0.5 rounded-full text-xs">
                                  <XCircle className="w-3 h-3 text-rose-400" />
                                  {tr('مرفوض', 'Refusé')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-950/80 text-amber-400 border border-amber-800/80 font-bold px-2.5 py-0.5 rounded-full text-xs">
                                  <AlertCircle className="w-3 h-3 text-amber-400" />
                                  {tr('قيد المراجعة', 'En attente')}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 mt-0.5">
                              {c.wholesale_status !== 'approved' && (
                                <button 
                                  onClick={() => handleUpdateWholesaleStatus(c, 'approved')} 
                                  className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800/60 rounded transition"
                                  title={tr('اعتماد الحساب', 'Approuver')}
                                >
                                  {tr('اعتماد', 'Approuver')}
                                </button>
                              )}
                              {c.wholesale_status !== 'rejected' && (
                                <button 
                                  onClick={() => handleUpdateWholesaleStatus(c, 'rejected')} 
                                  className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-800/60 rounded transition"
                                  title={tr('رفض الحساب', 'Refuser')}
                                >
                                  {tr('رفض', 'Refuser')}
                                </button>
                              )}
                            </div>

                            {/* Account status */}
                            <div>
                              <select
                                value={c.status || 'Active'}
                                onChange={e => handleUpdateAccountStatus(c, e.target.value as 'Active' | 'Suspended' | 'Blocked')}
                                className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-800 bg-slate-900 text-slate-200 focus:outline-none focus:border-emerald-500"
                              >
                                <option value="Active">{tr('نشط (Active)', 'Actif')}</option>
                                <option value="Suspended">{tr('موقوف (Suspended)', 'Suspendu')}</option>
                                <option value="Blocked">{tr('محظور (Blocked)', 'Bloqué')}</option>
                              </select>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs space-y-1">
                            <div>
                              <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                                {getGroupName(c.customer_group_id)}
                              </span>
                            </div>
                            {c.price_list_id && (
                              <div className="text-xs text-slate-400">
                                {tr('كتالوج:', 'Tarif:')} {getPriceListName(c.price_list_id)}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <div className="font-mono text-slate-300 font-semibold">{tr('الحد:', 'Plafond:')} {formatPrice(c.credit_limit || 0)}</div>
                            <div className="font-mono text-emerald-400 font-bold">{tr('المتاح:', 'Dispo:')} {formatPrice(c.credit_balance || 0)}</div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                onClick={() => { setSelectedCustomer(c); setCustomerDetailsModal(true); }}
                                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition-colors"
                                title={tr('عرض التفاصيل الكاملة', 'Détails')}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {c.phone && (
                                <>
                                  <a 
                                    href={`tel:${c.phone}`}
                                    className="p-1.5 hover:bg-blue-950 text-blue-400 rounded-lg transition-colors"
                                    title={tr('اتصال هاتفي مباشر', 'Appeler')}
                                  >
                                    <Phone className="w-4 h-4" />
                                  </a>
                                  <a 
                                    href={`https://wa.me/213${c.phone.replace(/^0/, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 hover:bg-emerald-950 text-emerald-400 rounded-lg transition-colors"
                                    title={tr('مراسلة عبر واتساب', 'WhatsApp')}
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </a>
                                </>
                              )}
                              <button 
                                onClick={() => openWholesaleCustomerModal(c)} 
                                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-blue-400 rounded-lg transition-colors"
                                title={tr('تعديل الحساب', 'Modifier')}
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {c.is_deleted ? (
                                <>
                                  <button 
                                    onClick={() => handleRestoreWholesaleCustomer(c.id)} 
                                    className="p-1.5 hover:bg-emerald-950 text-emerald-400 rounded-lg transition-colors"
                                    title={tr('استعادة من السلة', 'Restauration')}
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handlePermanentDeleteWholesaleCustomer(c.id)} 
                                    className="p-1.5 hover:bg-rose-950/60 text-rose-400 rounded-lg transition-colors"
                                    title={tr('حذف نهائي', 'Suppression définitive')}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button 
                                  onClick={() => handleSoftDeleteWholesaleCustomer(c.id)} 
                                  className="p-1.5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                                  title={tr('نقل إلى المهملات', 'Corbeille')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: CUSTOMER GROUPS & CREDIT ACCOUNTS */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Section A: Customer Groups */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100">{tr('مجموعات شرائح الجملة (Tariff Groups)', 'Groupes Tarifaires Wholesale')}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{tr('تحديد نسبة الخصم المئوية الموحدة لكل فئة من العملاء', 'Définissez des remises globales par catégorie de clients.')}</p>
              </div>
              <button 
                onClick={() => openGroupModal(null)} 
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-950/50"
              >
                <Plus className="w-4 h-4" /> {tr('مجموعة جديدة', 'Nouveau Groupe')}
              </button>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm text-slate-300 text-start">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-start">{tr('اسم المجموعة (عربي)', 'Nom (AR)')}</th>
                    <th className="py-3 px-4 text-start">{tr('اسم المجموعة (فرنسي)', 'Nom (FR)')}</th>
                    <th className="py-3 px-4 text-start">{tr('الخصم الموحد', 'Remise globale')}</th>
                    <th className="py-3 px-4 text-center">{tr('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredGroups.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">{tr('لا توجد مجموعات عملاء مضافة بعد', 'Aucun groupe de clients enregistré.')}</td>
                    </tr>
                  )}
                  {filteredGroups.map(g => (
                    <tr key={g.id} className="hover:bg-slate-900/50 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-100">{g.name_ar}</td>
                      <td className="py-3.5 px-4 text-slate-300">{g.name_fr}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 font-bold px-2.5 py-1 rounded-full text-xs">
                          <Percent className="w-3 h-3" />
                          -{g.discount_percentage}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center space-x-1">
                        <button onClick={() => openGroupModal(g)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-emerald-400 transition"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteGroup(g.id)} className="p-1.5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Credit & Group Assignments */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100">{tr('الحسابات الائتمانية وتخصيص المجموعات للعملاء', 'Comptes Crédit & Groupes Clients')}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{tr('تعيين الحد الائتماني ورصيد الشراء المتاح لكل تجار الجملة', 'Ajustez les plafonds de crédit et les affectations de groupes.')}</p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm text-slate-300 text-start">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-start">{tr('العميل / الشركة', 'Client / Société')}</th>
                    <th className="py-3 px-4 text-start">{tr('المجموعة المخصصة', 'Groupe')}</th>
                    <th className="py-3 px-4 text-start">{tr('الحد الائتماني الإجمالي', 'Limite Crédit')}</th>
                    <th className="py-3 px-4 text-start">{tr('الرصيد المتاح للائتمان', 'Solde Dispo')}</th>
                    <th className="py-3 px-4 text-center">{tr('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredWholesaleCustomers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">{tr('لا يوجد عملاء جملة مطابقين للبحث', 'Aucun client wholesale trouvé.')}</td>
                    </tr>
                  )}
                  {filteredWholesaleCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(c => (
                    <tr key={c.id} className="hover:bg-slate-900/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-100">{c.full_name || c.phone}</div>
                        <div className="text-xs text-slate-400">{c.company_name || c.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 px-2.5 py-1 rounded-full text-xs font-semibold">
                          {getGroupName(c.customer_group_id)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-200 font-semibold">{formatPrice(c.credit_limit || 0)}</td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400 font-bold">{formatPrice(c.credit_balance || 0)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <button 
                          onClick={() => openCreditModal(c)} 
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-emerald-800/60 bg-emerald-950 text-emerald-300 hover:bg-emerald-900 transition inline-flex items-center gap-1.5"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          {tr('تعديل الائتمان/المجموعة', 'Ajuster')}
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

      {/* TAB 2: PRICE LISTS & PRICE ENTRIES */}
      {activeTab === 'pricelists' && (
        <div className="space-y-6">
          {/* Catalogues */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100">{tr('كتالوجات وقوائم أسعار الجملة', 'Catalogues de Prix B2B')}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{tr('أنشئ قوائم أسعار خاصة بالمواسم أو الفئات لتطبيقها على المنتجات', 'Créez des catalogues tarifaires sur mesure.')}</p>
              </div>
              <button 
                onClick={() => openPriceListModal(null)} 
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-950/50"
              >
                <Plus className="w-4 h-4" /> {tr('كتالوج جديد', 'Nouveau Catalogue')}
              </button>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm text-slate-300 text-start">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-start">{tr('اسم قائمة الأسعار', 'Nom du catalogue')}</th>
                    <th className="py-3 px-4 text-start">{tr('الحالة', 'Statut')}</th>
                    <th className="py-3 px-4 text-start">{tr('عدد المنتجات المدرجة', 'Produits inclus')}</th>
                    <th className="py-3 px-4 text-center">{tr('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {priceLists.map(pl => {
                    const entriesCount = priceEntries.filter(e => e.price_list_id === pl.id).length;
                    return (
                      <tr key={pl.id} className="hover:bg-slate-900/50 transition">
                        <td className="py-3.5 px-4 font-semibold text-slate-100">{pl.name}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${pl.is_active ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>
                            {pl.is_active ? tr('نشط', 'Actif') : tr('معطل', 'Inactif')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-300">{entriesCount} {tr('منتج', 'produits')}</td>
                        <td className="py-3.5 px-4 text-center space-x-1">
                          <button onClick={() => openPriceListModal(pl)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-emerald-400 transition"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDeletePriceList(pl.id)} className="p-1.5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Entries */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100">{tr('سجل أسعار المنتجات المحددة داخل القوائم', 'Lignes de Tarifs Produits')}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{tr('تخصيص سعر جملة خاص لمنتج محدد في كتالوج أسعار معين', 'Affectez des tarifs spécifiques par produit et catalogue.')}</p>
              </div>
              <button 
                onClick={() => openPriceEntryModal(null)} 
                disabled={priceLists.length === 0 || products.length === 0}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-950/50 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> {tr('إضافة سعر منتج', 'Ajouter un Tarif')}
              </button>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm text-slate-300 text-start">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-start">{tr('قائمة الأسعار', 'Catalogue')}</th>
                    <th className="py-3 px-4 text-start">{tr('المنتج', 'Produit')}</th>
                    <th className="py-3 px-4 text-start">{tr('سعر التجزئة', 'Prix Détail')}</th>
                    <th className="py-3 px-4 text-start">{tr('سعر الجملة المخصص', 'Prix Gros')}</th>
                    <th className="py-3 px-4 text-center">{tr('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPriceEntries.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">{tr('لا توجد تسعيرات مضافة في القوائم', 'Aucun tarif enregistré.')}</td>
                    </tr>
                  )}
                  {filteredPriceEntries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(e => {
                    const prod = products.find(p => p.id === e.product_id);
                    return (
                      <tr key={e.id} className="hover:bg-slate-900/50 transition">
                        <td className="py-3.5 px-4 font-semibold text-slate-200">{getPriceListName(e.price_list_id)}</td>
                        <td className="py-3.5 px-4 text-slate-200">
                          <div className="font-semibold">{getProductName(e.product_id)}</div>
                          {prod && <div className="text-xs text-slate-500">SKU: {prod.sku}</div>}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">{prod ? formatPrice(prod.price) : '-'}</td>
                        <td className="py-3.5 px-4 font-mono text-emerald-400 font-bold">{formatPrice(e.wholesale_price)}</td>
                        <td className="py-3.5 px-4 text-center space-x-1">
                          <button onClick={() => openPriceEntryModal(e)} className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDeletePriceEntry(e.id)} className="p-1.5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOMER PRICE OVERRIDES */}
      {activeTab === 'overrides' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100">{tr('التجاوزات الحصرية لأسعار العملاء (Client Overrides)', 'Prix Spécifiques Exclusifs par Client')}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{tr('تخصيص سعر بيع استثنائي لعميل محدد على منتج معين يتجاوز جميع قوانين الخصم الأخرى', 'Définissez des prix négociés sur mesure pour un client particulier.')}</p>
            </div>
            <button 
              onClick={() => openOverrideModal(null)} 
              disabled={customers.length === 0 || products.length === 0}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-950/50 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> {tr('إضافة سعر استثنائي', 'Nouveau Prix Exclusif')}
            </button>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm text-slate-300 text-start">
              <thead className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 text-start">{tr('العميل المستفيد', 'Client bénéficiaire')}</th>
                  <th className="py-3 px-4 text-start">{tr('المنتج المستهدف', 'Produit concerné')}</th>
                  <th className="py-3 px-4 text-start">{tr('السعر الاستثنائي المتفق عليه', 'Prix spécial exclusif')}</th>
                  <th className="py-3 px-4 text-center">{tr('إجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOverrides.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">{tr('لا توجد تجاوزات أسعار مسجلة', 'Aucune exception de tarif enregistrée.')}</td>
                  </tr>
                )}
                {filteredOverrides.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(o => (
                  <tr key={o.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-100">{getCustomerName(o.customer_id)}</td>
                    <td className="py-3.5 px-4 text-slate-300">{getProductName(o.product_id)}</td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400 font-bold">{formatPrice(o.custom_price)}</td>
                    <td className="py-3.5 px-4 text-center space-x-1">
                      <button onClick={() => openOverrideModal(o)} className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteOverride(o.id)} className="p-1.5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PURCHASE ORDERS (B2B ORDERS) */}
      {activeTab === 'purchase_orders' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100">{tr('طلبات الشراء والاعتماد B2B (Purchase Orders)', 'Bons de Commande Wholesale')}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{tr('مراجعة، اعتماد، وفلترة طلبات الشراء المقدمة من تجار الجملة', 'Validez et gérez les bons d\'achat de vos clients B2B.')}</p>
            </div>
            <button 
              onClick={() => openPoModal(null)} 
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-950/50"
            >
              <Plus className="w-4 h-4" /> {tr('طلب شراء جديد', 'Nouveau Bon d\'Achat')}
            </button>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm text-slate-300 text-start">
              <thead className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 text-start">{tr('رقم PO', 'N° PO')}</th>
                  <th className="py-3 px-4 text-start">{tr('العميل', 'Client')}</th>
                  <th className="py-3 px-4 text-start">{tr('المبلغ الإجمالي', 'Total')}</th>
                  <th className="py-3 px-4 text-start">{tr('الحالة', 'Statut')}</th>
                  <th className="py-3 px-4 text-start">{tr('التاريخ', 'Date')}</th>
                  <th className="py-3 px-4 text-center">{tr('إجراءات الاعتماد', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPurchaseOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">{tr('لا توجد طلبات شراء مسجلة', 'Aucun bon d\'achat trouvé.')}</td>
                  </tr>
                )}
                {filteredPurchaseOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(po => (
                  <tr key={po.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-100">{po.po_number}</td>
                    <td className="py-3.5 px-4 text-slate-300">{getCustomerName(po.customer_id)}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-100 font-bold">{formatPrice(po.total_amount)}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        po.status === 'approved' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80' :
                        po.status === 'pending' ? 'bg-amber-950/80 text-amber-400 border border-amber-800/80' :
                        'bg-rose-950/80 text-rose-400 border border-rose-800/80'
                      }`}>
                        {po.status === 'approved' ? tr('معتمد وفوتِر', 'Approuvé') : po.status === 'pending' ? tr('قيد المراجعة', 'En attente') : tr('مرفوض', 'Refusé')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">{formatDate(po.created_at)}</td>
                    <td className="py-3.5 px-4 text-center space-x-1">
                      {po.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleApprovePO(po)} 
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1 transition shadow"
                          >
                            <Check className="w-3.5 h-3.5" /> {tr('قبول وفوتَرة', 'Approuver')}
                          </button>
                          <button 
                            onClick={() => handleRejectPO(po.id)} 
                            className="bg-slate-900 hover:bg-rose-950 hover:text-rose-400 text-slate-300 border border-slate-800 text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                          >
                            {tr('رفض', 'Rejeter')}
                          </button>
                        </>
                      )}
                      <button onClick={() => openPoModal(po)} className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeletePO(po.id)} className="p-1.5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: INVOICES */}
      {activeTab === 'invoices' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100">{tr('فواتير ائتمان تحصيل الجملة (Wholesale Invoices)', 'Factures de Crédit B2B')}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{tr('متابعة وتحصيل الديون والفواتير الآجلة الصادرة لعملاء B2B', 'Suivez l\'état d\'encaissement de vos factures B2B.')}</p>
            </div>
            <button 
              onClick={() => openInvoiceModal(null)} 
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-950/50"
            >
              <Plus className="w-4 h-4" /> {tr('فاتورة جديدة', 'Nouvelle Facture')}
            </button>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm text-slate-300 text-start">
              <thead className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 text-start">{tr('رقم الفاتورة', 'N° Facture')}</th>
                  <th className="py-3 px-4 text-start">{tr('العميل', 'Client')}</th>
                  <th className="py-3 px-4 text-start">{tr('مبلغ الفاتورة', 'Montant')}</th>
                  <th className="py-3 px-4 text-start">{tr('تاريخ الاستحقاق', 'Échéance')}</th>
                  <th className="py-3 px-4 text-start">{tr('الحالة', 'Statut')}</th>
                  <th className="py-3 px-4 text-center">{tr('إجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">{tr('لا توجد فواتير مطابقة للبحث', 'Aucune facture trouvée.')}</td>
                  </tr>
                )}
                {filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-100">{inv.invoice_number}</td>
                    <td className="py-3.5 px-4 text-slate-300">{getCustomerName(inv.customer_id)}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-100 font-bold">{formatPrice(inv.total_amount)}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">{formatDate(inv.due_date)}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        inv.status === 'paid' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80' :
                        inv.status === 'overdue' ? 'bg-rose-950/80 text-rose-400 border border-rose-800/80' :
                        'bg-amber-950/80 text-amber-400 border border-amber-800/80'
                      }`}>
                        {inv.status === 'paid' ? tr('مدفوعة بالكامل', 'Payée') : inv.status === 'overdue' ? tr('متأخرة عن الاستحقاق', 'En retard') : tr('مستحقة للدفع', 'Non payée')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center space-x-1">
                      {inv.status !== 'paid' && (
                        <button 
                          onClick={() => handleMarkInvoicePaid(inv.id)} 
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1 transition shadow"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {tr('تأكيد التحصيل', 'Marquer payée')}
                        </button>
                      )}
                      <button onClick={() => openInvoiceModal(inv)} className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteInvoice(inv.id)} className="p-1.5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: WHOLESALE SETTINGS & PAYMENT TERMS */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Settings Form */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-100">{tr('إعدادات وقوانين بيع الجملة', 'Règles & Config Wholesale B2B')}</h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('الحد الأدنى لقيمة الطلب بالدينار (MOQ Value)', 'Valeur minimale de commande (MOQ DZD)')}</label>
                <input 
                  type="number" 
                  value={wholesaleSettings.min_order_amount} 
                  onChange={e => setWholesaleSettings({ ...wholesaleSettings, min_order_amount: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500" 
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('مدة السداد الافتراضية للفواتير (أيام)', 'Conditions de paiement par défaut (Jours)')}</label>
                <input 
                  type="number" 
                  value={wholesaleSettings.default_payment_terms_days} 
                  onChange={e => setWholesaleSettings({ ...wholesaleSettings, default_payment_terms_days: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500" 
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('البريد الإلكتروني المباشر لخدمة B2B', 'Email Service Client B2B')}</label>
                <input 
                  type="email" 
                  value={wholesaleSettings.b2b_contact_email} 
                  onChange={e => setWholesaleSettings({ ...wholesaleSettings, b2b_contact_email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500" 
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('هاتف قسم المبيعات B2B', 'Téléphone Service B2B')}</label>
                <input 
                  type="text" 
                  value={wholesaleSettings.b2b_contact_phone} 
                  onChange={e => setWholesaleSettings({ ...wholesaleSettings, b2b_contact_phone: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500" 
                />
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="req_tax"
                    checked={wholesaleSettings.require_tax_id} 
                    onChange={e => setWholesaleSettings({ ...wholesaleSettings, require_tax_id: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-950" 
                  />
                  <label htmlFor="req_tax" className="text-xs font-medium text-slate-300">{tr('اشتراط إدخال السجل التجاري والـ NIF عند التسجيل', 'Exiger NIF / Registre de Commerce')}</label>
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="auto_po"
                    checked={wholesaleSettings.auto_approve_po} 
                    onChange={e => setWholesaleSettings({ ...wholesaleSettings, auto_approve_po: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-950" 
                  />
                  <label htmlFor="auto_po" className="text-xs font-medium text-slate-300">{tr('الموافقة التلقائية على طلبات الشراء ذات الرصيد المتاح', 'Validation automatique des Bons d\'Achat')}</label>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('شروط وأحكام الاعتماد التجاري (تظهر في الفواتير)', 'Conditions générales de crédit (imprimées)')}</label>
                <textarea 
                  rows={3}
                  value={wholesaleSettings.wholesale_terms_notes} 
                  onChange={e => setWholesaleSettings({ ...wholesaleSettings, wholesale_terms_notes: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500" 
                />
              </div>

              <button 
                onClick={handleSaveWholesaleSettings} 
                disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-lg shadow-emerald-950/60"
              >
                {tr('حفظ إعدادات الجملة', 'Enregistrer les paramètres')}
              </button>
            </div>
          </div>

          {/* Payment Terms Options */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100">{tr('شروط وآجال الدفع (Payment Terms)', 'Conditions d\'Échéance')}</h2>
              <button 
                onClick={() => openPaymentTermModal(null)} 
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow"
              >
                <Plus className="w-3.5 h-3.5" /> {tr('إضافة أجل', 'Ajouter')}
              </button>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-sm text-slate-300 text-start">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-start">{tr('شرط الدفع', 'Condition')}</th>
                    <th className="py-3 px-4 text-start">{tr('عدد الأيام', 'Jours')}</th>
                    <th className="py-3 px-4 text-start">{tr('الحالة', 'Statut')}</th>
                    <th className="py-3 px-4 text-center">{tr('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paymentTerms.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">{tr('لا توجد شروط دفع مضافة', 'Aucune condition enregistrée.')}</td>
                    </tr>
                  )}
                  {paymentTerms.map(pt => (
                    <tr key={pt.id} className="hover:bg-slate-900/50 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-100">{pt.label}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{pt.days} {tr('يوم', 'jours')}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${pt.is_active ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>
                          {pt.is_active ? tr('نشط', 'Actif') : tr('معطل', 'Inactif')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center space-x-1">
                        <button onClick={() => openPaymentTermModal(pt)} className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeletePaymentTerm(pt.id)} className="p-1.5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: B2B REPORTS */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-100">{tr('ملخص أرقام البيع بالجملة B2B', 'Tableau de bord Wholesale B2B')}</h2>
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="text-xs text-emerald-400 uppercase font-bold">{tr('مبيعات الجملة المعتمدة', 'Volume ventes Wholesale')}</div>
                <div className="text-2xl font-bold font-mono text-slate-100 mt-1">
                  {formatPrice(purchaseOrders.filter(p => p.status === 'approved').reduce((acc, p) => acc + p.total_amount, 0))}
                </div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="text-xs text-amber-400 uppercase font-bold">{tr('إجمالي الائتمان التجاري المستحق', 'Encours de crédit commercial')}</div>
                <div className="text-2xl font-bold font-mono text-slate-100 mt-1">
                  {formatPrice(invoices.filter(i => i.status === 'unpaid').reduce((acc, i) => acc + i.total_amount, 0))}
                </div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="text-xs text-blue-400 uppercase font-bold">{tr('نسبة تحصيل الديون والفواتير', 'Taux de recouvrement')}</div>
                <div className="text-2xl font-bold text-slate-100 mt-1">
                  {invoices.length > 0 
                    ? `${Math.round((invoices.filter(i => i.status === 'paid').length / invoices.length) * 100)}%`
                    : '100%'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 mb-2">{tr('كبار مشتري الجملة', 'Top Acheteurs Wholesale')}</h2>
              <div className="divide-y divide-slate-800/80">
                {customers.filter(c => c.account_type === 'wholesale').slice(0, 5).map(c => (
                  <div key={c.id} className="py-3 flex justify-between items-center text-sm">
                    <div>
                      <div className="font-semibold text-slate-200">{c.full_name || c.phone}</div>
                      <div className="text-xs text-slate-400">{c.company_name || c.email}</div>
                    </div>
                    <div className="text-end font-mono">
                      <div className="font-bold text-emerald-400">{formatPrice(c.total_spent || 0)}</div>
                      <div className="text-[10px] text-slate-500">{c.total_orders} {tr('طلب', 'orders')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-slate-800/80">
              <button 
                onClick={handleExportCSV}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 py-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4 text-emerald-400" /> {tr('تصدير التقرير التجاري الشامل', 'Exporter le registre B2B')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {activeTab !== 'settings' && activeTab !== 'reports' && currentDatasetLength > itemsPerPage && (
        <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 shadow-xl text-xs">
          <span className="text-slate-400">
            {tr('عرض الصفحة', 'Page')} <strong className="text-slate-200">{currentPage}</strong> {tr('من', 'sur')} <strong className="text-slate-200">{totalPages}</strong> ({currentDatasetLength} {tr('سجل', 'entrées')})
          </span>
          <div className="flex items-center gap-1.5">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-2 border border-slate-800 bg-slate-900 rounded-xl hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-2 border border-slate-800 bg-slate-900 rounded-xl hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODALS */}

      {/* 1. Group Modal */}
      {groupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">{editingGroup ? tr('تعديل المجموعة', 'Modifier le groupe') : tr('إضافة مجموعة عملاء جديدة', 'Ajouter un groupe')}</h3>
              <button onClick={() => setGroupModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-200" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('الاسم بالعربي', 'Nom (AR)')}</label>
                <input value={groupForm.name_ar} onChange={e => setGroupForm({ ...groupForm, name_ar: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('الاسم بالفرنسي', 'Nom (FR)')}</label>
                <input value={groupForm.name_fr} onChange={e => setGroupForm({ ...groupForm, name_fr: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('الخصم العام الموحد (%)', 'Remise globale (%)')}</label>
                <input type="number" min="0" max="100" value={groupForm.discount_percentage} onChange={e => setGroupForm({ ...groupForm, discount_percentage: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setGroupModal(false)} className="px-4 py-2 text-xs font-semibold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl transition">{tr('إلغاء', 'Annuler')}</button>
              <button onClick={handleSaveGroup} disabled={saving} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-lg shadow-emerald-950/50">{tr('حفظ', 'Enregistrer')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Customer Credit & Group Modal */}
      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">{tr('تعديل الحساب الائتماني والمجموعة للعميل', 'Ajuster les limites de crédit')}</h3>
              <button onClick={() => setCreditModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-200" /></button>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-400">{tr('العميل:', 'Client:')} <span className="font-bold text-slate-100">{getCustomerName(creditForm.customer_id)}</span></p>
              
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('المجموعة المخصصة للعميل', 'Groupe du client')}</label>
                <select 
                  value={creditForm.customer_group_id} 
                  onChange={e => setCreditForm({ ...creditForm, customer_group_id: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="">{tr('بدون مجموعة (خصم عادي)', 'Aucun groupe')}</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{isAr ? g.name_ar : g.name_fr} (-{g.discount_percentage}%)</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('الحد الائتماني الإجمالي (DZD)', 'Limite globale de crédit')}</label>
                <input type="number" value={creditForm.credit_limit} onChange={e => setCreditForm({ ...creditForm, credit_limit: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 font-mono" />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('رصيد الائتمان المتاح حالياً (DZD)', 'Solde disponible actuel')}</label>
                <input type="number" value={creditForm.credit_balance} onChange={e => setCreditForm({ ...creditForm, credit_balance: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setCreditModal(false)} className="px-4 py-2 text-xs font-semibold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl transition">{tr('إلغاء', 'Annuler')}</button>
              <button onClick={handleSaveCredit} disabled={saving} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-lg shadow-emerald-950/50">{tr('تحديث البيانات', 'Enregistrer')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Price List Modal */}
      {priceListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">{editingPriceList ? tr('تعديل كتالوج الأسعار', 'Modifier le catalogue') : tr('إضافة كتالوج أسعار جديد', 'Ajouter un catalogue')}</h3>
              <button onClick={() => setPriceListModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-200" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('اسم قائمة الأسعار / الكتالوج', 'Nom du catalogue')}</label>
                <input value={priceListForm.name} onChange={e => setPriceListForm({ ...priceListForm, name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="pl_act" checked={priceListForm.is_active} onChange={e => setPriceListForm({ ...priceListForm, is_active: e.target.checked })} className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500" />
                <label htmlFor="pl_act" className="text-xs font-semibold text-slate-300">{tr('تنشيط الكتالوج في النظام', 'Activer ce catalogue')}</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setPriceListModal(false)} className="px-4 py-2 text-xs font-semibold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl transition">{tr('إلغاء', 'Annuler')}</button>
              <button onClick={handleSavePriceList} disabled={saving} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-lg shadow-emerald-950/50">{tr('حفظ', 'Enregistrer')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Price Entry Modal */}
      {priceEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">{editingPriceEntry ? tr('تعديل سعر المنتج في الكتالوج', 'Modifier tarif du produit') : tr('تعيين سعر جملة لمنتج', 'Assigner un tarif de gros')}</h3>
              <button onClick={() => setPriceEntryModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-200" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('قائمة الأسعار / الكتالوج', 'Catalogue de Prix')}</label>
                <select value={priceEntryForm.price_list_id} onChange={e => setPriceEntryForm({ ...priceEntryForm, price_list_id: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500">
                  {priceLists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('المنتج', 'Produit')}</label>
                <select value={priceEntryForm.product_id} onChange={e => setPriceEntryForm({ ...priceEntryForm, product_id: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500">
                  {products.map(p => <option key={p.id} value={p.id}>{isAr ? p.name_ar : p.name_fr} ({p.sku})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('سعر الجملة المخصص للمنتج (DZD)', 'Tarif de gros pour ce produit')}</label>
                <input type="number" min="0" value={priceEntryForm.wholesale_price} onChange={e => setPriceEntryForm({ ...priceEntryForm, wholesale_price: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setPriceEntryModal(false)} className="px-4 py-2 text-xs font-semibold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl transition">{tr('إلغاء', 'Annuler')}</button>
              <button onClick={handleSavePriceEntry} disabled={saving} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-lg shadow-emerald-950/50">{tr('حفظ السعر', 'Enregistrer')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">{editingOverride ? tr('تعديل السعر المخصص للعميل', 'Modifier prix spécifique') : tr('سعر استثنائي مخصص لعميل', 'Exception de prix par client')}</h3>
              <button onClick={() => setOverrideModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-200" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('العميل المستفيد', 'Client Wholesale')}</label>
                <select value={overrideForm.customer_id} onChange={e => setOverrideForm({ ...overrideForm, customer_id: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500">
                  {customers.map(c => <option key={c.id} value={c.id}>{c.full_name || c.phone} ({c.company_name || 'Individual'})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('المنتج', 'Produit concerné')}</label>
                <select value={overrideForm.product_id} onChange={e => setOverrideForm({ ...overrideForm, product_id: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500">
                  {products.map(p => <option key={p.id} value={p.id}>{isAr ? p.name_ar : p.name_fr} ({p.sku})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('السعر الاستثنائي المتفق عليه (DZD)', 'Saisir le tarif convenu')}</label>
                <input type="number" min="0" value={overrideForm.custom_price} onChange={e => setOverrideForm({ ...overrideForm, custom_price: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setOverrideModal(false)} className="px-4 py-2 text-xs font-semibold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl transition">{tr('إلغاء', 'Annuler')}</button>
              <button onClick={handleSaveOverride} disabled={saving} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-lg shadow-emerald-950/50">{tr('حفظ السعر', 'Enregistrer')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Purchase Order Modal */}
      {poModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">{editingPo ? tr('تعديل طلب الشراء', 'Modifier bon d\'achat') : tr('إنشاء طلب شراء B2B جديد', 'Nouveau bon d\'achat')}</h3>
              <button onClick={() => setPoModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-200" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('رقم طلب الشراء (PO Number)', 'N° PO')}</label>
                <input value={poForm.po_number} onChange={e => setPoForm({ ...poForm, po_number: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('العميل المستفيد', 'Client')}</label>
                <select value={poForm.customer_id} onChange={e => setPoForm({ ...poForm, customer_id: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500">
                  {customers.map(c => <option key={c.id} value={c.id}>{c.full_name || c.phone}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('المبلغ الإجمالي لطلب الشراء (DZD)', 'Montant total')}</label>
                <input type="number" min="0" value={poForm.total_amount} onChange={e => setPoForm({ ...poForm, total_amount: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('أجل وملاحظات السداد', 'Termes de paiement')}</label>
                <select value={poForm.payment_terms_id} onChange={e => setPoForm({ ...poForm, payment_terms_id: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500">
                  <option value="">{tr('بدون أجل حدد لاحقاً', 'Par défaut')}</option>
                  {paymentTerms.map(pt => <option key={pt.id} value={pt.id}>{pt.label} ({pt.days} {tr('يوم', 'd')})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('ملاحظات إضافية', 'Notes')}</label>
                <textarea rows={2} value={poForm.notes} onChange={e => setPoForm({ ...poForm, notes: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setPoModal(false)} className="px-4 py-2 text-xs font-semibold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl transition">{tr('إلغاء', 'Annuler')}</button>
              <button onClick={handleSavePo} disabled={saving} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-lg shadow-emerald-950/50">{tr('حفظ الطلب', 'Enregistrer')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Invoice Modal */}
      {invoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">{editingInvoice ? tr('تعديل فاتورة الائتمان', 'Modifier facture') : tr('إصدار فاتورة ائتمان جملة', 'Nouvelle facture')}</h3>
              <button onClick={() => setInvoiceModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-200" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('رقم الفاتورة', 'N° Facture')}</label>
                <input value={invoiceForm.invoice_number} onChange={e => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('العميل', 'Client')}</label>
                <select value={invoiceForm.customer_id} onChange={e => setInvoiceForm({ ...invoiceForm, customer_id: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500">
                  {customers.map(c => <option key={c.id} value={c.id}>{c.full_name || c.phone}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('مبلغ الفاتورة (DZD)', 'Montant')}</label>
                <input type="number" min="0" value={invoiceForm.total_amount} onChange={e => setInvoiceForm({ ...invoiceForm, total_amount: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('تاريخ الاستحقاق الدفع', 'Date d\'échéance')}</label>
                <input type="date" value={invoiceForm.due_date} onChange={e => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('حالة الفاتورة', 'Statut')}</label>
                <select value={invoiceForm.status} onChange={e => setInvoiceForm({ ...invoiceForm, status: e.target.value as 'unpaid' | 'paid' | 'overdue' })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500">
                  <option value="unpaid">{tr('غير مدفوعة', 'Unpaid')}</option>
                  <option value="paid">{tr('مدفوعة بالكامل', 'Paid')}</option>
                  <option value="overdue">{tr('متأخرة عن الاستحقاق', 'Overdue')}</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setInvoiceModal(false)} className="px-4 py-2 text-xs font-semibold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl transition">{tr('إلغاء', 'Annuler')}</button>
              <button onClick={handleSaveInvoice} disabled={saving} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-lg shadow-emerald-950/50">{tr('حفظ الفاتورة', 'Enregistrer')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Payment Term Modal */}
      {paymentTermModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">{editingPaymentTerm ? tr('تعديل أجل الدفع', 'Modifier échéance') : tr('إضافة أجل سداد جديد', 'Nouvelle échéance')}</h3>
              <button onClick={() => setPaymentTermModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-200" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('المسمى (مثال: سداد خلال 30 يوم)', 'Libellé')}</label>
                <input value={paymentTermForm.label} onChange={e => setPaymentTermForm({ ...paymentTermForm, label: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{tr('عدد الأيام المسموحة بالائتمان', 'Nombre de jours')}</label>
                <input type="number" min="0" value={paymentTermForm.days} onChange={e => setPaymentTermForm({ ...paymentTermForm, days: Number(e.target.value) })} className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-xl focus:outline-none focus:border-emerald-500 font-mono" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="pt_act" checked={paymentTermForm.is_active} onChange={e => setPaymentTermForm({ ...paymentTermForm, is_active: e.target.checked })} className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500" />
                <label htmlFor="pt_act" className="text-xs font-semibold text-slate-300">{tr('تنشيط هذه الخيار في طلبات الشراء', 'Activer cette option')}</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setPaymentTermModal(false)} className="px-4 py-2 text-xs font-semibold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl transition">{tr('إلغاء', 'Annuler')}</button>
              <button onClick={handleSavePaymentTerm} disabled={saving} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-lg shadow-emerald-950/50">{tr('حفظ', 'Enregistrer')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Wholesale Customer Modal */}
      {wholesaleCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                {editingWholesaleCustomer 
                  ? tr('تعديل بيانات تاجر الجملة B2B', 'Modifier le compte Grossiste B2B') 
                  : tr('إضافة تاجر جملة جديد B2B', 'Nouveau Grossiste B2B')}
              </h3>
              <button onClick={() => setWholesaleCustomerModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-200" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('اسم الشركة / المؤسسة', 'Nom de la Société')} *</label>
                <input 
                  value={wholesaleCustomerForm.company_name} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, company_name: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500" 
                  placeholder="مثال: SARL DZ Commerce" 
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('اسم المسؤول / الشخص المكلف', 'Nom du Représentant')} *</label>
                <input 
                  value={wholesaleCustomerForm.full_name} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, full_name: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500" 
                  placeholder="مثال: أحمد بن علي" 
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('رقم الهاتف', 'Téléphone')} *</label>
                <input 
                  value={wholesaleCustomerForm.phone} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, phone: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl font-mono focus:outline-none focus:border-emerald-500" 
                  placeholder="0550000000" 
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('البريد الإلكتروني', 'Email')}</label>
                <input 
                  value={wholesaleCustomerForm.email} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, email: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500" 
                  placeholder="contact@company.com" 
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('المدينة / العنوان', 'Ville / Adresse')}</label>
                <input 
                  value={wholesaleCustomerForm.city} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, city: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500" 
                  placeholder="الجزائر العاصمة" 
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('رمز الولاية (1-58)', 'Code Wilaya')}</label>
                <input 
                  type="number" min="1" max="58"
                  value={wholesaleCustomerForm.wilaya_id} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, wilaya_id: Number(e.target.value) })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl font-mono focus:outline-none focus:border-emerald-500" 
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('السجل التجاري (RC / Register Number)', 'Registre de Commerce (RC)')}</label>
                <input 
                  value={wholesaleCustomerForm.register_number} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, register_number: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl font-mono focus:outline-none focus:border-emerald-500" 
                  placeholder="16/00-1234567B26" 
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('الرقم الجبائي (NIF / Tax ID)', 'NIF (Identifiant Fiscal)')}</label>
                <input 
                  value={wholesaleCustomerForm.tax_id} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, tax_id: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl font-mono focus:outline-none focus:border-emerald-500" 
                  placeholder="002316123456789" 
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('رقم الإحصاء (NIS)', 'Numéro NIS')}</label>
                <input 
                  value={wholesaleCustomerForm.nis} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, nis: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl font-mono focus:outline-none focus:border-emerald-500" 
                  placeholder="0023169999" 
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('حالة الاعتماد (Wholesale Status)', 'Statut d\'Approbation')}</label>
                <select 
                  value={wholesaleCustomerForm.wholesale_status} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, wholesale_status: e.target.value as 'pending' | 'approved' | 'rejected' })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                >
                  <option value="approved">{tr('معتمد (Approved)', 'Approuvé')}</option>
                  <option value="pending">{tr('قيد المراجعة (Pending)', 'En attente')}</option>
                  <option value="rejected">{tr('مرفوض (Rejected)', 'Refusé')}</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('المجموعة المخصصة', 'Groupe Tarifaire')}</label>
                <select 
                  value={wholesaleCustomerForm.customer_group_id} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, customer_group_id: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="">{tr('بدون مجموعة (خصم عام)', 'Aucun groupe')}</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{isAr ? g.name_ar : g.name_fr} (-{g.discount_percentage}%)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('قائمة الأسعار المخصصة', 'Catalogue de Prix')}</label>
                <select 
                  value={wholesaleCustomerForm.price_list_id} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, price_list_id: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="">{tr('القائمة الافتراضية', 'Catalogue par défaut')}</option>
                  {priceLists.map(pl => (
                    <option key={pl.id} value={pl.id}>{pl.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('شروط وآجال الدفع', 'Condition d\'Échéance')}</label>
                <select 
                  value={wholesaleCustomerForm.payment_terms_id} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, payment_terms_id: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="">{tr('دفع فوري (COD)', 'Comptant')}</option>
                  {paymentTerms.map(pt => (
                    <option key={pt.id} value={pt.id}>{pt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('الحد الائتماني الإجمالي (DZD)', 'Plafond Crédit (DZD)')}</label>
                <input 
                  type="number" 
                  value={wholesaleCustomerForm.credit_limit} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, credit_limit: Number(e.target.value) })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl font-mono focus:outline-none focus:border-emerald-500" 
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">{tr('الرصيد المتاح حالياً (DZD)', 'Solde Disponible (DZD)')}</label>
                <input 
                  type="number" 
                  value={wholesaleCustomerForm.credit_balance} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, credit_balance: Number(e.target.value) })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl font-mono focus:outline-none focus:border-emerald-500" 
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-400 block mb-1">{tr('ملاحظات إدارية وجبائية', 'Notes B2B')}</label>
                <textarea 
                  rows={2}
                  value={wholesaleCustomerForm.notes} 
                  onChange={e => setWholesaleCustomerForm({ ...wholesaleCustomerForm, notes: e.target.value })} 
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500" 
                  placeholder={tr('أية ملاحظات إضافية حول التاجر...', 'Notes sur le client grossiste...')}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setWholesaleCustomerModal(false)} className="px-4 py-2 text-xs font-semibold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl transition">{tr('إلغاء', 'Annuler')}</button>
              <button onClick={handleSaveWholesaleCustomer} disabled={saving} className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/50">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {tr('حفظ بيانات تاجر الجملة', 'Enregistrer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Customer Details Drawer Modal */}
      {customerDetailsModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
            {/* Drawer Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-extrabold text-slate-100">
                    {selectedCustomer.company_name || selectedCustomer.full_name}
                  </h3>
                  <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    selectedCustomer.wholesale_status === 'approved' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' :
                    selectedCustomer.wholesale_status === 'rejected' ? 'bg-rose-950/80 text-rose-400 border border-rose-800/50' : 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                  }`}>
                    {selectedCustomer.wholesale_status || 'approved'}
                  </span>
                  <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    selectedCustomer.status === 'Active' ? 'bg-blue-950/80 text-blue-400 border border-blue-800/50' :
                    selectedCustomer.status === 'Suspended' ? 'bg-amber-950/80 text-amber-400 border border-amber-800/50' : 'bg-red-950/80 text-red-400 border border-red-800/50'
                  }`}>
                    {selectedCustomer.status || 'Active'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  ID: <span className="font-mono text-slate-300">{selectedCustomer.id}</span> | {tr('تاريخ الإنشاء:', 'Créé le:')} {selectedCustomer.created_at?.slice(0, 10)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setCustomerDetailsModal(false); openWholesaleCustomerModal(selectedCustomer); }}
                  className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-emerald-950/60 border border-emerald-800/60 hover:bg-emerald-900/60 text-emerald-300 rounded-xl transition"
                >
                  <Edit className="w-3.5 h-3.5" />
                  {tr('تعديل الحساب', 'Modifier')}
                </button>
                <button onClick={() => setCustomerDetailsModal(false)}>
                  <X className="w-6 h-6 text-slate-400 hover:text-slate-200" />
                </button>
              </div>
            </div>

            {/* Details Tab Buttons */}
            <div className="flex border-b border-slate-800 space-x-2 text-xs font-bold overflow-x-auto">
              <button 
                onClick={() => setDetailsTab('info')} 
                className={`pb-2 px-3 border-b-2 transition ${detailsTab === 'info' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                {tr('المعلومات العامة والجبائية', 'Info Générales & Fiscales')}
              </button>
              <button 
                onClick={() => setDetailsTab('orders')} 
                className={`pb-2 px-3 border-b-2 transition ${detailsTab === 'orders' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                {tr('سجل الطلبات والفواتير', 'Commandes & Factures')}
              </button>
              <button 
                onClick={() => setDetailsTab('overrides')} 
                className={`pb-2 px-3 border-b-2 transition ${detailsTab === 'overrides' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                {tr('الأسعار المخصصة', 'Prix Spécifiques')}
              </button>
              <button 
                onClick={() => setDetailsTab('notes')} 
                className={`pb-2 px-3 border-b-2 transition ${detailsTab === 'notes' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                {tr('الملاحظات الإدارية', 'Notes B2B')}
              </button>
              <button 
                onClick={() => setDetailsTab('logs')} 
                className={`pb-2 px-3 border-b-2 transition ${detailsTab === 'logs' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                {tr('سجل النشاطات والتغيرات', 'Journal d\'activités')}
              </button>
            </div>

            {/* Tab 1: General Info */}
            {detailsTab === 'info' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950 p-3.5 rounded-xl space-y-2 border border-slate-800">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    {tr('معلومات الشركة والاتصال', 'Coordonnées de la Société')}
                  </h4>
                  <p><strong className="text-slate-400">{tr('الشركة:', 'Société:')}</strong> <span className="text-slate-200">{selectedCustomer.company_name || '—'}</span></p>
                  <p><strong className="text-slate-400">{tr('المسؤول:', 'Représentant:')}</strong> <span className="text-slate-200">{selectedCustomer.full_name || '—'}</span></p>
                  <p><strong className="text-slate-400">{tr('الهاتف:', 'Téléphone:')}</strong> <span className="font-mono text-slate-200">{selectedCustomer.phone}</span></p>
                  <p><strong className="text-slate-400">{tr('البريد:', 'Email:')}</strong> <span className="text-slate-200">{selectedCustomer.email || '—'}</span></p>
                  <p><strong className="text-slate-400">{tr('العنوان:', 'Adresse:')}</strong> <span className="text-slate-200">{selectedCustomer.address || '—'}, {selectedCustomer.city || ''} (الولاية {selectedCustomer.wilaya_id || ''})</span></p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl space-y-2 border border-slate-800">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    {tr('البيانات الجبائية والقانونية', 'Données Légales & Fiscales')}
                  </h4>
                  <p><strong className="text-slate-400">RC (المركز التجاري):</strong> <span className="font-mono text-slate-200">{selectedCustomer.register_number || '—'}</span></p>
                  <p><strong className="text-slate-400">NIF (الرقم الجبائي):</strong> <span className="font-mono text-slate-200">{selectedCustomer.tax_id || '—'}</span></p>
                  <p><strong className="text-slate-400">NIS (رقم الإحصاء):</strong> <span className="font-mono text-slate-200">{selectedCustomer.nis || '—'}</span></p>
                  <p><strong className="text-slate-400">VAT (رقم الرسم):</strong> <span className="font-mono text-emerald-400 font-bold">{selectedCustomer.vat_number || '—'}</span></p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl space-y-2 border border-slate-800 md:col-span-2">
                  <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    {tr('الحساب الائتماني وشروط التعامل B2B', 'Crédit Commercial & Conditions')}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold block">{tr('المجموعة', 'Groupe')}</span>
                      <span className="font-bold text-slate-100">{getGroupName(selectedCustomer.customer_group_id)}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold block">{tr('كتالوج الأسعار', 'Tarif')}</span>
                      <span className="font-bold text-slate-100">{selectedCustomer.price_list_id ? getPriceListName(selectedCustomer.price_list_id) : 'افتراضي'}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold block">{tr('الحد الائتماني', 'Plafond')}</span>
                      <span className="font-bold font-mono text-slate-100">{formatPrice(selectedCustomer.credit_limit || 0)}</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold block">{tr('الرصيد المتاح', 'Solde Dispo')}</span>
                      <span className="font-bold font-mono text-emerald-400">{formatPrice(selectedCustomer.credit_balance || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Orders & Invoices */}
            {detailsTab === 'orders' && (
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-slate-200 mb-2">{tr('طلبات الشراء (Purchase Orders)', 'Bons d\'Achat (POs)')}</h4>
                  <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                    <table className="w-full text-start">
                      <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-2 text-start">N° PO</th>
                          <th className="p-2 text-start">{tr('المبلغ', 'Montant')}</th>
                          <th className="p-2 text-start">{tr('الحالة', 'Statut')}</th>
                          <th className="p-2 text-start">{tr('التاريخ', 'Date')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {purchaseOrders.filter(p => p.customer_id === selectedCustomer.id).length === 0 ? (
                          <tr><td colSpan={4} className="p-4 text-center text-slate-500">{tr('لا توجد طلبات شراء لهذا العميل', 'Aucun bon d\'achat trouvé')}</td></tr>
                        ) : (
                          purchaseOrders.filter(p => p.customer_id === selectedCustomer.id).map(po => (
                            <tr key={po.id}>
                              <td className="p-2 font-mono font-bold text-emerald-400">{po.po_number}</td>
                              <td className="p-2 font-mono font-bold text-slate-200">{formatPrice(po.total_amount)}</td>
                              <td className="p-2">
                                <span className={`px-2 py-0.5 rounded-full font-bold ${po.status === 'approved' ? 'bg-emerald-950/80 text-emerald-400' : 'bg-amber-950/80 text-amber-400'}`}>
                                  {po.status}
                                </span>
                              </td>
                              <td className="p-2 text-slate-400">{po.created_at?.slice(0, 10)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-200 mb-2">{tr('فواتير الائتمان', 'Factures de Crédit')}</h4>
                  <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                    <table className="w-full text-start">
                      <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-2 text-start">N° Facture</th>
                          <th className="p-2 text-start">{tr('المبلغ', 'Montant')}</th>
                          <th className="p-2 text-start">{tr('تاريخ الاستحقاق', 'Échéance')}</th>
                          <th className="p-2 text-start">{tr('الحالة', 'Statut')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {invoices.filter(i => i.customer_id === selectedCustomer.id).length === 0 ? (
                          <tr><td colSpan={4} className="p-4 text-center text-slate-500">{tr('لا توجد فواتير لهذا العميل', 'Aucune facture trouvée')}</td></tr>
                        ) : (
                          invoices.filter(i => i.customer_id === selectedCustomer.id).map(inv => (
                            <tr key={inv.id}>
                              <td className="p-2 font-mono font-bold text-emerald-400">{inv.invoice_number}</td>
                              <td className="p-2 font-mono font-bold text-slate-200">{formatPrice(inv.total_amount)}</td>
                              <td className="p-2 font-mono text-slate-400">{inv.due_date}</td>
                              <td className="p-2">
                                <span className={`px-2 py-0.5 rounded-full font-bold ${inv.status === 'paid' ? 'bg-emerald-950/80 text-emerald-400' : 'bg-rose-950/80 text-rose-400'}`}>
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Overrides */}
            {detailsTab === 'overrides' && (
              <div className="space-y-4 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-200">{tr('إضافة سعر مخصص لهذا العميل', 'Ajouter un tarif spécifique')}</h4>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select 
                      value={quickOverrideForm.product_id}
                      onChange={e => setQuickOverrideForm({ ...quickOverrideForm, product_id: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-800 rounded-xl text-xs bg-slate-900 text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">{tr('اختر المنتج...', 'Sélectionner un produit...')}</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{isAr ? p.name_ar : p.name_fr} ({p.sku})</option>
                      ))}
                    </select>

                    <input 
                      type="number" 
                      placeholder={tr('السعر المخصص (DZD)', 'Prix (DZD)')} 
                      value={quickOverrideForm.custom_price || ''}
                      onChange={e => setQuickOverrideForm({ ...quickOverrideForm, custom_price: Number(e.target.value) })}
                      className="w-36 px-3 py-2 border border-slate-800 rounded-xl text-xs bg-slate-900 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />

                    <button 
                      onClick={handleSaveQuickOverride}
                      disabled={saving}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl transition shadow-lg shadow-emerald-950/50"
                    >
                      {tr('إضافة', 'Ajouter')}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                  <table className="w-full text-start">
                    <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="p-2 text-start">{tr('المنتج', 'Produit')}</th>
                        <th className="p-2 text-start">{tr('السعر الأصلي', 'Prix Original')}</th>
                        <th className="p-2 text-start">{tr('السعر المخصص', 'Prix Spécifique')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {overrides.filter(o => o.customer_id === selectedCustomer.id).length === 0 ? (
                        <tr><td colSpan={3} className="p-4 text-center text-slate-500">{tr('لا توجد أسعار استثنائية لهذا العميل', 'Aucune exception de prix')}</td></tr>
                      ) : (
                        overrides.filter(o => o.customer_id === selectedCustomer.id).map(ov => {
                          const prod = products.find(p => p.id === ov.product_id);
                          return (
                            <tr key={ov.id}>
                              <td className="p-2 font-semibold text-slate-200">{prod ? (isAr ? prod.name_ar : prod.name_fr) : ov.product_id}</td>
                              <td className="p-2 font-mono text-slate-500 line-through">{formatPrice(prod?.price || 0)}</td>
                              <td className="p-2 font-mono font-bold text-emerald-400">{formatPrice(ov.custom_price)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 4: Admin Notes */}
            {detailsTab === 'notes' && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">{tr('ملاحظات عامة حول العميل', 'Notes Générales')}</label>
                  <textarea 
                    rows={3} 
                    defaultValue={selectedCustomer.notes || ''}
                    id="details_notes_input"
                    className="w-full p-3 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-500"
                    placeholder={tr('أية ملاحظات خاصة بالعميل...', 'Notes publiques sur le client...')}
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">{tr('ملاحظات إدارية سرية (Internal Admin Notes)', 'Notes Admin Confidentielles')}</label>
                  <textarea 
                    rows={3} 
                    defaultValue={selectedCustomer.admin_notes || ''}
                    id="details_admin_notes_input"
                    className="w-full p-3 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl focus:outline-none focus:border-emerald-500"
                    placeholder={tr('ملاحظات إدارية سرية لا تظهر للعميل...', 'Notes réservées à l\'administration...')}
                  />
                </div>

                <button 
                  onClick={() => {
                    const notesEl = document.getElementById('details_notes_input') as HTMLTextAreaElement;
                    const adminNotesEl = document.getElementById('details_admin_notes_input') as HTMLTextAreaElement;
                    handleSaveDetailsNotes(notesEl?.value || '', adminNotesEl?.value || '');
                  }}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl transition shadow-lg shadow-emerald-950/50"
                >
                  {tr('حفظ الملاحظات', 'Enregistrer les Notes')}
                </button>
              </div>
            )}

            {/* Tab 5: Activity Logs */}
            {detailsTab === 'logs' && (
              <div className="space-y-3 text-xs max-h-80 overflow-y-auto pr-1">
                {(!selectedCustomer.activity_log || selectedCustomer.activity_log.length === 0) ? (
                  <div className="p-8 text-center text-slate-500 border border-slate-800 border-dashed rounded-xl">
                    {tr('لا توجد نشاطات مسجلة بعد لهذا العميل', 'Aucun historique d\'activité disponible.')}
                  </div>
                ) : (
                  selectedCustomer.activity_log.map(log => (
                    <div key={log.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-200">{log.action}</div>
                        <div className="text-slate-400 mt-0.5">{log.details}</div>
                      </div>
                      <div className="text-end text-[10px] text-slate-500 whitespace-nowrap">
                        <div className="font-bold text-emerald-400">{log.user || 'Admin'}</div>
                        <div>{log.timestamp?.slice(0, 16).replace('T', ' ')}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button 
                onClick={() => setCustomerDetailsModal(false)} 
                className="px-5 py-2 text-xs font-bold border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition"
              >
                {tr('إغلاق', 'Fermer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHOLESALE DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeletingItem}
        itemName={deleteModal.title}
        title={deleteModal.type === 'reject_po' ? tr('تأكيد رفض طلب الشراء', 'Confirmer le rejet du bon d\'achat') : undefined}
        description={deleteModal.type === 'reject_po' ? tr('هل أنت متأكد من رفض طلب الشراء هذا؟', 'Voulez-vous vraiment rejeter ce bon d\'achat ?') : undefined}
        confirmText={deleteModal.type === 'reject_po' ? tr('تأكيد الرفض', 'Rejeter') : undefined}
        error={deleteModal.error}
      />
    </div>
  );
}
