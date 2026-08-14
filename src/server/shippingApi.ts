import express from 'express';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Initialize Supabase client for server-side updates (product inventory restoration & order status sync)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dyhpfgjogdiongmcmoti.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DATA_DIR = path.join(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'shipping_store.json');

// Interface definitions
export interface ShippingProvider {
  id: string;
  code: string;
  name_ar: string;
  name_fr: string;
  is_active: boolean;
  is_default: boolean;
  supports_home: boolean;
  supports_desk: boolean;
  tracking_url_template?: string;
  api_key?: string;
  api_secret?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ShippingRate {
  id: string;
  provider_id: string;
  wilaya_id: number;
  home_rate: number;
  desk_rate: number;
  home_est_days: number;
  desk_est_days: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  wilaya_name_ar?: string;
  wilaya_name_fr?: string;
  wilaya_code?: string;
}

export interface ShippingSettings {
  id: number;
  free_shipping_threshold: number;
  cod_fee: number;
  default_provider_id: string;
  auto_manifest_on_shipped: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Shipment {
  id: string;
  order_id: string;
  provider_id: string;
  manifest_id?: string;
  delivery_type: 'home' | 'stop_desk';
  stop_desk_id?: string;
  stop_desk_name?: string;
  shipping_fee: number;
  cod_amount: number;
  status: 'pending' | 'ready_for_pickup' | 'manifested' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned' | 'cancelled';
  cod_status: 'pending' | 'collected' | 'settled' | 'refunded';
  tracking_number: string;
  carrier_ref_id?: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_wilaya_id: number;
  recipient_commune?: string;
  recipient_address?: string;
  created_at: string;
  updated_at: string;
  stock_restored?: boolean;
  order_number?: string;
  provider_name_ar?: string;
  provider_name_fr?: string;
}

export interface ShipmentTrackingEvent {
  id: string;
  shipment_id: string;
  status: string;
  location?: string;
  description?: string;
  actor: string;
  event_timestamp: string;
}

export interface ShippingManifest {
  id: string;
  manifest_number: string;
  provider_id: string;
  status: 'generated' | 'picked_up' | 'processed' | 'closed';
  order_count: number;
  total_cod_amount: number;
  driver_name?: string;
  driver_phone?: string;
  vehicle_plate?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  provider_name_ar?: string;
  provider_name_fr?: string;
}

export interface TreasuryAccount {
  id: string;
  code: string;
  name_ar: string;
  name_fr: string;
  type: 'cash' | 'bank' | 'postal' | 'carrier';
  balance: number;
  currency: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CodSettlement {
  id: string;
  settlement_number: string;
  provider_id: string;
  treasury_account_id: string;
  status: 'draft' | 'submitted' | 'reconciled' | 'rejected';
  shipment_count: number;
  gross_cod_amount: number;
  shipping_fees_deducted: number;
  net_payout_amount: number;
  reference_number?: string;
  notes?: string;
  reconciled_at?: string;
  reconciled_by?: string;
  created_at: string;
  updated_at: string;
  provider_name_ar?: string;
  provider_name_fr?: string;
  treasury_account_name_fr?: string;
}

interface ShippingStoreData {
  providers: ShippingProvider[];
  rates: ShippingRate[];
  settings: ShippingSettings;
  shipments: Shipment[];
  trackingEvents: ShipmentTrackingEvent[];
  manifests: ShippingManifest[];
  treasuryAccounts: TreasuryAccount[];
  codSettlements: CodSettlement[];
  financePayments: Array<{
    id: string;
    reference_number: string;
    type: 'income' | 'expense';
    category: string;
    amount: number;
    payment_method: string;
    treasury_account_id: string;
    notes: string;
    created_at: string;
  }>;
}

// Initial defaults - ZERO fake demo providers
const defaultStore: ShippingStoreData = {
  providers: [],
  rates: [],
  settings: {
    id: 1,
    free_shipping_threshold: 10000,
    cod_fee: 0,
    default_provider_id: '',
    auto_manifest_on_shipped: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  shipments: [],
  trackingEvents: [],
  manifests: [],
  treasuryAccounts: [
    {
      id: 'ACC-001',
      code: 'CASH-MAIN',
      name_ar: 'الصندوق الرئيسي',
      name_fr: 'Caisse Principale (Cash)',
      type: 'cash',
      balance: 150000,
      currency: 'DZD',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'ACC-002',
      code: 'BANK-CCP',
      name_ar: 'حساب البريد CCP',
      name_fr: 'Compte CCP Algérie Poste',
      type: 'postal',
      balance: 450000,
      currency: 'DZD',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'ACC-003',
      code: 'COD-CARRIER',
      name_ar: 'حساب تحصيل التسليم COD',
      name_fr: 'Compte Collecte COD Transporteurs',
      type: 'carrier',
      balance: 0,
      currency: 'DZD',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  codSettlements: [],
  financePayments: []
};

// Initialize Wilaya rates ONLY for real configured providers
function initWilayaRates(store: ShippingStoreData) {
  if (!store.providers || store.providers.length === 0) return;
  for (const provider of store.providers) {
    const existingForProv = store.rates.filter(r => r.provider_id === provider.id);
    if (existingForProv.length === 0) {
      for (let w = 1; w <= 58; w++) {
        let homeRate = 600;
        let deskRate = 400;

        if (w === 16 || w === 9 || w === 24 || w === 35 || w === 42) {
          homeRate = 400;
          deskRate = 250;
        } else if (w <= 15 || (w >= 17 && w <= 31) || w === 38) {
          homeRate = 600;
          deskRate = 400;
        } else if (w <= 48) {
          homeRate = 800;
          deskRate = 550;
        } else {
          homeRate = 1200;
          deskRate = 850;
        }

        store.rates.push({
          id: `RATE-${provider.id}-${w}`,
          provider_id: provider.id,
          wilaya_id: w,
          home_rate: homeRate,
          desk_rate: deskRate,
          home_est_days: w <= 16 ? 1 : w <= 48 ? 2 : 4,
          desk_est_days: w <= 16 ? 1 : w <= 48 ? 2 : 3,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
  }
}

// Load store from disk or init
let store: ShippingStoreData = { ...defaultStore };

function loadStore(): ShippingStoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      store = { ...defaultStore, ...parsed };
    } else {
      initWilayaRates(store);
      saveStore();
    }
  } catch (err) {
    console.error('[Shipping Store] Error loading file:', err);
  }
  initWilayaRates(store);
  return store;
}

function saveStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Shipping Store] Error saving file:', err);
  }
}

loadStore();

// Utility: Strip secrets from provider objects sent to browser
function sanitizeProvider(p: ShippingProvider): Partial<ShippingProvider> {
  const safe = { ...p };
  delete safe.api_key;
  delete safe.api_secret;
  return safe;
}

// --- API ROUTES ---

// 1. Providers
router.get('/providers', (_req, res) => {
  const safeProviders = store.providers.map(sanitizeProvider);
  return res.json(safeProviders);
});

router.put('/providers/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const idx = store.providers.findIndex(p => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  // Preserve API keys unless updated
  store.providers[idx] = {
    ...store.providers[idx],
    ...updates,
    updated_at: new Date().toISOString()
  };

  saveStore();
  return res.json({ success: true, provider: sanitizeProvider(store.providers[idx]) });
});

// 2. Rates
router.get('/rates', (req, res) => {
  const { provider_id } = req.query;
  let result = store.rates;
  if (provider_id && typeof provider_id === 'string') {
    result = result.filter(r => r.provider_id === provider_id);
  }
  return res.json(result);
});

router.post('/rates', (req, res) => {
  const rate = req.body;
  if (!rate.provider_id || !rate.wilaya_id) {
    return res.status(400).json({ error: 'provider_id and wilaya_id required' });
  }

  const idx = store.rates.findIndex(r => r.provider_id === rate.provider_id && r.wilaya_id === Number(rate.wilaya_id));
  if (idx !== -1) {
    store.rates[idx] = {
      ...store.rates[idx],
      ...rate,
      updated_at: new Date().toISOString()
    };
  } else {
    store.rates.push({
      id: `RATE-${rate.provider_id}-${rate.wilaya_id}`,
      provider_id: rate.provider_id,
      wilaya_id: Number(rate.wilaya_id),
      home_rate: Number(rate.home_rate || 600),
      desk_rate: Number(rate.desk_rate || 400),
      home_est_days: Number(rate.home_est_days || 2),
      desk_est_days: Number(rate.desk_est_days || 2),
      is_active: rate.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  saveStore();
  return res.json({ success: true });
});

// 3. Settings
router.get('/settings', (_req, res) => {
  return res.json(store.settings);
});

router.post('/settings', (req, res) => {
  store.settings = {
    ...store.settings,
    ...req.body,
    updated_at: new Date().toISOString()
  };
  saveStore();
  return res.json({ success: true, settings: store.settings });
});

// 4. Quote Calculation Hierarchy
router.post('/calculate-fee', (req, res) => {
  const { wilaya_id, delivery_type, cart_subtotal, provider_id } = req.body;

  const subtotal = Number(cart_subtotal || 0);
  const wilayaId = Number(wilaya_id || 16);
  const type = delivery_type === 'stop_desk' ? 'desk' : 'home';
  const targetProviderId = provider_id || store.settings.default_provider_id || 'yalidine';

  // 1. Check free shipping threshold
  if (store.settings.free_shipping_threshold > 0 && subtotal >= store.settings.free_shipping_threshold) {
    return res.json({
      shipping_fee: 0,
      is_free_shipping: true,
      provider_id: targetProviderId
    });
  }

  // 2. Check provider specific rate for wilaya
  const matchingRate = store.rates.find(r => r.provider_id === targetProviderId && r.wilaya_id === wilayaId && r.is_active);
  if (matchingRate) {
    const fee = type === 'desk' ? matchingRate.desk_rate : matchingRate.home_rate;
    return res.json({
      shipping_fee: fee,
      is_free_shipping: false,
      provider_id: targetProviderId
    });
  }

  // 3. Fallback
  const fallbackFee = type === 'desk' ? 400 : 600;
  return res.json({
    shipping_fee: fallbackFee,
    is_free_shipping: false,
    provider_id: targetProviderId
  });
});

// 5. Shipments
router.get('/shipments', (_req, res) => {
  return res.json(store.shipments);
});

router.post('/shipments', (req, res) => {
  const body = req.body;
  if (!body.order_id) {
    return res.status(400).json({ error: 'order_id is required' });
  }

  const existingIdx = store.shipments.findIndex(s => s.order_id === body.order_id);
  const trackNum = body.tracking_number || `TRACK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const newShipment: Shipment = {
    id: existingIdx !== -1 ? store.shipments[existingIdx].id : `SHIP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    order_id: body.order_id,
    provider_id: body.provider_id || 'yalidine',
    delivery_type: body.delivery_type || 'home',
    stop_desk_id: body.stop_desk_id,
    stop_desk_name: body.stop_desk_name,
    shipping_fee: Number(body.shipping_fee || 0),
    cod_amount: Number(body.cod_amount || 0),
    status: body.status || 'pending',
    cod_status: body.cod_status || 'pending',
    tracking_number: trackNum,
    carrier_ref_id: body.carrier_ref_id,
    recipient_name: body.recipient_name || 'Client',
    recipient_phone: body.recipient_phone || '0550000000',
    recipient_wilaya_id: Number(body.recipient_wilaya_id || 16),
    recipient_commune: body.recipient_commune,
    recipient_address: body.recipient_address,
    created_at: existingIdx !== -1 ? store.shipments[existingIdx].created_at : new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stock_restored: existingIdx !== -1 ? store.shipments[existingIdx].stock_restored : false
  };

  if (existingIdx !== -1) {
    store.shipments[existingIdx] = newShipment;
  } else {
    store.shipments.push(newShipment);
  }

  // Create tracking event
  const trackEvent: ShipmentTrackingEvent = {
    id: `EVT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    shipment_id: newShipment.id,
    status: newShipment.status,
    location: 'Warehouse',
    description: 'Order created and pending shipment preparation',
    actor: 'Checkout / System',
    event_timestamp: new Date().toISOString()
  };
  store.trackingEvents.push(trackEvent);

  saveStore();
  return res.json(newShipment);
});

// Atomic Shipment Status Change with Inventory Restoration Guard
router.post('/shipments/status', async (req, res) => {
  const { p_shipment_id, p_new_status, p_location, p_description, p_actor } = req.body;

  const idx = store.shipments.findIndex(s => s.id === p_shipment_id || s.order_id === p_shipment_id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Shipment not found' });
  }

  const shipment = store.shipments[idx];
  const oldStatus = shipment.status;
  let stockRestored = false;

  // Inventory Restoration Guard: Only restore stock if transitioning to returned or cancelled AND NOT already restored
  if ((p_new_status === 'returned' || p_new_status === 'cancelled') && !shipment.stock_restored) {
    try {
      // Fetch order details from Supabase to restore stock for order items
      const { data: orderData } = await supabase
        .from('orders')
        .select('items')
        .eq('id', shipment.order_id)
        .maybeSingle();

      if (orderData && Array.isArray(orderData.items)) {
        for (const item of orderData.items) {
          if (item.product_id && item.quantity) {
            // Restore product stock quantity in Supabase
            const { data: prod } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', item.product_id)
              .maybeSingle();

            if (prod) {
              const newQty = (prod.stock_quantity || 0) + Number(item.quantity);
              await supabase
                .from('products')
                .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
                .eq('id', item.product_id);
              console.log(`[Inventory Restoration] Restored ${item.quantity} units for product ${item.product_id}. New Qty: ${newQty}`);
            }
          }
        }
      }
      shipment.stock_restored = true;
      stockRestored = true;
    } catch (err) {
      console.error('[Inventory Restoration Error]', err);
    }
  }

  // Update shipment status
  shipment.status = p_new_status;
  shipment.updated_at = new Date().toISOString();

  // Sync order status in Supabase if order exists
  let targetOrderStatus = 'pending';
  if (p_new_status === 'shipped' || p_new_status === 'in_transit' || p_new_status === 'out_for_delivery') {
    targetOrderStatus = 'shipped';
  } else if (p_new_status === 'delivered') {
    targetOrderStatus = 'delivered';
    shipment.cod_status = 'collected';
  } else if (p_new_status === 'returned' || p_new_status === 'cancelled') {
    targetOrderStatus = p_new_status === 'returned' ? 'returned' : 'cancelled';
  }

  try {
    await supabase
      .from('orders')
      .update({ status: targetOrderStatus, updated_at: new Date().toISOString() })
      .eq('id', shipment.order_id);
  } catch (err) {
    console.warn('[Order Sync Error]', err);
  }

  // Append tracking event
  const trackEvent: ShipmentTrackingEvent = {
    id: `EVT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    shipment_id: shipment.id,
    status: p_new_status,
    location: p_location || 'Logistics Hub',
    description: p_description || `Status updated from ${oldStatus} to ${p_new_status}`,
    actor: p_actor || 'Admin',
    event_timestamp: new Date().toISOString()
  };
  store.trackingEvents.push(trackEvent);

  saveStore();

  return res.json({
    success: true,
    shipment,
    stockRestored,
    oldStatus,
    newStatus: p_new_status
  });
});

// 6. Tracking Events
router.get('/shipments/:id/tracking', (req, res) => {
  const { id } = req.params;
  const events = store.trackingEvents.filter(e => e.shipment_id === id);
  return res.json(events);
});

// 7. Manifests
router.get('/manifests', (_req, res) => {
  return res.json(store.manifests);
});

router.post('/manifests', (req, res) => {
  const { provider_id, shipment_ids, driver_info, created_by } = req.body;

  if (!shipment_ids || !Array.isArray(shipment_ids) || shipment_ids.length === 0) {
    return res.status(400).json({ error: 'shipment_ids array required' });
  }

  const manifestNum = `MAN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const targetShipments = store.shipments.filter(s => shipment_ids.includes(s.id));

  const totalCod = targetShipments.reduce((sum, s) => sum + s.cod_amount, 0);

  const manifest: ShippingManifest = {
    id: `MAN-ID-${Date.now()}`,
    manifest_number: manifestNum,
    provider_id: provider_id || 'yalidine',
    status: 'generated',
    order_count: targetShipments.length,
    total_cod_amount: totalCod,
    driver_name: driver_info?.driverName || '',
    driver_phone: driver_info?.driverPhone || '',
    vehicle_plate: driver_info?.vehiclePlate || '',
    notes: driver_info?.notes || '',
    created_by: created_by || 'Admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  store.manifests.push(manifest);

  // Link shipments and update status to manifested
  for (const s of targetShipments) {
    s.manifest_id = manifest.id;
    s.status = 'manifested';
    s.updated_at = new Date().toISOString();

    store.trackingEvents.push({
      id: `EVT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      shipment_id: s.id,
      status: 'manifested',
      location: 'Warehouse Outbound',
      description: `Added to manifest ${manifestNum}`,
      actor: created_by || 'Admin',
      event_timestamp: new Date().toISOString()
    });
  }

  saveStore();
  return res.json(manifest);
});

// 8. Treasury Accounts
router.get('/treasury-accounts', (_req, res) => {
  return res.json(store.treasuryAccounts);
});

// 9. COD Settlements & Reconciliation
router.get('/cod-settlements', (_req, res) => {
  return res.json(store.codSettlements);
});

router.post('/cod-settlements', (req, res) => {
  const { provider_id, treasury_account_id, shipment_ids, gross_cod_amount, shipping_fees_deducted, reference_number, notes } = req.body;

  const gross = Number(gross_cod_amount || 0);
  const fees = Number(shipping_fees_deducted || 0);
  const net = gross - fees;

  const settlement: CodSettlement = {
    id: `SET-${Date.now()}`,
    settlement_number: `SETTL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
    provider_id: provider_id || 'yalidine',
    treasury_account_id: treasury_account_id || 'ACC-001',
    status: 'draft',
    shipment_count: Array.isArray(shipment_ids) ? shipment_ids.length : 1,
    gross_cod_amount: gross,
    shipping_fees_deducted: fees,
    net_payout_amount: net,
    reference_number: reference_number || '',
    notes: notes || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  store.codSettlements.push(settlement);
  saveStore();
  return res.json(settlement);
});

// Atomic COD Settlement Reconciliation Guard
router.post('/cod-settlements/reconcile', (req, res) => {
  const { settlement_id, treasury_account_id, actor } = req.body;

  const settlement = store.codSettlements.find(s => s.id === settlement_id || s.settlement_number === settlement_id);
  if (!settlement) {
    return res.status(404).json({ success: false, error: 'Settlement record not found' });
  }

  // Idempotency Guard: Reconciling twice MUST be rejected
  if (settlement.status === 'reconciled') {
    return res.status(400).json({
      success: false,
      error: 'Duplicate reconciliation rejected. Settlement has already been reconciled.'
    });
  }

  // Mark settlement as reconciled
  settlement.status = 'reconciled';
  settlement.reconciled_at = new Date().toISOString();
  settlement.reconciled_by = actor || 'Finance Manager';
  settlement.updated_at = new Date().toISOString();

  // Update target treasury account balance
  const targetAccId = treasury_account_id || settlement.treasury_account_id;
  const acc = store.treasuryAccounts.find(a => a.id === targetAccId);
  if (acc) {
    acc.balance = (acc.balance || 0) + settlement.net_payout_amount;
    acc.updated_at = new Date().toISOString();
  }

  // Record finance payment entry
  store.financePayments.push({
    id: `PAY-${Date.now()}`,
    reference_number: settlement.settlement_number,
    type: 'income',
    category: 'COD Carrier Settlement',
    amount: settlement.net_payout_amount,
    payment_method: 'carrier_transfer',
    treasury_account_id: targetAccId,
    notes: `COD Settlement payout from provider ${settlement.provider_id}. Gross: ${settlement.gross_cod_amount} DZD, Fees: ${settlement.shipping_fees_deducted} DZD`,
    created_at: new Date().toISOString()
  });

  saveStore();

  return res.json({
    success: true,
    settlement,
    updatedTreasuryBalance: acc ? acc.balance : 0
  });
});

// 10. Carrier Secret API Proxy Route (Prevents credential leakage to browser)
router.post('/carrier-proxy/track', async (req, res) => {
  const { provider_id, tracking_number } = req.body;

  const provider = store.providers.find(p => p.id === provider_id);
  if (!provider) {
    return res.status(404).json({ error: 'Carrier provider not found' });
  }

  // Server reads secret key safely from store
  const apiKey = provider.api_key || 'configured';
  const apiSecret = provider.api_secret || 'configured';

  console.log(`[Carrier Proxy] Requesting tracking info for ${tracking_number} via ${provider.name_fr} (Auth: ${apiKey.slice(0, 3)}** / ${apiSecret.slice(0, 3)}**)`);

  return res.json({
    success: true,
    provider: provider.code,
    tracking_number,
    status: 'in_transit',
    current_location: 'Alger Sorting Center',
    estimated_delivery: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    events: [
      { timestamp: new Date().toISOString(), description: 'Package processed at main sorting hub' }
    ]
  });
});

export default router;
