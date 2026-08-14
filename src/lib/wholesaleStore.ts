import { 
  CustomerGroup, PriceList, PriceListEntry, CustomerPriceOverride, 
  PurchaseOrder, PaymentTerms, WholesaleInvoice, WholesaleSettings 
} from '../types';
import { supabase } from './supabase';

export interface CustomerCreditData {
  customer_id: string;
  customer_group_id?: string;
  credit_limit?: number;
  credit_balance?: number;
  company_name?: string;
  account_type?: string;
  wholesale_status?: string;
}

export interface WholesaleStoreData {
  groups: CustomerGroup[];
  customer_credits?: CustomerCreditData[];
  price_lists?: PriceList[];
  priceLists?: PriceList[];
  price_entries?: PriceListEntry[];
  priceEntries?: PriceListEntry[];
  overrides: CustomerPriceOverride[];
  purchase_orders?: PurchaseOrder[];
  purchaseOrders?: PurchaseOrder[];
  payment_terms?: PaymentTerms[];
  paymentTerms?: PaymentTerms[];
  invoices: WholesaleInvoice[];
  settings?: WholesaleSettings;
  wholesaleSettings?: WholesaleSettings;
  creditData?: Record<string, CustomerCreditData>;
}

export const DEFAULT_WHOLESALE_SETTINGS: WholesaleSettings = {
  min_order_amount: 50000,
  credit_limit_default: 100000,
  auto_approve_po: false,
  default_payment_terms_days: 30,
  wholesale_terms_notes: '1. Le paiement doit être effectué dans le délai convenu.\n2. Tout retard entraînera la suspension du compte crédit.',
};

/**
 * Loads all Wholesale / B2B data directly from Supabase PostgreSQL tables.
 */
export async function loadWholesaleStore(): Promise<WholesaleStoreData> {
  try {
    const [
      groupsRes,
      listsRes,
      entriesRes,
      overridesRes,
      termsRes,
      posRes,
      invoicesRes,
      settingsRes,
      custsRes
    ] = await Promise.all([
      supabase.from('customer_groups').select('*').order('created_at', { ascending: false }),
      supabase.from('price_lists').select('*').order('created_at', { ascending: false }),
      supabase.from('price_list_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('customer_price_overrides').select('*').order('created_at', { ascending: false }),
      supabase.from('payment_terms').select('*').order('days', { ascending: true }),
      supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('wholesale_invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('wholesale_settings').select('*').limit(1).maybeSingle(),
      supabase.from('customers').select('id, company_name, customer_group_id, credit_limit, credit_balance, account_type, wholesale_status').eq('account_type', 'wholesale')
    ]);

    const groups: CustomerGroup[] = groupsRes.data || [];
    const price_lists: PriceList[] = listsRes.data || [];
    const price_entries: PriceListEntry[] = entriesRes.data || [];
    const overrides: CustomerPriceOverride[] = overridesRes.data || [];
    const payment_terms: PaymentTerms[] = (termsRes.data && termsRes.data.length > 0) 
      ? termsRes.data.map(pt => ({ id: pt.id, label: pt.name || pt.label, days: pt.days, is_active: pt.is_active }))
      : [
          { id: 'pt-30', label: 'Net 30 Days', days: 30, is_active: true },
          { id: 'pt-60', label: 'Net 60 Days', days: 60, is_active: true },
          { id: 'pt-cash', label: 'Cash on Delivery (COD)', days: 0, is_active: true }
        ];
    const purchase_orders: PurchaseOrder[] = posRes.data || [];
    const invoices: WholesaleInvoice[] = invoicesRes.data || [];
    const settings: WholesaleSettings = settingsRes.data 
      ? {
          min_order_amount: settingsRes.data.min_order_amount ?? 50000,
          credit_limit_default: settingsRes.data.credit_limit_default ?? 100000,
          auto_approve_po: settingsRes.data.auto_approve_po ?? false,
          default_payment_terms_days: settingsRes.data.default_payment_terms_days ?? 30,
          wholesale_terms_notes: settingsRes.data.wholesale_terms_notes || DEFAULT_WHOLESALE_SETTINGS.wholesale_terms_notes,
        }
      : DEFAULT_WHOLESALE_SETTINGS;

    const customer_credits: CustomerCreditData[] = (custsRes.data || []).map(c => ({
      customer_id: c.id,
      customer_group_id: c.customer_group_id || '',
      credit_limit: c.credit_limit || 100000,
      credit_balance: c.credit_balance || 0,
      company_name: c.company_name || '',
      account_type: c.account_type || 'wholesale',
      wholesale_status: c.wholesale_status || 'approved'
    }));

    return {
      groups,
      customer_credits,
      price_lists,
      priceLists: price_lists,
      price_entries,
      priceEntries: price_entries,
      overrides,
      purchase_orders,
      purchaseOrders: purchase_orders,
      payment_terms,
      paymentTerms: payment_terms,
      invoices,
      settings,
      wholesaleSettings: settings,
    };
  } catch (err) {
    console.error('Error loading wholesale store from Supabase:', err);
    return {
      groups: [],
      customer_credits: [],
      price_lists: [],
      price_entries: [],
      overrides: [],
      purchase_orders: [],
      payment_terms: [],
      invoices: [],
      settings: DEFAULT_WHOLESALE_SETTINGS
    };
  }
}

/**
 * Legacy compatibility stub. Business data is persisted immediately per operation via Supabase.
 */
export async function saveWholesaleStore(): Promise<boolean> {
  return true;
}

/* -------------------------------------------------------------------------- */
/*                          ATOMIC CREDIT ADJUSTMENT                           */
/* -------------------------------------------------------------------------- */

export async function adjustCustomerCreditInDB(params: {
  customer_id: string;
  amount: number;
  type: 'charge' | 'payment' | 'refund';
  order_id?: string;
  reference_number?: string;
  description?: string;
}): Promise<{ success: boolean; new_balance?: number; available_credit?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('adjust_customer_credit', {
      p_customer_id: params.customer_id,
      p_amount: params.amount,
      p_type: params.type,
      p_order_id: params.order_id || null,
      p_reference_number: params.reference_number || null,
      p_description: params.description || null
    });

    if (error) {
      console.error('RPC adjust_customer_credit error:', error);
      return { success: false, error: error.message };
    }

    if (data && data.success === false) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      new_balance: data?.new_balance,
      available_credit: data?.available_credit
    };
  } catch (err: unknown) {
    const errorObj = err as Error;
    console.error('Failed adjustCustomerCreditInDB:', err);
    return { success: false, error: errorObj.message || 'Credit adjustment failed' };
  }
}

/* -------------------------------------------------------------------------- */
/*                         WHOLESALE ACTIVITY LOGS                             */
/* -------------------------------------------------------------------------- */

export async function logWholesaleActivityInDB(params: {
  customer_id?: string;
  action: string;
  details: string;
  created_by?: string;
}) {
  try {
    await supabase.from('wholesale_activity_logs').insert({
      customer_id: params.customer_id || null,
      action: params.action,
      details: params.details,
      created_by: params.created_by || 'Admin',
    });
  } catch (err) {
    console.warn('Failed to insert wholesale activity log:', err);
  }
}

export async function fetchWholesaleActivityLogsFromDB(customerId?: string) {
  try {
    let query = supabase.from('wholesale_activity_logs').select('*').order('created_at', { ascending: false });
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    const { data } = await query;
    return data || [];
  } catch {
    return [];
  }
}

