import { supabase } from './supabase';
import { adjustStockInDB, fetchWarehousesFromDB } from './inventoryStore';

export interface ImportProductsResult {
  totalParsed: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: { row: number; error: string }[];
}

export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((header) => {
        const val = row[header];
        const str = val === null || val === undefined ? '' : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  // Add UTF-8 BOM so Arabic and French accents display properly in Excel
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function parseCSVText(text: string): Record<string, string>[] {
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current.trim()) lines.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) lines.push(current);
  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === ',' && !inQ) {
        result.push(field.trim());
        field = '';
      } else {
        field += c;
      }
    }
    result.push(field.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    if (vals.length === 0 || (vals.length === 1 && !vals[0])) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] !== undefined ? vals[idx] : '';
    });
    rows.push(row);
  }
  return rows;
}

export function parseCSVFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return resolve([]);

      const parsed = parseCSVText(text);
      resolve(parsed);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}

export function downloadCSVTemplate(type: string = 'products'): void {
  const templateData = [
    {
      name_ar: 'منتج تجريبي',
      name_fr: 'Produit Test',
      price: 1500,
      cost_price: 1000,
      sku: 'PRD-TEST-01',
      stock_quantity: 10,
      category_slug: 'electronics'
    }
  ];
  exportToCSV(templateData, `${type}_import_template`);
}

export function downloadInventoryCSVTemplate(): void {
  const templateData = [
    {
      sku: 'PRD-TEST-01',
      warehouse_code: 'WH-MAIN',
      quantity_change: 5,
      notes: 'Bulk stock addition via CSV'
    }
  ];
  exportToCSV(templateData, 'inventory_import_template');
}

export function normalizeSlugBase(text: string): string {
  if (!text) return 'product';
  const cleaned = text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'product';
}

export function generateUniqueSlug(baseText: string, usedSlugs: Set<string>): string {
  const base = normalizeSlugBase(baseText);
  if (!usedSlugs.has(base.toLowerCase())) {
    usedSlugs.add(base.toLowerCase());
    return base;
  }
  let counter = 2;
  while (true) {
    const candidate = `${base}-${counter}`;
    if (!usedSlugs.has(candidate.toLowerCase())) {
      usedSlugs.add(candidate.toLowerCase());
      return candidate;
    }
    counter++;
  }
}

export async function importProductsFromCSV(
  file: File,
  options?: { updateBySku?: boolean; skipDuplicates?: boolean; autoCreateCategory?: boolean; selectedCategoryId?: string },
  onProgress?: (pct: number) => void
): Promise<ImportProductsResult> {
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors: { row: number; error: string }[] = [];

  try {
    const rows = await parseCSVFile(file);
    const totalParsed = rows.length;

    if (totalParsed === 0) {
      return { totalParsed: 0, insertedCount: 0, updatedCount: 0, skippedCount: 0, errorCount: 1, errors: [{ row: 0, error: 'CSV file is empty or formatted incorrectly.' }] };
    }

    const warehouses = await fetchWarehousesFromDB();
    const mainWh = warehouses.find((w) => w.is_main) || warehouses[0];

    // Pre-fetch existing product slugs from DB to prevent collisions with existing products
    const usedSlugs = new Set<string>();
    const { data: dbProducts } = await supabase.from('products').select('slug');
    if (dbProducts) {
      dbProducts.forEach((p) => {
        if (p.slug) usedSlugs.add(p.slug.toLowerCase().trim());
      });
    }

    // Pre-fetch categories for auto-creation
    const { data: catData } = await supabase.from('categories').select('id, slug, name_ar, name_fr');
    const catMap = new Map<string, string>();
    const usedCatSlugs = new Set<string>();
    (catData || []).forEach((c) => {
      if (c.slug) {
        catMap.set(c.slug.toLowerCase(), c.id);
        usedCatSlugs.add(c.slug.toLowerCase().trim());
      }
      if (c.name_ar) catMap.set(c.name_ar.toLowerCase(), c.id);
      if (c.name_fr) catMap.set(c.name_fr.toLowerCase(), c.id);
    });

    for (let idx = 0; idx < rows.length; idx++) {
      if (onProgress) {
        onProgress(Math.round(((idx + 1) / totalParsed) * 100));
      }

      const row = rows[idx];
      const name_ar = row['name_ar'] || row['name'] || row['اسم المنتج'] || '';
      const name_fr = row['name_fr'] || row['name'] || row['nom du produit'] || name_ar;
      const price = Number(row['price'] || row['السعر'] || 0);
      const cost_price = Number(row['cost_price'] || row['تكلفة'] || 0);
      const sku = (row['sku'] || row['رمز المنتج'] || '').trim();
      const stock_qty = Number(row['stock_quantity'] || row['stock'] || row['الكمية'] || 0);
      const catSlug = (row['category_slug'] || row['category'] || row['الفئة'] || '').trim();

      if (!name_ar && !name_fr) {
        errorCount++;
        errors.push({ row: idx + 2, error: 'اسم المنتج مطلوب / Product name is required' });
        continue;
      }

      let category_id: string | null = null;
      if (options?.selectedCategoryId) {
        category_id = options.selectedCategoryId;
      } else if (catSlug) {
        if (catMap.has(catSlug.toLowerCase())) {
          category_id = catMap.get(catSlug.toLowerCase())!;
        } else if (options?.autoCreateCategory !== false) {
          const newCatSlug = generateUniqueSlug(catSlug, usedCatSlugs);
          const { data: newCat } = await supabase
            .from('categories')
            .insert({ name_ar: catSlug, name_fr: catSlug, slug: newCatSlug, is_active: true })
            .select('id')
            .single();
          if (newCat?.id) {
            category_id = newCat.id;
            catMap.set(catSlug.toLowerCase(), newCat.id);
          }
        }
      }

      // Check existing SKU
      let existingId: string | null = null;
      if (sku) {
        const { data: existing } = await supabase.from('products').select('id, slug').eq('sku', sku).maybeSingle();
        if (existing?.id) existingId = existing.id;
      }

      if (existingId) {
        if (options?.skipDuplicates) {
          skippedCount++;
          continue;
        }
        if (options?.updateBySku !== false) {
          const { error: updateErr } = await supabase
            .from('products')
            .update({
              name_ar: name_ar || name_fr,
              name_fr: name_fr || name_ar,
              price,
              cost_price,
              stock_quantity: stock_qty,
              category_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingId);

          if (updateErr) {
            errorCount++;
            errors.push({ row: idx + 2, error: updateErr.message });
          } else {
            updatedCount++;
            if (mainWh && stock_qty >= 0) {
              await adjustStockInDB({
                product_id: existingId,
                warehouse_id: mainWh.id,
                qty_change: stock_qty,
                movement_type: 'csv_bulk_update',
                reference_number: 'CSV-IMPORT',
                notes: 'Stock updated via CSV import'
              });
            }
          }
          continue;
        }
      }

      // Generate unique slug checking DB + current batch
      const rowSlug = (row['slug'] || row['الرابط'] || '').trim();
      const baseForSlug = rowSlug || name_fr || name_ar || 'product';
      const slug = generateUniqueSlug(baseForSlug, usedSlugs);

      let { data: prodData, error: prodError } = await supabase
        .from('products')
        .insert({
          name_ar: name_ar || name_fr,
          name_fr: name_fr || name_ar,
          slug,
          price,
          cost_price,
          sku: sku || undefined,
          stock_quantity: stock_qty,
          category_id,
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      // Safeguard: Retry with timestamped suffix if database still rejects due to duplicate slug
      if (prodError && (prodError.message.includes('products_slug_key') || prodError.message.includes('duplicate key'))) {
        const retrySlug = `${slug}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        usedSlugs.add(retrySlug.toLowerCase());
        const retryRes = await supabase
          .from('products')
          .insert({
            name_ar: name_ar || name_fr,
            name_fr: name_fr || name_ar,
            slug: retrySlug,
            price,
            cost_price,
            sku: sku || undefined,
            stock_quantity: stock_qty,
            category_id,
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        prodData = retryRes.data;
        prodError = retryRes.error;
      }

      if (prodError) {
        errorCount++;
        errors.push({ row: idx + 2, error: prodError.message });
      } else {
        insertedCount++;
        if (mainWh && prodData?.id && stock_qty > 0) {
          await adjustStockInDB({
            product_id: prodData.id,
            warehouse_id: mainWh.id,
            qty_change: stock_qty,
            movement_type: 'csv_bulk_update',
            reference_number: 'CSV-IMPORT',
            notes: 'Bulk product import via CSV'
          });
        }
      }
    }

    return { totalParsed, insertedCount, updatedCount, skippedCount, errorCount, errors };
  } catch (err: unknown) {
    const e = err as Error;
    return {
      totalParsed: 0,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 1,
      errors: [{ row: 0, error: `File parsing error: ${e?.message || 'Unknown error'}` }]
    };
  }
}

export async function importInventoryFromCSV(file: File): Promise<ImportProductsResult> {
  const insertedCount = 0;
  let updatedCount = 0;
  const skippedCount = 0;
  let errorCount = 0;
  const errors: { row: number; error: string }[] = [];

  try {
    const rows = await parseCSVFile(file);
    const totalParsed = rows.length;

    if (totalParsed === 0) {
      return { totalParsed: 0, insertedCount: 0, updatedCount: 0, skippedCount: 0, errorCount: 1, errors: [{ row: 0, error: 'CSV file is empty or formatted incorrectly.' }] };
    }

    const warehouses = await fetchWarehousesFromDB();
    const mainWh = warehouses.find((w) => w.is_main) || warehouses[0];

    const { data: allProducts } = await supabase.from('products').select('id, sku');
    const prodMap = new Map<string, string>();
    (allProducts || []).forEach((p) => {
      if (p.id) prodMap.set(p.id, p.id);
      if (p.sku) prodMap.set(p.sku.toLowerCase(), p.id);
    });

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const skuOrId = (row['sku'] || row['product_id'] || row['رمز المنتج'] || '').trim();
      const whCode = (row['warehouse_code'] || row['warehouse_id'] || '').trim();
      const qtyChange = Number(row['quantity_change'] || row['quantity'] || row['الكمية'] || 0);
      const notes = row['notes'] || 'CSV stock adjustment';

      const prodId = prodMap.get(skuOrId.toLowerCase()) || prodMap.get(skuOrId);
      if (!prodId) {
        errorCount++;
        errors.push({ row: idx + 2, error: `Product with SKU or ID '${skuOrId}' not found.` });
        continue;
      }

      const wh = warehouses.find((w) => w.code.toLowerCase() === whCode.toLowerCase() || w.id === whCode) || mainWh;
      if (!wh) {
        errorCount++;
        errors.push({ row: idx + 2, error: `Warehouse '${whCode}' not found.` });
        continue;
      }

      const res = await adjustStockInDB({
        product_id: prodId,
        warehouse_id: wh.id,
        qty_change: qtyChange,
        movement_type: 'csv_bulk_update',
        reference_number: 'CSV-ADJUSTMENT',
        notes
      });

      if (res.success) {
        updatedCount++;
      } else {
        errorCount++;
        errors.push({ row: idx + 2, error: res.error || 'Failed to update stock' });
      }
    }

    return { totalParsed, insertedCount, updatedCount, skippedCount, errorCount, errors };
  } catch (err: unknown) {
    const e = err as Error;
    return {
      totalParsed: 0,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 1,
      errors: [{ row: 0, error: `File parsing error: ${e?.message || 'Unknown error'}` }]
    };
  }
}

export async function exportProductsCSV(data?: Record<string, unknown>[]): Promise<void> {
  let exportData = data;
  if (!exportData || exportData.length === 0) {
    const { data: dbData } = await supabase.from('products').select('id, sku, name_ar, name_fr, price, cost_price, stock_quantity, category_id, is_active, created_at');
    exportData = (dbData as Record<string, unknown>[]) || [];
  }
  exportToCSV(exportData, 'products_export');
}

export async function exportOrdersCSV(data?: Record<string, unknown>[]): Promise<void> {
  let exportData = data;
  if (!exportData || exportData.length === 0) {
    const { data: dbData } = await supabase.from('orders').select('id, order_number, customer_name, customer_phone, wilaya_id, status, payment_status, total_amount, shipping_fee, created_at');
    exportData = (dbData as Record<string, unknown>[]) || [];
  }
  exportToCSV(exportData, 'orders_export');
}

export async function exportCustomersCSV(data?: Record<string, unknown>[]): Promise<void> {
  let exportData = data;
  if (!exportData || exportData.length === 0) {
    const { data: dbData } = await supabase.from('customers').select('id, full_name, phone, email, wilaya_id, total_orders, total_spent, created_at');
    exportData = (dbData as Record<string, unknown>[]) || [];
  }
  exportToCSV(exportData, 'customers_export');
}

export async function exportCategoriesCSV(data?: Record<string, unknown>[]): Promise<void> {
  let exportData = data;
  if (!exportData || exportData.length === 0) {
    const { data: dbData } = await supabase.from('categories').select('id, name_ar, name_fr, slug, is_active, created_at');
    exportData = (dbData as Record<string, unknown>[]) || [];
  }
  exportToCSV(exportData, 'categories_export');
}

export async function exportInventoryCSV(data?: Record<string, unknown>[]): Promise<void> {
  let exportData = data;
  if (!exportData || exportData.length === 0) {
    const { data: dbData } = await supabase.from('inventory_levels').select('id, product_id, warehouse_id, quantity, damaged_quantity, rack_location, updated_at');
    exportData = (dbData as Record<string, unknown>[]) || [];
  }
  exportToCSV(exportData, 'inventory_export');
}

export async function exportPaymentMethodsCSV(data?: Record<string, unknown>[]): Promise<void> {
  let exportData = data;
  if (!exportData || exportData.length === 0) {
    const { data: dbData } = await supabase.from('payment_methods').select('*');
    exportData = (dbData as Record<string, unknown>[]) || [];
  }
  exportToCSV(exportData, 'payment_methods_export');
}

export async function exportShippingMethodsCSV(data?: Record<string, unknown>[]): Promise<void> {
  let exportData = data;
  if (!exportData || exportData.length === 0) {
    const { data: dbData } = await supabase.from('shipping_providers').select('*');
    exportData = (dbData as Record<string, unknown>[]) || [];
  }
  exportToCSV(exportData, 'shipping_providers_export');
}

export async function exportWilayasCSV(data?: Record<string, unknown>[]): Promise<void> {
  let exportData = data;
  if (!exportData || exportData.length === 0) {
    const { data: dbData } = await supabase.from('wilayas').select('id, code, name_ar, name_fr, delivery_fee, is_active');
    exportData = (dbData as Record<string, unknown>[]) || [];
  }
  exportToCSV(exportData, 'wilayas_export');
}

export async function exportMarketingCSV(data?: Record<string, unknown>[]): Promise<void> {
  let exportData = data;
  if (!exportData || exportData.length === 0) {
    const { data: dbData } = await supabase.from('coupons').select('*');
    exportData = (dbData as Record<string, unknown>[]) || [];
  }
  exportToCSV(exportData, 'marketing_coupons_export');
}

export async function exportReportsCSV(data?: Record<string, unknown>[]): Promise<void> {
  let exportData = data;
  if (!exportData || exportData.length === 0) {
    const { data: dbData } = await supabase.from('store_settings').select('*');
    exportData = (dbData as Record<string, unknown>[]) || [];
  }
  exportToCSV(exportData, 'store_reports_export');
}

export async function exportAdminUsersCSV(data?: Record<string, unknown>[]): Promise<void> {
  let exportData = data;
  if (!exportData || exportData.length === 0) {
    const { data: dbData } = await supabase.from('administrators').select('id, full_name, email, role, is_active, created_at');
    exportData = (dbData as Record<string, unknown>[]) || [];
  }
  exportToCSV(exportData, 'admin_users_export');
}

export async function exportSettingsCSV(data?: Record<string, unknown>[]): Promise<void> {
  let exportData = data;
  if (!exportData || exportData.length === 0) {
    const { data: dbData } = await supabase.from('store_settings').select('*');
    exportData = (dbData as Record<string, unknown>[]) || [];
  }
  exportToCSV(exportData, 'settings_export');
}
