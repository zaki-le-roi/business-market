import { useState, useEffect, useMemo } from 'react';
import {
  Users, Search, Plus, Edit2, Trash2, Phone, Mail, MapPin,
  ShoppingBag, DollarSign, RefreshCw, X, Shield, Star, AlertTriangle,
  UserCheck, Download, Upload, FileSpreadsheet, CheckSquare, Square,
  Eye, ChevronLeft, ChevronRight, RotateCcw,
  CheckCircle2, Ban, Home, MessageSquare
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Customer, CustomerSegment, Order, SavedAddress } from '../../types';
import { ALL_WILAYAS } from '../../constants/wilayas';

// Algerian 58 Wilayas list
const ALGERIAN_WILAYAS = ALL_WILAYAS.map(w => ({
  id: w.id,
  code: w.code,
  name: `${w.name_fr} - ${w.name_ar}`,
  name_ar: w.name_ar,
  name_fr: w.name_fr
}));

const DEFAULT_RETAIL_CUSTOMERS: Customer[] = [];

export default function AdminCustomers() {
  const { lang, formatPrice } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  // Core Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'deleted'>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'new' | 'with_orders' | 'no_orders'>('all');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [wilayaFilter, setWilayaFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'created_desc' | 'created_asc' | 'spent_desc' | 'orders_desc' | 'name_asc'>('created_desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modals / Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Customer Profile View
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [profileTab, setProfileTab] = useState<'overview' | 'orders' | 'addresses' | 'notes'>('overview');

  // Delete Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  // CSV Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [parsedImportRows, setParsedImportRows] = useState<Partial<Customer>[]>([]);

  // Address Modal
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressForm, setAddressForm] = useState({
    id: '',
    label: 'المنزل',
    address: '',
    city: '',
    state: '16',
    postal_code: '',
    is_default: false
  });

  // Customer Form State
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    wilaya_id: 16,
    address: '',
    city: '',
    segment: 'new' as CustomerSegment,
    notes: '',
    is_verified: true,
    is_active: true,
  });

  // Load Data on Mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Customers
      const { data: dbCusts, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (custErr) {
        console.warn('Supabase customers query warning:', custErr.message);
      }

      // 2. Fetch Orders to sync order counts & totals
      const { data: dbOrders, error: ordErr } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordErr) {
        console.warn('Supabase orders query warning:', ordErr.message);
      }

      const orderList: Order[] = (dbOrders || []) as Order[];
      setOrders(orderList);

      // Map raw customer rows & extract extended fields from JSON notes
      let loadedCusts: Customer[] = (dbCusts || []).map((row: Customer) => {
        let is_active = row.is_active ?? true;
        let is_deleted = row.is_deleted ?? false;
        let deleted_at = row.deleted_at || null;
        let saved_addresses = row.saved_addresses || [];
        let cleanNotes = row.notes;

        if (row.notes && typeof row.notes === 'string' && row.notes.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(row.notes);
            if (parsed.is_active !== undefined) is_active = parsed.is_active;
            if (parsed.is_deleted !== undefined) is_deleted = parsed.is_deleted;
            if (parsed.deleted_at !== undefined) deleted_at = parsed.deleted_at;
            if (parsed.saved_addresses !== undefined) saved_addresses = parsed.saved_addresses;
            cleanNotes = parsed.admin_notes !== undefined ? parsed.admin_notes : row.notes;
          } catch {
            cleanNotes = row.notes;
          }
        }

        // Calculate accurate totals from actual orders table
        const matchingOrders = orderList.filter(o =>
          (o.customer_id && o.customer_id === row.id) ||
          (o.customer_phone && row.phone && o.customer_phone.replace(/\s+/g, '').endsWith(row.phone.replace(/\s+/g, '').slice(-8)))
        );

        const total_orders = matchingOrders.length > 0 ? matchingOrders.length : (row.total_orders || 0);
        const total_spent = matchingOrders.length > 0
          ? matchingOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
          : (row.total_spent || 0);

        return {
          ...row,
          account_type: 'retail' as const,
          notes: cleanNotes,
          is_active,
          is_deleted,
          deleted_at,
          saved_addresses,
          total_orders,
          total_spent,
        };
      });

      // Filter only retail accounts (exclude wholesale)
      loadedCusts = loadedCusts.filter(c => c.account_type !== 'wholesale');

      // Sync with Local Storage to prevent any record loss
      const savedLocal = localStorage.getItem('local_retail_customers');
      if (savedLocal) {
        try {
          const localParsed: Customer[] = JSON.parse(savedLocal);
          // Merge local records missing in Supabase
          const existingIds = new Set(loadedCusts.map(c => c.id));
          localParsed.forEach(lc => {
            if (!existingIds.has(lc.id) && lc.account_type !== 'wholesale') {
              loadedCusts.push(lc);
            }
          });
        } catch {
          // Ignore JSON parse error
        }
      }

      if (loadedCusts.length === 0) {
        loadedCusts = DEFAULT_RETAIL_CUSTOMERS;
      }

      setCustomers(loadedCusts);
      localStorage.setItem('local_retail_customers', JSON.stringify(loadedCusts));
    } catch (err) {
      console.error('Error fetching retail customers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync back helper
  const persistCustomersState = async (updatedList: Customer[]) => {
    setCustomers(updatedList);
    localStorage.setItem('local_retail_customers', JSON.stringify(updatedList));

    // Also update viewingCustomer if open
    if (viewingCustomer) {
      const match = updatedList.find(c => c.id === viewingCustomer.id);
      if (match) setViewingCustomer(match);
    }
  };

  // Add/Edit Open Handlers
  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      full_name: '',
      phone: '',
      email: '',
      wilaya_id: 16,
      address: '',
      city: '',
      segment: 'new',
      notes: '',
      is_verified: true,
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      full_name: c.full_name || '',
      phone: c.phone || '',
      email: c.email || '',
      wilaya_id: c.wilaya_id || 16,
      address: c.address || '',
      city: c.city || '',
      segment: c.segment || 'regular',
      notes: c.notes || '',
      is_verified: c.is_verified ?? true,
      is_active: c.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  // Save Customer (CREATE or UPDATE)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name.trim()) {
      showToast(tr('يرجى كتابة اسم العميل', 'Veuillez saisir le nom du client'), 'error');
      return;
    }
    if (!formData.phone.trim()) {
      showToast(tr('يرجى كتابة رقم الهاتف', 'Veuillez saisir le numéro de téléphone'), 'error');
      return;
    }

    setSaving(true);

    try {
      const customerId = editingCustomer ? editingCustomer.id : crypto.randomUUID();

      // Encode custom fields safely inside notes JSON
      const extMeta = {
        admin_notes: formData.notes.trim() || '',
        is_active: formData.is_active,
        is_deleted: editingCustomer?.is_deleted ?? false,
        deleted_at: editingCustomer?.deleted_at || null,
        saved_addresses: editingCustomer?.saved_addresses || [],
      };

      const payload = {
        id: customerId,
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        wilaya_id: Number(formData.wilaya_id) || 16,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        segment: formData.segment,
        notes: JSON.stringify(extMeta),
        is_verified: formData.is_verified,
        account_type: 'retail' as const,
        updated_at: new Date().toISOString(),
      };

      if (editingCustomer) {
        // UPDATE DB
        const { error: dbErr } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', editingCustomer.id);

        if (dbErr) {
          console.warn('Supabase customer update warning:', dbErr.message);
        }

        const updated = customers.map(c =>
          c.id === editingCustomer.id
            ? {
                ...c,
                ...payload,
                notes: formData.notes.trim() || null,
                is_active: formData.is_active,
              }
            : c
        );
        await persistCustomersState(updated);
        showToast(tr('تم تحديث بيانات العميل بنجاح', 'Client mis à jour avec succès'), 'success');
      } else {
        // CREATE DB
        const newCustObj: Customer = {
          ...payload,
          notes: formData.notes.trim() || null,
          is_active: formData.is_active,
          is_deleted: false,
          deleted_at: null,
          is_guest: false,
          total_orders: 0,
          total_spent: 0,
          saved_addresses: [],
          created_at: new Date().toISOString(),
        };

        const { error: dbErr } = await supabase
          .from('customers')
          .insert([payload]);

        if (dbErr) {
          console.warn('Supabase customer insert warning:', dbErr.message);
        }

        const newList = [newCustObj, ...customers];
        await persistCustomersState(newList);
        showToast(tr('تم ديمومة إضافة العميل بنجاح', 'Client créé et enregistré avec succès'), 'success');
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving customer:', err);
      showToast(tr('حدث خطأ أثناء الحفظ', 'Erreur lors de l\'enregistrement'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Open Delete Dialog
  const triggerDeleteConfirm = (c: Customer) => {
    setCustomerToDelete(c);
    setIsBulkDelete(false);
    setIsDeleteModalOpen(true);
  };

  const triggerBulkDeleteConfirm = () => {
    if (selectedIds.size === 0) return;
    setCustomerToDelete(null);
    setIsBulkDelete(true);
    setIsDeleteModalOpen(true);
  };

  // Execute Soft Delete
  const handleSoftDelete = async () => {
    try {
      const now = new Date().toISOString();

      if (isBulkDelete) {
        const ids = Array.from(selectedIds);
        const updated = customers.map(c => {
          if (ids.includes(c.id)) {
            return { ...c, is_deleted: true, deleted_at: now };
          }
          return c;
        });

        // Update DB in background
        for (const id of ids) {
          const cust = customers.find(item => item.id === id);
          if (cust) {
            const ext = {
              admin_notes: cust.notes || '',
              is_active: cust.is_active,
              is_deleted: true,
              deleted_at: now,
              saved_addresses: cust.saved_addresses || [],
            };
            await supabase.from('customers').update({ notes: JSON.stringify(ext) }).eq('id', id);
          }
        }

        await persistCustomersState(updated);
        setSelectedIds(new Set());
        showToast(tr(`تم نقل ${ids.length} عميل إلى السلة بنجاح`, `${ids.length} clients déplacés vers la corbeille`), 'success');
      } else if (customerToDelete) {
        const updated = customers.map(c =>
          c.id === customerToDelete.id ? { ...c, is_deleted: true, deleted_at: now } : c
        );

        const ext = {
          admin_notes: customerToDelete.notes || '',
          is_active: customerToDelete.is_active,
          is_deleted: true,
          deleted_at: now,
          saved_addresses: customerToDelete.saved_addresses || [],
        };
        await supabase.from('customers').update({ notes: JSON.stringify(ext) }).eq('id', customerToDelete.id);

        await persistCustomersState(updated);
        if (viewingCustomer?.id === customerToDelete.id) {
          setIsProfileOpen(false);
        }
        showToast(tr('تم نقل العميل إلى سلة المحذوفات', 'Client déplacé vers la corbeille'), 'success');
      }
    } catch (err) {
      console.error('Soft delete error:', err);
      showToast(tr('خطأ أثناء الحذف المؤقت', 'Erreur lors de la suppression'), 'error');
    } finally {
      setIsDeleteModalOpen(false);
    }
  };

  // Execute Permanent Delete
  const handlePermanentDelete = async () => {
    try {
      if (isBulkDelete) {
        const ids = Array.from(selectedIds);
        await supabase.from('customers').delete().in('id', ids);

        const updated = customers.filter(c => !ids.includes(c.id));
        await persistCustomersState(updated);
        setSelectedIds(new Set());
        showToast(tr(`تم الحذف النهائي لـ ${ids.length} عميل`, `${ids.length} clients supprimés définitivement`), 'success');
      } else if (customerToDelete) {
        await supabase.from('customers').delete().eq('id', customerToDelete.id);

        const updated = customers.filter(c => c.id !== customerToDelete.id);
        await persistCustomersState(updated);
        if (viewingCustomer?.id === customerToDelete.id) {
          setIsProfileOpen(false);
        }
        showToast(tr('تم حذف العميل نهائياً من قاعدة البيانات', 'Client supprimé définitivement'), 'success');
      }
    } catch (err) {
      console.error('Permanent delete error:', err);
      showToast(tr('خطأ أثناء الحذف النهائي', 'Erreur de suppression définitive'), 'error');
    } finally {
      setIsDeleteModalOpen(false);
    }
  };

  // Restore Customer from Trash
  const handleRestoreCustomer = async (c: Customer) => {
    try {
      const updated = customers.map(item =>
        item.id === c.id ? { ...item, is_deleted: false, deleted_at: null } : item
      );

      const ext = {
        admin_notes: c.notes || '',
        is_active: c.is_active,
        is_deleted: false,
        deleted_at: null,
        saved_addresses: c.saved_addresses || [],
      };
      await supabase.from('customers').update({ notes: JSON.stringify(ext) }).eq('id', c.id);

      await persistCustomersState(updated);
      showToast(tr('تم استعادة العميل بنجاح', 'Client restauré avec succès'), 'success');
    } catch (err) {
      console.error('Restore error:', err);
      showToast(tr('خطأ أثناء الاستعادة', 'Erreur de restauration'), 'error');
    }
  };

  // Bulk Status Change (Activate / Deactivate)
  const handleBulkStatusChange = async (active: boolean) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);

    try {
      const updated = customers.map(c => {
        if (ids.includes(c.id)) {
          return { ...c, is_active: active };
        }
        return c;
      });

      for (const id of ids) {
        const cust = customers.find(item => item.id === id);
        if (cust) {
          const ext = {
            admin_notes: cust.notes || '',
            is_active: active,
            is_deleted: cust.is_deleted ?? false,
            deleted_at: cust.deleted_at || null,
            saved_addresses: cust.saved_addresses || [],
          };
          await supabase.from('customers').update({ notes: JSON.stringify(ext) }).eq('id', id);
        }
      }

      await persistCustomersState(updated);
      setSelectedIds(new Set());
      showToast(
        active
          ? tr(`تم تفعيل ${ids.length} حساب عميل`, `${ids.length} comptes activés`)
          : tr(`تم تعطيل ${ids.length} حساب عميل`, `${ids.length} comptes désactivés`),
        'success'
      );
    } catch (err) {
      console.error('Bulk status change error:', err);
    }
  };

  // CSV Export Actions
  const handleExportAllFiltered = () => {
    exportCustomersCSV(filteredCustomers, `retail_customers_${Date.now()}.csv`);
    showToast(tr('تم تصدير ملف العملاء بنجاح', 'Exportation CSV réussie'), 'success');
  };

  const handleExportSelected = () => {
    if (selectedIds.size === 0) return;
    const selectedList = customers.filter(c => selectedIds.has(c.id));
    exportCustomersCSV(selectedList, `selected_retail_customers_${Date.now()}.csv`);
    showToast(tr(`تم تصدير ${selectedList.length} عميل محدد`, `${selectedList.length} clients exportés`), 'success');
  };

  // CSV Import Parse & Execute
  const handleProcessCsvImport = () => {
    if (!csvText.trim()) return;
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      showToast(tr('لم يتم العثور على بيانات صالحة في ملف CSV', 'Aucune donnée valide trouvée dans le CSV'), 'error');
      return;
    }
    setParsedImportRows(rows);
  };

  const handleConfirmImport = async () => {
    if (parsedImportRows.length === 0) return;

    setSaving(true);
    try {
      const newCustsToInsert: Customer[] = [];

      for (const row of parsedImportRows) {
        const newId = crypto.randomUUID();
        const extMeta = {
          admin_notes: row.notes || '',
          is_active: true,
          is_deleted: false,
          deleted_at: null,
          saved_addresses: [],
        };

        const dbPayload = {
          id: newId,
          full_name: row.full_name || 'عميل تجزئة',
          phone: row.phone || '0500000000',
          email: row.email || null,
          wilaya_id: row.wilaya_id || 16,
          city: row.city || null,
          address: row.address || null,
          segment: row.segment || 'new',
          notes: JSON.stringify(extMeta),
          is_verified: true,
          account_type: 'retail' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await supabase.from('customers').insert([dbPayload]);

        newCustsToInsert.push({
          ...dbPayload,
          notes: row.notes || null,
          is_active: true,
          is_deleted: false,
          deleted_at: null,
          is_guest: false,
          total_orders: 0,
          total_spent: 0,
          saved_addresses: [],
        });
      }

      const updated = [...newCustsToInsert, ...customers];
      await persistCustomersState(updated);
      setIsImportModalOpen(false);
      setCsvText('');
      setParsedImportRows([]);
      showToast(tr(`تم استيراد ${newCustsToInsert.length} عميل تجزئة بنجاح`, `${newCustsToInsert.length} clients importés avec succès`), 'success');
    } catch (err) {
      console.error('Error importing CSV:', err);
      showToast(tr('حدث خطأ أثناء الاستيراد', 'Erreur d\'importation'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Address Book Actions inside Profile
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingCustomer) return;

    const currentAddresses = viewingCustomer.saved_addresses || [];
    let updatedAddresses: SavedAddress[] = [];

    if (addressForm.id) {
      // Edit
      updatedAddresses = currentAddresses.map(a =>
        a.id === addressForm.id ? { ...addressForm } : (addressForm.is_default ? { ...a, is_default: false } : a)
      );
    } else {
      // Create
      const newAddr: SavedAddress = {
        ...addressForm,
        id: `addr-${Date.now()}`
      };
      if (addressForm.is_default || currentAddresses.length === 0) {
        updatedAddresses = currentAddresses.map(a => ({ ...a, is_default: false }));
        newAddr.is_default = true;
      } else {
        updatedAddresses = [...currentAddresses];
      }
      updatedAddresses.push(newAddr);
    }

    const updatedCustomer = {
      ...viewingCustomer,
      saved_addresses: updatedAddresses
    };

    const extMeta = {
      admin_notes: viewingCustomer.notes || '',
      is_active: viewingCustomer.is_active ?? true,
      is_deleted: viewingCustomer.is_deleted ?? false,
      deleted_at: viewingCustomer.deleted_at || null,
      saved_addresses: updatedAddresses,
    };

    await supabase.from('customers').update({ notes: JSON.stringify(extMeta) }).eq('id', viewingCustomer.id);

    const updatedList = customers.map(c => c.id === viewingCustomer.id ? updatedCustomer : c);
    await persistCustomersState(updatedList);
    setViewingCustomer(updatedCustomer);
    setIsAddressModalOpen(false);
    showToast(tr('تم حفظ العنوان بنجاح', 'Adresse enregistrée avec succès'), 'success');
  };

  const handleDeleteAddress = async (addrId: string) => {
    if (!viewingCustomer) return;
    const updatedAddresses = (viewingCustomer.saved_addresses || []).filter(a => a.id !== addrId);
    const updatedCustomer = { ...viewingCustomer, saved_addresses: updatedAddresses };

    const extMeta = {
      admin_notes: viewingCustomer.notes || '',
      is_active: viewingCustomer.is_active ?? true,
      is_deleted: viewingCustomer.is_deleted ?? false,
      deleted_at: viewingCustomer.deleted_at || null,
      saved_addresses: updatedAddresses,
    };

    await supabase.from('customers').update({ notes: JSON.stringify(extMeta) }).eq('id', viewingCustomer.id);
    const updatedList = customers.map(c => c.id === viewingCustomer.id ? updatedCustomer : c);
    await persistCustomersState(updatedList);
    setViewingCustomer(updatedCustomer);
    showToast(tr('تم حذف العنوان', 'Adresse supprimée'), 'info');
  };

  // Instant Search & Filtering Pipeline
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // 1. Status Filter
      if (statusFilter === 'active' && (c.is_deleted || c.is_active === false)) return false;
      if (statusFilter === 'inactive' && (c.is_deleted || c.is_active !== false)) return false;
      if (statusFilter === 'deleted' && !c.is_deleted) return false;
      if (statusFilter === 'all' && c.is_deleted) return false; // Default excludes trash

      // 2. Activity Filter
      if (activityFilter === 'new' && c.segment !== 'new') return false;
      if (activityFilter === 'with_orders' && (!c.total_orders || c.total_orders === 0)) return false;
      if (activityFilter === 'no_orders' && (c.total_orders && c.total_orders > 0)) return false;

      // 3. Segment Filter
      if (segmentFilter !== 'all' && c.segment !== segmentFilter) return false;

      // 4. Wilaya Filter
      if (wilayaFilter !== 'all' && Number(c.wilaya_id) !== Number(wilayaFilter)) return false;

      // 5. Search Filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = c.full_name?.toLowerCase().includes(q);
        const matchesPhone = c.phone?.includes(q);
        const matchesEmail = c.email?.toLowerCase().includes(q);
        const matchesCity = c.city?.toLowerCase().includes(q);
        const matchesAddress = c.address?.toLowerCase().includes(q);
        const matchesNotes = c.notes?.toLowerCase().includes(q);
        const matchesWilaya = c.wilaya_id?.toString() === q;

        if (!matchesName && !matchesPhone && !matchesEmail && !matchesCity && !matchesAddress && !matchesNotes && !matchesWilaya) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'created_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'created_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'spent_desc') return (b.total_spent || 0) - (a.total_spent || 0);
      if (sortBy === 'orders_desc') return (b.total_orders || 0) - (a.total_orders || 0);
      if (sortBy === 'name_asc') return (a.full_name || '').localeCompare(b.full_name || '');
      return 0;
    });
  }, [customers, search, statusFilter, activityFilter, segmentFilter, wilayaFilter, sortBy]);

  // Paginated View
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(startIndex, startIndex + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;

  // Toggle Selection
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedCustomers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedCustomers.map(c => c.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Viewing Customer's Orders
  const customerOrdersList = useMemo(() => {
    if (!viewingCustomer) return [];
    return orders.filter(o =>
      (o.customer_id && o.customer_id === viewingCustomer.id) ||
      (o.customer_phone && viewingCustomer.phone && o.customer_phone.replace(/\s+/g, '').endsWith(viewingCustomer.phone.replace(/\s+/g, '').slice(-8))) ||
      (o.customer_email && viewingCustomer.email && o.customer_email.toLowerCase() === viewingCustomer.email.toLowerCase())
    );
  }, [orders, viewingCustomer]);

  // Helper for Segment Badges
  const renderSegmentBadge = (seg: CustomerSegment) => {
    switch (seg) {
      case 'vip':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-950/60 text-amber-400 border border-amber-800/80 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <Star className="w-3 h-3 fill-amber-400" /> VIP
          </span>
        );
      case 'regular':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-950/60 text-blue-400 border border-blue-800/80 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <UserCheck className="w-3 h-3" /> {tr('دائم', 'Régulier')}
          </span>
        );
      case 'risky':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-950/60 text-rose-400 border border-rose-800/80 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <AlertTriangle className="w-3 h-3" /> {tr('عالي المخاطر', 'Risqué')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            {tr('جديد', 'Nouveau')}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-950/80 border border-emerald-800/80 rounded-xl text-emerald-400 shadow-lg shadow-emerald-950/50">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                {tr('إدارة عملاء التجزئة (Retail)', 'Gestion des Clients Retail')}
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/80 text-xs px-2.5 py-1 rounded-full font-mono font-semibold">
                  {filteredCustomers.length}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                {tr('نظام متكامل لإدارة سجلات المشترين، الطلبات، العناوين والتصدير', 'Gestion complète des clients particuliers, historiques de commandes et profils')}
              </p>
            </div>
          </div>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors shadow"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            {tr('استيراد CSV', 'Importer CSV')}
          </button>

          <button
            onClick={handleExportAllFiltered}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors shadow"
          >
            <Download className="w-4 h-4 text-blue-400" />
            {tr('تصدير CSV', 'Exporter CSV')}
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/60 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {tr('إضافة عميل جديد', 'Nouveau Client')}
          </button>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">{tr('إجمالي عملاء التجزئة', 'Total Clients Retail')}</div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{customers.filter(c => !c.is_deleted).length}</div>
          </div>
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">{tr('عملاء لديهم طلبات', 'Clients avec commandes')}</div>
            <div className="text-2xl font-bold text-slate-100 mt-1">
              {customers.filter(c => !c.is_deleted && (c.total_orders || 0) > 0).length}
            </div>
          </div>
          <div className="p-3 bg-blue-950/60 border border-blue-800/60 rounded-xl text-blue-400">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">{tr('العملاء المميزون VIP', 'Clients VIP')}</div>
            <div className="text-2xl font-bold text-slate-100 mt-1">
              {customers.filter(c => !c.is_deleted && c.segment === 'vip').length}
            </div>
          </div>
          <div className="p-3 bg-amber-950/60 border border-amber-800/60 rounded-xl text-amber-400">
            <Star className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">{tr('مجموع مشتريات التجزئة', 'Ventes Totales Retail')}</div>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
              {formatPrice(customers.filter(c => !c.is_deleted).reduce((acc, c) => acc + (c.total_spent || 0), 0))}
            </div>
          </div>
          <div className="p-3 bg-indigo-950/60 border border-indigo-800/60 rounded-xl text-indigo-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FILTER BAR & SEARCH */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
        {/* Instant Search Bar */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder={tr('بحث فوري بالاسم، رقم الهاتف، البريد، المدينة، العنوان، أو الملاحظات...', 'Recherche instantanée par nom, téléphone, email, ville...')}
              className="w-full bg-slate-900 border border-slate-800 text-slate-100 text-sm rounded-xl ps-11 pe-10 py-2.5 focus:outline-none focus:border-emerald-500 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'created_desc' | 'created_asc' | 'spent_desc' | 'orders_desc' | 'name_asc')}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 w-full md:w-auto"
            >
              <option value="created_desc">{tr('الأحدث تسجيلاً', 'Plus récents')}</option>
              <option value="created_asc">{tr('الأقدم تسجيلاً', 'Plus anciens')}</option>
              <option value="spent_desc">{tr('الأعلى إنفاقاً (DZD)', 'Plus dépensé')}</option>
              <option value="orders_desc">{tr('الأكثر طلبات', 'Plus de commandes')}</option>
              <option value="name_asc">{tr('ترتيب أبجدي (A-Z)', 'Nom (A-Z)')}</option>
            </select>

            <button
              onClick={fetchData}
              title={tr('تحديث البيانات', 'Rafraîchir')}
              className="p-2.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-xl transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">{tr('حالة الحساب', 'Statut du compte')}</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as 'all' | 'active' | 'inactive' | 'deleted'); setCurrentPage(1); }}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl p-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">{tr('جميع الحالات (نشط وغير نشط)', 'Tous les statuts')}</option>
              <option value="active">{tr('الحسابات النشطة فقط', 'Comptes actifs')}</option>
              <option value="inactive">{tr('الحسابات المعطلة فقط', 'Comptes inactifs')}</option>
              <option value="deleted">{tr('سلة المحذوفات (Trash)', 'Corbeille')}</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">{tr('نشاط الطلبات', 'Activité commandes')}</label>
            <select
              value={activityFilter}
              onChange={(e) => { setActivityFilter(e.target.value as 'all' | 'new' | 'with_orders' | 'no_orders'); setCurrentPage(1); }}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl p-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">{tr('الجميع', 'Tous')}</option>
              <option value="new">{tr('عملاء جدد', 'Nouveaux clients')}</option>
              <option value="with_orders">{tr('عملاء لديهم طلبات', 'Avec commandes')}</option>
              <option value="no_orders">{tr('عملاء بدون طلبات', 'Sans commandes')}</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">{tr('تصنيف الشريحة', 'Catégorie Client')}</label>
            <select
              value={segmentFilter}
              onChange={(e) => { setSegmentFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl p-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">{tr('جميع الشرائح', 'Toutes les catégories')}</option>
              <option value="new">{tr('جديد (New)', 'Nouveau')}</option>
              <option value="regular">{tr('دائم (Regular)', 'Régulier')}</option>
              <option value="vip">{tr('مميز (VIP)', 'VIP')}</option>
              <option value="risky">{tr('عالي المخاطر (Risky)', 'Risqué')}</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">{tr('الولاية', 'Wilaya')}</label>
            <select
              value={wilayaFilter}
              onChange={(e) => { setWilayaFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-xl p-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">{tr('جميع الولايات (58 ولاية)', 'Toutes les wilayas')}</option>
              {ALGERIAN_WILAYAS.map(w => (
                <option key={w.id} value={w.id}>{w.id} - {w.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* FLOATING BULK ACTIONS BAR */}
      {selectedIds.size > 0 && (
        <div className="bg-emerald-950 border border-emerald-800 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-fadeIn">
          <div className="flex items-center gap-2 text-xs text-emerald-200 font-medium">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>
              {tr(`تم تحديد ${selectedIds.size} عميل تجزئة`, `${selectedIds.size} clients sélectionnés`)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleBulkStatusChange(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {tr('تفعيل المحدد', 'Activer')}
            </button>

            <button
              onClick={() => handleBulkStatusChange(false)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-800/60 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              <Ban className="w-3.5 h-3.5" />
              {tr('تعطيل المحدد', 'Désactiver')}
            </button>

            <button
              onClick={handleExportSelected}
              className="flex items-center gap-1.5 bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800/60 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              {tr('تصدير المحدد', 'Exporter')}
            </button>

            <button
              onClick={triggerBulkDeleteConfirm}
              className="flex items-center gap-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/60 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {tr('حذف المحدد', 'Supprimer')}
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-400 hover:text-slate-100 underline px-2"
            >
              {tr('إلغاء التحديد', 'Annuler')}
            </button>
          </div>
        </div>
      )}

      {/* CUSTOMERS TABLE */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3 bg-slate-950 rounded-2xl border border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-sm font-medium">{tr('جاري تحميل عملاء التجزئة وقاعدة البيانات...', 'Chargement des clients retail...')}</p>
        </div>
      ) : (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-300 text-start">
              <thead className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="p-3.5 text-center w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-slate-100 focus:outline-none"
                    >
                      {selectedIds.size > 0 && selectedIds.size === paginatedCustomers.length ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 text-start">{tr('العميل', 'Client')}</th>
                  <th className="py-3.5 px-4 text-start">{tr('الهاتف والبريد', 'Contact')}</th>
                  <th className="py-3.5 px-4 text-start">{tr('الموقع والولاية', 'Wilaya / Ville')}</th>
                  <th className="py-3.5 px-4 text-start">{tr('الشريحة والحالة', 'Catégorie & Statut')}</th>
                  <th className="py-3.5 px-4 text-start">{tr('الطلبات', 'Commandes')}</th>
                  <th className="py-3.5 px-4 text-start">{tr('إجمالي الإنفاق', 'Dépensé')}</th>
                  <th className="py-3.5 px-4 text-center">{tr('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedCustomers.map((c) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-slate-900/50 transition-colors ${
                      selectedIds.has(c.id) ? 'bg-emerald-950/20' : ''
                    } ${c.is_deleted ? 'opacity-60 bg-rose-950/10' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => toggleSelectRow(c.id)}
                        className="text-slate-400 hover:text-slate-100 focus:outline-none"
                      >
                        {selectedIds.has(c.id) ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    {/* Customer Name & Badge */}
                    <td className="py-3.5 px-4 font-medium text-slate-100">
                      <div
                        onClick={() => { setViewingCustomer(c); setIsProfileOpen(true); }}
                        className="font-bold text-slate-100 hover:text-emerald-400 cursor-pointer flex items-center gap-1.5 group"
                      >
                        <span>{c.full_name || tr('بدون اسم', 'Sans nom')}</span>
                        <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-emerald-400 transition" />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {c.is_verified && (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                            <Shield className="w-3 h-3" /> {tr('موثق', 'Vérifié')}
                          </span>
                        )}
                        {c.is_deleted && (
                          <span className="text-[10px] text-rose-400 font-bold bg-rose-950 px-1.5 py-0.5 rounded">
                            {tr('في السلة', 'Corbeille')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Phone & Email */}
                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="font-mono text-xs text-slate-200 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a href={`tel:${c.phone}`} className="hover:underline hover:text-emerald-400">
                          {c.phone || '—'}
                        </a>
                      </div>
                      {c.email && (
                        <div className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[150px]">{c.email}</span>
                        </div>
                      )}
                    </td>

                    {/* Address & Wilaya */}
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      <div className="flex items-center gap-1 text-slate-300 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          {c.city ? `${c.city} (${c.wilaya_id || ''})` : `الولاية ${c.wilaya_id || '—'}`}
                        </span>
                      </div>
                      {c.address && <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{c.address}</div>}
                    </td>

                    {/* Segment & Active Status */}
                    <td className="py-3.5 px-4 space-y-1">
                      <div>{renderSegmentBadge(c.segment || 'new')}</div>
                      <div>
                        {c.is_active !== false ? (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            {tr('حساب نشط', 'Actif')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                            {tr('معطل', 'Inactif')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Orders Count */}
                    <td className="py-3.5 px-4 font-mono text-slate-200">
                      <div className="flex items-center gap-1">
                        <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold">{c.total_orders || 0}</span>
                      </div>
                    </td>

                    {/* Total Spent */}
                    <td className="py-3.5 px-4 font-mono text-emerald-400 font-bold">
                      {formatPrice(c.total_spent || 0)}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => { setViewingCustomer(c); setIsProfileOpen(true); }}
                          title={tr('عرض الملف الشامل', 'Voir le profil')}
                          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleOpenEdit(c)}
                          title={tr('تعديل البيانات', 'Modifier')}
                          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-blue-400 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {c.is_deleted ? (
                          <button
                            onClick={() => handleRestoreCustomer(c)}
                            title={tr('استعادة العميل من السلة', 'Restaurer')}
                            className="p-1.5 hover:bg-emerald-950 text-emerald-400 rounded-lg transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => triggerDeleteConfirm(c)}
                            title={tr('حذف', 'Supprimer')}
                            className="p-1.5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-base font-semibold">{tr('لا يوجد عملاء تجزئة مطابقون لفلاتر البحث', 'Aucun client retail trouvé')}</p>
                      <p className="text-xs text-slate-600 mt-1">{tr('جرب تغيير كلمة البحث أو فلاتر التصفية', 'Ajustez votre recherche ou vos filtres')}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION BAR */}
          <div className="bg-slate-900/80 border-t border-slate-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span>
                {tr(
                  `عرض ${Math.min((currentPage - 1) * pageSize + 1, filteredCustomers.length)} - ${Math.min(currentPage * pageSize, filteredCustomers.length)} من إجمالي ${filteredCustomers.length} عميل`,
                  `Affichage ${Math.min((currentPage - 1) * pageSize + 1, filteredCustomers.length)} - ${Math.min(currentPage * pageSize, filteredCustomers.length)} sur ${filteredCustomers.length} clients`
                )}
              </span>

              <div className="flex items-center gap-1.5 ms-2 border-s border-slate-800 ps-3">
                <span>{tr('الصفحة:', 'Par page:')}</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
              </button>

              <span className="px-3 font-mono text-slate-200 font-semibold">
                {currentPage} / {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. CUSTOMER PROFILE SLIDE-OVER / FULL MODAL (DETAILED PROFILE) */}
      {/* ========================================================= */}
      {isProfileOpen && viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-sm transition-all p-0 sm:p-4">
          <div className="bg-slate-900 border-s border-slate-800 w-full max-w-3xl h-full sm:h-[95vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
            {/* Profile Header */}
            <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-emerald-950/60">
                  {viewingCustomer.full_name?.charAt(0)?.toUpperCase() || 'C'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    {viewingCustomer.full_name || tr('بدون اسم', 'Sans nom')}
                    {renderSegmentBadge(viewingCustomer.segment || 'new')}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="font-mono text-emerald-400 font-semibold">{viewingCustomer.phone}</span>
                    {viewingCustomer.email && <span>• {viewingCustomer.email}</span>}
                    <span>• {ALGERIAN_WILAYAS.find(w => w.id === viewingCustomer.wilaya_id)?.name || `Wilaya ${viewingCustomer.wilaya_id}`}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsProfileOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-2 rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Quick Action Contact Bar */}
            <div className="px-6 py-3 bg-slate-900 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${viewingCustomer.phone}`}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  {tr('اتصال', 'Appeler')}
                </a>

                {viewingCustomer.email && (
                  <a
                    href={`mailto:${viewingCustomer.email}`}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    {tr('بريد', 'Email')}
                  </a>
                )}

                <a
                  href={`https://wa.me/213${viewingCustomer.phone.replace(/^0/, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 px-3 py-1.5 rounded-lg transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setIsProfileOpen(false); handleOpenEdit(viewingCustomer); }}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  {tr('تعديل البيانات', 'Modifier')}
                </button>
              </div>
            </div>

            {/* Profile Navigation Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 px-6 border-b border-slate-800 text-xs font-semibold overflow-x-auto">
              <button
                onClick={() => setProfileTab('overview')}
                className={`py-3 px-4 border-b-2 transition whitespace-nowrap ${
                  profileTab === 'overview'
                    ? 'border-emerald-500 text-emerald-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tr('معلومات الحساب', 'Vue générale')}
              </button>

              <button
                onClick={() => setProfileTab('orders')}
                className={`py-3 px-4 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                  profileTab === 'orders'
                    ? 'border-emerald-500 text-emerald-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{tr('سجل الطلبات', 'Commandes')}</span>
                <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {customerOrdersList.length}
                </span>
              </button>

              <button
                onClick={() => setProfileTab('addresses')}
                className={`py-3 px-4 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                  profileTab === 'addresses'
                    ? 'border-emerald-500 text-emerald-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{tr('دفتر العناوين', 'Adresses')}</span>
                <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {(viewingCustomer.saved_addresses || []).length}
                </span>
              </button>

              <button
                onClick={() => setProfileTab('notes')}
                className={`py-3 px-4 border-b-2 transition whitespace-nowrap ${
                  profileTab === 'notes'
                    ? 'border-emerald-500 text-emerald-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tr('ملاحظات وسجل العميل', 'Notes & Activité')}
              </button>
            </div>

            {/* Profile Tab Contents */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* TAB 1: OVERVIEW */}
              {profileTab === 'overview' && (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400">{tr('إجمالي المشتريات', 'Total Dépensé')}</div>
                      <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                        {formatPrice(viewingCustomer.total_spent || 0)}
                      </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400">{tr('عدد الطلبات', 'Commandes')}</div>
                      <div className="text-lg font-bold text-slate-100 font-mono mt-1">
                        {viewingCustomer.total_orders || 0}
                      </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                      <div className="text-xs text-slate-400">{tr('متوسط القيمة (AOV)', 'Panier Moyen')}</div>
                      <div className="text-lg font-bold text-slate-100 font-mono mt-1">
                        {formatPrice(
                          viewingCustomer.total_orders && viewingCustomer.total_orders > 0
                            ? (viewingCustomer.total_spent || 0) / viewingCustomer.total_orders
                            : 0
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Personal Details Table */}
                  <div className="bg-slate-950 rounded-xl border border-slate-800 p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      {tr('التفاصيل الشخصية والعنوان', 'Informations personnelles')}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block">{tr('الاسم الكامل', 'Nom complet')}</span>
                        <span className="text-slate-100 font-semibold">{viewingCustomer.full_name || '—'}</span>
                      </div>

                      <div>
                        <span className="text-slate-500 block">{tr('رقم الهاتف', 'Téléphone')}</span>
                        <span className="text-slate-100 font-mono font-semibold">{viewingCustomer.phone}</span>
                      </div>

                      <div>
                        <span className="text-slate-500 block">{tr('البريد الإلكتروني', 'Email')}</span>
                        <span className="text-slate-100">{viewingCustomer.email || '—'}</span>
                      </div>

                      <div>
                        <span className="text-slate-500 block">{tr('الولاية والمدينة', 'Wilaya & Ville')}</span>
                        <span className="text-slate-100">
                          {ALGERIAN_WILAYAS.find(w => w.id === viewingCustomer.wilaya_id)?.name || `Wilaya ${viewingCustomer.wilaya_id}`}
                          {viewingCustomer.city ? ` (${viewingCustomer.city})` : ''}
                        </span>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-slate-500 block">{tr('العنوان التفصيلي', 'Adresse détaillée')}</span>
                        <span className="text-slate-200">{viewingCustomer.address || '—'}</span>
                      </div>

                      <div>
                        <span className="text-slate-500 block">{tr('تاريخ التسجيل', 'Date d Inscription')}</span>
                        <span className="text-slate-300 font-mono">
                          {new Date(viewingCustomer.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 block">{tr('توثيق الحساب', 'Vérification')}</span>
                        <span className={viewingCustomer.is_verified ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                          {viewingCustomer.is_verified ? tr('حساب موثق (Verified)', 'Vérifié') : tr('غير موثق', 'Non vérifié')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ORDER HISTORY */}
              {profileTab === 'orders' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-emerald-400" />
                      {tr('سجل جميع الطلبات المرتبطة بهذا العميل', 'Historique des commandes')}
                    </h3>
                  </div>

                  {customerOrdersList.length === 0 ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
                      <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>{tr('لم يقم هذا العميل بإجراء أية طلبات حتى الآن', 'Aucune commande effectuée par ce client')}</p>
                    </div>
                  ) : (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
                      {customerOrdersList.map(ord => (
                        <div key={ord.id} className="p-4 hover:bg-slate-900/50 transition">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-emerald-400 text-xs">
                                {ord.order_number}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {new Date(ord.created_at).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-100 font-mono">
                                {formatPrice(ord.total)}
                              </span>
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-semibold uppercase">
                                {ord.status}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                            <span>{ord.items?.length || 0} {tr('منتجات', 'produits')}</span>
                            <span>• {ord.delivery_type === 'home' ? tr('توصيل للمنزل', 'À domicile') : tr('توصيل للمكتب', 'Stop desk')}</span>
                            <span>• {ord.payment_method === 'cod' ? tr('الدفع عند التسليم', 'COD') : ord.payment_method}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ADDRESS BOOK */}
              {profileTab === 'addresses' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      {tr('دفتر العناوين المعتمدة', 'Carnet d adresses')}
                    </h3>

                    <button
                      onClick={() => {
                        setAddressForm({ id: '', label: 'المنزل', address: '', city: viewingCustomer.city || '', state: String(viewingCustomer.wilaya_id || '16'), postal_code: '', is_default: false });
                        setIsAddressModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {tr('إضافة عنوان جديد', 'Nouvelle adresse')}
                    </button>
                  </div>

                  {(viewingCustomer.saved_addresses || []).length === 0 ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
                      <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>{tr('لا توجد عناوين إضافية مسجلة', 'Aucune adresse enregistrée')}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(viewingCustomer.saved_addresses || []).map(addr => (
                        <div key={addr.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 relative">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-100 flex items-center gap-1">
                              <Home className="w-3.5 h-3.5 text-emerald-400" />
                              {addr.label}
                            </span>

                            {addr.is_default && (
                              <span className="bg-emerald-950 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-800/80">
                                {tr('العنوان الرئيسي', 'Par défaut')}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-300">{addr.address}</p>
                          <div className="text-[11px] text-slate-400">
                            {addr.city} - Wilaya {addr.state}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                            <button
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="text-xs text-rose-400 hover:underline"
                            >
                              {tr('حذف', 'Supprimer')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: NOTES & ACTIVITY */}
              {profileTab === 'notes' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-200">{tr('ملاحظات وسجل العميل', 'Notes internes')}</h3>
                  <textarea
                    rows={6}
                    defaultValue={viewingCustomer.notes || ''}
                    onBlur={async (e) => {
                      const newNotes = e.target.value;
                      const updated = customers.map(c => c.id === viewingCustomer.id ? { ...c, notes: newNotes } : c);
                      const extMeta = {
                        admin_notes: newNotes,
                        is_active: viewingCustomer.is_active,
                        is_deleted: viewingCustomer.is_deleted,
                        deleted_at: viewingCustomer.deleted_at,
                        saved_addresses: viewingCustomer.saved_addresses || [],
                      };
                      await supabase.from('customers').update({ notes: JSON.stringify(extMeta) }).eq('id', viewingCustomer.id);
                      await persistCustomersState(updated);
                      showToast(tr('تم حفظ الملاحظات', 'Notes enregistrées'), 'success');
                    }}
                    placeholder={tr('اكتب أية ملاحظات إدارية خاصة بهذا العميل هنا...', 'Notes...')}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-100 rounded-xl p-3 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    {tr('يتم حفظ الملاحظات تلقائياً عند تغيير النص والخروج من الصندوق.', 'Sauvegarde automatique au changement de texte.')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. CREATE / EDIT CUSTOMER MODAL */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                {editingCustomer
                  ? tr('تعديل بيانات عميل التجزئة', 'Modifier le Client Retail')
                  : tr('إضافة عميل تجزئة جديد', 'Nouveau Client Retail')}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {tr('الاسم الكامل', 'Nom Complet')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  placeholder="مثال: أحمد بن علي"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('رقم الهاتف', 'Téléphone')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="0550000000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('البريد الإلكتروني', 'Email')}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="client@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('الولاية (1-58)', 'Wilaya')}
                  </label>
                  <select
                    value={formData.wilaya_id}
                    onChange={(e) => setFormData({ ...formData, wilaya_id: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {ALGERIAN_WILAYAS.map(w => (
                      <option key={w.id} value={w.id}>{w.id} - {w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('المدينة / البلديات', 'Ville / Commune')}
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="الجزائر الوسطى"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {tr('العنوان التفصيلي', 'Adresse Complète')}
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  placeholder="شارع..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('تصنيف الشريحة', 'Catégorie Client')}
                  </label>
                  <select
                    value={formData.segment}
                    onChange={(e) => setFormData({ ...formData, segment: e.target.value as CustomerSegment })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="new">{tr('عميل جديد (New)', 'Nouveau')}</option>
                    <option value="regular">{tr('عميل دائم (Regular)', 'Régulier')}</option>
                    <option value="vip">{tr('عميل مميز (VIP)', 'VIP')}</option>
                    <option value="risky">{tr('عميل عالي المخاطر (Risky)', 'Risqué')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('حالة الحساب', 'Statut')}
                  </label>
                  <select
                    value={formData.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="active">{tr('نشط (Active)', 'Actif')}</option>
                    <option value="inactive">{tr('معطل (Inactive)', 'Inactif')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {tr('ملاحظات إدارية', 'Notes Interne')}
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  placeholder={tr('أية ملاحظات خاصة بهذا العميل...', 'Notes...')}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_verified"
                  checked={formData.is_verified}
                  onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
                <label htmlFor="is_verified" className="text-xs text-slate-300 cursor-pointer">
                  {tr('توثيق الحساب (Verified Badge)', 'Compte Vérifié')}
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 text-xs font-bold rounded-xl transition disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {tr('حفظ العميل في قاعدة البيانات', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. DELETE CONFIRMATION DIALOG (SOFT vs PERMANENT DELETE) */}
      {/* ========================================================= */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-fadeIn">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-950 border border-rose-800 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {tr('تأكيد حذف عميل التجزئة', 'Confirmer la suppression')}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isBulkDelete
                    ? tr(`حذف ${selectedIds.size} عميل محدد`, `Supprimer ${selectedIds.size} clients`)
                    : customerToDelete?.full_name || customerToDelete?.phone}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {tr(
                'يرجى اختيار نوع الحذف المطلوبة: يمكنك النقل إلى سلة المحذوفات لاستعادته لاحقاً، أو الحذف النهائي من قاعدة البيانات.',
                'Veuillez choisir le mode de suppression: déplacement vers la corbeille ou suppression définitive.'
              )}
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleSoftDelete}
                className="w-full flex items-center justify-between bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-800 p-3 rounded-xl text-xs font-bold transition"
              >
                <span>{tr('نقل إلى سلة المحذوفات (Soft Delete)', 'Déplacer vers Corbeille')}</span>
                <RotateCcw className="w-4 h-4 text-amber-400" />
              </button>

              <button
                onClick={handlePermanentDelete}
                className="w-full flex items-center justify-between bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 p-3 rounded-xl text-xs font-bold transition"
              >
                <span>{tr('حذف نهائي من قاعدة البيانات (Permanent)', 'Supprimer Dédefinitivement')}</span>
                <Trash2 className="w-4 h-4 text-rose-400" />
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
              >
                {tr('إلغاء', 'Annuler')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. CSV IMPORT MODAL */}
      {/* ========================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                {tr('استيراد قائمة العملاء من ملف CSV', 'Importer des clients CSV')}
              </h2>
              <button
                onClick={() => { setIsImportModalOpen(false); setParsedImportRows([]); }}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <p className="font-bold text-slate-200">{tr('تعليمات الاستيراد:', 'Instructions:')}</p>
                <p className="text-slate-400">
                  {tr(
                    'قم بلصق محتوى ملف CSV هنا أو اختر الملف. يجب أن يحتوي الجدول على الأعمدة: Full Name, Phone, Email, Wilaya, City, Address, Segment, Notes.',
                    'Collez le contenu CSV ou sélectionnez le fichier avec les colonnes requises.'
                  )}
                </p>

                <div className="pt-2">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const content = event.target?.result as string;
                          setCsvText(content || '');
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-950 file:text-emerald-400 hover:file:bg-emerald-900 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">{tr('نص CSV / البيانات:', 'Contenu CSV:')}</label>
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Full Name, Phone, Email, Wilaya, City, Address, Segment, Notes&#10;أحمد بن علي, 0555123456, ahmed@gmail.com, 16, الجزائر, ديدوش مراد, vip, عميل مميز"
                  className="w-full bg-slate-950 border border-slate-800 font-mono text-xs text-slate-100 rounded-xl p-3 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {parsedImportRows.length > 0 && (
                <div className="bg-slate-950 p-3 rounded-xl border border-emerald-800/80 space-y-2 max-h-48 overflow-y-auto">
                  <p className="font-bold text-emerald-400">
                    {tr(`تم تحليل ${parsedImportRows.length} صف جاهز للاستيراد:`, `${parsedImportRows.length} lignes valides trouvées:`)}
                  </p>
                  <div className="space-y-1">
                    {parsedImportRows.slice(0, 5).map((r, idx) => (
                      <div key={idx} className="text-[11px] text-slate-300 flex items-center justify-between border-b border-slate-800/60 pb-1">
                        <span>{r.full_name} ({r.phone})</span>
                        <span className="text-slate-500">{r.city || 'Alger'}</span>
                      </div>
                    ))}
                    {parsedImportRows.length > 5 && (
                      <p className="text-[10px] text-slate-500 pt-1">... و {parsedImportRows.length - 5} صفوف أخرى</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <button
                onClick={handleProcessCsvImport}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold transition"
              >
                {tr('معاينة وتحليل البيانات', 'Analyser')}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>

                <button
                  disabled={parsedImportRows.length === 0 || saving}
                  onClick={handleConfirmImport}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 text-xs font-bold rounded-xl transition disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {tr('تأكيد استيراد الكل', 'Importer Tout')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. ADD ADDRESS MODAL */}
      {/* ========================================================= */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                {tr('إضافة عنوان جديد للعميل', 'Ajouter une adresse')}
              </h3>
              <button onClick={() => setIsAddressModalOpen(false)} className="text-slate-400 hover:text-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">{tr('تسمية العنوان', 'Label')}</label>
                <input
                  type="text"
                  required
                  value={addressForm.label}
                  onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                  placeholder="المنزل / المكتب / المقر"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">{tr('العنوان التفصيلي', 'Adresse')}</label>
                <input
                  type="text"
                  required
                  value={addressForm.address}
                  onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                  placeholder="شارع..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">{tr('المدينة', 'Ville')}</label>
                  <input
                    type="text"
                    required
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">{tr('الولاية', 'Wilaya')}</label>
                  <select
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {ALGERIAN_WILAYAS.map(w => (
                      <option key={w.id} value={w.id}>{w.id} - {w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_default_addr"
                  checked={addressForm.is_default}
                  onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
                <label htmlFor="is_default_addr" className="text-slate-300 cursor-pointer">
                  {tr('تعيين كعنوان رئيسي', 'Adresse par défaut')}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-lg"
                >
                  {tr('حفظ العنوان', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Global CSV Export Helper
function exportCustomersCSV(customersList: Customer[], filename = 'retail_customers_export.csv') {
  const headers = [
    'ID',
    'Full Name',
    'Phone',
    'Email',
    'Wilaya ID',
    'City',
    'Address',
    'Segment',
    'Total Orders',
    'Total Spent (DZD)',
    'Active Status',
    'Verified',
    'Created At',
    'Notes'
  ];

  const rows = customersList.map(c => [
    `"${c.id}"`,
    `"${(c.full_name || '').replace(/"/g, '""')}"`,
    `"${c.phone || ''}"`,
    `"${c.email || ''}"`,
    c.wilaya_id || '',
    `"${(c.city || '').replace(/"/g, '""')}"`,
    `"${(c.address || '').replace(/"/g, '""')}"`,
    c.segment || 'new',
    c.total_orders || 0,
    c.total_spent || 0,
    c.is_active !== false ? 'Active' : 'Inactive',
    c.is_verified ? 'Yes' : 'No',
    `"${c.created_at || ''}"`,
    `"${(c.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Global CSV Parser
function parseCSV(text: string): Partial<Customer>[] {
  const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
  const results: Partial<Customer>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const regex = /(?:,|\n|^)("(?:(?:"")*|[^"]*)*"|[^",\n]*)/g;
    const values: string[] = [];
    let match;
    while ((match = regex.exec(lines[i])) !== null) {
      if (match.index === regex.lastIndex) regex.lastIndex++;
      let val = match[1] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1).replace(/""/g, '"');
      }
      values.push(val.trim());
    }

    if (values.length === 0) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });

    const fullName = rowObj['full name'] || rowObj['fullname'] || rowObj['name'] || rowObj['الاسم'] || values[0] || '';
    const phone = rowObj['phone'] || rowObj['mobile'] || rowObj['الهاتف'] || values[1] || '';
    const email = rowObj['email'] || rowObj['البريد'] || values[2] || '';
    const wilayaStr = rowObj['wilaya id'] || rowObj['wilaya'] || rowObj['الولاية'] || values[3] || '16';
    const city = rowObj['city'] || rowObj['المدينة'] || values[4] || '';
    const address = rowObj['address'] || rowObj['العنوان'] || values[5] || '';
    const segment = (rowObj['segment'] || values[6] || 'new') as CustomerSegment;
    const notes = rowObj['notes'] || rowObj['ملاحظات'] || values[7] || '';

    if (fullName || phone) {
      results.push({
        full_name: fullName,
        phone: phone,
        email: email || null,
        wilaya_id: parseInt(wilayaStr, 10) || 16,
        city: city || null,
        address: address || null,
        segment: ['new', 'regular', 'vip', 'risky'].includes(segment) ? segment : 'new',
        notes: notes || null,
        is_verified: true,
        is_active: true,
        account_type: 'retail',
      });
    }
  }

  return results;
}
