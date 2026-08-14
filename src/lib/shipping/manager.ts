import { supabase } from '../supabase';
import {
  ShippingProvider,
  ShippingRate,
  ShippingSettings,
  ShippingManifest,
  Shipment,
  ShipmentTrackingEvent,
  TreasuryAccount,
  CodSettlement,
  ShipmentStatus
} from './types';

/**
  * Pure Supabase & Server API Shipping Manager - Module 5 Single Source of Truth
  * ZERO authoritative localStorage dependency.
  */

const BASE_API = '/api/shipping';

// Helper for server API fetch with fallback
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_API}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
      ...options
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch (err) {
    console.error(`[Shipping API Fetch Error] ${endpoint}:`, err);
    return null;
  }
}

// Helper for system_settings fallback
async function getShippingStore<T>(key: string, defaultVal: T[]): Promise<T[]> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as T[];
    }
  } catch (e) {
    console.warn(`[shipping/manager] Error loading ${key}:`, e);
  }
  return defaultVal;
}

async function setShippingStore<T>(key: string, dataVal: T[]): Promise<boolean> {
  try {
    const { error } = await supabase.from('system_settings').upsert({
      key,
      value: JSON.stringify(dataVal),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
    return !error;
  } catch (e) {
    console.error(`[shipping/manager] Error saving ${key}:`, e);
    return false;
  }
}

// Default initial providers
export const INITIAL_PROVIDERS: ShippingProvider[] = [];

// 1. Providers
export interface ShippingProvidersResult {
  providers: ShippingProvider[];
  error?: string | null;
}

export async function getShippingProviders(): Promise<ShippingProvidersResult> {
  try {
    const { data, error } = await supabase
      .from('shipping_providers')
      .select('*')
      .order('is_default', { ascending: false });

    if (error) {
      return {
        providers: [],
        error: `[Supabase ${error.code || 'Error'}] ${error.message}`
      };
    }

    return { providers: (data as ShippingProvider[]) || [], error: null };
  } catch (err: unknown) {
    const e = err as Error;
    return { providers: [], error: e.message || 'Failed to fetch shipping providers' };
  }
}

export async function createShippingProvider(provider: {
  code: string;
  name_ar: string;
  name_fr: string;
  supports_home_delivery?: boolean;
  supports_stop_desk?: boolean;
  supports_cod?: boolean;
  is_active?: boolean;
  tracking_url_template?: string;
}): Promise<{ success: boolean; data?: ShippingProvider; error?: string }> {
  try {
    const payload = {
      code: provider.code.toLowerCase().trim().replace(/\s+/g, '_'),
      name_ar: provider.name_ar,
      name_fr: provider.name_fr,
      supports_home_delivery: provider.supports_home_delivery ?? true,
      supports_stop_desk: provider.supports_stop_desk ?? true,
      supports_cod: provider.supports_cod ?? true,
      is_active: provider.is_active ?? true,
      tracking_url_template: provider.tracking_url_template || '',
      updated_at: new Date().toISOString()
    };

    const { data: inserted, error: insertError } = await supabase
      .from('shipping_providers')
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      return { success: false, error: `[Supabase ${insertError.code || 'Error'}] ${insertError.message}` };
    }

    if (!inserted || !inserted.id) {
      return { success: false, error: 'Insert succeeded but no record returned' };
    }

    // Fresh SELECT verification from Supabase
    const { data: verified, error: verifyError } = await supabase
      .from('shipping_providers')
      .select('*')
      .eq('id', inserted.id)
      .single();

    if (verifyError || !verified) {
      return { success: false, error: `Verification failed after insert: ${verifyError?.message || 'Record not found'}` };
    }

    // Auto-seed default rates for 58 wilayas for this new provider
    try {
      const { data: wilayas } = await supabase.from('wilayas').select('id, delivery_fee');
      if (wilayas && wilayas.length > 0) {
        const rateRows = wilayas.map((w) => ({
          provider_id: verified.id,
          wilaya_id: w.id,
          home_fee: COALESCE_FEE(w.id, w.delivery_fee, 'home'),
          desk_fee: COALESCE_FEE(w.id, w.delivery_fee, 'desk'),
          return_fee: 200
        }));
        await supabase.from('shipping_rates').upsert(rateRows, { onConflict: 'provider_id,wilaya_id' });
      }
    } catch {
      // non-blocking rate seed
    }

    return { success: true, data: verified as ShippingProvider };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to create shipping provider' };
  }
}

function COALESCE_FEE(wilayaId: number, baseFee: number | null, type: 'home' | 'desk'): number {
  let home = baseFee || 600;
  if (wilayaId === 16) home = 400;
  else if ([9, 31, 25, 19, 35, 42].includes(wilayaId)) home = 600;
  else if ([1, 11, 30, 33, 37, 39, 47].includes(wilayaId)) home = 900;
  else if (wilayaId >= 50) home = 1200;

  if (type === 'desk') return Math.max(200, home - 200);
  return home;
}

export async function deleteShippingProvider(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: deleteError } = await supabase.from('shipping_providers').delete().eq('id', id);
    if (deleteError) {
      return { success: false, error: `[Supabase ${deleteError.code || 'Error'}] ${deleteError.message}` };
    }

    // Fresh SELECT verification from Supabase
    const { data: check } = await supabase
      .from('shipping_providers')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (check) {
      return { success: false, error: 'Row still exists in Supabase after delete.' };
    }

    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to delete shipping provider' };
  }
}

export async function updateShippingProvider(id: string, updates: Partial<ShippingProvider>): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: updateError } = await supabase
      .from('shipping_providers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      return { success: false, error: `[Supabase ${updateError.code || 'Error'}] ${updateError.message}` };
    }

    // Fresh SELECT verification from Supabase
    const { data: verified, error: verifyError } = await supabase
      .from('shipping_providers')
      .select('*')
      .eq('id', id)
      .single();

    if (verifyError || !verified) {
      return { success: false, error: `Verification failed after update: ${verifyError?.message || 'Record not found'}` };
    }

    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to update shipping provider' };
  }
}

export async function batchUpsertShippingProviders(providersToUpsert: Array<{
  code: string;
  name_ar: string;
  name_fr: string;
  supports_home_delivery?: boolean;
  supports_stop_desk?: boolean;
  supports_cod?: boolean;
  is_active?: boolean;
  tracking_url_template?: string;
}>): Promise<{ success: boolean; insertedCount: number; error?: string }> {
  try {
    if (!providersToUpsert || providersToUpsert.length === 0) {
      return { success: false, insertedCount: 0, error: 'No providers to import' };
    }

    const payload = providersToUpsert.map((p) => ({
      code: p.code.toLowerCase().trim().replace(/\s+/g, '_'),
      name_ar: p.name_ar.trim(),
      name_fr: p.name_fr.trim(),
      supports_home_delivery: p.supports_home_delivery ?? true,
      supports_stop_desk: p.supports_stop_desk ?? true,
      supports_cod: p.supports_cod ?? true,
      is_active: p.is_active ?? true,
      tracking_url_template: p.tracking_url_template?.trim() || '',
      updated_at: new Date().toISOString()
    }));

    const { data: upserted, error: upsertError } = await supabase
      .from('shipping_providers')
      .upsert(payload, { onConflict: 'code' })
      .select();

    if (upsertError) {
      return { success: false, insertedCount: 0, error: `[Supabase ${upsertError.code || 'Error'}] ${upsertError.message}` };
    }

    const insertedCount = upserted ? upserted.length : 0;

    // Fresh SELECT verification from Supabase
    const { data: verified, error: verifyError } = await supabase
      .from('shipping_providers')
      .select('id, code');

    if (verifyError) {
      return { success: false, insertedCount: 0, error: `Verification failed after batch upsert: ${verifyError.message}` };
    }

    // Auto-seed rates for 58 wilayas for any provider that doesn't have rates yet
    if (verified && verified.length > 0) {
      const { data: wilayas } = await supabase.from('wilayas').select('id, delivery_fee');
      if (wilayas && wilayas.length > 0) {
        for (const prov of verified) {
          try {
            const rateRows = wilayas.map((w) => ({
              provider_id: prov.id,
              wilaya_id: w.id,
              home_fee: COALESCE_FEE(w.id, w.delivery_fee, 'home'),
              desk_fee: COALESCE_FEE(w.id, w.delivery_fee, 'desk'),
              return_fee: 200
            }));
            await supabase.from('shipping_rates').upsert(rateRows, { onConflict: 'provider_id,wilaya_id' });
          } catch {
            // non-blocking
          }
        }
      }
    }

    return { success: true, insertedCount };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, insertedCount: 0, error: err?.message || 'Failed to batch upsert shipping providers' };
  }
}

// 2. Shipping Rates
export async function getShippingRates(providerId?: string): Promise<(ShippingRate & { wilaya_name_ar?: string; wilaya_name_fr?: string; wilaya_code?: string })[]> {
  try {
    let query = supabase
      .from('shipping_rates')
      .select(`
        *,
        wilayas!inner(id, code, name_ar, name_fr)
      `);

    if (providerId) {
      query = query.eq('provider_id', providerId);
    }

    const { data, error } = await query.order('wilaya_id', { ascending: true });

    if (!error && data && data.length > 0) {
      return ((data || []) as unknown as Array<ShippingRate & { wilayas?: { name_ar?: string; name_fr?: string; code?: string } }>).map((row) => ({
        ...row,
        wilaya_name_ar: row.wilayas?.name_ar || '',
        wilaya_name_fr: row.wilayas?.name_fr || '',
        wilaya_code: row.wilayas?.code || ''
      }));
    }
  } catch {
    // fallback
  }

  // Fallback to Server API
  const apiRates = await apiFetch<ShippingRate[]>(`/rates${providerId ? `?provider_id=${providerId}` : ''}`);
  if (apiRates && apiRates.length > 0) {
    return apiRates.map(r => ({
      ...r,
      wilaya_name_ar: `ولاية ${r.wilaya_id}`,
      wilaya_name_fr: `Wilaya ${r.wilaya_id}`,
      wilaya_code: String(r.wilaya_id).padStart(2, '0')
    }));
  }

  // Fallback to system_settings
  const ratesStore = await getShippingStore<ShippingRate>('shipping_rates_store', []);
  const filtered = providerId ? ratesStore.filter((r) => r.provider_id === providerId) : ratesStore;
  return filtered.map((r) => ({
    ...r,
    wilaya_name_ar: `ولاية ${r.wilaya_id}`,
    wilaya_name_fr: `Wilaya ${r.wilaya_id}`,
    wilaya_code: String(r.wilaya_id).padStart(2, '0')
  }));
}

export async function upsertShippingRate(rate: Partial<ShippingRate>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('shipping_rates')
      .upsert({
        ...rate,
        updated_at: new Date().toISOString()
      }, { onConflict: 'provider_id,wilaya_id' });

    if (!error) return true;
  } catch {
    // fallback
  }

  // Fallback to Server API
  const res = await apiFetch<{ success: boolean }>('/rates', {
    method: 'POST',
    body: JSON.stringify(rate)
  });
  if (res?.success) return true;

  // Fallback to system_settings
  const current = await getShippingStore<ShippingRate>('shipping_rates_store', []);
  const index = current.findIndex((r) => r.provider_id === rate.provider_id && r.wilaya_id === rate.wilaya_id);
  const updatedRate: ShippingRate = {
    id: rate.id || `rate-${rate.provider_id}-${rate.wilaya_id}`,
    provider_id: rate.provider_id || 'yalidine',
    wilaya_id: rate.wilaya_id || 16,
    home_fee: Number(rate.home_fee || 600),
    stop_desk_fee: Number(rate.stop_desk_fee || 400),
    return_fee: Number(rate.return_fee || 200),
    estimated_days_min: Number(rate.estimated_days_min || 1),
    estimated_days_max: Number(rate.estimated_days_max || 3),
    is_active: Boolean(rate.is_active ?? true),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (index >= 0) {
    current[index] = { ...current[index], ...updatedRate };
  } else {
    current.push(updatedRate);
  }
  return await setShippingStore('shipping_rates_store', current);
}

// 3. Shipping Settings
export async function getShippingSettings(): Promise<ShippingSettings | null> {
  try {
    const { data, error } = await supabase
      .from('shipping_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (!error && data) return data;
  } catch {
    // fallback
  }

  // Fallback to Server API
  const apiSettings = await apiFetch<ShippingSettings>('/settings');
  if (apiSettings) return apiSettings;

  // Fallback to system_settings
  const storeSettings = await getShippingStore<ShippingSettings>('shipping_settings_store', [
    {
      id: 1,
      default_provider_id: '',
      free_shipping_threshold: 10000,
      enable_free_shipping: true,
      enable_stop_desk: true,
      updated_at: new Date().toISOString()
    }
  ]);
  return storeSettings[0] || null;
}

export async function updateShippingSettings(settings: Partial<ShippingSettings>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('shipping_settings')
      .upsert({
        id: 1,
        ...settings,
        updated_at: new Date().toISOString()
      });

    if (!error) return true;
  } catch {
    // fallback
  }

  // Fallback to Server API
  const res = await apiFetch<{ success: boolean }>('/settings', {
    method: 'POST',
    body: JSON.stringify(settings)
  });
  if (res?.success) return true;

  // Fallback to system_settings
  const current = await getShippingSettings();
  const updated: ShippingSettings = {
    id: 1,
    default_provider_id: settings.default_provider_id || current?.default_provider_id || '',
    free_shipping_threshold: settings.free_shipping_threshold ?? current?.free_shipping_threshold ?? 10000,
    enable_free_shipping: settings.enable_free_shipping ?? current?.enable_free_shipping ?? true,
    enable_stop_desk: settings.enable_stop_desk ?? current?.enable_stop_desk ?? true,
    updated_at: new Date().toISOString()
  };
  return await setShippingStore('shipping_settings_store', [updated]);
}

// 4. Calculate Shipping Fee via RPC / Server API
export async function calculateShippingFee(
  wilayaId: number,
  deliveryType: 'home' | 'stop_desk',
  subtotal: number,
  providerId?: string
): Promise<{ shippingFee: number; isFreeShipping: boolean; providerId: string }> {
  const { data, error } = await supabase.rpc('calculate_order_shipping_fee', {
    p_wilaya_id: wilayaId,
    p_delivery_type: deliveryType,
    p_cart_subtotal: subtotal,
    p_provider_id: providerId || null
  });

  if (!error && data) {
    return {
      shippingFee: Number(data.shipping_fee || 0),
      isFreeShipping: Boolean(data.is_free_shipping),
      providerId: data.provider_id || providerId || ''
    };
  }

  // Fallback to Server API
  const apiRes = await apiFetch<{ shipping_fee: number; is_free_shipping: boolean; provider_id: string }>('/calculate-fee', {
    method: 'POST',
    body: JSON.stringify({ wilaya_id: wilayaId, delivery_type: deliveryType, cart_subtotal: subtotal, provider_id: providerId })
  });

  if (apiRes) {
    return {
      shippingFee: Number(apiRes.shipping_fee || 0),
      isFreeShipping: Boolean(apiRes.is_free_shipping),
      providerId: apiRes.provider_id || providerId || 'yalidine'
    };
  }

  return {
    shippingFee: deliveryType === 'stop_desk' ? 400 : 600,
    isFreeShipping: subtotal >= 10000,
    providerId: providerId || 'yalidine'
  };
}

// 5. Create Shipment for Order
export async function createShipmentForOrder(shipmentData: {
  order_id: string;
  provider_id: string;
  delivery_type: 'home' | 'stop_desk';
  stop_desk_id?: string;
  stop_desk_name?: string;
  shipping_fee: number;
  cod_amount: number;
  recipient_name: string;
  recipient_phone: string;
  recipient_wilaya_id: number;
  recipient_commune?: string;
  recipient_address?: string;
  tracking_number?: string;
  carrier_ref_id?: string;
}): Promise<Shipment | null> {
  const trackNum = shipmentData.tracking_number || `TRACK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const { data, error } = await supabase
    .from('shipments')
    .upsert({
      ...shipmentData,
      tracking_number: trackNum,
      status: 'pending',
      cod_status: 'pending',
      updated_at: new Date().toISOString()
    }, { onConflict: 'order_id' })
    .select()
    .single();

  if (!error && data) {
    await supabase.from('shipment_tracking_events').insert({
      shipment_id: data.id,
      status: 'pending',
      location: 'Warehouse',
      description: 'Order created and pending shipment preparation',
      actor: 'Storefront Checkout'
    });
    return data;
  }

  // Fallback to Server API
  return await apiFetch<Shipment>('/shipments', {
    method: 'POST',
    body: JSON.stringify(shipmentData)
  });
}

// 6. Fetch Shipments
export async function getShipments(): Promise<(Shipment & { order_number?: string; provider_name_ar?: string; provider_name_fr?: string })[]> {
  const { data, error } = await supabase
    .from('shipments')
    .select(`
      *,
      orders(order_number, customer_name, customer_phone),
      shipping_providers(name_ar, name_fr)
    `)
    .order('created_at', { ascending: false });

  if (!error && data) {
    return ((data || []) as unknown as Array<Shipment & { orders?: { order_number?: string }; shipping_providers?: { name_ar?: string; name_fr?: string } }>).map((s) => ({
      ...s,
      order_number: s.orders?.order_number || '',
      provider_name_ar: s.shipping_providers?.name_ar || '',
      provider_name_fr: s.shipping_providers?.name_fr || ''
    }));
  }

  // Fallback to Server API
  const apiShipments = await apiFetch<Shipment[]>('/shipments');
  return (apiShipments || []).map(s => ({
    ...s,
    order_number: s.order_number || `ORD-${s.order_id.slice(0, 8)}`,
    provider_name_ar: s.provider_name_ar || '',
    provider_name_fr: s.provider_name_fr || ''
  }));
}

export async function getShipmentByOrderId(orderId: string): Promise<Shipment | null> {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (!error && data) return data;

  const all = await getShipments();
  return all.find(s => s.order_id === orderId) || null;
}

// 7. Tracking Events
export async function getShipmentTrackingEvents(shipmentId: string): Promise<ShipmentTrackingEvent[]> {
  const { data, error } = await supabase
    .from('shipment_tracking_events')
    .select('*')
    .eq('shipment_id', shipmentId)
    .order('event_timestamp', { ascending: true });

  if (!error && data) return data;

  const events = await apiFetch<ShipmentTrackingEvent[]>(`/shipments/${shipmentId}/tracking`);
  return events || [];
}

// 8. Update Shipment Status (via RPC / Server API with Idempotent Inventory & Order Sync)
export async function updateShipmentStatus(
  shipmentId: string,
  newStatus: ShipmentStatus,
  location?: string,
  description?: string,
  actor: string = 'Admin'
): Promise<{ success: boolean; stockRestored?: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('process_shipment_status_change', {
    p_shipment_id: shipmentId,
    p_new_status: newStatus,
    p_location: location || 'Logistics Hub',
    p_description: description || `Status updated to ${newStatus}`,
    p_actor: actor
  });

  if (!error && data) {
    return {
      success: Boolean(data.success),
      stockRestored: Boolean(data.stock_restored)
    };
  }

  // Fallback to Server API
  const apiRes = await apiFetch<{ success: boolean; stockRestored?: boolean; error?: string }>('/shipments/status', {
    method: 'POST',
    body: JSON.stringify({
      p_shipment_id: shipmentId,
      p_new_status: newStatus,
      p_location: location,
      p_description: description,
      p_actor: actor
    })
  });

  if (apiRes) {
    return {
      success: Boolean(apiRes.success),
      stockRestored: Boolean(apiRes.stockRestored),
      error: apiRes.error
    };
  }

  return { success: false, error: error?.message || 'Failed to update shipment status' };
}

// 9. Shipping Manifests
export async function createShippingManifest(
  providerId: string,
  shipmentIds: string[],
  driverInfo?: { driverName?: string; driverPhone?: string; vehiclePlate?: string; notes?: string },
  createdBy: string = 'Admin'
): Promise<ShippingManifest | null> {
  const { data: shipmentsData } = await supabase
    .from('shipments')
    .select('cod_amount')
    .in('id', shipmentIds);

  if (shipmentsData && shipmentsData.length > 0) {
    const manifestNum = `MAN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalCod = (shipmentsData || []).reduce((sum, s) => sum + Number(s.cod_amount || 0), 0);

    const { data: manifest, error: manifestErr } = await supabase
      .from('shipping_manifests')
      .insert({
        manifest_number: manifestNum,
        provider_id: providerId,
        status: 'generated',
        order_count: shipmentIds.length,
        total_cod_amount: totalCod,
        driver_name: driverInfo?.driverName || '',
        driver_phone: driverInfo?.driverPhone || '',
        vehicle_plate: driverInfo?.vehiclePlate || '',
        notes: driverInfo?.notes || '',
        created_by: createdBy
      })
      .select()
      .single();

    if (!manifestErr && manifest) {
      await supabase
        .from('shipments')
        .update({ manifest_id: manifest.id, status: 'manifested', updated_at: new Date().toISOString() })
        .in('id', shipmentIds);

      return manifest;
    }
  }

  // Fallback to Server API
  return await apiFetch<ShippingManifest>('/manifests', {
    method: 'POST',
    body: JSON.stringify({ provider_id: providerId, shipment_ids: shipmentIds, driver_info: driverInfo, created_by: createdBy })
  });
}

export async function getShippingManifests(): Promise<(ShippingManifest & { provider_name_ar?: string; provider_name_fr?: string })[]> {
  const { data, error } = await supabase
    .from('shipping_manifests')
    .select(`
      *,
      shipping_providers(name_ar, name_fr)
    `)
    .order('created_at', { ascending: false });

  if (!error && data) {
    return ((data || []) as unknown as Array<ShippingManifest & { shipping_providers?: { name_ar?: string; name_fr?: string } }>).map((m) => ({
      ...m,
      provider_name_ar: m.shipping_providers?.name_ar || '',
      provider_name_fr: m.shipping_providers?.name_fr || ''
    }));
  }

  // Fallback to Server API
  const apiManifests = await apiFetch<ShippingManifest[]>('/manifests');
  return (apiManifests || []).map(m => ({
    ...m,
    provider_name_ar: m.provider_name_ar || '',
    provider_name_fr: m.provider_name_fr || ''
  }));
}

// 10. Treasury Accounts
export async function getTreasuryAccounts(): Promise<TreasuryAccount[]> {
  const { data, error } = await supabase
    .from('treasury_accounts')
    .select('*')
    .eq('is_active', true)
    .order('name_fr', { ascending: true });

  if (!error && data && data.length > 0) return data;

  // Fallback to Server API
  const accounts = await apiFetch<TreasuryAccount[]>('/treasury-accounts');
  return accounts || [];
}

// 11. COD Settlements
export async function createCodSettlement(
  providerId: string,
  shipmentIds: string[],
  notes?: string
): Promise<CodSettlement | null> {
  const { data: shipmentsData } = await supabase
    .from('shipments')
    .select('id, order_id, cod_amount, shipping_fee')
    .in('id', shipmentIds);

  if (shipmentsData && shipmentsData.length > 0) {
    let gross = 0;
    let fees = 0;
    shipmentsData.forEach(s => {
      gross += Number(s.cod_amount || 0);
      fees += Number(s.shipping_fee || 0);
    });
    const net = gross - fees;
    const setNum = `SET-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: settlement, error } = await supabase
      .from('cod_settlements')
      .insert({
        settlement_number: setNum,
        provider_id: providerId,
        status: 'draft',
        total_orders_count: shipmentsData.length,
        gross_cod_collected: gross,
        total_shipping_fees_deducted: fees,
        net_payout_amount: net,
        notes: notes || ''
      })
      .select()
      .single();

    if (!error && settlement) return settlement;
  }

  // Fallback to Server API
  return await apiFetch<CodSettlement>('/cod-settlements', {
    method: 'POST',
    body: JSON.stringify({ provider_id: providerId, shipment_ids: shipmentIds, notes })
  });
}

export async function reconcileCodSettlement(
  settlementId: string,
  treasuryAccountId: string,
  actor: string = 'Admin'
): Promise<{ success: boolean; netPayout?: number; error?: string }> {
  const { data, error } = await supabase.rpc('reconcile_cod_settlement', {
    p_settlement_id: settlementId,
    p_treasury_account_id: treasuryAccountId,
    p_actor: actor
  });

  if (!error && data) {
    return {
      success: Boolean(data.success),
      netPayout: Number(data.net_payout_amount || 0)
    };
  }

  // Fallback to Server API
  const apiRes = await apiFetch<{ success: boolean; netPayout?: number; error?: string }>('/cod-settlements/reconcile', {
    method: 'POST',
    body: JSON.stringify({ settlement_id: settlementId, treasury_account_id: treasuryAccountId, actor })
  });

  if (apiRes) {
    return {
      success: Boolean(apiRes.success),
      netPayout: apiRes.netPayout,
      error: apiRes.error
    };
  }

  return { success: false, error: error?.message || 'Reconciliation failed' };
}

export async function getCodSettlements(): Promise<(CodSettlement & { provider_name_ar?: string; provider_name_fr?: string; treasury_name_ar?: string })[]> {
  const { data, error } = await supabase
    .from('cod_settlements')
    .select(`
      *,
      shipping_providers(name_ar, name_fr),
      treasury_accounts(name_ar, name_fr)
    `)
    .order('created_at', { ascending: false });

  if (!error && data) {
    return ((data || []) as unknown as Array<CodSettlement & { shipping_providers?: { name_ar?: string; name_fr?: string }; treasury_accounts?: { name_ar?: string; name_fr?: string } }>).map((cs) => ({
      ...cs,
      provider_name_ar: cs.shipping_providers?.name_ar || '',
      provider_name_fr: cs.shipping_providers?.name_fr || '',
      treasury_name_ar: cs.treasury_accounts?.name_ar || ''
    }));
  }

  // Fallback to Server API
  const settlements = await apiFetch<CodSettlement[]>('/cod-settlements');
  return (settlements || []).map(s => ({
    ...s,
    provider_name_ar: s.provider_name_ar || '',
    provider_name_fr: s.provider_name_fr || '',
    treasury_name_ar: s.treasury_account_name_fr || ''
  }));
}
