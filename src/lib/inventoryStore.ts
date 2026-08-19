import { supabase } from './supabase';
import {
  Warehouse,
  ProductVariant,
  InventoryLevel,
  InventoryMovement,
  Supplier,
  SupplierPO,
  MovementType
} from '../types/inventory';

// --- HELPERS ---

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function safeUpsert(
  table: string,
  payload: Record<string, unknown>,
  onConflictCol?: string
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const builder = supabase.from(table).upsert(payload, onConflictCol ? { onConflict: onConflictCol } : undefined).select();
  const { data, error } = await builder.single();

  if (error) {
    return { data: null, error: { message: error.message } };
  }
  return { data: (data as Record<string, unknown>) || null, error: null };
}

async function safeInsert(
  table: string,
  payload: Record<string, unknown>
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const { data, error } = await supabase.from(table).insert(payload).select().single();

  if (error) {
    return { data: null, error: { message: error.message } };
  }
  return { data: (data as Record<string, unknown>) || null, error: null };
}

async function safeUpdate(
  table: string,
  payload: Record<string, unknown>,
  matchCol: string,
  matchVal: unknown
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const { data, error } = await supabase.from(table).update(payload).eq(matchCol, matchVal as string).select();

  if (error) {
    return { data: null, error: { message: error.message } };
  }
  const row = Array.isArray(data) && data.length > 0 ? (data[0] as Record<string, unknown>) : null;
  return { data: row, error: null };
}

// --- MAPPERS ---

function dbToWarehouse(row: Record<string, unknown>): Warehouse {
  return {
    id: String(row.id || ''),
    code: String(row.code || ''),
    name_ar: String(row.name_ar || row.name || ''),
    name_fr: String(row.name_fr || row.name || ''),
    address: String(row.address || ''),
    city: String(row.city || ''),
    wilaya_id: row.wilaya_id ? Number(row.wilaya_id) : undefined,
    manager_name: String(row.manager_name || row.manager || ''),
    phone: String(row.phone || ''),
    is_main: Boolean(row.is_main),
    is_active: Boolean(row.is_active ?? true),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || '')
  };
}

function dbToVariant(row: Record<string, unknown>): ProductVariant {
  return {
    id: String(row.id || ''),
    product_id: String(row.product_id || ''),
    sku: row.sku ? String(row.sku) : undefined,
    name_ar: String(row.name_ar || row.name || ''),
    name_fr: String(row.name_fr || row.name || ''),
    options: (row.options as Record<string, string>) || {},
    price_override: row.price_override ? Number(row.price_override) : undefined,
    stock_quantity: Number(row.stock_quantity || 0),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || '')
  };
}

function dbToInventoryLevel(row: Record<string, unknown>): InventoryLevel {
  return {
    id: String(row.id || ''),
    product_id: String(row.product_id || ''),
    variant_id: row.variant_id ? String(row.variant_id) : undefined,
    warehouse_id: String(row.warehouse_id || ''),
    quantity: Number(row.quantity || 0),
    damaged_quantity: Number(row.damaged_quantity || 0),
    rack_location: row.rack_location ? String(row.rack_location) : '',
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || '')
  };
}

function dbToMovement(row: Record<string, unknown>): InventoryMovement {
  return {
    id: String(row.id || ''),
    product_id: String(row.product_id || ''),
    variant_id: row.variant_id ? String(row.variant_id) : undefined,
    warehouse_id: row.warehouse_id ? String(row.warehouse_id) : undefined,
    target_warehouse_id: row.target_warehouse_id ? String(row.target_warehouse_id) : undefined,
    movement_type: (row.movement_type as MovementType) || 'manual_adjustment',
    quantity_change: Number(row.quantity_change || 0),
    previous_stock: Number(row.previous_stock || 0),
    new_stock: Number(row.new_stock || 0),
    reference_number: row.reference_number ? String(row.reference_number) : '',
    created_by: row.created_by ? String(row.created_by) : 'Admin',
    notes: row.notes ? String(row.notes) : '',
    created_at: String(row.created_at || '')
  };
}

function dbToSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: String(row.id || ''),
    code: String(row.code || ''),
    name: String(row.name || ''),
    contact_person: String(row.contact_person || ''),
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    address: String(row.address || ''),
    payment_terms: String(row.payment_terms || ''),
    notes: String(row.notes || ''),
    is_active: Boolean(row.is_active ?? true),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || '')
  };
}

function dbToSupplierPO(row: Record<string, unknown>): SupplierPO {
  return {
    id: String(row.id || ''),
    po_number: String(row.po_number || ''),
    supplier_id: String(row.supplier_id || ''),
    warehouse_id: String(row.warehouse_id || ''),
    status: (row.status as SupplierPO['status']) || 'draft',
    items: Array.isArray(row.items) ? (row.items as SupplierPO['items']) : [],
    total_cost: Number(row.total_cost || 0),
    expected_delivery_date: row.expected_delivery_date ? String(row.expected_delivery_date) : undefined,
    notes: row.notes ? String(row.notes) : '',
    created_by: String(row.created_by || 'Admin'),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || '')
  };
}

// --- WAREHOUSES API ---

export async function fetchWarehousesFromDB(): Promise<Warehouse[]> {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .order('is_main', { ascending: false });

    if (error) {
      console.warn('Error fetching warehouses from DB:', error.message);
      return [];
    }
    return (data || []).map((r) => dbToWarehouse(r as Record<string, unknown>));
  } catch (e) {
    console.error('Exception fetching warehouses:', e);
    return [];
  }
}

export async function upsertWarehouseInDB(warehouse: Partial<Warehouse>): Promise<{ success: boolean; data?: Warehouse; error?: string }> {
  try {
    const isTempId = !warehouse.id || warehouse.id.startsWith('wh-');
    const warehouseId = isTempId ? generateUUID() : (warehouse.id as string);

    const payload: Record<string, unknown> = {
      id: warehouseId,
      code: warehouse.code || `WH-${Date.now().toString().slice(-4)}`,
      name: warehouse.name_ar || warehouse.name_fr || warehouse.code || 'المستودع',
      name_ar: warehouse.name_ar,
      name_fr: warehouse.name_fr,
      address: warehouse.address || '',
      city: warehouse.city || '',
      manager_name: warehouse.manager_name || '',
      manager: warehouse.manager_name || '',
      phone: warehouse.phone || '',
      is_main: Boolean(warehouse.is_main),
      is_active: Boolean(warehouse.is_active ?? true)
    };

    const { data, error } = await safeUpsert('warehouses', payload);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: dbToWarehouse(data as Record<string, unknown>) };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to save warehouse' };
  }
}

export async function deleteWarehouseFromDB(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if inventory exists in this warehouse if table exists
    try {
      const { data: levels, error: checkError } = await supabase
        .from('inventory_levels')
        .select('quantity')
        .eq('warehouse_id', id);

      if (!checkError && levels && levels.some((l) => Number(l.quantity || 0) > 0)) {
        return {
          success: false,
          error: 'Cannot delete warehouse while inventory exists. Transfer or remove the inventory first.'
        };
      }
    } catch {
      // Table may not exist or not be queried, proceed to warehouse deletion
    }

    const { error } = await supabase.from('warehouses').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to delete warehouse' };
  }
}

// --- PRODUCT VARIANTS API ---

export async function fetchProductVariantsFromDB(productId?: string): Promise<ProductVariant[]> {
  try {
    let query = supabase.from('product_variants').select('*');
    if (productId) {
      query = query.eq('product_id', productId);
    }
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) {
      console.warn('Error fetching variants from DB:', error.message);
      return [];
    }
    return (data || []).map((r) => dbToVariant(r as Record<string, unknown>));
  } catch (e) {
    console.error('Exception fetching variants:', e);
    return [];
  }
}

export async function upsertProductVariantInDB(variant: Partial<ProductVariant>): Promise<{ success: boolean; data?: ProductVariant; error?: string }> {
  try {
    const isTempId = !variant.id || variant.id.startsWith('var-');
    const variantId = isTempId ? generateUUID() : (variant.id as string);

    const payload: Record<string, unknown> = {
      id: variantId,
      product_id: variant.product_id,
      sku: variant.sku || null,
      name: variant.name_ar || variant.name_fr || 'Variant',
      name_ar: variant.name_ar,
      name_fr: variant.name_fr,
      options: variant.options || {},
      price_override: variant.price_override || null,
      stock_quantity: Number(variant.stock_quantity || 0),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await safeUpsert('product_variants', payload);

    if (error) return { success: false, error: error.message };
    return { success: true, data: dbToVariant(data as Record<string, unknown>) };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to save variant' };
  }
}

export async function deleteProductVariantFromDB(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('product_variants').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to delete variant' };
  }
}

// --- INVENTORY LEVELS API ---

export async function fetchInventoryLevelsFromDB(): Promise<InventoryLevel[]> {
  try {
    const { data, error } = await supabase
      .from('inventory_levels')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data.map((r) => dbToInventoryLevel(r as Record<string, unknown>));
    }
    if (error) {
      console.warn('Error fetching inventory levels from DB:', error.message);
    }
  } catch (e) {
    console.error('Exception fetching inventory levels:', e);
  }
  return [];
}

export async function adjustStockInDB(params: {
  product_id: string;
  variant_id?: string;
  warehouse_id: string;
  qty_change: number;
  movement_type: MovementType;
  reference_number?: string;
  actor?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Try RPC first if available
    const { data, error } = await supabase.rpc('adjust_inventory_level', {
      p_product_id: params.product_id,
      p_variant_id: params.variant_id || null,
      p_warehouse_id: params.warehouse_id,
      p_qty_change: params.qty_change,
      p_movement_type: params.movement_type,
      p_ref: params.reference_number || null,
      p_actor: params.actor || 'Admin',
      p_notes: params.notes || null
    });

    if (!error && data && (data as { success: boolean }).success) {
      return { success: true };
    }
  } catch (err) {
    console.warn('[inventoryStore] RPC adjust_inventory_level failed, using direct fallback:', err);
  }

  // 2. Direct relational DB query on inventory_levels
  try {
    let query = supabase
      .from('inventory_levels')
      .select('*')
      .eq('product_id', params.product_id)
      .eq('warehouse_id', params.warehouse_id);

    if (params.variant_id) {
      query = query.eq('variant_id', params.variant_id);
    } else {
      query = query.is('variant_id', null);
    }

    const { data: existingRows } = await query;
    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    const previousStock = existing ? Number(existing.quantity || 0) : 0;
    const newStock = Math.max(0, previousStock + params.qty_change);

    if (existing) {
      const { error: updateErr } = await safeUpdate(
        'inventory_levels',
        {
          quantity: newStock,
          updated_at: new Date().toISOString()
        },
        'id',
        existing.id
      );

      if (updateErr) return { success: false, error: updateErr.message };
    } else {
      const { error: insertErr } = await safeInsert('inventory_levels', {
        id: generateUUID(),
        product_id: params.product_id,
        variant_id: params.variant_id || null,
        warehouse_id: params.warehouse_id,
        quantity: newStock,
        updated_at: new Date().toISOString()
      });

      if (insertErr) return { success: false, error: insertErr.message };
    }

    // Insert into inventory_movements
    await safeInsert('inventory_movements', {
      id: generateUUID(),
      product_id: params.product_id,
      variant_id: params.variant_id || null,
      warehouse_id: params.warehouse_id,
      movement_type: params.movement_type,
      quantity_change: params.qty_change,
      previous_stock: previousStock,
      new_stock: newStock,
      reference_number: params.reference_number || `ADJ-${Date.now().toString().slice(-6)}`,
      created_by: params.actor || 'Admin',
      notes: params.notes || '',
      created_at: new Date().toISOString()
    });

    // Update overall stock_quantity in products table
    const { data: allLevels } = await supabase
      .from('inventory_levels')
      .select('quantity')
      .eq('product_id', params.product_id);

    const totalProductStock = (allLevels || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0);

    await safeUpdate(
      'products',
      { stock_quantity: totalProductStock, updated_at: new Date().toISOString() },
      'id',
      params.product_id
    );

    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to adjust stock' };
  }
}

export async function transferStockInDB(params: {
  product_id: string;
  variant_id?: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  transfer_qty: number;
  actor?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('transfer_inventory_between_warehouses', {
      p_product_id: params.product_id,
      p_variant_id: params.variant_id || null,
      p_from_warehouse_id: params.from_warehouse_id,
      p_to_warehouse_id: params.to_warehouse_id,
      p_transfer_qty: params.transfer_qty,
      p_actor: params.actor || 'Admin',
      p_notes: params.notes || null
    });

    if (!error && data && (data as { success: boolean }).success) {
      return { success: true };
    }
  } catch (err) {
    console.warn('[inventoryStore] RPC transfer_inventory_between_warehouses failed, using fallback:', err);
  }

  try {
    const qty = Math.abs(params.transfer_qty);
    const deductRes = await adjustStockInDB({
      product_id: params.product_id,
      variant_id: params.variant_id,
      warehouse_id: params.from_warehouse_id,
      qty_change: -qty,
      movement_type: 'transfer_out',
      reference_number: `TRF-${Date.now().toString().slice(-6)}`,
      actor: params.actor,
      notes: `Transfer out to WH #${params.to_warehouse_id}. ${params.notes || ''}`
    });

    if (!deductRes.success) return deductRes;

    const addRes = await adjustStockInDB({
      product_id: params.product_id,
      variant_id: params.variant_id,
      warehouse_id: params.to_warehouse_id,
      qty_change: qty,
      movement_type: 'transfer_in',
      reference_number: `TRF-${Date.now().toString().slice(-6)}`,
      actor: params.actor,
      notes: `Transfer in from WH #${params.from_warehouse_id}. ${params.notes || ''}`
    });

    return addRes;
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to transfer stock' };
  }
}

// --- INVENTORY MOVEMENTS API ---

export async function fetchInventoryMovementsFromDB(): Promise<InventoryMovement[]> {
  try {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) {
      return data.map((r) => dbToMovement(r as Record<string, unknown>));
    }
    if (error) {
      console.warn('Error fetching inventory movements from DB:', error.message);
    }
  } catch (e) {
    console.error('Exception fetching inventory movements:', e);
  }
  return [];
}

// --- SUPPLIERS API ---

export async function fetchSuppliersFromDB(): Promise<Supplier[]> {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching suppliers:', error.message);
      return [];
    }
    return (data || []).map((r) => dbToSupplier(r as Record<string, unknown>));
  } catch (e) {
    console.error('Exception fetching suppliers:', e);
    return [];
  }
}

export async function upsertSupplierInDB(supplier: Partial<Supplier>): Promise<{ success: boolean; data?: Supplier; error?: string }> {
  try {
    const isTempId = !supplier.id || supplier.id.startsWith('sup-');
    const supplierId = isTempId ? generateUUID() : (supplier.id as string);

    const payload: Record<string, unknown> = {
      id: supplierId,
      code: supplier.code || `SUP-${Date.now().toString().slice(-4)}`,
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      payment_terms: supplier.payment_terms || '',
      notes: supplier.notes || '',
      is_active: Boolean(supplier.is_active ?? true),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await safeUpsert('suppliers', payload);

    if (error) return { success: false, error: error.message };
    return { success: true, data: dbToSupplier(data as Record<string, unknown>) };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to save supplier' };
  }
}

export async function deleteSupplierFromDB(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to delete supplier' };
  }
}

// --- SUPPLIER PURCHASE ORDERS API ---

export async function fetchSupplierPOsFromDB(): Promise<SupplierPO[]> {
  try {
    const { data, error } = await supabase
      .from('supplier_purchase_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching supplier POs:', error.message);
      return [];
    }
    return (data || []).map((r) => dbToSupplierPO(r as Record<string, unknown>));
  } catch (e) {
    console.error('Exception fetching supplier POs:', e);
    return [];
  }
}

export async function upsertSupplierPOInDB(po: Partial<SupplierPO>): Promise<{ success: boolean; data?: SupplierPO; error?: string }> {
  try {
    const isTempId = !po.id || po.id.startsWith('spo-');
    const poId = isTempId ? generateUUID() : (po.id as string);

    const payload: Record<string, unknown> = {
      id: poId,
      po_number: po.po_number || `SPO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      supplier_id: po.supplier_id,
      warehouse_id: po.warehouse_id,
      status: po.status || 'draft',
      items: po.items || [],
      total_cost: Number(po.total_cost || 0),
      expected_delivery_date: po.expected_delivery_date || null,
      notes: po.notes || null,
      created_by: po.created_by || 'Admin',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await safeUpsert('supplier_purchase_orders', payload);

    if (error) return { success: false, error: error.message };
    return { success: true, data: dbToSupplierPO(data as Record<string, unknown>) };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to save supplier PO' };
  }
}

export async function receiveSupplierPOInDB(po: SupplierPO, actor: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Update stock levels for each received item in the target warehouse
    for (const item of po.items) {
      if (item.quantity_received > 0) {
        await adjustStockInDB({
          product_id: item.product_id,
          variant_id: item.variant_id,
          warehouse_id: po.warehouse_id,
          qty_change: item.quantity_received,
          movement_type: 'supplier_receipt',
          reference_number: po.po_number,
          actor: actor || 'Admin',
          notes: `Supplier Receipt from PO #${po.po_number}`
        });
      }
    }

    // 2. Mark PO as received
    const { error } = await safeUpdate(
      'supplier_purchase_orders',
      { status: 'received', updated_at: new Date().toISOString() },
      'id',
      po.id
    );

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to receive PO' };
  }
}
