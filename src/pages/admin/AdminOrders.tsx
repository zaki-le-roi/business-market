import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Eye, X, Package, Truck, CheckCircle2, Clock, XCircle,
  Loader2, Trash2, Download, Plus, Edit2, FileText, Printer, RefreshCw,
  ChevronLeft, ChevronRight, Upload, CheckSquare, DollarSign, UserCheck, Tag,
  FileSpreadsheet, Send, CornerDownLeft
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Order, OrderStatus, PaymentStatus, PaymentMethod, Wilaya, Product, Customer, ShipmentHistoryItem } from '../../types';
import { getShippingProviders, createShipmentForOrder, getShipmentByOrderId } from '../../lib/shipping/manager';
import { exportOrdersCSV, parseCSVFile } from '../../lib/csvHelper';
import { printOrderInvoice, printPackingSlip, printShippingLabel } from '../../utils/orderPrint';
import { ALL_WILAYAS as ALGERIAN_WILAYAS } from '../../constants/wilayas';
import { adjustStockInDB, fetchWarehousesFromDB } from '../../lib/inventoryStore';
import { processDomainEvent } from '../../lib/automationEngine';

/* --------------------------- STATUS CONFIG --------------------------- */
const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
  confirmed: 'bg-teal-950/60 text-teal-400 border-teal-800/60',
  processing: 'bg-blue-950/60 text-blue-400 border-blue-800/60',
  ready_to_ship: 'bg-purple-950/60 text-purple-400 border-purple-800/60',
  shipped: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60',
  delivered: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
  cancelled: 'bg-rose-950/60 text-rose-400 border-rose-800/60',
  returned: 'bg-orange-950/60 text-orange-400 border-orange-800/60',
  refunded: 'bg-slate-900 text-slate-400 border-slate-700/60',
};

const STATUS_ICON: Record<OrderStatus, typeof Clock> = {
  pending: Clock,
  confirmed: CheckCircle2,
  processing: Package,
  ready_to_ship: Send,
  shipped: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
  returned: CornerDownLeft,
  refunded: RefreshCw,
};

const STATUS_LABELS: Record<OrderStatus, { ar: string; fr: string }> = {
  pending: { ar: 'قيد الانتظار', fr: 'En attente' },
  confirmed: { ar: 'مؤكد', fr: 'Confirmée' },
  processing: { ar: 'قيد المعالجة', fr: 'En traitement' },
  ready_to_ship: { ar: 'جاهز للشحن', fr: 'Prêt à l\'expédition' },
  shipped: { ar: 'تم الشحن', fr: 'Expédiée' },
  delivered: { ar: 'تم التوصيل', fr: 'Livrée' },
  cancelled: { ar: 'ملغى', fr: 'Annulée' },
  returned: { ar: 'مرتجع', fr: 'Retournée' },
  refunded: { ar: 'مسترجع', fr: 'Remboursée' },
};

const ALL_STATUSES: OrderStatus[] = [
  'pending', 'confirmed', 'processing', 'ready_to_ship',
  'shipped', 'delivered', 'cancelled', 'returned', 'refunded'
];

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: 'bg-slate-900 text-slate-400 border-slate-800',
  pending: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
  paid: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
  partially_paid: 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60',
  failed: 'bg-rose-950/60 text-rose-400 border-rose-800/60',
  refunded: 'bg-purple-950/60 text-purple-400 border-purple-800/60',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, { ar: string; fr: string }> = {
  unpaid: { ar: 'غير مدفوع', fr: 'Non payé' },
  pending: { ar: 'قيد المراجعة', fr: 'En attente' },
  paid: { ar: 'مدفوع بالكامل', fr: 'Payé' },
  partially_paid: { ar: 'مدفوع جزئياً', fr: 'Partiellement payé' },
  failed: { ar: 'فشل الدفع', fr: 'Échec' },
  refunded: { ar: 'مسترجع', fr: 'Remboursé' },
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { ar: string; fr: string }> = {
  cod: { ar: 'الدفع عند الاستلام (COD)', fr: 'Paiement à la livraison' },
  cib: { ar: 'بطاقة CIB / EDAHABIA', fr: 'Carte CIB / EDAHABIA' },
  edahabia: { ar: 'البطاقة الذهبية', fr: 'Edahabia' },
  ccp: { ar: 'حساب CCP / BaridiMob', fr: 'BaridiMob' },
  bank_transfer: { ar: 'تحويل بنكي', fr: 'Virement bancaire' },
  credit: { ar: 'رصيد الحساب (Credit)', fr: 'Crédit client' },
};

const wilayaName = (w: Wilaya | undefined | null, lang: string, wilayaId?: number | null) => {
  if (w && w.name_ar) return lang === 'ar' ? w.name_ar : w.name_fr;
  if (wilayaId) {
    const found = ALGERIAN_WILAYAS.find(item => item.id === wilayaId);
    if (found) return lang === 'ar' ? found.name_ar : found.name_fr;
  }
  return '-';
};

export default function AdminOrders() {
  const { lang, formatPrice, dir, formatDate } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';

  const tr = (arStr: string, frStr: string) => (isAr ? arStr : frStr);

  // Core Data
  const [orders, setOrders] = useState<Order[]>([]);
  const [productsCatalog, setProductsCatalog] = useState<Product[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethod | 'all'>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'retail' | 'wholesale' | 'guest'>('all');
  const [wilayaFilter, setWilayaFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selection & Details
  const [selectedOrderIds, setSelectedOrderIds] = useState<Record<string, boolean>>({});
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Yalidine State
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [shipmentInfo, setShipmentInfo] = useState<ShipmentHistoryItem | null>(null);

  // New / Edit Order Form State
  const [formData, setFormData] = useState({
    id: '',
    order_number: '',
    customer_id: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_type: 'retail' as 'retail' | 'wholesale' | 'guest',
    wilaya_id: 16,
    delivery_type: 'home' as 'home' | 'desk',
    address: '',
    commune: '',
    shipping_company: 'Yalidine Express',
    tracking_number: '',
    payment_method: 'cod' as PaymentMethod,
    payment_status: 'unpaid' as PaymentStatus,
    status: 'pending' as OrderStatus,
    delivery_fee: 400,
    discount_amount: 0,
    notes: '',
    admin_notes: '',
    items: [] as Array<{
      product_id: string;
      name: string;
      slug: string;
      image: string;
      price: number;
      quantity: number;
      subtotal: number;
    }>
  });

  // Fetch initial data
  const loadData = async () => {
    try {
      setLoading(true);
      const [{ data: ordersData, error: ordersErr }, { data: prodsData }, { data: custsData }] = await Promise.all([
        supabase.from('orders').select('*, wilaya:wilayas(*)').order('created_at', { ascending: false }),
        supabase.from('products').select('*'),
        supabase.from('customers').select('*')
      ]);

      if (ordersErr) throw ordersErr;

      setOrders((ordersData || []) as Order[]);
      setProductsCatalog((prodsData || []) as Product[]);
      setCustomersList((custsData || []) as Customer[]);
    } catch (err) {
      console.error('Error loading orders:', err);
      showToast(tr('فشل تحميل بيانات الطلبات', 'Échec du chargement des commandes'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch shipment status when selecting an order
  useEffect(() => {
    let isMounted = true;
    if (selectedOrder) {
      getShipmentByOrderId(selectedOrder.id).then((ship) => {
        if (isMounted) setShipmentInfo((ship as unknown) as ShipmentHistoryItem || null);
      });
    } else {
      setShipmentInfo(null);
    }
    return () => { isMounted = false; };
  }, [selectedOrder]);

  /* --------------------------- Stock Adjustment Helpers --------------------------- */
  const updateProductStockForOrder = async (items: Array<{ product_id: string; quantity: number }>, direction: 'decrease' | 'increase', orderRef?: string) => {
    try {
      const warehouses = await fetchWarehousesFromDB();
      const mainWh = warehouses.find(w => w.is_main) || warehouses[0];
      if (!mainWh) return;

      for (const item of items) {
        if (!item.product_id) continue;
        const qtyChange = direction === 'decrease' ? -item.quantity : item.quantity;
        const mType = direction === 'decrease' ? 'order_deduction' : 'return_restock';

        await adjustStockInDB({
          product_id: item.product_id,
          warehouse_id: mainWh.id,
          qty_change: qtyChange,
          movement_type: mType,
          reference_number: orderRef || 'ADMIN-ORDER-UPDATE',
          notes: direction === 'decrease' ? 'Order stock deduction' : 'Order cancellation stock restore'
        });
      }
      // Refresh local products catalog
      const { data: updatedProds } = await supabase.from('products').select('*');
      if (updatedProds) setProductsCatalog(updatedProds as Product[]);
    } catch (err) {
      console.warn('Stock update warning:', err);
    }
  };

  /* --------------------------- Activity Logging Helper --------------------------- */
  const addOrderActivity = (order: Order, action: string, details: string): Order => {
    const newEntry = {
      id: crypto.randomUUID(),
      action,
      details,
      timestamp: new Date().toISOString(),
      user: 'المسؤول (Admin)'
    };
    const currentLogs = order.activity_log || [];
    return {
      ...order,
      activity_log: [newEntry, ...currentLogs]
    };
  };

  /* --------------------------- Filters & Pagination --------------------------- */
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      // Payment Status
      if (paymentStatusFilter !== 'all' && o.payment_status !== paymentStatusFilter) return false;
      // Payment Method
      if (paymentMethodFilter !== 'all' && o.payment_method !== paymentMethodFilter) return false;
      // Customer Type
      if (customerTypeFilter !== 'all' && o.customer_type !== customerTypeFilter) return false;
      // Wilaya
      if (wilayaFilter !== 'all' && String(o.wilaya_id) !== wilayaFilter) return false;

      // Search Query
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const num = (o.order_number || '').toLowerCase();
        const name = (o.customer_name || '').toLowerCase();
        const phone = (o.customer_phone || '').toLowerCase();
        const address = (o.address || '').toLowerCase();
        const itemsNames = (o.items || []).map(i => i.name.toLowerCase()).join(' ');

        if (!num.includes(q) && !name.includes(q) && !phone.includes(q) && !address.includes(q) && !itemsNames.includes(q)) {
          return false;
        }
      }

      // Date Range
      if (fromDate) {
        if (new Date(o.created_at) < new Date(fromDate)) return false;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(o.created_at) > end) return false;
      }

      return true;
    });
  }, [orders, statusFilter, paymentStatusFilter, paymentMethodFilter, customerTypeFilter, wilayaFilter, search, fromDate, toDate]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const selectedCount = Object.values(selectedOrderIds).filter(Boolean).length;

  /* --------------------------- Order Actions --------------------------- */
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      setSaving(true);
      const nowIso = new Date().toISOString();
      const updatedOrderObj = addOrderActivity(
        order,
        'تحديث الحالة',
        `تغيير حالة الطلب من [${STATUS_LABELS[order.status].ar}] إلى [${STATUS_LABELS[newStatus].ar}]`
      );

      const dbPatch = {
        status: newStatus,
        updated_at: nowIso,
        delivered_at: newStatus === 'delivered' ? nowIso : order.delivered_at,
        cancelled_at: newStatus === 'cancelled' ? nowIso : order.cancelled_at,
      };

      const { error: err } = await supabase.from('orders').update(dbPatch).eq('id', orderId);
      if (err) {
        console.error('Supabase update order status error:', err);
        throw err;
      }

      // Handle automatic stock reduction/restoration
      if ((newStatus === 'confirmed' || newStatus === 'processing') && (order.status === 'pending' || order.status === 'cancelled')) {
        await updateProductStockForOrder(order.items, 'decrease');
      } else if ((newStatus === 'cancelled' || newStatus === 'returned') && order.status !== 'cancelled' && order.status !== 'returned') {
        await updateProductStockForOrder(order.items, 'increase');
      }

      // Log status history
      try {
        await supabase.from('order_status_history').insert({
          order_id: orderId,
          status: newStatus,
          notes: `Admin changed status to ${newStatus}`,
          created_by: 'admin'
        });
      } catch (histErr) {
        console.warn('Order status history insertion skipped/failed:', histErr);
      }

      // Trigger ShipmentStatusUpdated automation event if shipped/delivered
      if (newStatus === 'shipped' || newStatus === 'delivered' || newStatus === 'ready_to_ship') {
        try {
          processDomainEvent('ShipmentStatusUpdated', {
            orderId: order.id,
            status: newStatus,
            customerEmail: order.customer_email,
          }).catch((err) => console.warn('Automation trigger warning:', err));
        } catch (autoErr) {
          console.warn('Automation trigger failed:', autoErr);
        }
      }

      const statePatch = {
        ...dbPatch,
        activity_log: updatedOrderObj.activity_log
      };

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...statePatch } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, ...statePatch } : null);
      }

      showToast(tr(`تم تحديث حالة الطلب #${order.order_number} بنجاح`, `Statut de la commande #${order.order_number} mis à jour`), 'success');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error updating order status:', error);
      showToast(tr(`فشل تحديث حالة الطلب: ${error?.message || ''}`, `Échec de la mise à jour du statut: ${error?.message || ''}`), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePaymentStatus = async (orderId: string, newPayStatus: PaymentStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      setSaving(true);
      const nowIso = new Date().toISOString();
      const updatedOrderObj = addOrderActivity(
        order,
        'تحديث الدفع',
        `تعديل حالة الدفع إلى [${PAYMENT_STATUS_LABELS[newPayStatus].ar}]`
      );

      const dbPatch = {
        payment_status: newPayStatus,
        updated_at: nowIso
      };

      const { error: err } = await supabase.from('orders').update(dbPatch).eq('id', orderId);
      if (err) {
        console.error('Supabase update payment status error:', err);
        throw err;
      }

      const statePatch = {
        ...dbPatch,
        activity_log: updatedOrderObj.activity_log
      };

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...statePatch } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, ...statePatch } : null);
      }

      showToast(tr(`تم تحديث حالة الدفع للطلب #${order.order_number}`, `Statut de paiement mis à jour pour #${order.order_number}`), 'success');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error updating payment status:', error);
      showToast(tr(`فشل تحديث حالة الدفع: ${error?.message || ''}`, `Échec de la mise à jour du paiement: ${error?.message || ''}`), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      setSaving(true);
      try {
        await supabase.from('order_status_history').delete().eq('order_id', orderId);
      } catch (histErr) {
        console.warn('Error deleting order status history:', histErr);
      }
      const { error: err } = await supabase.from('orders').delete().eq('id', orderId);
      if (err) throw err;

      setOrders(prev => prev.filter(o => o.id !== orderId));
      if (selectedOrder?.id === orderId) setSelectedOrder(null);

      showToast(tr(`تم حذف الطلب #${order.order_number} بنجاح`, `Commande #${order.order_number} supprimée`), 'success');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error deleting order:', error);
      showToast(tr(`فشل حذف الطلب: ${error?.message || ''}`, `Échec de la suppression de la commande: ${error?.message || ''}`), 'error');
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------- Bulk Actions --------------------------- */
  const handleBulkAction = async (action: 'confirm' | 'cancel' | 'ship' | 'deliver' | 'delete' | 'export') => {
    const targetIds = Object.keys(selectedOrderIds).filter(id => selectedOrderIds[id]);
    if (targetIds.length === 0) return;

    if (action === 'export') {
      const selectedData = orders.filter(o => targetIds.includes(o.id));
      exportOrdersCSV(selectedData as unknown as Record<string, unknown>[]);
      showToast(tr(`تم تصدير ${selectedData.length} طلب إلى CSV`, `${selectedData.length} commandes exportées`), 'success');
      return;
    }

    try {
      setSaving(true);
      const nowIso = new Date().toISOString();

      if (action === 'delete') {
        try {
          await supabase.from('order_status_history').delete().in('order_id', targetIds);
        } catch (histErr) {
          console.warn('Error deleting order status history in bulk:', histErr);
        }
        const { error: err } = await supabase.from('orders').delete().in('id', targetIds);
        if (err) throw err;

        setOrders(prev => prev.filter(o => !targetIds.includes(o.id)));
        setSelectedOrderIds({});
        showToast(tr(`تم حذف ${targetIds.length} طلب بنجاح`, `${targetIds.length} commandes supprimées`), 'success');
        return;
      }

      let newStatus: OrderStatus = 'pending';
      let actionLabel = '';
      if (action === 'confirm') { newStatus = 'confirmed'; actionLabel = 'اعتماد الجماعي'; }
      else if (action === 'cancel') { newStatus = 'cancelled'; actionLabel = 'إلغاء الجماعي'; }
      else if (action === 'ship') { newStatus = 'shipped'; actionLabel = 'شحن الجماعي'; }
      else if (action === 'deliver') { newStatus = 'delivered'; actionLabel = 'تسليم الجماعي'; }

      for (const id of targetIds) {
        const order = orders.find(o => o.id === id);
        if (!order) continue;

        addOrderActivity(order, actionLabel, `تحديث بالحالة [${STATUS_LABELS[newStatus].ar}] عبر الإجراء الجماعي`);
        const dbPatch = {
          status: newStatus,
          updated_at: nowIso
        };

        const { error: err } = await supabase.from('orders').update(dbPatch).eq('id', id);
        if (err) console.error(`Bulk update error for order ${id}:`, err);

        if ((newStatus === 'confirmed') && order.status === 'pending') {
          await updateProductStockForOrder(order.items, 'decrease');
        } else if (newStatus === 'cancelled' && order.status !== 'cancelled') {
          await updateProductStockForOrder(order.items, 'increase');
        }
      }

      setOrders(prev => prev.map(o => targetIds.includes(o.id) ? { ...o, status: newStatus } : o));
      setSelectedOrderIds({});
      showToast(tr(`تم تحديث ${targetIds.length} طلب بنجاح`, `${targetIds.length} commandes mises à jour`), 'success');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error executing bulk action:', error);
      showToast(tr(`فشل تنفيذ الإجراء الجماعي: ${error?.message || ''}`, `Échec de l'action groupée: ${error?.message || ''}`), 'error');
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------- Manual Create & Edit Order --------------------------- */
  const handleOpenCreateModal = () => {
    const randomOrderNum = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    setFormData({
      id: '',
      order_number: randomOrderNum,
      customer_id: '',
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      customer_type: 'retail',
      wilaya_id: 16,
      delivery_type: 'home',
      address: '',
      commune: '',
      shipping_company: 'Yalidine Express',
      tracking_number: '',
      payment_method: 'cod',
      payment_status: 'unpaid',
      status: 'pending',
      delivery_fee: 400,
      discount_amount: 0,
      notes: '',
      admin_notes: '',
      items: []
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (order: Order) => {
    setFormData({
      id: order.id,
      order_number: order.order_number,
      customer_id: order.customer_id || '',
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      customer_email: order.customer_email || '',
      customer_type: order.customer_type || 'retail',
      wilaya_id: order.wilaya_id || 16,
      delivery_type: order.delivery_type || 'home',
      address: order.address || '',
      commune: order.commune || '',
      shipping_company: order.shipping_company || 'Yalidine Express',
      tracking_number: order.tracking_number || '',
      payment_method: order.payment_method || 'cod',
      payment_status: order.payment_status || 'unpaid',
      status: order.status || 'pending',
      delivery_fee: Number(order.delivery_fee) || 0,
      discount_amount: Number(order.discount_amount) || 0,
      notes: order.notes || '',
      admin_notes: order.admin_notes || '',
      items: (order.items || []).map(i => ({ ...i }))
    });
    setIsEditModalOpen(true);
  };

  const handleSelectCustomerForForm = (custId: string) => {
    const cust = customersList.find(c => c.id === custId);
    if (!cust) return;

    setFormData(prev => ({
      ...prev,
      customer_id: cust.id,
      customer_name: cust.full_name || cust.company_name || '',
      customer_phone: cust.phone || '',
      customer_email: cust.email || '',
      customer_type: cust.account_type === 'wholesale' ? 'wholesale' : 'retail',
      wilaya_id: cust.wilaya_id || prev.wilaya_id,
      address: cust.address || prev.address,
      commune: cust.city || prev.commune
    }));
  };

  const handleAddItemToForm = (productId: string) => {
    const prod = productsCatalog.find(p => p.id === productId);
    if (!prod) return;

    const existingIdx = formData.items.findIndex(i => i.product_id === prod.id);
    if (existingIdx >= 0) {
      const updated = [...formData.items];
      updated[existingIdx].quantity += 1;
      updated[existingIdx].subtotal = updated[existingIdx].quantity * updated[existingIdx].price;
      setFormData(prev => ({ ...prev, items: updated }));
    } else {
      const newItem = {
        product_id: prod.id,
        name: isAr ? prod.name_ar : prod.name_fr,
        slug: prod.sku || prod.slug || 'SKU',
        image: prod.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200',
        price: Number(prod.price),
        quantity: 1,
        subtotal: Number(prod.price)
      };
      setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
    }
  };

  const handleSaveOrderForm = async () => {
    if (!formData.customer_phone.trim()) {
      showToast(tr('يرجى إدخال رقم هاتف العميل', 'Veuillez saisir le numéro de téléphone'), 'error');
      return;
    }
    if (formData.items.length === 0) {
      showToast(tr('يرجى إضافة منتج واحد على الأقل للطلب', 'Veuillez ajouter au moins un produit'), 'error');
      return;
    }

    try {
      setSaving(true);
      const nowIso = new Date().toISOString();
      const subtotal = formData.items.reduce((acc, item) => acc + item.subtotal, 0);
      const total = Math.max(0, subtotal + formData.delivery_fee - formData.discount_amount);

      const wilayaObj = ALGERIAN_WILAYAS.find(w => w.id === formData.wilaya_id);

      if (formData.id) {
        // EDIT EXISTING ORDER
        const existing = orders.find(o => o.id === formData.id);
        const updatedActivityObj = addOrderActivity(
          existing || ({} as Order),
          'تعديل تفاصيل الطلب',
          `تعديل المنتجات، العنوان أو الملاحظات بواسطة الأدمن`
        );

        // Clean database patch with only valid DB columns
        const dbPatch = {
          customer_id: formData.customer_id || null,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_email: formData.customer_email || null,
          wilaya_id: formData.wilaya_id,
          delivery_type: formData.delivery_type,
          address: formData.address,
          city: formData.commune || formData.address || null,
          tracking_number: formData.tracking_number || null,
          payment_method: formData.payment_method,
          payment_status: formData.payment_status,
          status: formData.status,
          items: formData.items,
          subtotal,
          delivery_fee: formData.delivery_fee,
          discount_amount: formData.discount_amount,
          total,
          notes: formData.notes || null,
          updated_at: nowIso
        };

        const { error: err } = await supabase.from('orders').update(dbPatch).eq('id', formData.id);
        if (err) {
          console.error('Supabase update order error:', err);
          throw err;
        }

        const statePatch = {
          ...dbPatch,
          commune: formData.commune,
          customer_type: formData.customer_type,
          shipping_company: formData.shipping_company,
          admin_notes: formData.admin_notes,
          activity_log: updatedActivityObj.activity_log,
          wilaya: wilayaObj
        };

        setOrders(prev => prev.map(o => o.id === formData.id ? { ...o, ...statePatch } : o));
        if (selectedOrder?.id === formData.id) {
          setSelectedOrder(prev => prev ? { ...prev, ...statePatch } : null);
        }

        showToast(tr('تم حفظ تعديلات الطلب بنجاح', 'Commande mise à jour avec succès'), 'success');
        setIsEditModalOpen(false);
      } else {
        // CREATE NEW ORDER
        const newOrderId = crypto.randomUUID();

        // Clean database payload with only valid DB columns
        const dbPayload = {
          id: newOrderId,
          order_number: formData.order_number,
          customer_id: formData.customer_id || null,
          customer_name: formData.customer_name || 'عميل جديد',
          customer_phone: formData.customer_phone,
          customer_email: formData.customer_email || null,
          wilaya_id: formData.wilaya_id,
          delivery_type: formData.delivery_type,
          address: formData.address,
          city: formData.commune || formData.address || null,
          tracking_number: formData.tracking_number || null,
          payment_method: formData.payment_method,
          payment_status: formData.payment_status,
          status: formData.status,
          items: formData.items,
          subtotal,
          delivery_fee: formData.delivery_fee,
          discount_amount: formData.discount_amount,
          total,
          fraud_risk_score: 10,
          is_phone_verified: true,
          notes: formData.notes || null,
          created_at: nowIso,
          updated_at: nowIso
        };

        const { data: insertedData, error: err } = await supabase.from('orders').insert(dbPayload).select().single();
        if (err) {
          console.error('Supabase insert order error:', err);
          throw err;
        }

        const completeNewOrder: Order = {
          ...(insertedData || dbPayload),
          commune: formData.commune,
          customer_type: formData.customer_type,
          shipping_company: formData.shipping_company,
          admin_notes: formData.admin_notes,
          wilaya: wilayaObj,
          activity_log: [
            {
              id: crypto.randomUUID(),
              action: 'إنشاء الطلب',
              details: `تم إنشاء الطلب يدوياً بواسطة الأدمن بمبلغ إجمالي ${total} دج`,
              timestamp: nowIso,
              user: 'المسؤول (Admin)'
            }
          ]
        } as Order;

        // Reduce stock if confirmed or processing
        if (formData.status === 'confirmed' || formData.status === 'processing') {
          await updateProductStockForOrder(formData.items, 'decrease');
        }

        setOrders(prev => [completeNewOrder, ...prev]);
        showToast(tr(`تم إنشاء الطلب #${formData.order_number} بنجاح`, `Commande #${formData.order_number} créée`), 'success');
        setIsCreateModalOpen(false);
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error saving order form:', error);
      showToast(tr(`فشل حفظ بيانات الطلب: ${error?.message || ''}`, `Échec de l'enregistrement: ${error?.message || ''}`), 'error');
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------- Yalidine Creation --------------------------- */
  const handleCreateYalidineShipment = async () => {
    if (!selectedOrder) return;
    setCreatingShipment(true);
    try {
      const providers = await getShippingProviders();
      const provider = providers.find((p) => p.code === 'yalidine' || p.id === 'prov-yal-express');
      if (!provider) {
        throw new Error('Yalidine غير مهيأ. يرجى تهيئة مزود الشحن في إعدادات الشحن أولاً.');
      }

      const shipment = await createShipmentForOrder({
        order_id: selectedOrder.id,
        provider_id: provider.id,
        delivery_type: (selectedOrder.delivery_type as 'home' | 'stop_desk') || 'home',
        shipping_fee: selectedOrder.delivery_fee || 0,
        cod_amount: selectedOrder.total || 0,
        recipient_name: selectedOrder.customer_name || 'Customer',
        recipient_phone: selectedOrder.customer_phone || '',
        recipient_wilaya_id: Number(selectedOrder.wilaya_id || 16),
        recipient_address: selectedOrder.address || '',
        recipient_commune: selectedOrder.city || '',
      });

      if (shipment && shipment.tracking_number) {
        setShipmentInfo((shipment as unknown) as ShipmentHistoryItem);

        const statePatch = { tracking_number: shipment.tracking_number, shipping_company: provider.name_fr || 'Yalidine Express' };
        setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, ...statePatch } : o));
        setSelectedOrder(prev => prev ? { ...prev, ...statePatch } : null);

        showToast(tr('تم إنشاء شحنة Yalidine ورقم التتبع بنجاح!', 'Colis Yalidine créé avec succès !'), 'success');
      } else {
        throw new Error('فشل إنشاء الشحنة على شركة Yalidine');
      }
    } catch (err: unknown) {
      const error = err as Error;
      showToast(error.message || 'خطأ أثناء إنشاء الشحنة', 'error');
    } finally {
      setCreatingShipment(false);
    }
  };

  /* --------------------------- CSV Import --------------------------- */
  const handleImportOrdersCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      showToast(tr('يرجى اختيار ملف CSV صالح', 'Veuillez sélectionner un fichier CSV valide'), 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(tr('حجم الملف كبير جداً (الحد الأقصى 10 ميغابايت)', 'Fichier trop volumineux (max 10MB)'), 'error');
      return;
    }

    try {
      setSaving(true);
      const rows = await parseCSVFile(file);
      if (rows.length === 0) {
        showToast(tr('ملف CSV فارغ أو غير صالح', 'Fichier CSV vide ou invalide'), 'error');
        return;
      }

      const nowIso = new Date().toISOString();
      let importedCount = 0;

      for (const row of rows) {
        const phone = row.customer_phone || row.phone || '0550000000';
        const name = row.customer_name || row.name || 'عميل محوّل';
        const orderNum = row.order_number || `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
        const total = Number(row.total || row.amount || 1000);

        const newOrder = {
          id: crypto.randomUUID(),
          order_number: orderNum,
          customer_name: name,
          customer_phone: phone,
          wilaya_id: Number(row.wilaya_id || 16),
          delivery_type: (row.delivery_type as 'home' | 'desk') || 'home',
          address: row.address || 'العنوان غير محدد',
          items: [{ product_id: '', name: 'منتجات مجمعة', slug: 'CSV-IMPORT', image: '', price: total, quantity: 1, subtotal: total }],
          subtotal: total,
          delivery_fee: 0,
          discount_amount: 0,
          total,
          payment_method: 'cod' as PaymentMethod,
          payment_status: 'unpaid' as PaymentStatus,
          status: 'pending' as OrderStatus,
          fraud_risk_score: 0,
          is_phone_verified: false,
          created_at: nowIso,
          updated_at: nowIso
        };

        await supabase.from('orders').insert(newOrder);
        importedCount++;
      }

      await loadData();
      setIsImportModalOpen(false);
      showToast(tr(`تم استيراد ${importedCount} طلب بنجاح`, `${importedCount} commandes importées`), 'success');
    } catch (err) {
      console.error('Error importing orders CSV:', err);
      showToast(tr('فشل استيراد الطلبات من CSV', 'Échec de l\'importation CSV'), 'error');
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------- RENDER UI --------------------------- */
  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center bg-slate-950 rounded-2xl border border-slate-800">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-emerald-500" />
          <p className="text-sm font-medium text-slate-400">
            {tr('جاري تحميل سجل الطلبات والمستودع...', 'Chargement des commandes...')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100" dir={dir}>
      {/* TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-950/80 border border-emerald-800/80 rounded-xl text-emerald-400 shadow-inner">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              {tr('إدارة الطلبات والمبيعات', 'Gestion des Commandes')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {tr('أنظمة تحكم متكاملة في الشحنات، الفواتير، المخزون والتوصيل مع Yalidine Express', 'Gestion complète des commandes, livraisons, factures et stocks')}
            </p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors shadow"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            {tr('استيراد CSV', 'Importer CSV')}
          </button>

          <button
            onClick={() => exportOrdersCSV(filteredOrders as unknown as Record<string, unknown>[])}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors shadow"
          >
            <Download className="w-4 h-4 text-blue-400" />
            {tr('تصدير CSV', 'Exporter CSV')}
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/60 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {tr('إضافة طلب جديد', 'Nouvelle Commande')}
          </button>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-md">
          <div>
            <div className="text-xs font-medium text-slate-400">{tr('إجمالي الطلبات', 'Total Commandes')}</div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{orders.length}</div>
          </div>
          <div className="p-3 bg-indigo-950/60 border border-indigo-800/60 rounded-xl text-indigo-400">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-md">
          <div>
            <div className="text-xs font-medium text-slate-400">{tr('طلبات قيد الانتظار', 'En Attente')}</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {orders.filter(o => o.status === 'pending').length}
            </div>
          </div>
          <div className="p-3 bg-amber-950/60 border border-amber-800/60 rounded-xl text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-md">
          <div>
            <div className="text-xs font-medium text-slate-400">{tr('تم التوصيل والتسليم', 'Livrées')}</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {orders.filter(o => o.status === 'delivered').length}
            </div>
          </div>
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-md">
          <div>
            <div className="text-xs font-medium text-slate-400">{tr('إجمالي المبيعات المحصلة', 'Chiffre d\'affaires')}</div>
            <div className="text-xl font-extrabold text-slate-100 mt-1">
              {formatPrice(orders.filter(o => o.payment_status === 'paid' || o.status === 'delivered').reduce((acc, o) => acc + Number(o.total || 0), 0))}
            </div>
          </div>
          <div className="p-3 bg-teal-950/60 border border-teal-800/60 rounded-xl text-teal-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-lg space-y-3 max-w-full overflow-hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[140px] xs:min-w-[200px] w-full sm:w-auto">
            <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ltr:left-3.5 rtl:right-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('بحث برقم الطلب، اسم العميل، الهاتف، العنوان أو المنتج...', 'Recherche par N° commande, nom, tél, produit...')}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl py-2.5 text-xs text-slate-100 ltr:pl-10 ltr:pr-4 rtl:pr-10 rtl:pl-4 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-auto min-w-[140px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">{tr('جميع الحالات', 'Tous les statuts')}</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s].ar}</option>
              ))}
            </select>
          </div>

          {/* Payment Status Filter */}
          <div className="w-full sm:w-auto min-w-[140px]">
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as PaymentStatus | 'all')}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">{tr('جميع حالات الدفع', 'Tous les paiements')}</option>
              <option value="unpaid">{tr('غير مدفوع', 'Non payé')}</option>
              <option value="paid">{tr('مدفوع بالكامل', 'Payé')}</option>
              <option value="partially_paid">{tr('مدفوع جزئياً', 'Partiellement payé')}</option>
              <option value="refunded">{tr('مسترجع', 'Remboursé')}</option>
            </select>
          </div>

          {/* Customer Type Filter */}
          <div className="w-full sm:w-auto min-w-[140px]">
            <select
              value={customerTypeFilter}
              onChange={(e) => setCustomerTypeFilter(e.target.value as 'all' | 'retail' | 'wholesale' | 'guest')}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">{tr('جميع أنواع العملاء', 'Tous types clients')}</option>
              <option value="retail">{tr('تجزئة (Retail)', 'Détail')}</option>
              <option value="wholesale">{tr('جملة (B2B / Wholesale)', 'Gros (B2B)')}</option>
              <option value="guest">{tr('زائر (Guest)', 'Invité')}</option>
            </select>
          </div>

          {/* Wilaya Filter */}
          <div className="w-full sm:w-auto min-w-[140px]">
            <select
              value={wilayaFilter}
              onChange={(e) => setWilayaFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">{tr('جميع الولايات', 'Toutes les wilayas')}</option>
              {ALGERIAN_WILAYAS.map((w) => (
                <option key={w.id} value={w.id}>{w.id} - {wilayaName(w, lang)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span>{tr('من تاريخ:', 'Du:')}</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <span>{tr('إلى تاريخ:', 'Au:')}</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            {(fromDate || toDate || statusFilter !== 'all' || paymentStatusFilter !== 'all' || wilayaFilter !== 'all' || search) && (
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setStatusFilter('all');
                  setPaymentStatusFilter('all');
                  setPaymentMethodFilter('all');
                  setCustomerTypeFilter('all');
                  setWilayaFilter('all');
                  setFromDate('');
                  setToDate('');
                }}
                className="text-rose-400 hover:underline px-2"
              >
                {tr('إعادة ضبط الفلاتر', 'Réinitialiser')}
              </button>
            )}
          </div>

          <div className="font-semibold text-slate-300">
            {tr('عُثر على', 'Trouvé')} {filteredOrders.length} {tr('طلب', 'commande(s)')}
          </div>
        </div>
      </div>

      {/* BULK ACTION BAR */}
      {selectedCount > 0 && (
        <div className="bg-emerald-950/80 border border-emerald-800/80 p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-fadeIn w-full overflow-hidden">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 shrink-0">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>{tr(`تم تحديد ${selectedCount} طلب`, `${selectedCount} sélectionné(s)`)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleBulkAction('confirm')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors min-h-[36px] flex items-center justify-center shrink-0"
            >
              {tr('اعتماد المحدد', 'Confirmer')}
            </button>
            <button
              onClick={() => handleBulkAction('ship')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors min-h-[36px] flex items-center justify-center shrink-0"
            >
              {tr('تعليم كـ "تم الشحن"', 'Expédier')}
            </button>
            <button
              onClick={() => handleBulkAction('deliver')}
              className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors min-h-[36px] flex items-center justify-center shrink-0"
            >
              {tr('تعليم كـ "تم التوصيل"', 'Livrer')}
            </button>
            <button
              onClick={() => handleBulkAction('cancel')}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors min-h-[36px] flex items-center justify-center shrink-0"
            >
              {tr('إلغاء المحدد', 'Annuler')}
            </button>
            <button
              onClick={() => handleBulkAction('export')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors min-h-[36px] flex items-center justify-center shrink-0"
            >
              {tr('تصدير المحدد', 'Exporter')}
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors min-h-[36px] flex items-center justify-center shrink-0"
            >
              {tr('حذف المحدد', 'Supprimer')}
            </button>
          </div>
        </div>
      )}

      {/* ORDERS TABLE */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={paginatedOrders.length > 0 && paginatedOrders.every(o => selectedOrderIds[o.id])}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const nextMap = { ...selectedOrderIds };
                      paginatedOrders.forEach(o => { nextMap[o.id] = checked; });
                      setSelectedOrderIds(nextMap);
                    }}
                    className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                  />
                </th>
                <th className="p-3 text-start">{tr('رقم الطلب', 'N° Commande')}</th>
                <th className="p-3 text-start">{tr('اسم العميل / الهاتف', 'Client')}</th>
                <th className="p-3 text-start">{tr('الولاية والتوصيل', 'Wilaya & Livraison')}</th>
                <th className="p-3 text-start">{tr('المبلغ الإجمالي', 'Total Net')}</th>
                <th className="p-3 text-start">{tr('حالة الدفع', 'Paiement')}</th>
                <th className="p-3 text-start">{tr('حالة الطلب', 'Statut')}</th>
                <th className="p-3 text-start">{tr('التاريخ', 'Date')}</th>
                <th className="p-3 text-center">{tr('إجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-10 h-10 text-slate-600 stroke-1" />
                      <p>{tr('لا توجد طلبات مطابقة للبحث أو المصفاة', 'Aucune commande trouvée')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((o) => {
                  const Icon = STATUS_ICON[o.status] || Clock;
                  const isChecked = !!selectedOrderIds[o.id];

                  return (
                    <tr key={o.id} className={`hover:bg-slate-900/60 transition-colors ${isChecked ? 'bg-emerald-950/20' : ''}`}>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => setSelectedOrderIds(prev => ({ ...prev, [o.id]: e.target.checked }))}
                          className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                        />
                      </td>

                      <td className="p-3 font-mono font-bold text-slate-100">
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="hover:text-emerald-400 hover:underline text-start"
                        >
                          #{o.order_number}
                        </button>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-100">{o.customer_name || 'عميل'}</span>
                          {o.customer_type === 'wholesale' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-950/80 text-purple-300 border border-purple-700/60">
                              B2B / جملة
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{o.customer_phone}</div>
                      </td>

                      <td className="p-3">
                        <div className="text-slate-200">{wilayaName(o.wilaya, lang)}</div>
                        <div className="text-[11px] text-slate-400">
                          {o.delivery_type === 'home' ? tr('توصيل للمنزل', 'À domicile') : tr('استلام من المكتب', 'Au bureau')}
                          {o.shipping_company ? ` · ${o.shipping_company}` : ''}
                        </div>
                      </td>

                      <td className="p-3 font-extrabold text-emerald-400">
                        {formatPrice(Number(o.total))}
                      </td>

                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${PAYMENT_STATUS_COLORS[o.payment_status] || PAYMENT_STATUS_COLORS.unpaid}`}>
                          {PAYMENT_STATUS_LABELS[o.payment_status]?.ar || o.payment_status}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {PAYMENT_METHOD_LABELS[o.payment_method]?.[isAr ? 'ar' : 'fr'] || o.payment_method}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[o.status] || STATUS_COLORS.pending}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {STATUS_LABELS[o.status]?.ar || o.status}
                        </span>
                      </td>

                      <td className="p-3 text-slate-400 text-[11px]">
                        {formatDate(o.created_at)}
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedOrder(o)}
                            className="p-1.5 text-indigo-400 hover:bg-indigo-950/60 rounded-lg transition-colors"
                            title={tr('عرض تفاصيل الطلب', 'Voir détails')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(o)}
                            className="p-1.5 text-amber-400 hover:bg-amber-950/60 rounded-lg transition-colors"
                            title={tr('تعديل الطلب', 'Modifier')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => printOrderInvoice(o, lang)}
                            className="p-1.5 text-emerald-400 hover:bg-emerald-950/60 rounded-lg transition-colors"
                            title={tr('طباعة الفاتورة', 'Facture')}
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteOrder(o.id)}
                            className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg transition-colors"
                            title={tr('حذف الطلب', 'Supprimer')}
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* PAGINATION */}
        <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>{tr('عرض', 'Afficher')}</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>{tr('عنصر لكل صفحة', 'par page')}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </button>
            <span className="px-3 font-semibold text-slate-200">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {/* FULL ORDER DETAILS DRAWER */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-950 border-s border-slate-800 h-full flex flex-col shadow-2xl max-w-full overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 max-w-full">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-slate-100 font-mono truncate">#{selectedOrder.order_number}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[selectedOrder.status]}`}>
                      {STATUS_LABELS[selectedOrder.status]?.ar}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{formatDate(selectedOrder.created_at)}</p>
                </div>

                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg sm:hidden shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-thin">
                <button
                  onClick={() => printOrderInvoice(selectedOrder, lang)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {tr('طباعة الفاتورة', 'Facture')}
                </button>

                <button
                  onClick={() => printPackingSlip(selectedOrder, lang)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-700/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {tr('وصل التجهيز', 'Bon Préparation')}
                </button>

                <button
                  onClick={() => printShippingLabel(selectedOrder, lang)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-purple-400 border border-slate-700/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Tag className="w-3.5 h-3.5" />
                  {tr('ملصق A6', 'Étiquette')}
                </button>

                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg hidden sm:block shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 sm:space-y-6 text-xs text-slate-300 max-w-full">
              {/* Quick Status Change Buttons */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                  {tr('تحديث حالة الطلب السريع', 'Changement rapide de statut')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_STATUSES.map((st) => (
                    <button
                      key={st}
                      onClick={() => handleUpdateOrderStatus(selectedOrder.id, st)}
                      disabled={saving || selectedOrder.status === st}
                      className={`px-3 py-1.5 rounded-xl font-semibold border text-xs transition-all ${
                        selectedOrder.status === st
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      {STATUS_LABELS[st].ar}
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                    {tr('تحديث حالة الدفع', 'Mettre à jour le paiement')}:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(['unpaid', 'pending', 'paid', 'refunded'] as PaymentStatus[]).map((ps) => (
                      <button
                        key={ps}
                        onClick={() => handleUpdatePaymentStatus(selectedOrder.id, ps)}
                        disabled={saving || selectedOrder.payment_status === ps}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          selectedOrder.payment_status === ps
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                            : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {PAYMENT_STATUS_LABELS[ps]?.[isAr ? 'ar' : 'fr'] || ps}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Customer & Shipping Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2 min-w-0">
                  <div className="font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
                    <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    {tr('معلومات المشتري', 'Client')}
                  </div>
                  <div className="break-words"><strong className="text-slate-400">الاسم:</strong> <span className="text-slate-100 font-semibold">{selectedOrder.customer_name || 'عميل'}</span></div>
                  <div className="break-all"><strong className="text-slate-400">الهاتف:</strong> <span className="text-emerald-400 font-mono font-bold" dir="ltr">{selectedOrder.customer_phone}</span></div>
                  {selectedOrder.customer_email && <div className="break-all"><strong className="text-slate-400">البريد:</strong> <span className="text-slate-300">{selectedOrder.customer_email}</span></div>}
                  <div><strong className="text-slate-400">نوع الحساب:</strong> <span className="text-slate-300 capitalize">{selectedOrder.customer_type || 'retail'}</span></div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2 min-w-0">
                  <div className="font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Truck className="w-4 h-4 text-blue-400 shrink-0" />
                    {tr('معلومات الشحن والتوصيل', 'Expédition')}
                  </div>
                  <div className="break-words"><strong className="text-slate-400">الولاية:</strong> <span className="text-slate-100 font-semibold">{wilayaName(selectedOrder.wilaya, lang)}</span></div>
                  <div className="break-words"><strong className="text-slate-400">العنوان:</strong> <span className="text-slate-300">{selectedOrder.address || 'غير محدد'}</span></div>
                  <div><strong className="text-slate-400">نوع الشحن:</strong> <span className="text-slate-300">{selectedOrder.delivery_type === 'home' ? 'توصيل للمنزل' : 'مكتب'}</span></div>
                  <div><strong className="text-slate-400">شركة الشحن:</strong> <span className="text-indigo-400 font-semibold">{selectedOrder.shipping_company || 'Yalidine Express'}</span></div>
                  {selectedOrder.tracking_number && <div className="break-all"><strong className="text-slate-400">رقم التتبع:</strong> <span className="text-amber-400 font-mono font-bold">{selectedOrder.tracking_number}</span></div>}
                </div>
              </div>

              {/* Yalidine Integration Box */}
              <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-2xl p-4 space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-indigo-300">
                    <Truck className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>{tr('تكامل الشحن المباشر مع Yalidine Express', 'Expédition Yalidine Express')}</span>
                  </div>
                  {shipmentInfo && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-950 border border-indigo-700 text-indigo-300 shrink-0">
                      {shipmentInfo.status}
                    </span>
                  )}
                </div>

                {shipmentInfo ? (
                  <div className="space-y-2 text-slate-300">
                    <div className="break-all"><strong>رقم التتبع الرسمي:</strong> <span className="font-mono font-bold text-emerald-400">{shipmentInfo.trackingNumber || shipmentInfo.tracking_number}</span></div>
                    {(shipmentInfo.labelUrl || shipmentInfo.label_url) && (
                      <a
                        href={shipmentInfo.labelUrl || shipmentInfo.label_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold break-words"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        تحميل ملصق Yalidine الرسمى (PDF)
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-slate-400 text-[11px] leading-relaxed">أنشئ طرد Yalidine تلقائياً واستخرج رقم التتبع وملصق الشحن.</p>
                    <button
                      onClick={handleCreateYalidineShipment}
                      disabled={creatingShipment}
                      className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0 whitespace-nowrap"
                    >
                      {creatingShipment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      إنشاء شحنة Yalidine
                    </button>
                  </div>
                )}
              </div>

              {/* Products Table */}
              <div className="space-y-2">
                <div className="font-bold text-slate-200 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400 shrink-0" />
                  {tr('قائمة المنتجات المطلوبة', 'Articles')}
                </div>
                <div className="border border-slate-800 rounded-xl overflow-x-auto max-w-full scrollbar-thin">
                  <table className="w-full text-xs min-w-[340px]">
                    <thead className="bg-slate-900 text-slate-400">
                      <tr>
                        <th className="p-2.5 text-start">المنتج</th>
                        <th className="p-2.5 text-center">السعر</th>
                        <th className="p-2.5 text-center">الكمية</th>
                        <th className="p-2.5 text-end">المجموع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(selectedOrder.items || []).map((it, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 flex items-center gap-2.5 min-w-[140px]">
                            {it.image && <img src={it.image} alt={it.name} className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0" />}
                            <div className="min-w-0">
                              <div className="font-bold text-slate-100 line-clamp-2 break-words">{it.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">{it.slug}</div>
                            </div>
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">{formatPrice(Number(it.price))}</td>
                          <td className="p-2.5 text-center font-bold text-slate-100 whitespace-nowrap">{it.quantity}</td>
                          <td className="p-2.5 text-end font-extrabold text-emerald-400 whitespace-nowrap">{formatPrice(Number(it.subtotal || it.price * it.quantity))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400 gap-2">
                  <span>المجموع الفرعي للمنتجات:</span>
                  <span className="font-semibold text-slate-200 shrink-0">{formatPrice(Number(selectedOrder.subtotal))}</span>
                </div>
                <div className="flex justify-between text-slate-400 gap-2">
                  <span>تكلفة الشحن والتوصيل:</span>
                  <span className="font-semibold text-slate-200 shrink-0">{formatPrice(Number(selectedOrder.delivery_fee))}</span>
                </div>
                {Number(selectedOrder.discount_amount) > 0 && (
                  <div className="flex justify-between text-rose-400 gap-2">
                    <span>الخصم المطبق:</span>
                    <span className="shrink-0">-{formatPrice(Number(selectedOrder.discount_amount))}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-800 font-extrabold text-sm text-emerald-400 gap-2">
                  <span>الإجمالي الكلي:</span>
                  <span className="shrink-0">{formatPrice(Number(selectedOrder.total))}</span>
                </div>
              </div>

              {/* Order Notes & Activity Log */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    {tr('سجل نشاطات وتغييرات الطلب', 'Historique d\'activité')}
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                  {(selectedOrder.activity_log || []).length === 0 ? (
                    <p className="text-slate-500 text-center py-2">لا يوجد نشاط مسجل بعد</p>
                  ) : (
                    (selectedOrder.activity_log || []).map((act, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-slate-800/40 pb-2 last:border-0 last:pb-0 gap-1 text-xs">
                        <div className="min-w-0 break-words">
                          <span className="font-bold text-emerald-400">{act.action}:</span>{' '}
                          <span className="text-slate-300">{act.details}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap shrink-0">
                          {formatDate(act.timestamp)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT ORDER MODAL */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                {isEditModalOpen ? tr(`تعديل الطلب #${formData.order_number}`, `Modifier Commande #${formData.order_number}`) : tr('إضافة طلب جديد يدوياً', 'Créer une commande')}
              </h2>
              <button
                onClick={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-300">
              {/* Customer Selector */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="font-bold text-slate-200">1. معلومات المشتري</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-slate-400">اختر من قائمة العملاء:</label>
                    <select
                      onChange={(e) => handleSelectCustomerForForm(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-100"
                    >
                      <option value="">-- عميل جديد / إدخال يدوي --</option>
                      {customersList.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.full_name || c.company_name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-400">اسم العميل بالكامل *</label>
                    <input
                      type="text"
                      value={formData.customer_name}
                      onChange={(e) => setFormData(p => ({ ...p, customer_name: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-100"
                      placeholder="محمد بن علي"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-400">رقم الهاتف *</label>
                    <input
                      type="text"
                      value={formData.customer_phone}
                      onChange={(e) => setFormData(p => ({ ...p, customer_phone: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-100 font-mono"
                      placeholder="0550000000"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-400">البريد الإلكتروني (اختياري)</label>
                    <input
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) => setFormData(p => ({ ...p, customer_email: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Products Selector */}
              <div className="bg-slate-900/60 border border-slate-800 p-3.5 sm:p-4 rounded-xl space-y-3 max-w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="font-bold text-slate-200">2. اختيار المنتجات والكميات</div>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddItemToForm(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full sm:w-auto bg-emerald-950 border border-emerald-700 text-emerald-300 rounded-xl px-3 py-1.5 font-bold text-xs truncate"
                  >
                    <option value="">+ إضافة منتج للطلب</option>
                    {productsCatalog.map(p => (
                      <option key={p.id} value={p.id}>
                        {isAr ? p.name_ar : p.name_fr} ({p.price} دج) - المخزون: {p.stock_quantity}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.items.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">لم يتم إضافة منتجات للطلب بعد</p>
                ) : (
                  <div className="border border-slate-800 rounded-xl overflow-x-auto max-w-full scrollbar-thin">
                    <table className="w-full text-xs min-w-[360px]">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="p-2 text-start">المنتج</th>
                          <th className="p-2 text-center">السعر</th>
                          <th className="p-2 text-center">الكمية</th>
                          <th className="p-2 text-end">المجموع</th>
                          <th className="p-2 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {formData.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-bold text-slate-100 min-w-[120px] break-words">{item.name}</td>
                            <td className="p-2 text-center whitespace-nowrap">{item.price} دج</td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => {
                                  const q = Math.max(1, Number(e.target.value));
                                  const updated = [...formData.items];
                                  updated[idx].quantity = q;
                                  updated[idx].subtotal = q * updated[idx].price;
                                  setFormData(p => ({ ...p, items: updated }));
                                }}
                                className="w-16 bg-slate-950 border border-slate-700 rounded p-1 text-center font-bold text-slate-100"
                              />
                            </td>
                            <td className="p-2 text-end font-bold text-emerald-400 whitespace-nowrap">{item.subtotal} دج</td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => {
                                  setFormData(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
                                }}
                                className="text-rose-400 hover:text-rose-300"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Shipping & Payment Options */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="font-bold text-slate-200">3. الشحن، التوصيل والدفع</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block mb-1 text-slate-400">الولاية</label>
                    <select
                      value={formData.wilaya_id}
                      onChange={(e) => setFormData(p => ({ ...p, wilaya_id: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-100"
                    >
                      {ALGERIAN_WILAYAS.map(w => (
                        <option key={w.id} value={w.id}>{w.id} - {wilayaName(w, lang)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-400">نوع التوصيل</label>
                    <select
                      value={formData.delivery_type}
                      onChange={(e) => setFormData(p => ({ ...p, delivery_type: e.target.value as 'home' | 'desk' }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-100"
                    >
                      <option value="home">توصيل للمنزل</option>
                      <option value="desk">استلام من المكتب</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-400">تكلفة الشحن (دج)</label>
                    <input
                      type="number"
                      value={formData.delivery_fee}
                      onChange={(e) => setFormData(p => ({ ...p, delivery_fee: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-400">حالة الطلب</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(p => ({ ...p, status: e.target.value as OrderStatus }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-100"
                    >
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s].ar}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-400">حالة الدفع</label>
                    <select
                      value={formData.payment_status}
                      onChange={(e) => setFormData(p => ({ ...p, payment_status: e.target.value as PaymentStatus }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-100"
                    >
                      <option value="unpaid">غير مدفوع</option>
                      <option value="paid">مدفوع بالكامل</option>
                      <option value="partially_paid">مدفوع جزئياً</option>
                      <option value="refunded">مسترجع</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-400">طريقة الدفع</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData(p => ({ ...p, payment_method: e.target.value as PaymentMethod }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-100"
                    >
                      <option value="cod">الدفع عند الاستلام (COD)</option>
                      <option value="ccp">BaridiMob / CCP</option>
                      <option value="cib">CIB / EDAHABIA</option>
                      <option value="bank_transfer">تحويل بنكي</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-slate-400">العنوان بالتفصيل</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-slate-100"
                    placeholder="حي 500 مسكن، عمارة 12"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/80">
              <button
                onClick={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveOrderForm}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                حفظ الطلب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                {tr('استيراد الطلبات من ملف CSV', 'Importer des commandes')}
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              قم برفع ملف CSV يحتوي على الأعمدة: <code>customer_name, customer_phone, total, wilaya_id, address</code>
            </p>

            <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/80 rounded-xl p-6 text-center transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleImportOrdersCSV}
                className="hidden"
                id="csv-order-upload"
              />
              <label htmlFor="csv-order-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">اضغط هنا لاختيار ملف CSV</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
