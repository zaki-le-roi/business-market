import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Warehouse as WarehouseIcon,
  Boxes,
  Layers,
  History,
  Truck,
  Plus,
  Search,
  RefreshCw,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Edit2,
  Trash2,
  PackageCheck,
  Building2,
  MapPin,
  Phone,
  UserCheck
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Product } from '../../types';
import {
  Warehouse,
  ProductVariant,
  InventoryLevel,
  InventoryMovement,
  Supplier,
  SupplierPO,
  MovementType
} from '../../types/inventory';
import {
  fetchWarehousesFromDB,
  upsertWarehouseInDB,
  deleteWarehouseFromDB,
  fetchInventoryLevelsFromDB,
  adjustStockInDB,
  transferStockInDB,
  fetchInventoryMovementsFromDB,
  fetchProductVariantsFromDB,
  upsertProductVariantInDB,
  deleteProductVariantFromDB,
  fetchSuppliersFromDB,
  upsertSupplierInDB,
  deleteSupplierFromDB,
  fetchSupplierPOsFromDB,
  upsertSupplierPOInDB,
  receiveSupplierPOInDB
} from '../../lib/inventoryStore';
import { exportInventoryCSV } from '../../lib/csvHelper';

type TabType = 'warehouses' | 'stock' | 'variants' | 'movements' | 'suppliers' | 'pos';

export default function AdminInventory() {
  const { lang, tr } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';

  const [activeTab, setActiveTab] = useState<TabType>('stock');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventoryLevels, setInventoryLevels] = useState<InventoryLevel[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<SupplierPO[]>([]);

  // Modals & Forms
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Partial<Warehouse> | null>(null);

  const [showStockModal, setShowStockModal] = useState(false);
  const [stockForm, setStockForm] = useState<{
    product_id: string;
    variant_id?: string;
    warehouse_id: string;
    qty_change: number;
    movement_type: MovementType;
    reference_number: string;
    notes: string;
  }>({
    product_id: '',
    warehouse_id: '',
    qty_change: 0,
    movement_type: 'manual_adjustment',
    reference_number: '',
    notes: ''
  });

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState<{
    product_id: string;
    variant_id?: string;
    from_warehouse_id: string;
    to_warehouse_id: string;
    transfer_qty: number;
    notes: string;
  }>({
    product_id: '',
    from_warehouse_id: '',
    to_warehouse_id: '',
    transfer_qty: 1,
    notes: ''
  });

  const [showVariantModal, setShowVariantModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Partial<ProductVariant> | null>(null);

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);

  const [showPOModal, setShowPOModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'warehouse' | 'supplier' | 'variant';
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [poForm, setPoForm] = useState<{
    supplier_id: string;
    warehouse_id: string;
    items: { product_id: string; variant_id?: string; product_name: string; quantity_ordered: number; unit_cost: number }[];
    expected_delivery_date: string;
    notes: string;
  }>({
    supplier_id: '',
    warehouse_id: '',
    items: [],
    expected_delivery_date: '',
    notes: ''
  });

  // Fetch all inventory data from Supabase
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodsRes, whs, invLevels, vars, movs, sups, pos] = await Promise.all([
        supabase.from('products').select('*').order('name_ar', { ascending: true }),
        fetchWarehousesFromDB(),
        fetchInventoryLevelsFromDB(),
        fetchProductVariantsFromDB(),
        fetchInventoryMovementsFromDB(),
        fetchSuppliersFromDB(),
        fetchSupplierPOsFromDB()
      ]);

      if (prodsRes.data) setProducts(prodsRes.data as Product[]);
      setWarehouses(whs);
      setInventoryLevels(invLevels);
      setVariants(vars);
      setMovements(movs);
      setSuppliers(sups);
      setPurchaseOrders(pos);
    } catch (e) {
      console.error('Failed to load inventory data:', e);
      showToast(tr('خطأ في تحميل بيانات المخزون من داتابيز', 'Erreur de chargement des stocks'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, tr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Products for Stock View
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const s = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        (p.name_ar && p.name_ar.toLowerCase().includes(s)) ||
        (p.name_fr && p.name_fr.toLowerCase().includes(s)) ||
        (p.sku && p.sku.toLowerCase().includes(s))
    );
  }, [products, searchTerm]);

  // Main Warehouse reference
  const mainWarehouse = useMemo(() => warehouses.find((w) => w.is_main) || warehouses[0], [warehouses]);

  // --- HANDLERS ---

  // Save Warehouse
  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse?.name_ar || !editingWarehouse?.name_fr) {
      showToast(tr('يرجى كتابة اسم المستودع', 'Veuillez saisir le nom de l\'entrepôt'), 'error');
      return;
    }
    const res = await upsertWarehouseInDB(editingWarehouse);
    if (!res.success) {
      showToast(res.error || tr('فشل حفظ المستودع', 'Échec de l\'enregistrement'), 'error');
      return;
    }

    // Re-query Supabase to verify saved record
    const freshWarehouses = await fetchWarehousesFromDB();
    const savedExists = freshWarehouses.some((w) => w.id === res.data?.id || (res.data?.code && w.code === res.data.code));

    if (savedExists) {
      showToast(tr('تم حفظ المستودع بنجاح في Supabase', 'Entrepôt enregistré avec succès'), 'success');
      setShowWarehouseModal(false);
      setEditingWarehouse(null);
      setWarehouses(freshWarehouses);
    } else {
      showToast(tr('فشل التحقق من حفظ المستودع في قاعدة البيانات', 'Échec de la vérification en base de données'), 'error');
    }
  };

  // Delete Warehouse prompt
  const handleDeleteWarehouse = (wh: Warehouse) => {
    // Safety check: block deletion if warehouse contains active inventory
    const activeInventory = inventoryLevels.filter((item) => item.warehouse_id === wh.id && (Number(item.quantity_on_hand || item.quantity) > 0 || Number(item.quantity_reserved || 0) > 0));
    const totalStock = activeInventory.reduce((sum, item) => sum + Number(item.quantity_on_hand || item.quantity || 0), 0);

    if (totalStock > 0) {
      showToast(
        tr(
          `لا يمكن حذف هذا المستودع لأنه يحتوي على ${totalStock} قطعة مخزون نشطة. يرجى نقل المخزون أولاً إلى مستودع آخر.`,
          `Impossible de supprimer cet entrepôt: il contient ${totalStock} articles en stock. Veuillez transférer le stock d'abord.`
        ),
        'error'
      );
      return;
    }

    setDeleteConfirm({
      type: 'warehouse',
      id: wh.id,
      name: isAr ? wh.name_ar : wh.name_fr
    });
  };

  // Adjust Stock
  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockForm.product_id || !stockForm.warehouse_id || stockForm.qty_change === 0) {
      showToast(tr('يرجى تحديد المنتج، المستودع والكمية', 'Champs requis manquants'), 'error');
      return;
    }

    const res = await adjustStockInDB({
      product_id: stockForm.product_id,
      variant_id: stockForm.variant_id || undefined,
      warehouse_id: stockForm.warehouse_id,
      qty_change: Number(stockForm.qty_change),
      movement_type: stockForm.movement_type,
      reference_number: stockForm.reference_number || undefined,
      notes: stockForm.notes || undefined
    });

    if (res.success) {
      showToast(tr('تم تعديل المخزون بنجاح وتسجيل الحركة', 'Stock ajusté avec succès'), 'success');
      setShowStockModal(false);
      loadData();
    } else {
      showToast(res.error || tr('فشل تعديل المخزون', 'Échec de la modification'), 'error');
    }
  };

  // Transfer Stock
  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !transferForm.product_id ||
      !transferForm.from_warehouse_id ||
      !transferForm.to_warehouse_id ||
      transferForm.from_warehouse_id === transferForm.to_warehouse_id ||
      transferForm.transfer_qty <= 0
    ) {
      showToast(tr('يرجى التحقق من مستودع المصدر، الهدف والكمية', 'Informations de transfert invalides'), 'error');
      return;
    }

    const res = await transferStockInDB({
      product_id: transferForm.product_id,
      variant_id: transferForm.variant_id || undefined,
      from_warehouse_id: transferForm.from_warehouse_id,
      to_warehouse_id: transferForm.to_warehouse_id,
      transfer_qty: Number(transferForm.transfer_qty),
      notes: transferForm.notes || undefined
    });

    if (res.success) {
      showToast(tr('تم نقل المخزون بين المستودعات بنجاح', 'Transfert effectué avec succès'), 'success');
      setShowTransferModal(false);
      loadData();
    } else {
      showToast(res.error || tr('فشل نقل المخزون', 'Échec du transfert'), 'error');
    }
  };

  // Save Variant
  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariant?.product_id || !editingVariant?.name_ar || !editingVariant?.name_fr) {
      showToast(tr('يرجى إدخال اسم المتغير والمنتج المرتبط', 'Informations de variante requises'), 'error');
      return;
    }

    const res = await upsertProductVariantInDB(editingVariant);
    if (res.success) {
      showToast(tr('تم حفظ متغير المنتج بنجاح', 'Variante enregistrée'), 'success');
      setShowVariantModal(false);
      setEditingVariant(null);
      loadData();
    } else {
      showToast(res.error || tr('فشل حفظ المتغير', 'Échec de l\'enregistrement'), 'error');
    }
  };

  // Delete Variant prompt
  const handleDeleteVariant = (v: ProductVariant) => {
    setDeleteConfirm({
      type: 'variant',
      id: v.id,
      name: isAr ? v.name_ar : v.name_fr
    });
  };

  // Save Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier?.name) {
      showToast(tr('يرجى كتابة اسم المورد', 'Le nom du fournisseur est requis'), 'error');
      return;
    }

    const res = await upsertSupplierInDB(editingSupplier);
    if (!res.success) {
      showToast(res.error || tr('فشل حفظ المورد', 'Échec de l\'enregistrement'), 'error');
      return;
    }

    // Re-query Supabase to verify saved record
    const freshSuppliers = await fetchSuppliersFromDB();
    const savedExists = freshSuppliers.some((s) => s.id === res.data?.id || (res.data?.code && s.code === res.data.code));

    if (savedExists) {
      showToast(tr('تم حفظ المورد بنجاح في Supabase', 'Fournisseur enregistré avec succès'), 'success');
      setShowSupplierModal(false);
      setEditingSupplier(null);
      setSuppliers(freshSuppliers);
    } else {
      showToast(tr('فشل التحقق من حفظ المورد في قاعدة البيانات', 'Échec de la vérification en base de données'), 'error');
    }
  };

  // Delete Supplier prompt
  const handleDeleteSupplier = (sup: Supplier) => {
    setDeleteConfirm({
      type: 'supplier',
      id: sup.id,
      name: sup.name
    });
  };

  // Unified Execute Delete Handler
  const handleExecuteDelete = async () => {
    if (!deleteConfirm || isDeleting) return;
    setIsDeleting(true);

    try {
      if (deleteConfirm.type === 'warehouse') {
        const id = deleteConfirm.id;
        const res = await deleteWarehouseFromDB(id);
        if (!res.success) {
          showToast(res.error || tr('فشل حذف المستودع', 'Échec de la suppression'), 'error');
          return;
        }

        // Optimistically remove from state immediately
        setWarehouses((prev) => prev.filter((w) => w.id !== id));

        // Re-query Supabase to verify deletion
        const freshWarehouses = await fetchWarehousesFromDB();
        const stillExists = freshWarehouses.some((w) => w.id === id);

        if (!stillExists) {
          showToast(tr('تم حذف المستودع بنجاح من Supabase', 'Entrepôt supprimé'), 'success');
          setWarehouses(freshWarehouses);
        } else {
          showToast(tr('فشل التحقق من حذف المستودع من قاعدة البيانات', 'Échec de la vérification de suppression'), 'error');
        }
      } else if (deleteConfirm.type === 'supplier') {
        const id = deleteConfirm.id;
        const res = await deleteSupplierFromDB(id);
        if (!res.success) {
          showToast(res.error || tr('فشل حذف المورد', 'Échec de la suppression'), 'error');
          return;
        }

        // Optimistically remove from state immediately
        setSuppliers((prev) => prev.filter((s) => s.id !== id));

        // Re-query Supabase to verify deletion
        const freshSuppliers = await fetchSuppliersFromDB();
        const stillExists = freshSuppliers.some((s) => s.id === id);

        if (!stillExists) {
          showToast(tr('تم حذف المورد بنجاح من Supabase', 'Fournisseur supprimé'), 'success');
          setSuppliers(freshSuppliers);
        } else {
          showToast(tr('فشل التحقق من حذف المورد من قاعدة البيانات', 'Échec de la vérification de suppression'), 'error');
        }
      } else if (deleteConfirm.type === 'variant') {
        const id = deleteConfirm.id;
        const res = await deleteProductVariantFromDB(id);
        if (res.success) {
          showToast(tr('تم حذف المتغير بنجاح', 'Variante supprimée'), 'success');
          setVariants((prev) => prev.filter((v) => v.id !== id));
          loadData();
        } else {
          showToast(res.error || tr('فشل الحذف', 'Échec de la suppression'), 'error');
        }
      }
    } catch (e: unknown) {
      const err = e as Error;
      showToast(err?.message || tr('حدث خطأ أثناء الحذف', 'Une erreur est survenue lors de la suppression'), 'error');
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  // Save Supplier PO
  const handleSavePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.supplier_id || !poForm.warehouse_id || poForm.items.length === 0) {
      showToast(tr('يرجى اختيار المورد، المستودع وإضافة عنصر واحد على الأقل', 'PO incomplet'), 'error');
      return;
    }

    const totalCost = poForm.items.reduce((sum, item) => sum + item.quantity_ordered * item.unit_cost, 0);

    const res = await upsertSupplierPOInDB({
      supplier_id: poForm.supplier_id,
      warehouse_id: poForm.warehouse_id,
      status: 'draft',
      items: poForm.items.map((i) => ({
        product_id: i.product_id,
        variant_id: i.variant_id,
        product_name: i.product_name,
        quantity_ordered: i.quantity_ordered,
        quantity_received: 0,
        unit_cost: i.unit_cost,
        total_cost: i.quantity_ordered * i.unit_cost
      })),
      total_cost: totalCost,
      expected_delivery_date: poForm.expected_delivery_date || undefined,
      notes: poForm.notes || undefined
    });

    if (res.success) {
      showToast(tr('تم إنشاء أمر الشراء بنجاح', 'Bon de commande créé'), 'success');
      setShowPOModal(false);
      loadData();
    } else {
      showToast(res.error || tr('فشل إنشاء أمر الشراء', 'Échec de la création'), 'error');
    }
  };

  // Receive Supplier PO
  const handleReceivePO = async (po: SupplierPO) => {
    if (!confirm(tr(`هل تريد تأكيد استلام الشحنة وتحديث المخزون في المستودع لأمر الشراء رقم #${po.po_number}؟`, `Recevoir la commande #${po.po_number} et ajouter au stock ?`))) return;

    // By default receive 100% of ordered quantities
    const receivedItems = po.items.map((item) => ({
      ...item,
      quantity_received: item.quantity_ordered
    }));

    const res = await receiveSupplierPOInDB({ ...po, items: receivedItems }, 'Admin');
    if (res.success) {
      showToast(tr('تم استلام أمر الشراء وإدخال الكميات للمخزون بنجاح', 'Commande reçue et stock mis à jour'), 'success');
      loadData();
    } else {
      showToast(res.error || tr('فشل استلام أمر الشراء', 'Échec de la réception'), 'error');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const csvData = products.map((p) => {
      const pLevels = inventoryLevels.filter((l) => l.product_id === p.id && !l.variant_id);
      const mainQty = pLevels.find((l) => l.warehouse_id === mainWarehouse?.id)?.quantity || 0;
      return {
        'Product ID': p.id,
        SKU: p.sku || '',
        'Name AR': p.name_ar,
        'Name FR': p.name_fr,
        'Price (DZD)': p.price,
        'Cost Price (DZD)': p.cost_price || 0,
        'Main Stock': mainQty,
        'Total Stock': p.stock_quantity || 0,
        'Low Stock Threshold': p.low_stock_threshold || 5
      };
    });
    exportInventoryCSV(csvData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/60 p-6 rounded-2xl border border-slate-700">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Boxes className="w-7 h-7 text-emerald-400" />
            {tr('إدارة المخزون والمستودعات', 'Gestion des Stocks & Entrepôts')}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {tr(
              'نظام إدارة المستودعات متعدد الفروع، تتبع الحركات الفوري، الموردين وأوامر الشراء',
              'Gestion multi-entrepôts, mouvements de stock, variantes et commandes fournisseurs'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-xl flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {tr('تحديث البيانات', 'Actualiser')}
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl flex items-center gap-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {tr('تصدير CSV', 'Exporter CSV')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-700 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('stock')}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'stock' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Boxes className="w-4 h-4" />
          {tr('المخزون الحالي', 'Stocks Actuels')}
        </button>

        <button
          onClick={() => setActiveTab('warehouses')}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'warehouses' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <WarehouseIcon className="w-4 h-4" />
          {tr('المستودعات والفروع', 'Entrepôts')}
          <span className="bg-slate-700 text-xs px-2 py-0.5 rounded-full">{warehouses.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('variants')}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'variants' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          {tr('متغيرات المنتجات', 'Variantes')}
          <span className="bg-slate-700 text-xs px-2 py-0.5 rounded-full">{variants.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'movements' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          {tr('سجل الحركات', 'Historique Mouvements')}
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'suppliers' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          {tr('الموردون', 'Fournisseurs')}
          <span className="bg-slate-700 text-xs px-2 py-0.5 rounded-full">{suppliers.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('pos')}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'pos' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          {tr('أوامر الشراء', 'Bons de Commande')}
          <span className="bg-slate-700 text-xs px-2 py-0.5 rounded-full">{purchaseOrders.length}</span>
        </button>
      </div>

      {/* SEARCH & ACTIONS BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={tr('بحث بالاسم أو SKU...', 'Rechercher par nom ou SKU...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 text-white pl-9 pr-4 py-2 rounded-xl text-sm border border-slate-700 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {activeTab === 'stock' && (
            <>
              <button
                onClick={() => {
                  setStockForm({
                    product_id: products[0]?.id || '',
                    warehouse_id: mainWarehouse?.id || warehouses[0]?.id || '',
                    qty_change: 0,
                    movement_type: 'manual_adjustment',
                    reference_number: '',
                    notes: ''
                  });
                  setShowStockModal(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {tr('تعديل مخزون', 'Ajuster Stock')}
              </button>

              {warehouses.length > 1 && (
                <button
                  onClick={() => {
                    setTransferForm({
                      product_id: products[0]?.id || '',
                      from_warehouse_id: warehouses[0]?.id || '',
                      to_warehouse_id: warehouses[1]?.id || '',
                      transfer_qty: 1,
                      notes: ''
                    });
                    setShowTransferModal(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  {tr('تحويل بين مستودعين', 'Transfert Inter-Entrepôt')}
                </button>
              )}
            </>
          )}

          {activeTab === 'warehouses' && (
            <button
              onClick={() => {
                setEditingWarehouse({ code: `WH-${Date.now().toString().slice(-4)}`, name_ar: '', name_fr: '', is_main: false, is_active: true });
                setShowWarehouseModal(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {tr('إضافة مستودع جديد', 'Ajouter un entrepôt')}
            </button>
          )}

          {activeTab === 'variants' && (
            <button
              onClick={() => {
                setEditingVariant({ product_id: products[0]?.id || '', name_ar: '', name_fr: '', options: {}, stock_quantity: 0 });
                setShowVariantModal(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {tr('إضافة متغير جديد', 'Ajouter une variante')}
            </button>
          )}

          {activeTab === 'suppliers' && (
            <button
              onClick={() => {
                setEditingSupplier({ code: `SUP-${Date.now().toString().slice(-4)}`, name: '', is_active: true });
                setShowSupplierModal(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {tr('إضافة مورد جديد', 'Nouveau Fournisseur')}
            </button>
          )}

          {activeTab === 'pos' && (
            <button
              onClick={() => {
                setPoForm({
                  supplier_id: suppliers[0]?.id || '',
                  warehouse_id: mainWarehouse?.id || warehouses[0]?.id || '',
                  items: products[0] ? [{ product_id: products[0].id, product_name: products[0].name_ar || products[0].name_fr, quantity_ordered: 10, unit_cost: Number(products[0].cost_price || products[0].price || 0) }] : [],
                  expected_delivery_date: '',
                  notes: ''
                });
                setShowPOModal(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {tr('إنشاء أمر شراء (PO)', 'Nouveau Bon de Commande')}
            </button>
          )}
        </div>
      </div>

      {/* --- TAB 1: STOCK LEVELS --- */}
      {activeTab === 'stock' && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-900 text-slate-400 font-medium">
                <tr>
                  <th className="p-4">{tr('المنتج', 'Produit')}</th>
                  <th className="p-4">{tr('SKU', 'SKU')}</th>
                  <th className="p-4">{tr('المستودع الرئيسي', 'Entrepôt Principal')}</th>
                  {warehouses
                    .filter((w) => !w.is_main)
                    .map((w) => (
                      <th key={w.id} className="p-4">
                        {isAr ? w.name_ar : w.name_fr}
                      </th>
                    ))}
                  <th className="p-4">{tr('إجمالي المخزون', 'Stock Total')}</th>
                  <th className="p-4">{tr('الحالة', 'Statut')}</th>
                  <th className="p-4 text-center">{tr('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 text-slate-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6 + warehouses.length} className="p-8 text-center text-slate-400">
                      {tr('لا توجد منتجات مطابقة', 'Aucun produit trouvé')}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const pLevels = inventoryLevels.filter((l) => l.product_id === p.id && !l.variant_id);
                    const mainStock = pLevels.find((l) => l.warehouse_id === mainWarehouse?.id)?.quantity || 0;
                    const totalStock = p.stock_quantity ?? 0;
                    const lowThreshold = p.low_stock_threshold || 5;

                    let statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {tr('متوفر', 'En Stock')}
                      </span>
                    );

                    if (totalStock === 0) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3.5 h-3.5" />
                          {tr('منتهي', 'Rupture')}
                        </span>
                      );
                    } else if (totalStock <= lowThreshold) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {tr('منخفض', 'Stock Faible')}
                        </span>
                      );
                    }

                    return (
                      <tr key={p.id} className="hover:bg-slate-750/50 transition-colors">
                        <td className="p-4 font-medium text-white">
                          <div className="flex items-center gap-3">
                            {(p.images?.[0] || p.image_url) ? (
                              <img src={p.images?.[0] || p.image_url} alt="" className="w-10 h-10 object-cover rounded-lg bg-slate-700" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400 font-bold">
                                {p.name_ar?.[0] || 'P'}
                              </div>
                            )}
                            <div>
                              <div>{isAr ? p.name_ar : p.name_fr}</div>
                              <div className="text-xs text-slate-400 font-mono">{p.price} دج</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 font-mono text-xs text-slate-400">{p.sku || '-'}</td>

                        <td className="p-4 font-bold text-emerald-400 font-mono text-base">{mainStock}</td>

                        {warehouses
                          .filter((w) => !w.is_main)
                          .map((w) => {
                            const whStock = pLevels.find((l) => l.warehouse_id === w.id)?.quantity || 0;
                            return (
                              <td key={w.id} className="p-4 font-mono font-medium text-slate-300">
                                {whStock}
                              </td>
                            );
                          })}

                        <td className="p-4 font-bold font-mono text-white text-base">{totalStock}</td>

                        <td className="p-4">{statusBadge}</td>

                        <td className="p-4 text-center">
                          <button
                            onClick={() => {
                              setStockForm({
                                product_id: p.id,
                                warehouse_id: mainWarehouse?.id || warehouses[0]?.id || '',
                                qty_change: 0,
                                movement_type: 'manual_adjustment',
                                reference_number: '',
                                notes: ''
                              });
                              setShowStockModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors"
                            title={tr('تعديل المخزون', 'Ajuster stock')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 2: WAREHOUSES --- */}
      {activeTab === 'warehouses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((wh) => (
            <div key={wh.id} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-4 relative">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                    <WarehouseIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">{isAr ? wh.name_ar : wh.name_fr}</h3>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                      <span>{wh.code}</span>
                      {wh.is_main && (
                        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          {tr('الرئيسي', 'Principal')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingWarehouse(wh);
                      setShowWarehouseModal(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {!wh.is_main && (
                    <button
                      onClick={() => handleDeleteWarehouse(wh)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-300 pt-2 border-t border-slate-700/60">
                <div className="flex items-center gap-2 text-slate-400">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{wh.address || wh.city || tr('الجزائر العاصمة', 'Alger')}</span>
                </div>
                {wh.manager_name && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{wh.manager_name}</span>
                  </div>
                )}
                {wh.phone && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-mono">{wh.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- TAB 3: PRODUCT VARIANTS --- */}
      {activeTab === 'variants' && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-900 text-slate-400 font-medium">
                <tr>
                  <th className="p-4">{tr('اسم المتغير', 'Nom de variante')}</th>
                  <th className="p-4">{tr('المنتج الأصل', 'Produit parent')}</th>
                  <th className="p-4">{tr('SKU', 'SKU')}</th>
                  <th className="p-4">{tr('الخيارات (Color/Size)', 'Options')}</th>
                  <th className="p-4">{tr('سعر مخصص (دج)', 'Prix spécial')}</th>
                  <th className="p-4">{tr('كمية المخزون', 'Stock')}</th>
                  <th className="p-4 text-center">{tr('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 text-slate-200">
                {variants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      {tr('لا توجد متغيرات مسجلة للمنتجات', 'Aucune variante enregistrée')}
                    </td>
                  </tr>
                ) : (
                  variants.map((v) => {
                    const parentProd = products.find((p) => p.id === v.product_id);
                    return (
                      <tr key={v.id} className="hover:bg-slate-750/50 transition-colors">
                        <td className="p-4 font-semibold text-white">{isAr ? v.name_ar : v.name_fr}</td>
                        <td className="p-4 text-slate-300">{parentProd ? (isAr ? parentProd.name_ar : parentProd.name_fr) : '-'}</td>
                        <td className="p-4 font-mono text-xs text-slate-400">{v.sku || '-'}</td>
                        <td className="p-4 font-mono text-xs text-slate-300">
                          {Object.entries(v.options || {})
                            .map(([k, val]) => `${k}: ${val}`)
                            .join(', ') || '-'}
                        </td>
                        <td className="p-4 font-mono text-emerald-400">{v.price_override ? `${v.price_override} دج` : tr('الافتراضي', 'Par défaut')}</td>
                        <td className="p-4 font-mono font-bold text-white text-base">{v.stock_quantity}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingVariant(v);
                                setShowVariantModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteVariant(v)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition-colors"
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
        </div>
      )}

      {/* --- TAB 4: MOVEMENTS AUDIT LOG --- */}
      {activeTab === 'movements' && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between text-xs text-slate-400">
            <span>{tr('سجل دائم وغير قابل للتعديل لكافة عمليات الخصم، الإضافة والنقل في المخزون', 'Registre immuable des mouvements de stock')}</span>
            <span className="font-mono">{movements.length} {tr('حركة مسجلة', 'mouvements')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-900 text-slate-400 font-medium">
                <tr>
                  <th className="p-4">{tr('التاريخ والوقت', 'Date & Heure')}</th>
                  <th className="p-4">{tr('النوع', 'Type')}</th>
                  <th className="p-4">{tr('المنتج / المتغير', 'Produit')}</th>
                  <th className="p-4">{tr('المستودع', 'Entrepôt')}</th>
                  <th className="p-4">{tr('التغيير', 'Changement')}</th>
                  <th className="p-4">{tr('السابق -> الجديد', 'Ancien -> Nouveau')}</th>
                  <th className="p-4">{tr('المرجع', 'Référence')}</th>
                  <th className="p-4">{tr('بواسطة', 'Par')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 text-slate-200">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      {tr('لا توجد حركات مخزون مسجلة بعد', 'Aucun mouvement enregistré')}
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const prod = products.find((p) => p.id === m.product_id);
                    const wh = warehouses.find((w) => w.id === m.warehouse_id);
                    const targetWh = warehouses.find((w) => w.id === m.target_warehouse_id);

                    const isPositive = m.quantity_change > 0;

                    return (
                      <tr key={m.id} className="hover:bg-slate-750/50 transition-colors">
                        <td className="p-4 font-mono text-xs text-slate-400">
                          {new Date(m.created_at).toLocaleString(isAr ? 'ar-DZ' : 'fr-FR')}
                        </td>
                        <td className="p-4 font-semibold">
                          <span className="bg-slate-700 text-slate-200 px-2.5 py-1 rounded-full text-xs font-mono">
                            {m.movement_type}
                          </span>
                        </td>
                        <td className="p-4 font-medium text-white">{prod ? (isAr ? prod.name_ar : prod.name_fr) : m.product_id}</td>
                        <td className="p-4 text-slate-300">
                          {wh ? (isAr ? wh.name_ar : wh.name_fr) : '-'}
                          {targetWh && <span className="text-emerald-400"> {'->'} {isAr ? targetWh.name_ar : targetWh.name_fr}</span>}
                        </td>
                        <td className={`p-4 font-mono font-bold text-base ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? `+${m.quantity_change}` : m.quantity_change}
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-400">
                          {m.previous_stock} {'->'} <span className="text-white font-bold">{m.new_stock}</span>
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-400">{m.reference_number || '-'}</td>
                        <td className="p-4 text-xs text-slate-400">{m.created_by || 'Admin'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 5: SUPPLIERS --- */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map((sup) => (
            <div key={sup.id} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-white text-lg">{sup.name}</h3>
                  <div className="text-xs text-slate-400 font-mono">{sup.code}</div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingSupplier(sup);
                      setShowSupplierModal(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(sup)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-300 pt-2 border-t border-slate-700/60">
                {sup.contact_person && <div>👤 {sup.contact_person}</div>}
                {sup.phone && <div>📞 {sup.phone}</div>}
                {sup.email && <div>✉️ {sup.email}</div>}
                {sup.payment_terms && <div className="text-xs text-emerald-400">💳 {sup.payment_terms}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- TAB 6: SUPPLIER PURCHASE ORDERS --- */}
      {activeTab === 'pos' && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-900 text-slate-400 font-medium">
                <tr>
                  <th className="p-4">{tr('رقم أمر الشراء', 'PO #')}</th>
                  <th className="p-4">{tr('المورد', 'Fournisseur')}</th>
                  <th className="p-4">{tr('المستودع الهدف', 'Entrepôt Cible')}</th>
                  <th className="p-4">{tr('إجمالي التكلفة', 'Coût Total')}</th>
                  <th className="p-4">{tr('الحالة', 'Statut')}</th>
                  <th className="p-4">{tr('التاريخ', 'Date')}</th>
                  <th className="p-4 text-center">{tr('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 text-slate-200">
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      {tr('لا توجد أوامر شراء للموردين مسجلة', 'Aucun bon de commande trouvé')}
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map((po) => {
                    const sup = suppliers.find((s) => s.id === po.supplier_id);
                    const wh = warehouses.find((w) => w.id === po.warehouse_id);

                    let statusBadge = (
                      <span className="bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full text-xs font-semibold">
                        {po.status}
                      </span>
                    );
                    if (po.status === 'received') {
                      statusBadge = (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
                          {tr('مستلم بالكامل', 'Reçu')}
                        </span>
                      );
                    } else if (po.status === 'ordered') {
                      statusBadge = (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
                          {tr('قيد الانتظار', 'En commande')}
                        </span>
                      );
                    }

                    return (
                      <tr key={po.id} className="hover:bg-slate-750/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-white">{po.po_number}</td>
                        <td className="p-4 text-slate-300">{sup ? sup.name : po.supplier_id}</td>
                        <td className="p-4 text-slate-300">{wh ? (isAr ? wh.name_ar : wh.name_fr) : po.warehouse_id}</td>
                        <td className="p-4 font-mono font-bold text-emerald-400">{po.total_cost} دج</td>
                        <td className="p-4">{statusBadge}</td>
                        <td className="p-4 font-mono text-xs text-slate-400">
                          {po.created_at ? new Date(po.created_at).toLocaleDateString(isAr ? 'ar-DZ' : 'fr-FR') : '-'}
                        </td>
                        <td className="p-4 text-center">
                          {po.status !== 'received' && (
                            <button
                              onClick={() => handleReceivePO(po)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1 mx-auto transition-colors"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              {tr('تأكيد الاستلام بالمخزون', 'Recevoir en stock')}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODAL: STOCK ADJUSTMENT --- */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Boxes className="w-5 h-5 text-emerald-400" />
              {tr('تعديل مخزون منتج (تسجيل حركة)', 'Ajuster le stock')}
            </h2>

            <form onSubmit={handleSaveStockAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{tr('اختر المنتج', 'Produit')}</label>
                <select
                  value={stockForm.product_id}
                  onChange={(e) => setStockForm({ ...stockForm, product_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {isAr ? p.name_ar : p.name_fr} (Stock: {p.stock_quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{tr('المستودع', 'Entrepôt')}</label>
                <select
                  value={stockForm.warehouse_id}
                  onChange={(e) => setStockForm({ ...stockForm, warehouse_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                  required
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isAr ? w.name_ar : w.name_fr} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  {tr('مقدار التغيير (موجب للإضافة، سالب للخصم)', 'Changement (+ pour ajout, - pour retrait)')}
                </label>
                <input
                  type="number"
                  value={stockForm.qty_change}
                  onChange={(e) => setStockForm({ ...stockForm, qty_change: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm font-mono"
                  placeholder="e.g. +10 or -5"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{tr('نوع الحركة', 'Type de mouvement')}</label>
                <select
                  value={stockForm.movement_type}
                  onChange={(e) => setStockForm({ ...stockForm, movement_type: e.target.value as MovementType })}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                >
                  <option value="manual_adjustment">{tr('تعديل يدوي (Manual Adjustment)', 'Ajustement manuel')}</option>
                  <option value="initial_seed">{tr('إضافة المخزون الأولي (Initial Seed)', 'Stock initial')}</option>
                  <option value="damaged_loss">{tr('خسارة / تالف (Damaged / Loss)', 'Perte / Endommagé')}</option>
                  <option value="supplier_receipt">{tr('استلام شحنة (Supplier Receipt)', 'Réception fournisseur')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{tr('رقم المرجع (اختياري)', 'Référence')}</label>
                <input
                  type="text"
                  value={stockForm.reference_number}
                  onChange={(e) => setStockForm({ ...stockForm, reference_number: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm font-mono"
                  placeholder="e.g. REF-1002"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-600"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-500"
                >
                  {tr('تأكيد التعديل', 'Confirmer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: WAREHOUSE TRANSFERS --- */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
              {tr('تحويل مخزون بين المستودعات', 'Transfert inter-entrepôt')}
            </h2>

            <form onSubmit={handleSaveTransfer} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{tr('المنتج', 'Produit')}</label>
                <select
                  value={transferForm.product_id}
                  onChange={(e) => setTransferForm({ ...transferForm, product_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {isAr ? p.name_ar : p.name_fr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('من مستودع', 'De l\'entrepôt')}</label>
                  <select
                    value={transferForm.from_warehouse_id}
                    onChange={(e) => setTransferForm({ ...transferForm, from_warehouse_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {isAr ? w.name_ar : w.name_fr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('إلى مستودع', 'Vers l\'entrepôt')}</label>
                  <select
                    value={transferForm.to_warehouse_id}
                    onChange={(e) => setTransferForm({ ...transferForm, to_warehouse_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {isAr ? w.name_ar : w.name_fr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{tr('الكمية المنقولة', 'Quantité à transférer')}</label>
                <input
                  type="number"
                  min="1"
                  value={transferForm.transfer_qty}
                  onChange={(e) => setTransferForm({ ...transferForm, transfer_qty: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm font-mono"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-600"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500"
                >
                  {tr('إجراء التحويل', 'Confirmer transfert')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD/EDIT WAREHOUSE --- */}
      {showWarehouseModal && editingWarehouse && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <WarehouseIcon className="w-5 h-5 text-emerald-400" />
              {editingWarehouse.id ? tr('تعديل المستودع', 'Modifier l\'entrepôt') : tr('إضافة مستودع جديد', 'Nouvel entrepôt')}
            </h2>

            <form onSubmit={handleSaveWarehouse} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('كود المستودع', 'Code')}</label>
                  <input
                    type="text"
                    value={editingWarehouse.code || ''}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, code: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('المسؤول', 'Responsable')}</label>
                  <input
                    type="text"
                    value={editingWarehouse.manager_name || ''}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, manager_name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('الاسم (بالعربية)', 'Nom (Arabe)')}</label>
                  <input
                    type="text"
                    value={editingWarehouse.name_ar || ''}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, name_ar: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('الاسم (بالفرنسية)', 'Nom (Français)')}</label>
                  <input
                    type="text"
                    value={editingWarehouse.name_fr || ''}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, name_fr: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('المدينة / المنطقة', 'Ville / Wilaya')}</label>
                  <input
                    type="text"
                    value={editingWarehouse.city || ''}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, city: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('العنوان', 'Adresse')}</label>
                  <input
                    type="text"
                    value={editingWarehouse.address || ''}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, address: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('الهاتف', 'Téléphone')}</label>
                  <input
                    type="text"
                    value={editingWarehouse.phone || ''}
                    onChange={(e) => setEditingWarehouse({ ...editingWarehouse, phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm font-mono"
                  />
                </div>
                <div className="flex items-center gap-4 pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(editingWarehouse.is_active ?? true)}
                      onChange={(e) => setEditingWarehouse({ ...editingWarehouse, is_active: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                    <span>{tr('مستودع نشط', 'Entrepôt actif')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(editingWarehouse.is_main ?? false)}
                      onChange={(e) => setEditingWarehouse({ ...editingWarehouse, is_main: e.target.checked })}
                      className="w-4 h-4 accent-indigo-500 rounded"
                    />
                    <span>{tr('مستودع رئيسي', 'Entrepôt principal')}</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWarehouseModal(false)}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-600"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-500"
                >
                  {tr('حفظ المستودع', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD/EDIT VARIANT --- */}
      {showVariantModal && editingVariant && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              {editingVariant.id ? tr('تعديل المتغير', 'Modifier la variante') : tr('إضافة متغير جديد', 'Nouvelle variante')}
            </h2>

            <form onSubmit={handleSaveVariant} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{tr('المنتج الأصل', 'Produit parent')}</label>
                <select
                  value={editingVariant.product_id}
                  onChange={(e) => setEditingVariant({ ...editingVariant, product_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {isAr ? p.name_ar : p.name_fr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('اسم المتغير (عربي)', 'Nom (Arabe)')}</label>
                  <input
                    type="text"
                    value={editingVariant.name_ar || ''}
                    onChange={(e) => setEditingVariant({ ...editingVariant, name_ar: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                    placeholder="e.g. أحمر - XL"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('اسم المتغير (فرنسي)', 'Nom (Français)')}</label>
                  <input
                    type="text"
                    value={editingVariant.name_fr || ''}
                    onChange={(e) => setEditingVariant({ ...editingVariant, name_fr: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                    placeholder="e.g. Rouge - XL"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('SKU المتغير', 'SKU')}</label>
                  <input
                    type="text"
                    value={editingVariant.sku || ''}
                    onChange={(e) => setEditingVariant({ ...editingVariant, sku: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm font-mono"
                    placeholder="VAR-RED-XL"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('سعر مخصص (اختياري)', 'Prix (optionnel)')}</label>
                  <input
                    type="number"
                    value={editingVariant.price_override || ''}
                    onChange={(e) => setEditingVariant({ ...editingVariant, price_override: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm font-mono"
                    placeholder="1800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVariantModal(false)}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-600"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-500"
                >
                  {tr('حفظ المتغير', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD/EDIT SUPPLIER --- */}
      {showSupplierModal && editingSupplier && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              {editingSupplier.id ? tr('تعديل المورد', 'Modifier le fournisseur') : tr('إضافة مورد جديد', 'Nouveau fournisseur')}
            </h2>

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('كود المورد', 'Code')}</label>
                  <input
                    type="text"
                    value={editingSupplier.code || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, code: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('اسم الشركة / المورد', 'Nom du fournisseur')}</label>
                  <input
                    type="text"
                    value={editingSupplier.name || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('الشخص المسؤول', 'Contact')}</label>
                  <input
                    type="text"
                    value={editingSupplier.contact_person || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, contact_person: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('الهاتف', 'Téléphone')}</label>
                  <input
                    type="text"
                    value={editingSupplier.phone || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('البريد الإلكتروني', 'Email')}</label>
                  <input
                    type="email"
                    value={editingSupplier.email || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                    placeholder="supplier@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('شروط الدفع', 'Conditions de paiement')}</label>
                  <input
                    type="text"
                    value={editingSupplier.payment_terms || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, payment_terms: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                    placeholder="e.g. 30 days net / 50% advance"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{tr('العنوان', 'Adresse')}</label>
                <input
                  type="text"
                  value={editingSupplier.address || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                  placeholder="Street, City, State"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{tr('ملاحظات', 'Notes')}</label>
                <textarea
                  value={editingSupplier.notes || ''}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, notes: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                  rows={2}
                  placeholder="Additional notes or contract terms..."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(editingSupplier.is_active ?? true)}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, is_active: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <span>{tr('مورد نشط', 'Fournisseur actif')}</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-600"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-500"
                >
                  {tr('حفظ المورد', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE SUPPLIER PO --- */}
      {showPOModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-xl space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-400" />
              {tr('إنشاء أمر شراء للمورد (PO)', 'Nouveau bon de commande fournisseur')}
            </h2>

            <form onSubmit={handleSavePO} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('المورد', 'Fournisseur')}</label>
                  <select
                    value={poForm.supplier_id}
                    onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                    required
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">{tr('مستودع الاستلام', 'Entrepôt de réception')}</label>
                  <select
                    value={poForm.warehouse_id}
                    onChange={(e) => setPoForm({ ...poForm, warehouse_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 text-sm"
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {isAr ? w.name_ar : w.name_fr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <label className="block text-xs text-slate-400">{tr('عناصر الشحنة', 'Articles commandés')}</label>
                {poForm.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-900 p-3 rounded-xl border border-slate-700">
                    <select
                      value={item.product_id}
                      onChange={(e) => {
                        const selectedP = products.find((p) => p.id === e.target.value);
                        const newItems = [...poForm.items];
                        newItems[idx] = {
                          ...newItems[idx],
                          product_id: e.target.value,
                          product_name: selectedP ? selectedP.name_ar || selectedP.name_fr : '',
                          unit_cost: Number(selectedP?.cost_price || selectedP?.price || 0)
                        };
                        setPoForm({ ...poForm, items: newItems });
                      }}
                      className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {isAr ? p.name_ar : p.name_fr}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity_ordered}
                      onChange={(e) => {
                        const newItems = [...poForm.items];
                        newItems[idx].quantity_ordered = Number(e.target.value);
                        setPoForm({ ...poForm, items: newItems });
                      }}
                      className="w-20 bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs font-mono"
                    />

                    <input
                      type="number"
                      placeholder="Unit Cost"
                      value={item.unit_cost}
                      onChange={(e) => {
                        const newItems = [...poForm.items];
                        newItems[idx].unit_cost = Number(e.target.value);
                        setPoForm({ ...poForm, items: newItems });
                      }}
                      className="w-24 bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs font-mono"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPOModal(false)}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-600"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-500"
                >
                  {tr('إنشاء أمر الشراء', 'Créer PO')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CONFIRMATION MODAL FOR DELETION --- */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">
                {deleteConfirm.type === 'warehouse'
                  ? tr('تأكيد حذف المستودع', 'Confirmer la suppression de l\'entrepôt')
                  : deleteConfirm.type === 'supplier'
                  ? tr('تأكيد حذف المورد', 'Confirmer la suppression du fournisseur')
                  : tr('تأكيد حذف المتغير', 'Confirmer la suppression de la variante')}
              </h3>
            </div>

            <p className="text-sm text-slate-300">
              {tr(
                `هل أنت متأكد من رغبتك في حذف "${deleteConfirm.name}" نهائياً من قاعدة البيانات؟`,
                `Êtes-vous sûr de vouloir supprimer définitivement "${deleteConfirm.name}" de la base de données ?`
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                {tr('إلغاء', 'Annuler')}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{tr('جاري الحذف...', 'Suppression...')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>{tr('تأكيد الحذف', 'Confirmer')}</span>
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
