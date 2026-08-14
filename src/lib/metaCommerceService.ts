import { supabase } from './supabase';
import { Product } from '../types';

export interface MetaConfig {
  appId: string;
  appSecret: string;
  hasAppSecret?: boolean;
  appSecretSnippet?: string;
  accessToken: string;
  tokenExpiresAt?: string;
  connectedUser: { id: string; name: string; email?: string } | null;
  selectedPageId: string;
  selectedPageName: string;
  selectedPageAccessToken: string;
  selectedInstagramId: string;
  selectedInstagramUsername: string;
  selectedBusinessId: string;
  selectedCatalogId: string;
  selectedCatalogName: string;
  autoSyncEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: 'success' | 'failed' | 'idle';
}

export interface MetaSyncLog {
  id: string;
  timestamp: string;
  mode: 'manual' | 'auto';
  totalProducts: number;
  successCount: number;
  errorCount: number;
  status: 'success' | 'failed' | 'warning';
  message: string;
  details?: unknown;
}

const CONFIG_STORAGE_KEY = 'business_market_meta_commerce_config';
const LOGS_STORAGE_KEY = 'business_market_meta_sync_logs';

export const defaultConfig: MetaConfig = {
  appId: '',
  appSecret: '',
  accessToken: '',
  tokenExpiresAt: '',
  connectedUser: null,
  selectedPageId: '',
  selectedPageName: '',
  selectedPageAccessToken: '',
  selectedInstagramId: '',
  selectedInstagramUsername: '',
  selectedBusinessId: '',
  selectedCatalogId: '',
  selectedCatalogName: '',
  autoSyncEnabled: true,
  lastSyncAt: null,
  lastSyncStatus: 'idle',
};

// 1. Load Meta Commerce Config
export async function getMetaConfig(): Promise<MetaConfig> {
  // Try fetching from secure server endpoint first
  try {
    const res = await fetch('/api/meta/config');
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.config) {
        // Also update local cache
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultConfig, ...data.config }));
        return { ...defaultConfig, ...data.config };
      }
    }
  } catch (err) {
    console.warn('[MetaCommerceService] Server config fetch notice:', err);
  }

  // Fallback: Try fetching from Supabase system_settings
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'meta_social_commerce_config')
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      return { ...defaultConfig, ...parsed };
    }
  } catch (err) {
    console.warn('[MetaCommerceService] Supabase config fetch notice:', err);
  }

  // Fallback to localStorage
  try {
    const local = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (local) {
      return { ...defaultConfig, ...JSON.parse(local) };
    }
  } catch (e) {
    console.warn('[MetaCommerceService] LocalStorage read failed:', e);
  }

  return defaultConfig;
}

// 2. Save Meta Commerce Config
export async function saveMetaConfig(config: MetaConfig): Promise<boolean> {
  try {
    // Save locally
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));

    // Save to server API endpoint (which writes to system_settings with is_public = false)
    try {
      await fetch('/api/meta/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
    } catch (e) {
      console.warn('[MetaCommerceService] Server config save notice:', e);
    }

    return true;
  } catch (err) {
    console.error('[MetaCommerceService] Save config failed:', err);
    return false;
  }
}

// 3. Load Sync Logs
export async function getSyncLogs(): Promise<MetaSyncLog[]> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'meta_sync_logs')
      .single();

    if (!error && data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[MetaCommerceService] Logs fetch notice:', err);
  }

  try {
    const local = localStorage.getItem(LOGS_STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[MetaCommerceService] LocalStorage logs read failed:', e);
  }

  return [];
}

// 4. Add Sync Log
export async function addSyncLog(log: Omit<MetaSyncLog, 'id' | 'timestamp'>): Promise<MetaSyncLog[]> {
  const newLog: MetaSyncLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    ...log,
  };

  const currentLogs = await getSyncLogs();
  const updatedLogs = [newLog, ...currentLogs].slice(0, 100); // keep last 100 logs

  try {
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updatedLogs));

    await supabase
      .from('system_settings')
      .upsert({
        key: 'meta_sync_logs',
        value: JSON.stringify(updatedLogs),
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
  } catch (err) {
    console.warn('[MetaCommerceService] Save log warning:', err);
  }

  return updatedLogs;
}

// Helper to safely parse JSON responses and provide clear error messages if an HTML error page is returned
async function parseJsonResponse<T = Record<string, unknown>>(res: Response, fallbackMessage: string): Promise<T> {
  const contentType = res.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (text.startsWith('<!doctype') || text.startsWith('<html') || text.includes('<!DOCTYPE')) {
      throw new Error(`${fallbackMessage}: The server returned an HTML page (Status ${res.status}). Verify that backend API routes are active.`);
    }
    throw new Error(`${fallbackMessage} (Status ${res.status}): ${text.substring(0, 120)}`);
  }
  return res.json() as Promise<T>;
}

// 5. Get OAuth Authorization URL
export async function fetchMetaOAuthUrl(appId: string): Promise<string> {
  const redirectUri = `${window.location.origin}/api/meta/callback`;
  const res = await fetch(`/api/meta/oauth-url?appId=${encodeURIComponent(appId)}&redirectUri=${encodeURIComponent(redirectUri)}`);
  const data = await parseJsonResponse<{ success: boolean; url?: string; message?: string }>(res, 'Failed to get Meta OAuth authorization URL');
  if (!res.ok || !data.success || !data.url) {
    throw new Error(data.message || 'Failed to get Meta OAuth authorization URL');
  }
  return data.url;
}

// 6. Exchange Authorization Code for Long-Lived Token
export async function exchangeMetaCode(code: string, appId: string, appSecret: string) {
  const redirectUri = `${window.location.origin}/api/meta/callback`;
  const res = await fetch('/api/meta/exchange-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, appId, appSecret, redirectUri })
  });
  const data = await parseJsonResponse<{ success: boolean; accessToken?: string; user?: { id: string; name: string; email?: string }; message?: string }>(res, 'Failed to exchange Meta authorization code');
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to exchange Meta authorization code');
  }
  return data;
}

// 7. Fetch Facebook Pages and Instagram Accounts
export async function fetchMetaPages(accessToken: string) {
  const res = await fetch('/api/meta/pages', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await parseJsonResponse<{ success: boolean; pages?: Array<{ id: string; name: string; access_token: string; category: string; instagram_business_account?: { id: string; username: string; name: string } }>; message?: string }>(res, 'Failed to fetch Facebook Pages');
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch Facebook Pages');
  }
  return data.pages || [];
}

// 8. Fetch Catalogs and Businesses
export async function fetchMetaCatalogs(accessToken: string, businessId?: string) {
  const url = businessId ? `/api/meta/catalogs?businessId=${encodeURIComponent(businessId)}` : '/api/meta/catalogs';
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await parseJsonResponse<{ success: boolean; businesses?: Array<{ id: string; name: string }>; catalogs?: Array<{ id: string; name: string; product_count?: number; vertical?: string }>; message?: string }>(res, 'Failed to fetch Meta Catalogs');
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch Meta Catalogs');
  }
  return data;
}

// 9. Create New Meta Catalog
export interface MetaApiErrorDetails {
  code?: number;
  error_subcode?: number;
  message?: string;
  type?: string;
  fbtrace_id?: string;
  user_title?: string;
  user_msg?: string;
  business_id_used?: string;
  help?: string;
}

export class MetaApiError extends Error {
  details?: MetaApiErrorDetails;
  constructor(message: string, details?: MetaApiErrorDetails) {
    super(message);
    this.name = 'MetaApiError';
    this.details = details;
  }
}

export async function createMetaCatalog(accessToken: string, businessId: string, catalogName: string) {
  const res = await fetch('/api/meta/catalogs/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, businessId, catalogName })
  });
  const data = await parseJsonResponse<{
    success: boolean;
    catalog?: { id: string; name: string; product_count: number };
    businessId?: string;
    message?: string;
    error?: MetaApiErrorDetails;
  }>(res, 'Failed to create Meta Product Catalog');

  if (!res.ok || !data.success || !data.catalog) {
    const errMsg = data.message || data.error?.message || 'Failed to create Meta Product Catalog';
    throw new MetaApiError(errMsg, data.error);
  }
  return { ...data.catalog, businessId: data.businessId };
}

// 10. Execute Product Sync to Meta Catalog
export async function syncProductsToMetaCatalog(config: MetaConfig, products: Product[], mode: 'manual' | 'auto' = 'manual') {
  if (!config.accessToken || !config.selectedCatalogId) {
    throw new Error('Meta Access Token and Catalog ID must be configured before synchronizing products.');
  }

  if (products.length === 0) {
    throw new Error('No products available in Business Market to synchronize.');
  }

  const baseUrl = window.location.origin;

  try {
    const res = await fetch('/api/meta/sync-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: config.selectedPageAccessToken || config.accessToken,
        catalogId: config.selectedCatalogId,
        products,
        currency: 'DZD',
        baseUrl
      })
    });

    const data = await parseJsonResponse<{ success: boolean; processedCount?: number; message?: string; details?: unknown }>(res, 'Meta Catalog API Synchronization failed.');

    if (!res.ok || !data.success) {
      const errorMsg = data.message || 'Meta Catalog API Synchronization failed.';
      await addSyncLog({
        mode,
        totalProducts: products.length,
        successCount: 0,
        errorCount: products.length,
        status: 'failed',
        message: errorMsg,
        details: data.details || data
      });

      config.lastSyncAt = new Date().toISOString();
      config.lastSyncStatus = 'failed';
      await saveMetaConfig(config);

      throw new Error(errorMsg);
    }

    const successLog = await addSyncLog({
      mode,
      totalProducts: products.length,
      successCount: data.processedCount || products.length,
      errorCount: 0,
      status: 'success',
      message: `Successfully published/updated ${products.length} products to Meta Catalog (ID: ${config.selectedCatalogId}).`,
      details: data
    });

    config.lastSyncAt = new Date().toISOString();
    config.lastSyncStatus = 'success';
    await saveMetaConfig(config);

    return {
      success: true,
      data,
      logs: successLog
    };
  } catch (err: unknown) {
    const error = err as Error;
    await addSyncLog({
      mode,
      totalProducts: products.length,
      successCount: 0,
      errorCount: products.length,
      status: 'failed',
      message: error.message || 'Sync operation encountered an error.',
      details: error
    });

    config.lastSyncAt = new Date().toISOString();
    config.lastSyncStatus = 'failed';
    await saveMetaConfig(config);

    throw error;
  }
}

// 11. Check Access Token Status
export async function checkMetaTokenStatus(accessToken: string) {
  try {
    const res = await fetch('/api/meta/status', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return await parseJsonResponse<{ connected: boolean; tokenValid?: boolean; user?: { id: string; name: string }; error?: string }>(res, 'Failed to check token status');
  } catch (e: unknown) {
    const error = e as Error;
    return { connected: false, tokenValid: false, error: error.message };
  }
}
