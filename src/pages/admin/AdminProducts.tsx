import { useState, useEffect } from 'react';
import { 
  Package, Plus, Search, Edit2, Trash2, CheckCircle2, AlertCircle, 
  X, RefreshCw, Loader2
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Product, Category } from '../../types';
import ProductImageGalleryEditor from '../../components/ProductImageGalleryEditor';
import { deleteEntity } from '../../lib/deleteService';
import { ensureAuthenticatedAdmin } from '../../lib/storage';
import { adjustStockInDB, fetchWarehousesFromDB } from '../../lib/inventoryStore';

export default function AdminProducts() {
  const { lang, formatPrice } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Delete Confirmation Modal State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name_ar: '',
    name_fr: '',
    slug: '',
    description_ar: '',
    description_fr: '',
    category_id: '',
    sku: '',
    price: 0,
    compare_price: 0,
    wholesale_price: 0,
    stock_quantity: 0,
    galleryImages: [] as string[],
    is_active: true,
    is_featured: false,
    moq: 1,
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch products warning:', error.message);
      }

      let list = (data || []) as Product[];
      const saved = localStorage.getItem('local_admin_products') || localStorage.getItem('products');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const map = new Map<string, Product>();
            list.forEach(p => map.set(p.id, p));
            parsed.forEach((p: Product) => {
              if (p && p.id) {
                map.set(p.id, { ...(map.get(p.id) || {}), ...p });
              }
            });
            list = Array.from(map.values());
          }
        } catch {
          // fallback
        }
      }

      setProducts(list);
      localStorage.setItem('local_admin_products', JSON.stringify(list));
      localStorage.setItem('products', JSON.stringify(list));
    } catch (err) {
      console.error('Fetch products error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await supabase.from('categories').select('*').order('name_ar');
      if (data) setCategories(data as Category[]);
    } catch {
      // ignore
    }
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name_ar: '',
      name_fr: '',
      slug: '',
      description_ar: '',
      description_fr: '',
      category_id: categories[0]?.id || '',
      sku: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
      price: 0,
      compare_price: 0,
      wholesale_price: 0,
      stock_quantity: 10,
      galleryImages: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80'],
      is_active: true,
      is_featured: false,
      moq: 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    const imagesArray = p.images && p.images.length > 0 
      ? p.images 
      : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80'];

    setFormData({
      name_ar: p.name_ar || '',
      name_fr: p.name_fr || '',
      slug: p.slug || '',
      description_ar: p.description_ar || '',
      description_fr: p.description_fr || '',
      category_id: p.category_id || '',
      sku: p.sku || '',
      price: p.price || 0,
      compare_price: p.compare_price || 0,
      wholesale_price: p.wholesale_price || 0,
      stock_quantity: p.stock_quantity ?? 0,
      galleryImages: imagesArray,
      is_active: p.is_active ?? true,
      is_featured: p.is_featured ?? false,
      moq: p.moq || 1,
    });
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name_ar.trim() && !formData.name_fr.trim()) {
      showToast(tr('يرجى إدخال اسم المنتج', 'Veuillez entrer le nom du produit'), 'error');
      return;
    }

    if (Number(formData.price) <= 0) {
      showToast(tr('السعر يجب أن يكون أكبر من 0', 'Le prix doit être supérieur à 0'), 'error');
      return;
    }

    // Ensure and verify Supabase Auth session first
    const isAuthOk = await ensureAuthenticatedAdmin();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user && !isAuthOk) {
      showToast(
        tr('جلسة Supabase الخاصة بالمشرف مفقودة. يرجى تسجيل الدخول مجدداً.', 'Admin Supabase session is missing. Please sign in again.'),
        'error'
      );
      return;
    }

    setSaving(true);

    const imageList = formData.galleryImages.filter(Boolean);

    const isValidUuid = (str?: string | null) => 
      !!str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const isCategoryInDb = isValidUuid(formData.category_id) && categories.some(c => c.id === formData.category_id);
    const validCategoryId = isCategoryInDb ? formData.category_id : null;

    const rawSlug = (formData.slug || '').trim();
    const fallbackSlug = (formData.name_fr || formData.name_ar || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const generatedSlug = editingProduct 
      ? (rawSlug || fallbackSlug)
      : (rawSlug ? `${rawSlug}-${Date.now()}` : `${fallbackSlug}-${Date.now()}`);

    const cleanSku = (formData.sku || '').trim() || `SKU-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    // Schema payload matched strictly to Supabase database columns
    const productDbPayload = {
      name_ar: formData.name_ar || formData.name_fr || 'منتج جديد',
      name_fr: formData.name_fr || formData.name_ar || 'Nouveau Produit',
      slug: generatedSlug,
      description_ar: formData.description_ar || null,
      description_fr: formData.description_fr || null,
      category_id: validCategoryId,
      sku: cleanSku,
      price: Number(formData.price),
      compare_price: Number(formData.compare_price) || null,
      wholesale_price: Number(formData.wholesale_price) || null,
      stock_quantity: Number(formData.stock_quantity) || 0,
      moq: Number(formData.moq) || 1,
      images: imageList.length > 0 ? imageList : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80'],
      is_active: formData.is_active,
      is_featured: formData.is_featured,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingProduct) {
        // UPDATE existing product in Supabase database
        const { data, error } = await supabase
          .from('products')
          .update(productDbPayload)
          .eq('id', editingProduct.id)
          .select('*');

        if (error) {
          console.error('Supabase product update error:', error);
          showToast(
            tr(`فشل تحديث المنتج في قاعدة البيانات: ${error.message}`, `Échec de la mise à jour dans la base de données: ${error.message}`),
            'error'
          );
          return;
        }

        if (!data || data.length === 0) {
          console.error('Supabase product update returned no rows');
          showToast(
            tr('لم يتم تحديث أي صف في قاعدة البيانات (ربما تم حذف المنتج أو تم رفض الإذن)', 'Aucune ligne mise à jour dans la base de données'),
            'error'
          );
          return;
        }

        const savedProd = data[0] as Product;

        // Sync main warehouse stock level
        try {
          const warehouses = await fetchWarehousesFromDB();
          const mainWh = warehouses.find(w => w.is_main) || warehouses[0];
          if (mainWh && savedProd.id) {
            const stockDiff = Number(formData.stock_quantity) - (editingProduct.stock_quantity || 0);
            if (stockDiff !== 0) {
              await adjustStockInDB({
                product_id: savedProd.id,
                warehouse_id: mainWh.id,
                qty_change: stockDiff,
                movement_type: 'manual_adjustment',
                reference_number: 'ADMIN-PRODUCT-EDIT',
                notes: 'Stock updated from Product Edit form'
              });
            }
          }
        } catch (e) {
          console.warn('Inventory level sync warning:', e);
        }

        const updatedList = products.map(p => 
          p.id === editingProduct.id ? savedProd : p
        );
        setProducts(updatedList);
        localStorage.setItem('local_admin_products', JSON.stringify(updatedList));
        localStorage.setItem('products', JSON.stringify(updatedList));
        window.dispatchEvent(new Event('products_updated'));
        window.dispatchEvent(new Event('storage'));
        showToast(tr('تم تحديث المنتج بنجاح في قاعدة البيانات', 'Produit mis à jour dans la base de données avec succès'), 'success');
      } else {
        // CREATE new product with valid UUID in Supabase database
        const id = crypto.randomUUID();
        const newProd = {
          id,
          ...productDbPayload,
          short_description_ar: null,
          short_description_fr: null,
          cost_price: 0,
          low_stock_threshold: 5,
          weight: 0.5,
          attributes: {},
          tags: [],
          rating: 5,
          review_count: 0,
          sales_count: 0,
          is_flash_sale: false,
          flash_sale_ends_at: null,
          created_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from('products')
          .insert([newProd])
          .select('*');

        if (error) {
          console.error('Supabase product insert error:', error);
          showToast(
            tr(`فشل إضافة المنتج في قاعدة البيانات: ${error.message}`, `Échec de l'ajout dans la base de données: ${error.message}`),
            'error'
          );
          return;
        }

        if (!data || data.length === 0) {
          console.error('Supabase product insert returned no rows');
          showToast(
            tr('لم يتم حفظ المنتج في قاعدة البيانات', 'Échec de l\'enregistrement dans la base de données'),
            'error'
          );
          return;
        }

        const savedProd = data[0] as Product;

        // Seed initial inventory level in main warehouse
        try {
          const warehouses = await fetchWarehousesFromDB();
          const mainWh = warehouses.find(w => w.is_main) || warehouses[0];
          if (mainWh && savedProd.id && Number(formData.stock_quantity) > 0) {
            await adjustStockInDB({
              product_id: savedProd.id,
              warehouse_id: mainWh.id,
              qty_change: Number(formData.stock_quantity),
              movement_type: 'initial_seed',
              reference_number: 'NEW-PRODUCT-SEED',
              notes: 'Initial stock on product creation'
            });
          }
        } catch (e) {
          console.warn('Initial inventory seed warning:', e);
        }
        const newList = [savedProd, ...products.filter(p => p.id !== savedProd.id)];
        setProducts(newList);
        localStorage.setItem('local_admin_products', JSON.stringify(newList));
        localStorage.setItem('products', JSON.stringify(newList));
        window.dispatchEvent(new Event('products_updated'));
        window.dispatchEvent(new Event('storage'));
        showToast(tr('تم إضافة المنتج بنجاح إلى قاعدة البيانات', 'Produit ajouté à la base de données avec succès'), 'success');
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Save product error:', err);
      showToast(tr('حدث خطأ أثناء حفظ المنتج', 'Erreur lors de l\'enregistrement du produit'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;

    // Ensure and verify Supabase Auth session first
    const isAuthOk = await ensureAuthenticatedAdmin();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user && !isAuthOk) {
      showToast(
        tr('جلسة Supabase الخاصة بالمشرف مفقودة. يرجى تسجيل الدخول مجدداً.', 'Admin Supabase session is missing. Please sign in again.'),
        'error'
      );
      return;
    }

    setIsDeleting(true);
    try {
      const storageFiles = (productToDelete.images || []).map(url => ({
        bucket: 'product-images',
        urlOrPath: url,
      }));

      const res = await deleteEntity({
        tableName: 'products',
        id: productToDelete.id,
        storageFiles,
        localStorageKeys: ['local_admin_products', 'products'],
        eventToDispatch: 'products_updated',
      });

      if (!res.success) {
        const errorMsg = res.error || 'Database delete operation failed.';
        console.error('Delete product DB error:', errorMsg);
        showToast(
          tr(`فشل حذف المنتج من قاعدة البيانات: ${errorMsg}`, `Échec de la suppression dans la base de données: ${errorMsg}`),
          'error'
        );
        return;
      }

      // Refresh product list locally and in localStorage cache only AFTER DB delete succeeds
      const updatedList = products.filter(p => p.id !== productToDelete.id);
      setProducts(updatedList);
      localStorage.setItem('local_admin_products', JSON.stringify(updatedList));
      localStorage.setItem('products', JSON.stringify(updatedList));
      window.dispatchEvent(new Event('products_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast(tr('تم حذف المنتج وجميع صوره من قاعدة البيانات بنجاح', 'Produit et ses images supprimés de la base de données avec succès'), 'success');
      setProductToDelete(null);
    } catch (err: unknown) {
      console.error('Delete product error:', err);
      showToast(err instanceof Error ? err.message : tr('خطأ أثناء الحذف', 'Erreur de suppression'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (product: Product) => {
    // Ensure and verify Supabase Auth session first
    const isAuthOk = await ensureAuthenticatedAdmin();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user && !isAuthOk) {
      showToast(
        tr('جلسة Supabase الخاصة بالمشرف مفقودة. يرجى تسجيل الدخول مجدداً.', 'Admin Supabase session is missing. Please sign in again.'),
        'error'
      );
      return;
    }

    const updatedStatus = !product.is_active;
    try {
      const { error } = await supabase.from('products').update({ is_active: updatedStatus }).eq('id', product.id);
      if (error) {
        console.error('Toggle status error:', error);
        showToast(tr(`فشل تغيير حالة المنتج في قاعدة البيانات: ${error.message}`, `Erreur: ${error.message}`), 'error');
        return;
      }
      const newList = products.map(p => p.id === product.id ? { ...p, is_active: updatedStatus } : p);
      setProducts(newList);
      localStorage.setItem('local_admin_products', JSON.stringify(newList));
      localStorage.setItem('products', JSON.stringify(newList));
      window.dispatchEvent(new Event('products_updated'));
      window.dispatchEvent(new Event('storage'));
      showToast(
        updatedStatus
          ? tr('تم تفعيل المنتج في قاعدة البيانات', 'Produit activé dans la base de données')
          : tr('تم إلغاء تفعيل المنتج في قاعدة البيانات', 'Produit désactivé dans la base de données'),
        'success'
      );
    } catch (err) {
      console.error('Toggle status error:', err);
    }
  };

  const filtered = products.filter(p => {
    const matchesSearch = 
      p.name_ar?.toLowerCase().includes(search.toLowerCase()) ||
      p.name_fr?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-7 h-7 text-emerald-400" />
            {tr('إدارة المنتجات', 'Gestion des Produits')}
          </h1>
          <p className="text-sm text-slate-400">
            {tr('إضافة، تعديل، حذف والتحكم بمخزون المنتجات', 'Ajoutez, modifiez, supprimez et gérez vos stocks')}
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-emerald-950/40"
        >
          <Plus className="w-5 h-5" />
          {tr('إضافة منتج جديد', 'Nouveau Produit')}
        </button>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 flex items-center gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('بحث باسم المنتج أو الرمز (SKU)...', 'Rechercher par nom ou SKU...')}
            className="w-full bg-transparent text-sm text-slate-100 focus:outline-none"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-950 text-sm text-slate-200 border border-slate-800 rounded-lg p-3 focus:outline-none focus:border-emerald-500"
        >
          <option value="all">{tr('جميع التصنيفات', 'Toutes les catégories')}</option>
          {categories.filter(c => !c.parent_id).map(parent => {
            const children = categories.filter(c => c.parent_id === parent.id);
            return (
              <optgroup key={parent.id} label={isAr ? parent.name_ar : parent.name_fr}>
                <option value={parent.id}>
                  {isAr ? parent.name_ar : parent.name_fr} ({tr('الرئيسي', 'Parent')})
                </option>
                {children.map(child => (
                  <option key={child.id} value={child.id}>
                    &nbsp;&nbsp;&nbsp;↳ {isAr ? child.name_ar : child.name_fr}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
          <p>{tr('جاري تحميل المنتجات...', 'Chargement des produits...')}</p>
        </div>
      ) : (
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto shadow-sm">
          <table className="w-full text-sm text-slate-300 text-start">
            <thead className="bg-slate-900 border-b border-slate-800 text-xs text-slate-400 uppercase">
              <tr>
                <th className="py-3 px-4 text-start">{tr('المنتج', 'Produit')}</th>
                <th className="py-3 px-4 text-start">{tr('الرمز (SKU)', 'SKU')}</th>
                <th className="py-3 px-4 text-start">{tr('السعر', 'Prix')}</th>
                <th className="py-3 px-4 text-start">{tr('سعر الجملة', 'Prix Gros')}</th>
                <th className="py-3 px-4 text-start">{tr('المخزون', 'Stock')}</th>
                <th className="py-3 px-4 text-start">{tr('الحالة', 'Statut')}</th>
                <th className="py-3 px-4 text-center">{tr('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-slate-100 flex items-center gap-3">
                    <img 
                      src={p.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&auto=format&fit=crop&q=80'} 
                      alt={p.name_ar} 
                      className="w-10 h-10 object-cover rounded-md bg-slate-900 border border-slate-800 shrink-0"
                    />
                    <div>
                      <div className="font-semibold text-slate-100">
                        {isAr ? p.name_ar : (p.name_fr || p.name_ar)}
                      </div>
                      {p.is_featured && (
                        <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800/80 px-1.5 py-0.5 rounded">
                          {tr('مميز', 'En vedette')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-400">{p.sku || '—'}</td>
                  <td className="py-3.5 px-4 font-mono text-emerald-400 font-medium">
                    {formatPrice(p.price)}
                    {p.compare_price ? (
                      <span className="block text-xs line-through text-slate-500 font-normal">
                        {formatPrice(p.compare_price)}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-blue-400 font-medium">
                    {p.wholesale_price ? formatPrice(p.wholesale_price) : '—'}
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      p.stock_quantity <= 0 
                        ? 'bg-rose-950/60 text-rose-400 border border-rose-800' 
                        : p.stock_quantity <= 5 
                        ? 'bg-amber-950/60 text-amber-400 border border-amber-800' 
                        : 'bg-slate-900 text-slate-200'
                    }`}>
                      {p.stock_quantity}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => handleToggleActive(p)}
                      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        p.is_active 
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80 hover:bg-emerald-900/60' 
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {p.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {p.is_active ? (isAr ? 'نشط' : 'Actif') : (isAr ? 'معطل' : 'Inactif')}
                    </button>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenEditModal(p)}
                        title={tr('تعديل', 'Modifier')}
                        className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setProductToDelete(p)}
                        title={tr('حذف', 'Supprimer')}
                        className="p-1.5 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>{tr('لا توجد منتجات مطابقة للبحث', 'Aucun produit ne correspond')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE / EDIT PRODUCT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Package className="w-6 h-6 text-emerald-400" />
                {editingProduct 
                  ? tr('تعديل المنتج', 'Modifier le Produit') 
                  : tr('إضافة منتج جديد', 'Ajouter un Produit')}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('اسم المنتج (بالعربية)', 'Nom du Produit (Arabe)')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name_ar}
                    onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="مثال: هاتف ذكي برو"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('اسم المنتج (بالفرنسية)', 'Nom du Produit (Français)')}
                  </label>
                  <input
                    type="text"
                    value={formData.name_fr}
                    onChange={(e) => setFormData({ ...formData, name_fr: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="Ex: Smartphone Pro"
                  />
                </div>
              </div>

              {/* SKU & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('رمز المنتج (SKU)', 'Code Produit (SKU)')}
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('التصنيف', 'Catégorie')}
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">{tr('بدون تصنيف', 'Sans catégorie')}</option>
                    {categories.filter(c => !c.parent_id).map(parent => {
                      const children = categories.filter(c => c.parent_id === parent.id);
                      return (
                        <optgroup key={parent.id} label={isAr ? parent.name_ar : parent.name_fr}>
                          <option value={parent.id}>
                            {isAr ? parent.name_ar : parent.name_fr} ({tr('الرئيسي', 'Parent')})
                          </option>
                          {children.map(child => (
                            <option key={child.id} value={child.id}>
                              &nbsp;&nbsp;&nbsp;↳ {isAr ? child.name_ar : child.name_fr}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                <div>
                  <label className="block text-xs font-semibold text-emerald-400 mb-1">
                    {tr('سعر البيع (DZD)', 'Prix Vente (DZD)')} *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {tr('السعر الأصلي / الشطب', 'Prix Avant Remise')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.compare_price}
                    onChange={(e) => setFormData({ ...formData, compare_price: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-blue-400 mb-1">
                    {tr('سعر الجملة (B2B)', 'Prix Gros (B2B)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.wholesale_price}
                    onChange={(e) => setFormData({ ...formData, wholesale_price: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Stock & MOQ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('الكمية المتاحة بالمخزون', 'Quantité en Stock')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {tr('الحد الأدنى للطلب (MOQ)', 'Quantité Min. (MOQ)')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.moq}
                    onChange={(e) => setFormData({ ...formData, moq: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Product Image Gallery Editor */}
              <ProductImageGalleryEditor
                images={formData.galleryImages}
                onChange={(imgs) => setFormData({ ...formData, galleryImages: imgs })}
                onNotification={(type, msg) => showToast(msg, type)}
              />

              {/* Descriptions */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {tr('الوصف (بالعربية)', 'Description (Arabe)')}
                </label>
                <textarea
                  rows={2}
                  value={formData.description_ar}
                  onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  {tr('منتج نشط في المتجر', 'Produit actif')}
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  {tr('منتج مميز (الصفحة الرئيسية)', 'Produit en vedette')}
                </label>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {tr('إلغاء', 'Annuler')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {tr('حفظ المنتج', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DELETE PRODUCT CONFIRMATION MODAL */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-3 bg-rose-950/80 border border-rose-800/80 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">
                  {tr('تأكيد حذف المنتج نهائياً', 'Confirmer la suppression du produit')}
                </h3>
                <p className="text-xs text-slate-400">
                  {tr('هذا الإجراء لا يمكن التراجع عنه', 'Cette action est irréversible')}
                </p>
              </div>
            </div>

            {/* Product Card Details */}
            <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <img
                src={productToDelete.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&auto=format&fit=crop&q=80'}
                alt=""
                className="w-12 h-12 object-cover rounded-lg border border-slate-800 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-100 text-sm truncate">
                  {isAr ? productToDelete.name_ar : (productToDelete.name_fr || productToDelete.name_ar)}
                </h4>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                  <span>SKU: {productToDelete.sku || '—'}</span>
                  <span>·</span>
                  <span className="text-emerald-400 font-semibold">{formatPrice(productToDelete.price)}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-rose-950/30 border border-rose-900/40 p-3 rounded-xl text-rose-200">
              {tr(
                'سيتم حذف هذا المنتج بشكل دائم من قاعدة البيانات وإزالة جميع صوره المرفقة فوراً.',
                'Ce produit sera définitivement supprimé de la base de données ainsi que toutes ses images associées.'
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                {tr('إلغاء', 'Annuler')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProduct}
                disabled={isDeleting}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-rose-950/50"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {tr('حذف نهائي', 'Supprimer Définitivement')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
