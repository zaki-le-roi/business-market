import { supabase } from './supabase';
import { Coupon } from '../types';

export interface Promotion {
  id: string;
  title_ar: string;
  title_fr: string;
  type: 'flash_sale' | 'product_discount' | 'category_discount' | 'buy_x_get_y' | 'bundle' | 'scheduled';
  discount_type: 'percentage' | 'fixed' | 'free_shipping';
  discount_value: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  target_type: 'all_products' | 'specific_products' | 'specific_categories';
  product_ids?: string[];
  category_ids?: string[];
  buy_x?: number;
  get_y?: number;
  bundle_price?: number;
  created_at: string;
  updated_at: string;
}

export interface MarketingNotification {
  id: string;
  title: string;
  message: string;
  target_group: 'all' | 'retail' | 'wholesale' | 'selected';
  selected_customer_ids?: string[];
  scheduled_at?: string | null;
  sent_at?: string | null;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  created_at: string;
}

export interface MarketingActivityLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  user: string;
}

export interface ExtendedCoupon extends Coupon {
  customer_group_restriction?: 'all' | 'retail' | 'wholesale' | string;
}

const COUPONS_STORAGE_KEY = 'marketing_coupons_data';
const PROMOTIONS_STORAGE_KEY = 'marketing_promotions_data';
const NOTIFICATIONS_STORAGE_KEY = 'marketing_notifications_data';
const LOGS_STORAGE_KEY = 'marketing_activity_logs';

// Helper Functions for Coupons Persistence
export function loadCoupons(): ExtendedCoupon[] {
  try {
    const saved = localStorage.getItem(COUPONS_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading coupons from localStorage:', e);
  }
  return [];
}

export function saveCoupons(coupons: ExtendedCoupon[]) {
  localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(coupons));
}

// Helper Functions for Promotions
export function loadPromotions(): Promotion[] {
  try {
    const saved = localStorage.getItem(PROMOTIONS_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading promotions from localStorage:', e);
  }
  return [];
}

export function savePromotions(promotions: Promotion[]) {
  localStorage.setItem(PROMOTIONS_STORAGE_KEY, JSON.stringify(promotions));
}

// Helper Functions for Notifications
export function loadNotifications(): MarketingNotification[] {
  try {
    const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading notifications from localStorage:', e);
  }
  return [];
}

export function saveNotifications(notifications: MarketingNotification[]) {
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
}

// Helper Functions for Logs
export function loadMarketingLogs(): MarketingActivityLog[] {
  try {
    const saved = localStorage.getItem(LOGS_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading marketing logs from localStorage:', e);
  }
  return [];
}

export function addMarketingLog(action: string, details: string, user: string = 'Admin') {
  const current = loadMarketingLogs();
  const newLog: MarketingActivityLog = {
    id: `log-${Date.now()}`,
    action,
    details,
    timestamp: new Date().toISOString(),
    user
  };
  const updated = [newLog, ...current].slice(0, 100);
  localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

// --- SUPABASE DIRECT API FUNCTIONS ---

// 1. Coupons
export async function fetchCouponsFromDB(): Promise<ExtendedCoupon[]> {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching coupons from Supabase:', error.message);
      return loadCoupons();
    }
    if (data) {
      const mapped = data as ExtendedCoupon[];
      saveCoupons(mapped);
      return mapped;
    }
  } catch (e) {
    console.error('Error fetching coupons:', e);
  }
  return loadCoupons();
}

export async function upsertCouponInDB(couponData: Partial<ExtendedCoupon>): Promise<{ success: boolean; data?: ExtendedCoupon; error?: string }> {
  try {
    const payload = { ...couponData };
    if (!payload.id || payload.id.startsWith('coup-') || payload.id.startsWith('coupon-')) {
      delete payload.id;
    }

    const { data, error } = await supabase
      .from('coupons')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      console.error('Failed to upsert coupon in DB:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as ExtendedCoupon };
  } catch (e: unknown) {
    console.error('Exception in upsertCouponInDB:', e);
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to save coupon' };
  }
}

export async function deleteCouponFromDB(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete coupon in DB:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to delete coupon' };
  }
}

// 2. Promotions
export async function fetchPromotionsFromDB(): Promise<Promotion[]> {
  try {
    const { data, error } = await supabase
      .from('marketing_promotions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching promotions from Supabase:', error.message);
      return loadPromotions();
    }
    if (data) {
      const mapped = data as Promotion[];
      savePromotions(mapped);
      return mapped;
    }
  } catch (e) {
    console.error('Error fetching promotions:', e);
  }
  return loadPromotions();
}

export async function upsertPromotionInDB(promData: Partial<Promotion>): Promise<{ success: boolean; data?: Promotion; error?: string }> {
  try {
    const payload = { ...promData };
    if (!payload.id || payload.id.startsWith('prom-') || payload.id.startsWith('promotion-')) {
      delete payload.id;
    }

    const { data, error } = await supabase
      .from('marketing_promotions')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      console.error('Failed to upsert promotion in DB:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Promotion };
  } catch (e: unknown) {
    console.error('Exception in upsertPromotionInDB:', e);
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to save promotion' };
  }
}

export async function deletePromotionFromDB(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('marketing_promotions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete promotion in DB:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to delete promotion' };
  }
}

// 3. Notifications
export async function fetchNotificationsFromDB(): Promise<MarketingNotification[]> {
  try {
    const { data, error } = await supabase
      .from('marketing_notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching notifications from Supabase:', error.message);
      return loadNotifications();
    }
    if (data) {
      const mapped = data as MarketingNotification[];
      saveNotifications(mapped);
      return mapped;
    }
  } catch (e) {
    console.error('Error fetching notifications:', e);
  }
  return loadNotifications();
}

export async function upsertNotificationInDB(notifData: Partial<MarketingNotification>): Promise<{ success: boolean; data?: MarketingNotification; error?: string }> {
  try {
    const payload = { ...notifData };
    if (!payload.id || payload.id.startsWith('notif-') || payload.id.startsWith('notification-')) {
      delete payload.id;
    }

    const { data, error } = await supabase
      .from('marketing_notifications')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      console.error('Failed to upsert notification in DB:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as MarketingNotification };
  } catch (e: unknown) {
    console.error('Exception in upsertNotificationInDB:', e);
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to save notification' };
  }
}

export async function deleteNotificationFromDB(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('marketing_notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete notification in DB:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'Failed to delete notification' };
  }
}

// 4. Marketing Activity Audit Logs
export async function fetchMarketingLogsFromDB(): Promise<MarketingActivityLog[]> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'marketing')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data && data.length > 0) {
      const mapped: MarketingActivityLog[] = data.map((log) => ({
        id: log.id,
        action: log.action || 'Marketing Action',
        details: typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || ''),
        timestamp: log.created_at,
        user: log.actor || 'Admin'
      }));
      return mapped;
    }
  } catch (e) {
    console.warn('Error reading audit logs for marketing:', e);
  }
  return loadMarketingLogs();
}

export async function addMarketingLogToDB(action: string, details: string, user: string = 'Admin'): Promise<void> {
  // Update local
  addMarketingLog(action, details, user);

  // Update Supabase audit_logs
  try {
    await supabase.from('audit_logs').insert([{
      actor: user,
      action: action,
      entity_type: 'marketing',
      details: { details, timestamp: new Date().toISOString() }
    }]);
  } catch (e) {
    console.warn('Could not save marketing audit log to DB:', e);
  }
}
