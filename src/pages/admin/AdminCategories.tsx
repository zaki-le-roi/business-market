import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Edit, Trash2, X, Loader2, Save, Eye, EyeOff, FolderTree,
  AlertTriangle, ArrowUp, ArrowDown, Search, Download,
  Upload, ChevronRight, ChevronDown, Folder, CornerDownRight,
  Layers, CheckCircle2, FileSpreadsheet, ChevronLeft,
  ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { supabase } from '../../lib/supabase';
import { Category } from '../../types';
import ImageUploader, { UploadedImage } from '../../components/ImageUploader';
import { pathFromUrl, removeImage } from '../../lib/storage';
import { exportToCSV, parseCSVText } from '../../lib/csvHelper';

const slugify = (s: string) =>
  s.trim().toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

// Recursively get all descendant category IDs (to prevent circular parent selection)
function getDescendantCategoryIds(catId: string, allCategories: Category[]): string[] {
  let descendants: string[] = [];
  const children = allCategories.filter((c) => c.parent_id === catId);
  for (const child of children) {
    descendants.push(child.id);
    descendants = descendants.concat(getDescendantCategoryIds(child.id, allCategories));
  }
  return descendants;
}

// Recursively get cumulative product count (direct + child categories)
function getCumulativeCount(catId: string, allCategories: Category[], directCounts: Record<string, number>): number {
  let total = directCounts[catId] || 0;
  const descendantIds = getDescendantCategoryIds(catId, allCategories);
  for (const childId of descendantIds) {
    total += directCounts[childId] || 0;
  }
  return total;
}

interface FormState {
  name_ar: string;
  name_fr: string;
  slug: string;
  description_ar: string;
  description_fr: string;
  parent_id: string | null;
  sort_order: string;
  is_active: boolean;
  image_url: string;
}

const emptyForm: FormState = {
  name_ar: '',
  name_fr: '',
  slug: '',
  description_ar: '',
  description_fr: '',
  parent_id: null,
  sort_order: '0',
  is_active: true,
  image_url: '',
};

const toForm = (c: Category): FormState => ({
  name_ar: c.name_ar,
  name_fr: c.name_fr,
  slug: c.slug,
  description_ar: c.description_ar ?? '',
  description_fr: c.description_fr ?? '',
  parent_id: c.parent_id ?? null,
  sort_order: String(c.sort_order),
  is_active: c.is_active,
  image_url: c.image_url ?? '',
});

export default function AdminCategories() {
  const { lang, dir } = useLanguage();
  const { showToast } = useToast();
  const isAr = lang === 'ar';
  const tr = (ar: string, fr: string) => (isAr ? ar : fr);

  // Data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [directProductCounts, setDirectProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI / View states
  const [viewMode, setViewMode] = useState<'grid' | 'tree' | 'table'>('grid');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'parent_only' | 'child_only'>('all');
  const [countFilter, setCountFilter] = useState<'all' | 'has_products' | 'empty'>('all');
  const [parentFilter, setParentFilter] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal / Form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploadFolder, setUploadFolder] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [selectedCatIds, setSelectedCatIds] = useState<Record<string, boolean>>({});
  const [formErr, setFormErr] = useState<string | null>(null);

  // Delete Guard modal
  const [confirmDel, setConfirmDel] = useState<{ cat: Category; directCount: number; cumulativeCount: number } | null>(null);
  const [confirmDelInput, setConfirmDelInput] = useState('');

  // CSV Import Modal states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  // Load Data
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Load Data from Supabase
      const [{ data: cats, error: catsErr }, { data: prods }] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order').order('name_fr'),
        supabase.from('products').select('category_id'),
      ]);

      let loadedCats: Category[] = [];
      if (!catsErr && Array.isArray(cats)) {
        loadedCats = cats as Category[];
      } else {
        const localSaved = localStorage.getItem('local_admin_categories') || localStorage.getItem('categories');
        if (localSaved) {
          try {
            const parsed: Category[] = JSON.parse(localSaved);
            if (Array.isArray(parsed)) {
              loadedCats = parsed;
            }
          } catch {
            // fallback
          }
        }
      }

      setCategories(loadedCats);
      localStorage.setItem('local_admin_categories', JSON.stringify(loadedCats));
      localStorage.setItem('categories', JSON.stringify(loadedCats));

      const counts: Record<string, number> = {};
      (prods || []).forEach((p: { category_id: string | null }) => {
        if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      });
      setDirectProductCounts(counts);

      // Expand top-level parent categories by default in tree view
      const initialExpanded: Record<string, boolean> = {};
      loadedCats.forEach((c) => {
        if (!c.parent_id) initialExpanded[c.id] = true;
      });
      setExpandedNodes(initialExpanded);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Compute Cumulative Product Counts
  const cumulativeProductCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of categories) {
      map[cat.id] = getCumulativeCount(cat.id, categories, directProductCounts);
    }
    return map;
  }, [categories, directProductCounts]);

  // Allowed Parent Categories for Form (Prevents Circular Parent Relationships)
  const allowedParentCategories = useMemo(() => {
    if (!editing) return categories;
    const editingDescendants = getDescendantCategoryIds(editing.id, categories);
    return categories.filter((c) => c.id !== editing.id && !editingDescendants.includes(c.id));
  }, [categories, editing]);

  // Open Add Category Modal
  const openAdd = (presetParentId: string | null = null) => {
    setEditing(null);
    setForm({
      ...emptyForm,
      parent_id: presetParentId,
      sort_order: String(categories.length),
    });
    setImages([]);
    setUploadFolder('temp-' + Math.random().toString(36).slice(2, 10));
    setFormErr(null);
    setModalOpen(true);
  };

  // Open Edit Category Modal
  const openEdit = (c: Category) => {
    setEditing(c);
    setForm(toForm(c));
    setImages(c.image_url ? [{ url: c.image_url, path: pathFromUrl('category-images', c.image_url) ?? '' }] : []);
    setUploadFolder(c.id);
    setFormErr(null);
    setModalOpen(true);
  };

  // Save Category
  const save = async () => {
    if (!form.name_ar.trim() || !form.name_fr.trim()) {
      setFormErr(tr('الاسمان العربي والفرنسي مطلوبان', 'Les deux noms (AR et FR) sont requis'));
      return;
    }

    // Prevent selecting self as parent
    if (editing && form.parent_id === editing.id) {
      setFormErr(tr('لا يمكنك جعل الفئة أباً لنفسها', 'Une catégorie ne peut pas être son propre parent'));
      return;
    }

    setSaving(true);
    setFormErr(null);
    try {
      const validImg = images.find((i) => (i.url || i.preview) && !i.error);
      const imageUrl = validImg ? (validImg.url || validImg.preview || null) : (form.image_url.trim() || null);
      const generatedSlug = form.slug.trim() || slugify(form.name_fr) || slugify(form.name_ar) || `cat-${Date.now()}`;

      const payload = {
        name_ar: form.name_ar.trim(),
        name_fr: form.name_fr.trim(),
        slug: generatedSlug,
        description_ar: form.description_ar.trim() || null,
        description_fr: form.description_fr.trim() || null,
        parent_id: form.parent_id || null,
        image_url: imageUrl,
        sort_order: parseInt(form.sort_order) || 0,
        is_active: form.is_active,
      };

      if (editing) {
        const { error: uerr } = await supabase.from('categories').update(payload).eq('id', editing.id);
        if (uerr) console.warn('Supabase update warning:', uerr.message);

        const updatedCat: Category = { ...editing, ...payload, icon: editing.icon || null };
        const updatedList = categories.map(c => c.id === editing.id ? updatedCat : c);
        setCategories(updatedList);
        localStorage.setItem('local_admin_categories', JSON.stringify(updatedList));
        localStorage.setItem('categories', JSON.stringify(updatedList));
        window.dispatchEvent(new Event('categories_updated'));
        window.dispatchEvent(new Event('storage'));
        showToast(tr('تم تحديث الفئة بنجاح.', 'Catégorie mise à jour avec succès.'), 'success');
      } else {
        const newId = crypto.randomUUID();
        const newCat: Category = { id: newId, icon: null, ...payload };
        const { error: ierr } = await supabase.from('categories').insert([newCat]);
        if (ierr) console.warn('Supabase insert warning:', ierr.message);

        const newList = [...categories, newCat];
        setCategories(newList);
        localStorage.setItem('local_admin_categories', JSON.stringify(newList));
        localStorage.setItem('categories', JSON.stringify(newList));
        window.dispatchEvent(new Event('categories_updated'));
        window.dispatchEvent(new Event('storage'));
        showToast(tr('تم إنشاء الفئة بنجاح.', 'Catégorie créée avec succès.'), 'success');
      }
      setModalOpen(false);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : tr('فشل الحفظ', 'Échec de la sauvegarde');
      setFormErr(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Remove Category safely
  const remove = async (cat: Category) => {
    // Check if category has subcategories
    const children = categories.filter((c) => c.parent_id === cat.id);
    if (children.length > 0) {
      // Reassign children to cat's parent
      await supabase.from('categories').update({ parent_id: cat.parent_id }).eq('parent_id', cat.id);
    }

    if (cat.image_url) {
      const path = pathFromUrl('category-images', cat.image_url);
      if (path) await removeImage('category-images', path);
    }

    const { error: derr } = await supabase.from('categories').delete().eq('id', cat.id);
    if (derr) {
      if (derr.code === '23503' || derr.message?.toLowerCase().includes('foreign key')) {
        await supabase.from('categories').update({ is_active: false }).eq('id', cat.id);
        showToast(
          tr('تم تعطل الفئة بدلاً من حذفها لاحتوائها على منتجات.', 'Catégorie désactivée car elle contient des produits.'),
          'success'
        );
      } else {
        setError(derr.message);
        return;
      }
    } else {
      showToast(tr('تم حذف الفئة بنجاح.', 'Catégorie supprimée avec succès.'), 'success');
      const updatedList = categories.filter((c) => c.id !== cat.id);
      setCategories(updatedList);
      localStorage.setItem('local_admin_categories', JSON.stringify(updatedList));
      localStorage.setItem('categories', JSON.stringify(updatedList));
      window.dispatchEvent(new Event('categories_updated'));
      window.dispatchEvent(new Event('storage'));
    }

    setConfirmDel(null);
    setConfirmDelInput('');
    await load();
  };

  // Toggle active status
  const toggleActive = async (c: Category) => {
    const { error: terr } = await supabase.from('categories').update({ is_active: !c.is_active }).eq('id', c.id);
    if (terr) {
      setError(terr.message);
      return;
    }
    setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: !x.is_active } : x)));
    showToast(tr('تم تغيير حالة الفئة بنجاح', 'Statut mis à jour'), 'success');
  };

  // Move order up or down
  const moveOrder = async (c: Category, dirStr: 'up' | 'down') => {
    const siblings = categories
      .filter((x) => x.parent_id === c.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = siblings.findIndex((x) => x.id === c.id);
    const swapIdx = dirStr === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const other = siblings[swapIdx];

    await Promise.all([
      supabase.from('categories').update({ sort_order: other.sort_order }).eq('id', c.id),
      supabase.from('categories').update({ sort_order: c.sort_order }).eq('id', other.id),
    ]);
    await load();
  };

  // Bulk Delete Modal state
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  // Bulk Delete
  const selectedIds = Object.keys(selectedCatIds).filter((id) => selectedCatIds[id]);

  const handleOpenBulkDelete = () => {
    if (!selectedIds.length) return;
    setBulkDeleteError(null);
    setShowBulkDeleteModal(true);
  };

  const handleConfirmBulkDeleteCategories = async () => {
    if (!selectedIds.length) return;
    setIsBulkDeleting(true);
    setBulkDeleteError(null);
    try {
      const selectedCats = categories.filter((c) => selectedIds.includes(c.id));
      for (const c of selectedCats) {
        if (c.image_url) {
          const path = pathFromUrl('category-images', c.image_url);
          if (path) await removeImage('category-images', path);
        }
      }
      const { error: derr } = await supabase.from('categories').delete().in('id', selectedIds);
      if (derr) {
        await supabase.from('categories').update({ is_active: false }).in('id', selectedIds);
        showToast(tr('تم تعطيل بعض الفئات بدلاً من حذفها لاحتوائها على منتجات.', 'Catégories désactivées car elles contiennent des produits.'), 'success');
      } else {
        showToast(tr('تم حذف الفئات المحددة بنجاح.', 'Catégories supprimées.'), 'success');
        const remaining = categories.filter((c) => !selectedIds.includes(c.id));
        setCategories(remaining);
        localStorage.setItem('local_admin_categories', JSON.stringify(remaining));
        localStorage.setItem('categories', JSON.stringify(remaining));
        window.dispatchEvent(new Event('categories_updated'));
        window.dispatchEvent(new Event('storage'));
      }
      setSelectedCatIds({});
      setShowBulkDeleteModal(false);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error';
      setBulkDeleteError(msg);
      showToast(msg, 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Bulk Toggle Active Status
  const bulkToggleStatus = async (targetActive: boolean) => {
    if (!selectedIds.length) return;
    setSaving(true);
    try {
      const { error: uerr } = await supabase.from('categories').update({ is_active: targetActive }).in('id', selectedIds);
      if (uerr) throw uerr;
      showToast(tr('تم تحديث حالة الفئات بنجاح.', 'Statuts mis à jour avec succès.'), 'success');
      setSelectedCatIds({});
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Filtering Logic
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchNameAr = c.name_ar.toLowerCase().includes(q);
        const matchNameFr = c.name_fr.toLowerCase().includes(q);
        const matchSlug = c.slug.toLowerCase().includes(q);
        const matchDescAr = (c.description_ar || '').toLowerCase().includes(q);
        const matchDescFr = (c.description_fr || '').toLowerCase().includes(q);
        if (!matchNameAr && !matchNameFr && !matchSlug && !matchDescAr && !matchDescFr) {
          return false;
        }
      }

      // Status Filter
      if (statusFilter === 'active' && !c.is_active) return false;
      if (statusFilter === 'inactive' && c.is_active) return false;

      // Hierarchy Filter
      if (typeFilter === 'parent_only' && c.parent_id) return false;
      if (typeFilter === 'child_only' && !c.parent_id) return false;

      // Product Count Filter
      const dCount = directProductCounts[c.id] || 0;
      if (countFilter === 'has_products' && dCount === 0) return false;
      if (countFilter === 'empty' && dCount > 0) return false;

      // Parent Filter
      if (parentFilter !== 'all') {
        if (parentFilter === 'none' && c.parent_id) return false;
        if (parentFilter !== 'none' && c.parent_id !== parentFilter) return false;
      }

      return true;
    });
  }, [categories, searchTerm, statusFilter, typeFilter, countFilter, parentFilter, directProductCounts]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, countFilter, parentFilter, pageSize]);

  // Pagination calculation
  const totalItems = filteredCategories.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedCategories = useMemo(() => {
    return filteredCategories.slice(startIndex, startIndex + pageSize);
  }, [filteredCategories, startIndex, pageSize]);

  // Category map for quick parent lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  // CSV Export
  const handleExportCSV = () => {
    if (categories.length === 0) {
      showToast(tr('لا توجد فئات للتصدير', 'Aucune catégorie à exporter'), 'error');
      return;
    }

    const rows = categories.map((c) => {
      const parent = c.parent_id ? categoryMap.get(c.parent_id) : null;
      return {
        ID: c.id,
        'Parent ID': c.parent_id || '',
        'Parent Name': parent ? (isAr ? parent.name_ar : parent.name_fr) : 'Root',
        'Name (AR)': c.name_ar,
        'Name (FR)': c.name_fr,
        Slug: c.slug,
        Status: c.is_active ? 'Active' : 'Inactive',
        'Direct Products': directProductCounts[c.id] || 0,
        'Total Products': cumulativeProductCounts[c.id] || 0,
        'Sort Order': c.sort_order,
        'Created At': c.created_at || new Date().toISOString(),
      };
    });

    exportToCSV(rows, `categories_export_${new Date().toISOString().slice(0, 10)}`);
    showToast(tr('تم تصدير ملف الفئات بنجاح', 'Fichier CSV des catégories exporté'), 'success');
  };

  // Handle CSV Import Execution
  const executeCSVImport = async () => {
    let content = importText.trim();
    if (importFile) {
      content = await importFile.text();
    }

    if (!content) {
      showToast(tr('يرجى تقديم ملف أو نص CSV', 'Veuillez fournir un fichier ou du texte CSV'), 'error');
      return;
    }

    setImporting(true);
    try {
      const parsedRows = parseCSVText(content);
      if (parsedRows.length === 0) {
        showToast(tr('لم يتم العثور على بيانات في ملف CSV', 'Aucune donnée trouvée'), 'error');
        setImporting(false);
        return;
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Existing categories index by slug and ID
      const existingBySlug = new Map<string, Category>();
      const existingById = new Map<string, Category>();
      categories.forEach((c) => {
        existingBySlug.set(c.slug.toLowerCase(), c);
        existingById.set(c.id, c);
      });

      // Temporary map to resolve parent relationships in Pass 2
      const importedCategoryRecords: { row: Record<string, string>; resolvedId: string }[] = [];

      // PASS 1: Insert or Update Category records
      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];

        // Flexible key lookup for lowercased headers
        const nameAr =
          row['name (ar)'] ||
          row['name_ar'] ||
          row['name(ar)'] ||
          row['name'] ||
          row['اسم الفئة (عربي)'] ||
          row['اسم الفئة'] ||
          '';

        const nameFr =
          row['name (fr)'] ||
          row['name_fr'] ||
          row['name(fr)'] ||
          row['nom (fr)'] ||
          row['nom(fr)'] ||
          row['name'] ||
          nameAr ||
          '';

        if (!nameAr && !nameFr) {
          skipped++;
          errors.push(tr(`السطر ${i + 2}: لم يتم توفير اسم للفئة.`, `Ligne ${i + 2}: Nom de catégorie manquant.`));
          continue;
        }

        const rawSlug = row['slug'] || slugify(nameFr) || slugify(nameAr) || `cat-${Date.now()}-${i}`;
        const finalSlug = rawSlug.toLowerCase();
        const existingCat = existingBySlug.get(finalSlug) || (row['id'] ? existingById.get(row['id']) : undefined);

        let isAct = true;
        const statusRaw = (row['status'] || row['is_active'] || row['active'] || '').trim().toLowerCase();
        if (statusRaw) {
          if (['inactive', 'false', '0', 'غير نشط', 'désactivé'].includes(statusRaw)) {
            isAct = false;
          } else if (['active', 'true', '1', 'نشط', 'activé'].includes(statusRaw)) {
            isAct = true;
          }
        }

        const sortOrd = parseInt(row['sort order'] || row['sort_order'] || row['order'] || '0') || 0;

        const payload = {
          name_ar: nameAr || nameFr,
          name_fr: nameFr || nameAr,
          slug: finalSlug,
          description_ar: row['description (ar)'] || row['description_ar'] || row['description'] || null,
          description_fr: row['description (fr)'] || row['description_fr'] || row['description'] || null,
          is_active: isAct,
          sort_order: sortOrd,
          image_url: row['image url'] || row['image_url'] || row['image'] || null,
        };

        if (existingCat) {
          // UPDATE
          const { error: uerr } = await supabase.from('categories').update(payload).eq('id', existingCat.id);
          if (uerr) {
            console.warn('Supabase update warning during CSV import:', uerr.message);
          }
          updated++;
          importedCategoryRecords.push({ row, resolvedId: existingCat.id });
        } else {
          // INSERT
          const newId = row['id'] && row['id'].length > 10 ? row['id'] : crypto.randomUUID();
          const { data: idata, error: ierr } = await supabase
            .from('categories')
            .insert([{ id: newId, ...payload }])
            .select('*');

          if (ierr) {
            console.warn('Supabase insert warning during CSV import:', ierr.message);
          }
          created++;
          const createdId = idata?.[0]?.id || newId;
          importedCategoryRecords.push({ row, resolvedId: createdId });
        }
      }

      // Refresh categories list after Pass 1 to get latest IDs
      const { data: latestCats } = await supabase.from('categories').select('*');
      let latestList = (latestCats || []) as Category[];
      
      if (!latestCats || latestCats.length === 0) {
        const savedLocal = localStorage.getItem('local_admin_categories') || localStorage.getItem('categories');
        if (savedLocal) {
          try {
            const parsed = JSON.parse(savedLocal);
            if (Array.isArray(parsed)) {
              latestList = parsed;
            }
          } catch {
            // ignore
          }
        }
      }

      const latestMapBySlug = new Map<string, string>();
      const latestMapByNameFr = new Map<string, string>();
      const latestMapByNameAr = new Map<string, string>();

      latestList.forEach((c) => {
        latestMapBySlug.set(c.slug.toLowerCase(), c.id);
        latestMapByNameFr.set(c.name_fr.toLowerCase(), c.id);
        latestMapByNameAr.set(c.name_ar.toLowerCase(), c.id);
      });

      // PASS 2: Resolve Parent -> Child links
      for (const item of importedCategoryRecords) {
        const pIdRaw = item.row['parent id'] || item.row['parent_id'] || '';
        const pSlugRaw = item.row['parent slug'] || item.row['parent_slug'] || '';
        const pNameRaw = item.row['parent name'] || item.row['parent_name'] || item.row['parent'] || '';

        let targetParentId: string | null = null;

        if (pIdRaw && latestList.some((c) => c.id === pIdRaw && c.id !== item.resolvedId)) {
          targetParentId = pIdRaw;
        } else if (pSlugRaw && latestMapBySlug.has(pSlugRaw.toLowerCase())) {
          const found = latestMapBySlug.get(pSlugRaw.toLowerCase())!;
          if (found !== item.resolvedId) targetParentId = found;
        } else if (pNameRaw) {
          const found =
            latestMapByNameFr.get(pNameRaw.toLowerCase()) ||
            latestMapByNameAr.get(pNameRaw.toLowerCase());
          if (found && found !== item.resolvedId) targetParentId = found;
        }

        if (targetParentId) {
          await supabase.from('categories').update({ parent_id: targetParentId }).eq('id', item.resolvedId);
        }
      }

      const summary = { total: parsedRows.length, created, updated, skipped, errors };
      setImportSummary(summary);
      await load();
      window.dispatchEvent(new Event('categories_updated'));
      window.dispatchEvent(new Event('storage'));
      showToast(tr('تمت عملية الاستيراد بنجاح', 'Importation terminée avec succès'), 'success');
    } catch (e: unknown) {
      console.error('CSV import error:', e);
      showToast(tr('فشل الاستيراد', 'Échec de l\'importation'), 'error');
    } finally {
      setImporting(false);
    }
  };

  const inputCls =
    'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition';
  const labelCls = 'mb-1 block text-xs font-semibold text-slate-300';

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{tr('إدارة الفئات الهيكلية', 'Gestion des Catégories')}</h1>
          <p className="mt-1 text-xs text-slate-400">
            {tr('تنظيم الفئات الرئيسية والفرعية ومزامنة المنتجات في المتجر', 'Organisez vos catégories parentes, sous-catégories et produits')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-slate-100 transition shadow-sm"
          >
            <Download className="h-4 w-4 text-slate-400" />
            {tr('تصدير CSV', 'Exporter CSV')}
          </button>
          <button
            onClick={() => {
              setImportText('');
              setImportFile(null);
              setImportSummary(null);
              setImportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-slate-100 transition shadow-sm"
          >
            <Upload className="h-4 w-4 text-slate-400" />
            {tr('استيراد CSV', 'Importer CSV')}
          </button>
          <button
            onClick={() => openAdd(null)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-500 transition"
          >
            <Plus className="h-4 w-4" />
            {tr('إضافة فئة رئيسية', 'Nouvelle Catégorie Parent')}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-800/80 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{error}</div>}

      {/* Control Bar: Search, Filters & View Mode */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tr('ابحث بالاسم العربي، الفرنسي، الوصف أو الرابط (Slug)...', 'Rechercher par nom AR, FR, description ou slug...')}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 ps-9 pe-8 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:bg-slate-950"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-900 border border-slate-800 p-1 self-start lg:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'grid' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              {tr('شبكي', 'Grille')}
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'tree' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderTree className="h-3.5 w-3.5" />
              {tr('شجري (الهيكل)', 'Arborescence')}
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'table' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {tr('جدول', 'Tableau')}
            </button>
          </div>
        </div>

        {/* Filter Badges Bar */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5 pt-3 border-t border-slate-800">
          {/* Status Filter */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">{tr('الحالة', 'Statut')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 px-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="all">{tr('الكل', 'Tous les statuts')}</option>
              <option value="active">{tr('نشط فقط', 'Actifs uniquement')}</option>
              <option value="inactive">{tr('مخفي فقط', 'Inactifs uniquement')}</option>
            </select>
          </div>

          {/* Hierarchy Type Filter */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">{tr('نوع الفئة', 'Type de catégorie')}</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'parent_only' | 'child_only')}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 px-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="all">{tr('الكل (رئيسية وفرعية)', 'Toutes')}</option>
              <option value="parent_only">{tr('رئيسية فقط (Parents)', 'Parents uniquement')}</option>
              <option value="child_only">{tr('فرعية فقط (Enfants)', 'Sous-catégories')}</option>
            </select>
          </div>

          {/* Product Count Filter */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">{tr('عدد المنتجات', 'Nombre de produits')}</label>
            <select
              value={countFilter}
              onChange={(e) => setCountFilter(e.target.value as 'all' | 'has_products' | 'empty')}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 px-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="all">{tr('الكل', 'Tous')}</option>
              <option value="has_products">{tr('تحتوي على منتجات (>0)', 'Avec produits (>0)')}</option>
              <option value="empty">{tr('فارغة بدون منتجات (=0)', 'Vide (0 produit)')}</option>
            </select>
          </div>

          {/* Filter by Specific Parent */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-400">{tr('تصفية حسب الأب', 'Filtrer par parent')}</label>
            <select
              value={parentFilter}
              onChange={(e) => setParentFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 px-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="all">{tr('كل الآباء', 'Tous les parents')}</option>
              <option value="none">{tr('بدون أب (رئيسية فقط)', 'Sans parent')}</option>
              {categories
                .filter((c) => !c.parent_id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {isAr ? p.name_ar : p.name_fr}
                  </option>
                ))}
            </select>
          </div>

          {/* Clear Filters button */}
          <div className="flex items-end col-span-2 sm:col-span-1">
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setTypeFilter('all');
                setCountFilter('all');
                setParentFilter('all');
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition cursor-pointer"
            >
              {tr('إعادة ضبط الفلاتر', 'Réinitialiser')}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-800/80 bg-emerald-950/40 px-4 py-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-200">
              {selectedIds.length} {tr('فئة محددة', 'catégories sélectionnées')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => bulkToggleStatus(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500 transition"
            >
              <Eye className="h-3.5 w-3.5" />
              {tr('تفعيل المحدد', 'Activer la sélection')}
            </button>
            <button
              onClick={() => bulkToggleStatus(false)}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-500 transition"
            >
              <EyeOff className="h-3.5 w-3.5" />
              {tr('إخفاء المحدد', 'Désactiver')}
            </button>
            <button
              onClick={handleOpenBulkDelete}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-500 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {tr('حذف المحدد', 'Supprimer la sélection')}
            </button>
            <button
              onClick={() => setSelectedCatIds({})}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              {tr('إلغاء', 'Annuler')}
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: TREE VIEW (Arborescence) */}
      {viewMode === 'tree' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-emerald-400" />
              {tr('الهيكل الشجري الكامل للفئات', 'Arborescence hiérarchique')}
            </h3>
            <span className="text-xs font-semibold text-slate-400">
              {categories.filter((c) => !c.parent_id).length} {tr('فئة رئيسية', 'catégories racines')}
            </span>
          </div>

          {categories.filter((c) => !c.parent_id).length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Folder className="mx-auto mb-2 h-10 w-10 text-slate-600" />
              {tr('لا توجد فئات حالياً', 'Aucune catégorie racine')}
            </div>
          ) : (
            <div className="space-y-3">
              {categories
                .filter((c) => !c.parent_id)
                .map((parent) => (
                  <TreeNode
                    key={parent.id}
                    category={parent}
                    allCategories={categories}
                    directProductCounts={directProductCounts}
                    cumulativeProductCounts={cumulativeProductCounts}
                    expandedNodes={expandedNodes}
                    toggleExpand={(id) => setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }))}
                    openAddSubcat={(pId) => openAdd(pId)}
                    openEdit={(cat) => openEdit(cat)}
                    onConfirmDelete={(cat) =>
                      setConfirmDel({
                        cat,
                        directCount: directProductCounts[cat.id] || 0,
                        cumulativeCount: cumulativeProductCounts[cat.id] || 0,
                      })
                    }
                    toggleActive={(cat) => toggleActive(cat)}
                    moveOrder={(cat, dirStr) => moveOrder(cat, dirStr)}
                    selectedCatIds={selectedCatIds}
                    setSelectedCatIds={setSelectedCatIds}
                    isAr={isAr}
                    tr={tr}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="space-y-4">
          {paginatedCategories.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-12 text-center text-slate-500">
              <FolderTree className="mx-auto mb-2 h-10 w-10 text-slate-600" />
              <p className="font-semibold text-slate-300">{tr('لم يتم العثور على فئات تطابق البحث أو الفلاتر', 'Aucune catégorie trouvée')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedCategories.map((c) => {
                const parentCat = c.parent_id ? categoryMap.get(c.parent_id) : null;
                const dCount = directProductCounts[c.id] || 0;
                const cCount = cumulativeProductCounts[c.id] || 0;
                const subcats = categories.filter((sub) => sub.parent_id === c.id);
                const isSelected = !!selectedCatIds[c.id];

                return (
                  <div
                    key={c.id}
                    className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-slate-950 shadow-md transition hover:border-slate-700 ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                        : c.is_active
                        ? 'border-slate-800'
                        : 'border-slate-800 bg-slate-900/40 opacity-70'
                    }`}
                  >
                    {/* Card Top / Image Banner */}
                    <div className="relative h-36 overflow-hidden bg-slate-900">
                      {/* Checkbox badge */}
                      <div className="absolute top-3 ltr:left-3 rtl:right-3 z-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => setSelectedCatIds((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>

                      {c.image_url ? (
                        <img
                          src={c.image_url}
                          alt=""
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-600">
                          <FolderTree className="h-10 w-10" />
                        </div>
                      )}

                      {/* Top Action Badges */}
                      <div className="absolute top-3 ltr:right-3 rtl:left-3 flex gap-1.5 z-10">
                        <button
                          onClick={() => toggleActive(c)}
                          className="rounded-lg bg-slate-950/80 backdrop-blur-sm p-1.5 text-slate-300 shadow-sm hover:bg-slate-900 transition"
                          title={c.is_active ? tr('تعطيل', 'Désactiver') : tr('تفعيل', 'Activer')}
                        >
                          {c.is_active ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4 text-slate-500" />}
                        </button>
                      </div>

                      {/* Parent Badge Overlay */}
                      {parentCat ? (
                        <span className="absolute bottom-3 ltr:left-3 rtl:right-3 inline-flex items-center gap-1 rounded-full bg-slate-900/90 backdrop-blur-sm border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 shadow-sm">
                          <CornerDownRight className="h-3 w-3 text-emerald-400" />
                          {isAr ? parentCat.name_ar : parentCat.name_fr}
                        </span>
                      ) : (
                        <span className="absolute bottom-3 ltr:left-3 rtl:right-3 inline-flex items-center gap-1 rounded-full bg-emerald-600/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                          {tr('فئة رئيسية', 'Parent')}
                        </span>
                      )}

                      <span className="absolute bottom-3 ltr:right-3 rtl:left-3 rounded bg-slate-950/80 border border-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                        #{c.sort_order}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate font-bold text-slate-100 text-base">{isAr ? c.name_ar : c.name_fr}</h3>
                            <p className="truncate text-xs text-slate-400 font-mono">{isAr ? c.name_fr : c.name_ar}</p>
                          </div>
                        </div>

                        {c.description_ar && (
                          <p className="mt-2 line-clamp-2 text-xs text-slate-400">{isAr ? c.description_ar : c.description_fr}</p>
                        )}

                        {/* Counts & Subcat Info */}
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-md bg-emerald-950 border border-emerald-800 px-2.5 py-1 font-semibold text-emerald-300">
                            {dCount} {tr('منتج مباشر', 'prod. directs')}
                          </span>
                          {subcats.length > 0 && (
                            <span className="rounded-md bg-slate-900 border border-slate-800 px-2.5 py-1 font-semibold text-slate-300">
                              {cCount} {tr('إجمالي مع الفرعيات', 'total avec sous-cats')}
                            </span>
                          )}
                          {subcats.length > 0 && (
                            <span className="rounded-md bg-slate-900 border border-slate-800 px-2 py-1 font-medium text-slate-400">
                              {subcats.length} {tr('فرعية', 'sous-cats')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
                        <button
                          onClick={() => openAdd(c.id)}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-800/80 bg-emerald-950/50 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900 transition"
                          title={tr('إضافة فئة فرعية تحت هذه الفئة', 'Ajouter sous-catégorie')}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {tr('فرعية', 'Sous-cat')}
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
                        >
                          <Edit className="h-3.5 w-3.5 text-slate-400" />
                          {tr('تعديل', 'Modifier')}
                        </button>
                        <button
                          onClick={() =>
                            setConfirmDel({
                              cat: c,
                              directCount: dCount,
                              cumulativeCount: cCount,
                            })
                          }
                          className="inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-950/60 hover:text-rose-300 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3.5 w-8">
                    <input
                      type="checkbox"
                      checked={paginatedCategories.length > 0 && paginatedCategories.every((c) => selectedCatIds[c.id])}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const next = { ...selectedCatIds };
                        paginatedCategories.forEach((c) => (next[c.id] = checked));
                        setSelectedCatIds(next);
                      }}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="p-3.5">{tr('الفئة', 'Catégorie')}</th>
                  <th className="p-3.5">{tr('الفئة الأب', 'Parent')}</th>
                  <th className="p-3.5">{tr('الرابط (Slug)', 'Slug')}</th>
                  <th className="p-3.5 text-center">{tr('المنتجات المباشرة', 'Prod. Directs')}</th>
                  <th className="p-3.5 text-center">{tr('المنتجات التراكمية', 'Total Cumulé')}</th>
                  <th className="p-3.5 text-center">{tr('الحالة', 'Statut')}</th>
                  <th className="p-3.5 text-end">{tr('إجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedCategories.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      {tr('لا توجد فئات مطابقة للفلاتر الحالية', 'Aucune catégorie disponible')}
                    </td>
                  </tr>
                ) : (
                  paginatedCategories.map((c) => {
                    const parentCat = c.parent_id ? categoryMap.get(c.parent_id) : null;
                    const dCount = directProductCounts[c.id] || 0;
                    const cCount = cumulativeProductCounts[c.id] || 0;
                    const isSelected = !!selectedCatIds[c.id];

                    return (
                      <tr key={c.id} className={`hover:bg-slate-900/50 transition ${isSelected ? 'bg-emerald-950/30' : ''}`}>
                        <td className="p-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => setSelectedCatIds((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                            className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-slate-900 border border-slate-800">
                              {c.image_url ? (
                                <img
                                  src={c.image_url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                                  }}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-slate-600">
                                  <Folder className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-slate-100">{isAr ? c.name_ar : c.name_fr}</p>
                              <p className="text-[11px] text-slate-400">{isAr ? c.name_fr : c.name_ar}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 font-medium">
                          {parentCat ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 border border-slate-800 px-2 py-0.5 text-slate-300">
                              <CornerDownRight className="h-3 w-3 text-emerald-400" />
                              {isAr ? parentCat.name_ar : parentCat.name_fr}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-emerald-950 border border-emerald-800 px-2 py-0.5 font-semibold text-emerald-300">
                              {tr('رئيسية', 'Racine')}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-slate-400 text-[11px]">{c.slug}</td>
                        <td className="p-3.5 text-center font-bold text-slate-200">{dCount}</td>
                        <td className="p-3.5 text-center font-bold text-emerald-400">{cCount}</td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => toggleActive(c)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                              c.is_active ? 'bg-emerald-950 border border-emerald-800 text-emerald-300' : 'bg-slate-900 border border-slate-800 text-slate-500'
                            }`}
                          >
                            {c.is_active ? tr('نشط', 'Actif') : tr('مخفي', 'Masqué')}
                          </button>
                        </td>
                        <td className="p-3.5 text-end">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openAdd(c.id)}
                              className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-950/50"
                              title={tr('إضافة فئة فرعية', 'Ajouter sous-catégorie')}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openEdit(c)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                              title={tr('تعديل', 'Modifier')}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() =>
                                setConfirmDel({
                                  cat: c,
                                  directCount: dCount,
                                  cumulativeCount: cCount,
                                })
                              }
                              className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-950/50 hover:text-rose-300"
                              title={tr('حذف', 'Supprimer')}
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* Professional Pagination Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            {tr('عرض', 'Afficher')} <span className="font-bold text-slate-200">{startIndex + 1}</span> -{' '}
            <span className="font-bold text-slate-200">{Math.min(startIndex + pageSize, totalItems)}</span> {tr('من أصل', 'sur')}{' '}
            <span className="font-bold text-slate-200">{totalItems}</span> {tr('فئة', 'catégories')}
          </span>

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg border border-slate-800 bg-slate-900 py-1 px-2 font-semibold text-slate-200 outline-none focus:border-emerald-500"
          >
            <option value={10}>10 / {tr('صفحة', 'page')}</option>
            <option value={25}>25 / {tr('صفحة', 'page')}</option>
            <option value={50}>50 / {tr('صفحة', 'page')}</option>
            <option value={100}>100 / {tr('صفحة', 'page')}</option>
          </select>
        </div>

        {/* Page Buttons */}
        <div className="flex items-center gap-1 self-center sm:self-auto">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 transition"
          >
            {isAr ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 transition"
          >
            {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <span className="px-2 font-bold text-slate-300">
            {currentPage} / {totalPages || 1}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 transition"
          >
            {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 transition"
          >
            {isAr ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ADD / EDIT CATEGORY MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" dir={dir}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur-md">
              <h2 className="text-lg font-bold text-slate-100">
                {editing ? tr('تعديل الفئة', 'Modifier la catégorie') : tr('إضافة فئة جديدة', 'Nouvelle catégorie')}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {formErr && (
                <div className="rounded-xl bg-rose-950/60 border border-rose-800/80 px-3 py-2 text-xs text-rose-300 font-medium">
                  {formErr}
                </div>
              )}

              {/* Names */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{tr('الاسم (عربي) *', 'Nom (AR) *')}</label>
                  <input
                    value={form.name_ar}
                    onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                    className={inputCls}
                    placeholder="مثال: الهواتف الذكية"
                  />
                </div>
                <div>
                  <label className={labelCls}>{tr('الاسم (فرنسي) *', 'Nom (FR) *')}</label>
                  <input
                    value={form.name_fr}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name_fr: e.target.value,
                        slug: form.slug ? form.slug : slugify(e.target.value),
                      })
                    }
                    className={inputCls}
                    placeholder="Ex: Smartphones"
                  />
                </div>
              </div>

              {/* Parent Category Selector (WITH CYCLE PREVENTION) */}
              <div>
                <label className={labelCls}>{tr('الفئة الأب (المستوى الترتيبي)', 'Catégorie Parent')}</label>
                <select
                  value={form.parent_id || ''}
                  onChange={(e) => setForm({ ...form, parent_id: e.target.value || null })}
                  className={inputCls}
                >
                  <option value="">{tr('بدون أب (فئة رئيسية مستقلة)', 'Aucun (Catégorie Racine)')}</option>
                  {allowedParentCategories.map((catOption) => {
                    // Calculate depth level for indentation
                    let depth = 0;
                    let pId = catOption.parent_id;
                    while (pId) {
                      depth++;
                      const parentObj = categoryMap.get(pId);
                      pId = parentObj?.parent_id || null;
                    }
                    const indent = '─'.repeat(depth) + (depth > 0 ? ' ' : '');
                    return (
                      <option key={catOption.id} value={catOption.id}>
                        {indent} {isAr ? catOption.name_ar : catOption.name_fr}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  {tr('اختر فئة رئيسية لجعل هذه الفئة فرعية تحتها.', 'Sélectionnez un parent pour en faire une sous-catégorie.')}
                </p>
              </div>

              {/* Slug */}
              <div>
                <label className={labelCls}>{tr('الرابط المميز (Slug)', 'Slug')}</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder={tr('تلقائي من الاسم', 'Auto généré')}
                  className={inputCls}
                />
              </div>

              {/* Descriptions */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{tr('الوصف (عربي)', 'Description (AR)')}</label>
                  <textarea
                    value={form.description_ar}
                    onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
                    rows={2}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{tr('الوصف (فرنسي)', 'Description (FR)')}</label>
                  <textarea
                    value={form.description_fr}
                    onChange={(e) => setForm({ ...form, description_fr: e.target.value })}
                    rows={2}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Category Image */}
              <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  {tr('صورة الفئة', 'Image de la catégorie')}
                </h4>
                <ImageUploader
                  bucket="category-images"
                  folder={uploadFolder}
                  images={images}
                  onChange={(newImages) => {
                    setImages(newImages);
                    const uploadedUrl = newImages.find((i) => (i.url || i.preview) && !i.error)?.url || newImages[0]?.preview || '';
                    setForm((prev) => ({ ...prev, image_url: uploadedUrl }));
                  }}
                  multiple={false}
                  onNotification={(type, msg) => showToast(msg, type)}
                />
              </div>

              {/* Order & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{tr('الترتيب (Sort Order)', 'Ordre')}</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{tr('الحالة بالمتجر', 'Statut dans la boutique')}</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold transition ${
                      form.is_active
                        ? 'border-emerald-800 bg-emerald-950/60 text-emerald-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    {form.is_active ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4" />}
                    {form.is_active ? tr('نشطة في المتجر', 'Active') : tr('مخفية', 'Masquée')}
                  </button>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur-md">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                {tr('إلغاء', 'Annuler')}
              </button>
              <button
                onClick={save}
                disabled={saving || images.some((img) => img.uploading)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 disabled:opacity-50 transition"
              >
                {saving || images.some((img) => img.uploading) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {tr('حفظ الفئة', 'Enregistrer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" dir={dir}>
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur-md">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                {tr('استيراد الفئات من ملف CSV', 'Importer catégories depuis CSV')}
              </h2>
              <button
                onClick={() => setImportModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {!importSummary ? (
                <>
                  <p className="text-xs text-slate-400">
                    {tr(
                      'قم برفع ملف CSV يحتوي على الفئات وسيقوم النظام تلقائياً بربط الفئات الرئيسية والفرعية.',
                      'Téléchargez un fichier CSV contant vos catégories. Le système liera automatiquement les parents et sous-catégories.'
                    )}
                  </p>

                  {/* File Upload Input */}
                  <div>
                    <label className={labelCls}>{tr('اختر ملف CSV من جهازك', 'Fichier CSV')}</label>
                    <input
                      type="file"
                      accept=".csv,text/csv,application/vnd.ms-excel"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className={inputCls}
                    />
                  </div>

                  <div className="relative flex items-center my-2">
                    <div className="flex-grow border-t border-slate-800"></div>
                    <span className="flex-shrink mx-3 text-xs text-slate-500">{tr('أو الصق النص مباشرة', 'ou coller le texte CSV')}</span>
                    <div className="flex-grow border-t border-slate-800"></div>
                  </div>

                  {/* CSV Textarea */}
                  <div>
                    <label className={labelCls}>{tr('محتوى CSV', 'Contenu CSV')}</label>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      rows={6}
                      placeholder={`name_ar,name_fr,slug,parent_slug,is_active\n"إلكترونيات","Électronique","electronics","",true\n"هواتف","Smartphones","smartphones","electronics",true`}
                      className={`${inputCls} font-mono text-xs`}
                    />
                  </div>
                </>
              ) : (
                /* Import Summary Report */
                <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    {tr('ملخص عملية الاستيراد', 'Rapport d\'importation')}
                  </h3>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-slate-900 p-2.5 border border-slate-800">
                      <p className="text-slate-400">{tr('الإجمالي', 'Total')}</p>
                      <p className="font-bold text-slate-100 text-base">{importSummary.total}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-950/60 p-2.5 border border-emerald-800">
                      <p className="text-emerald-400">{tr('جديد', 'Nouveaux')}</p>
                      <p className="font-bold text-emerald-200 text-base">{importSummary.created}</p>
                    </div>
                    <div className="rounded-lg bg-slate-900 p-2.5 border border-slate-800">
                      <p className="text-slate-300">{tr('محدث', 'Mis à jour')}</p>
                      <p className="font-bold text-slate-100 text-base">{importSummary.updated}</p>
                    </div>
                    <div className="rounded-lg bg-amber-950/60 p-2.5 border border-amber-800">
                      <p className="text-amber-400">{tr('متجاوز', 'Ignorés')}</p>
                      <p className="font-bold text-amber-200 text-base">{importSummary.skipped}</p>
                    </div>
                  </div>

                  {importSummary.errors.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-rose-400">{tr('الأخطاء والتحذيرات:', 'Erreurs:')}</p>
                      <ul className="max-h-32 overflow-y-auto rounded-lg bg-rose-950/40 border border-rose-800/80 p-2 text-[11px] text-rose-300 space-y-1 font-mono">
                        {importSummary.errors.map((err, idx) => (
                          <li key={idx}>• {err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur-md">
              <button
                onClick={() => setImportModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                {importSummary ? tr('إغلاق', 'Fermer') : tr('إلغاء', 'Annuler')}
              </button>
              {!importSummary && (
                <button
                  onClick={executeCSVImport}
                  disabled={importing || (!importFile && !importText.trim())}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 disabled:opacity-50 transition"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {tr('بدء الاستيراد', 'Démarrer l\'importation')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE GUARD MODAL WITH PRODUCT WARNING */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" dir={dir}>
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-950/80 border border-amber-800/80">
              {confirmDel.directCount > 0 ? (
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              ) : (
                <Trash2 className="h-6 w-6 text-rose-400" />
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-100">{tr('تأكيد حذف الفئة', 'Confirmer la suppression')}</h3>
              <p className="mt-1 text-xs text-slate-400">
                {tr('هل أنت متأكد من حذف الفئة', 'Voulez-vous supprimer la catégorie')}{' '}
                <span className="font-bold text-slate-100">{isAr ? confirmDel.cat.name_ar : confirmDel.cat.name_fr}</span>؟
              </p>
            </div>

            {confirmDel.directCount > 0 ? (
              <div className="rounded-xl border border-amber-800/80 bg-amber-950/40 p-3 text-xs text-amber-200 space-y-2">
                <p className="font-semibold">
                  {tr('تحتوي هذه الفئة على', 'Cette catégorie contient')} <span className="font-bold text-amber-100">{confirmDel.directCount}</span>{' '}
                  {tr('منتج مباشر (وإجمالي', 'produit(s) (et au total')}{' '}
                  <span className="font-bold text-amber-100">{confirmDel.cumulativeCount}</span> {tr('منتج بالفرعيات).', 'avec sous-cats).')}
                </p>
                <p>{tr('اكتب اسم الفئة للتأكيد الحتمي:', 'Tapez le nom de la catégorie pour confirmer:')}</p>
                <span className="font-mono font-bold select-all bg-amber-900/80 border border-amber-700 text-amber-100 px-2 py-0.5 rounded block">
                  {isAr ? confirmDel.cat.name_ar : confirmDel.cat.name_fr}
                </span>
                <input
                  value={confirmDelInput}
                  onChange={(e) => setConfirmDelInput(e.target.value)}
                  className="w-full rounded-lg border border-amber-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-amber-500 outline-none"
                  placeholder={isAr ? confirmDel.cat.name_ar : confirmDel.cat.name_fr}
                />
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                {tr('سيتم حذف الفئة بشكل نهائي، وتعديل أي فئات فرعية تحتها لتصبح رئيسية.', 'La catégorie sera supprimée définitivement.')}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setConfirmDel(null);
                  setConfirmDelInput('');
                }}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition"
              >
                {tr('إلغاء', 'Annuler')}
              </button>
              <button
                onClick={() => remove(confirmDel.cat)}
                disabled={confirmDel.directCount > 0 && confirmDelInput !== (isAr ? confirmDel.cat.name_ar : confirmDel.cat.name_fr)}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {tr('حذف الفئة', 'Supprimer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK CATEGORIES DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleConfirmBulkDeleteCategories}
        isDeleting={isBulkDeleting}
        title={tr('تأكيد الحذف الجماعي للفئات', 'Confirmer la suppression des catégories')}
        description={tr(`هل أنت متأكد من حذف ${selectedIds.length} فئة محددة؟`, `Voulez-vous supprimer ${selectedIds.length} catégories sélectionnées ?`)}
        error={bulkDeleteError}
      />
    </div>
  );
}

// TREE NODE RECURSIVE COMPONENT
function TreeNode({
  category,
  allCategories,
  directProductCounts,
  cumulativeProductCounts,
  expandedNodes,
  toggleExpand,
  openAddSubcat,
  openEdit,
  onConfirmDelete,
  toggleActive,
  moveOrder,
  selectedCatIds,
  setSelectedCatIds,
  isAr,
  tr,
}: {
  category: Category;
  allCategories: Category[];
  directProductCounts: Record<string, number>;
  cumulativeProductCounts: Record<string, number>;
  expandedNodes: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  openAddSubcat: (parentId: string) => void;
  openEdit: (cat: Category) => void;
  onConfirmDelete: (cat: Category) => void;
  toggleActive: (cat: Category) => void;
  moveOrder: (cat: Category, dirStr: 'up' | 'down') => void;
  selectedCatIds: Record<string, boolean>;
  setSelectedCatIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isAr: boolean;
  tr: (ar: string, fr: string) => string;
}) {
  const children = allCategories.filter((c) => c.parent_id === category.id);
  const isExpanded = !!expandedNodes[category.id];
  const isSelected = !!selectedCatIds[category.id];
  const dCount = directProductCounts[category.id] || 0;
  const cCount = cumulativeProductCounts[category.id] || 0;

  return (
    <div className="space-y-1.5">
      {/* Node Header Row */}
      <div
        className={`group flex items-center justify-between gap-3 rounded-xl border p-3 transition ${
          isSelected
            ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500/20'
            : category.is_active
            ? 'border-slate-800 bg-slate-950 hover:border-slate-700'
            : 'border-slate-800 bg-slate-900/40 opacity-70'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => setSelectedCatIds((prev) => ({ ...prev, [category.id]: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
          />

          {/* Expand/Collapse Toggle Button */}
          {children.length > 0 ? (
            <button
              onClick={() => toggleExpand(category.id)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-800 transition"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-emerald-400" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-6" />
          )}

          {/* Thumbnail */}
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-slate-900 border border-slate-800">
            {category.image_url ? (
              <img
                src={category.image_url}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-600">
                <Folder className="h-4 w-4" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate font-bold text-slate-100 text-xs sm:text-sm">
              {isAr ? category.name_ar : category.name_fr}
            </p>
            <p className="truncate text-[11px] text-slate-400 font-mono">
              {category.slug}
            </p>
          </div>
        </div>

        {/* Right side stats and actions */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex rounded-md bg-slate-900 border border-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
            {dCount} {tr('مباشر', 'dir')}
          </span>

          {children.length > 0 && (
            <span className="rounded-md bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
              {cCount} {tr('إجمالي', 'total')}
            </span>
          )}

          <div className="flex items-center border-s border-slate-800 ps-1 ms-1">
            <button
              onClick={() => moveOrder(category, 'up')}
              className="rounded-md p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title={tr('تحريك للأعلى', 'Monter')}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => moveOrder(category, 'down')}
              className="rounded-md p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title={tr('تحريك للأسفل', 'Descendre')}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            onClick={() => toggleActive(category)}
            className={`rounded-lg p-1.5 transition ${
              category.is_active ? 'text-emerald-400 hover:bg-emerald-950/50' : 'text-slate-500 hover:bg-slate-800'
            }`}
            title={category.is_active ? tr('تجميع تعطيل', 'Désactiver') : tr('تفعيل', 'Activer')}
          >
            {category.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>

          <button
            onClick={() => openAddSubcat(category.id)}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-950/80 border border-emerald-800/80 px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-900 transition"
            title={tr('إضافة فئة فرعية', 'Ajouter sous-catégorie')}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{tr('فرعية', 'Sous-cat')}</span>
          </button>

          <button
            onClick={() => openEdit(category)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
            title={tr('تعديل', 'Modifier')}
          >
            <Edit className="h-4 w-4" />
          </button>

          <button
            onClick={() => onConfirmDelete(category)}
            className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 transition"
            title={tr('حذف', 'Supprimer')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Children Tree Indented Block */}
      {children.length > 0 && isExpanded && (
        <div className="ps-6 border-s-2 border-emerald-900/60 space-y-1.5 ms-3">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              category={child}
              allCategories={allCategories}
              directProductCounts={directProductCounts}
              cumulativeProductCounts={cumulativeProductCounts}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              openAddSubcat={openAddSubcat}
              openEdit={openEdit}
              onConfirmDelete={onConfirmDelete}
              toggleActive={toggleActive}
              moveOrder={moveOrder}
              selectedCatIds={selectedCatIds}
              setSelectedCatIds={setSelectedCatIds}
              isAr={isAr}
              tr={tr}
            />
          ))}
        </div>
      )}
    </div>
  );
}
