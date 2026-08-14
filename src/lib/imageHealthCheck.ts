import { supabase } from './supabase';
import { getBanners } from './banners';

export interface ImageHealthReportItem {
  id: string; // unique item check id
  entityType: 'product' | 'category' | 'banner' | 'cms_content';
  entityId: string;
  entityName: string;
  url: string;
  status: 'healthy' | 'broken';
  errorDetail: string;
  lastChecked: string;
}

export interface ImageHealthSummary {
  totalChecked: number;
  healthyCount: number;
  brokenCount: number;
  lastCompletedRun: string | null;
  isRunning: boolean;
  progress: number; // 0 to 100
  currentScanningName: string;
}

const STORAGE_KEY_ITEMS = 'image_health_check_items';
const STORAGE_KEY_CONFIG = 'image_health_check_config';

export interface HealthCheckConfig {
  periodicEnabled: boolean;
  intervalMinutes: number;
  lastRunTimestamp: number | null;
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  periodicEnabled: true,
  intervalMinutes: 10,
  lastRunTimestamp: null,
};

/**
 * Get saved health check items from localStorage
 */
export function getSavedHealthCheckItems(): ImageHealthReportItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('[ImageHealthCheck] Error loading saved items:', err);
    return [];
  }
}

/**
 * Save health check items to localStorage
 */
export function saveHealthCheckItems(items: ImageHealthReportItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    // Dispatch custom event to notify any mounted UI components
    window.dispatchEvent(new CustomEvent('image-health-items-updated', { detail: items }));
  } catch (err) {
    console.error('[ImageHealthCheck] Error saving items:', err);
  }
}

/**
 * Get config from localStorage
 */
export function getHealthCheckConfig(): HealthCheckConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Save config to localStorage
 */
export function saveHealthCheckConfig(config: HealthCheckConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('image-health-config-updated', { detail: config }));
  } catch (err) {
    console.error('[ImageHealthCheck] Error saving config:', err);
  }
}

/**
 * Test a single image URL via fetch / Image loader.
 */
export function validateImageUrl(url: string, timeoutMs = 8000): Promise<{ status: 'healthy' | 'broken'; error: string }> {
  if (!url) {
    return Promise.resolve({ status: 'broken', error: 'Empty URL' });
  }

  // Handle inline base64 data URLs
  if (url.startsWith('data:image/')) {
    return Promise.resolve({ status: 'healthy', error: '' });
  }

  // Handle Blob URLs (mock storage)
  if (url.startsWith('blob:')) {
    return new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => {
        img.src = '';
        resolve({ status: 'broken', error: 'Blob load timeout' });
      }, 3000);

      img.onload = () => {
        clearTimeout(timer);
        resolve({ status: 'healthy', error: '' });
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve({ status: 'broken', error: 'Invalid or revoked Blob URL' });
      };

      img.src = url;
    });
  }

  // Standard network url validation
  return new Promise((resolve) => {
    let resolved = false;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const signal = controller ? controller.signal : undefined;

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      if (controller) {
        try {
          controller.abort();
        } catch (e) {
          console.warn('[ImageHealthCheck] Controller abort error:', e);
        }
      }
      // Fallback to Image element loading check because of CORS on some image resources
      validateWithImageTag(url)
        .then(resolve)
        .catch(() => resolve({ status: 'broken', error: 'Network request timeout' }));
    }, timeoutMs);

    // Try standard fetch first (very reliable for checking headers/responses if CORS is allowed)
    fetch(url, { method: 'HEAD', signal, mode: 'cors' })
      .then((res) => {
        if (resolved) return;
        if (res.ok) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ status: 'healthy', error: '' });
        } else {
          // If HEAD fails or gets CORS block, try full GET, or fall back to image tag load
          fetch(url, { method: 'GET', signal, mode: 'cors' })
            .then((getRes) => {
              if (resolved) return;
              if (getRes.ok) {
                resolved = true;
                clearTimeout(timeout);
                resolve({ status: 'healthy', error: '' });
              } else {
                resolved = true;
                clearTimeout(timeout);
                resolve({ status: 'broken', error: `HTTP Error ${getRes.status} (${getRes.statusText})` });
              }
            })
            .catch(() => {
              // CORS might block fetch completely but browser can still render the image in <img>.
              // So we fall back to image tag loading as the ground truth.
              validateWithImageTag(url).then((imgRes) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                resolve(imgRes);
              });
            });
        }
      })
      .catch(() => {
        // Fall back to Image tag loading when fetch is blocked by CORS/network errors
        validateWithImageTag(url).then((imgRes) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          resolve(imgRes);
        });
      });
  });
}

function validateWithImageTag(url: string): Promise<{ status: 'healthy' | 'broken'; error: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    let isSettled = false;

    const timer = setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      img.src = '';
      resolve({ status: 'broken', error: 'Image element timeout' });
    }, 8000);

    img.onload = () => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);
      resolve({ status: 'healthy', error: '' });
    };

    img.onerror = () => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);
      resolve({ status: 'broken', error: 'Resource failed to load or is not an image' });
    };

    img.src = url;
  });
}

/**
 * Perform a full diagnostic check across all entities.
 * Triggers callback for status updates (e.g. current scanning item, progress).
 */
export async function runFullImageHealthCheck(
  onUpdate?: (summary: ImageHealthSummary) => void
): Promise<ImageHealthReportItem[]> {
  const summary: ImageHealthSummary = {
    totalChecked: 0,
    healthyCount: 0,
    brokenCount: 0,
    lastCompletedRun: null,
    isRunning: true,
    progress: 0,
    currentScanningName: 'Initializing database query...',
  };

  const update = (props: Partial<ImageHealthSummary>) => {
    Object.assign(summary, props);
    if (onUpdate) onUpdate({ ...summary });
    // Dispatch status update event
    window.dispatchEvent(new CustomEvent('image-health-summary-updated', { detail: { ...summary } }));
  };

  update({ isRunning: true, progress: 5 });

  const itemsToCheck: {
    entityType: 'product' | 'category' | 'banner' | 'cms_content';
    entityId: string;
    entityName: string;
    url: string;
  }[] = [];

  try {
    // 1. Fetch Products
    update({ currentScanningName: 'Fetching products from Supabase...' });
    const { data: products } = await supabase.from('products').select('id, name_ar, name_fr, images');
    if (products) {
      for (const p of products) {
        const pImages = Array.isArray(p.images) ? p.images : [];
        pImages.forEach((imgUrl: string, idx: number) => {
          if (imgUrl) {
            itemsToCheck.push({
              entityType: 'product',
              entityId: p.id,
              entityName: `${p.name_fr || p.name_ar || 'Product'} (Img #${idx + 1})`,
              url: imgUrl,
            });
          }
        });
      }
    }

    // 2. Fetch Categories
    update({ currentScanningName: 'Fetching categories...' });
    const { data: categories } = await supabase.from('categories').select('id, name_ar, name_fr, image_url');
    if (categories) {
      for (const c of categories) {
        if (c.image_url) {
          itemsToCheck.push({
            entityType: 'category',
            entityId: c.id,
            entityName: c.name_fr || c.name_ar || 'Category',
            url: c.image_url,
          });
        }
      }
    }

    // 3. Fetch Banners
    update({ currentScanningName: 'Fetching homepage banners...' });
    try {
      const banners = await getBanners();
      for (const b of banners) {
        if (b.image_url) {
          itemsToCheck.push({
            entityType: 'banner',
            entityId: b.id,
            entityName: `Banner: ${b.title_fr || b.title_ar || b.title || 'Untitled'} (Desktop)`,
            url: b.image_url,
          });
        }
        if (b.mobile_image_url) {
          itemsToCheck.push({
            entityType: 'banner',
            entityId: b.id,
            entityName: `Banner: ${b.title_fr || b.title_ar || b.title || 'Untitled'} (Mobile)`,
            url: b.mobile_image_url,
          });
        }
      }
    } catch (e) {
      console.warn('[ImageHealthCheck] Error loading banners during diagnostic:', e);
    }

    // 4. Fetch CMS Media Library images
    update({ currentScanningName: 'Fetching CMS Media Library assets...' });
    try {
      const { data: media } = await supabase.from('cms_media').select('id, name, title_ar, title_fr, url');
      if (media) {
        for (const item of media) {
          if (item.url) {
            itemsToCheck.push({
              entityType: 'cms_content',
              entityId: item.id,
              entityName: `CMS Media: ${item.title_fr || item.title_ar || item.name}`,
              url: item.url,
            });
          }
        }
      }
    } catch (e) {
      console.warn('[ImageHealthCheck] Error loading cms_media during diagnostic:', e);
    }

  } catch (err) {
    console.error('[ImageHealthCheck] Error querying database records:', err);
  }

  const total = itemsToCheck.length;
  if (total === 0) {
    update({
      totalChecked: 0,
      healthyCount: 0,
      brokenCount: 0,
      lastCompletedRun: new Date().toISOString(),
      isRunning: false,
      progress: 100,
      currentScanningName: 'No images found to scan.',
    });
    saveHealthCheckItems([]);
    return [];
  }

  update({ totalChecked: total, progress: 10 });

  const finalReport: ImageHealthReportItem[] = [];
  let healthy = 0;
  let broken = 0;

  // Process sequential checking so we don't spam the network or IndexedDB
  for (let i = 0; i < total; i++) {
    const item = itemsToCheck[i];
    update({
      currentScanningName: `Checking (${i + 1}/${total}): ${item.entityName}`,
      progress: Math.round(10 + (i / total) * 90),
    });

    const checkResult = await validateImageUrl(item.url);
    if (checkResult.status === 'healthy') {
      healthy++;
    } else {
      broken++;
    }

    finalReport.push({
      id: `${item.entityType}-${item.entityId}-${i}`,
      entityType: item.entityType,
      entityId: item.entityId,
      entityName: item.entityName,
      url: item.url,
      status: checkResult.status,
      errorDetail: checkResult.error,
      lastChecked: new Date().toISOString(),
    });

    // Save progressively to prevent losing results in long runs
    saveHealthCheckItems([...finalReport]);
  }

  // Complete
  update({
    totalChecked: total,
    healthyCount: healthy,
    brokenCount: broken,
    lastCompletedRun: new Date().toISOString(),
    isRunning: false,
    progress: 100,
    currentScanningName: `Scan complete! Checked ${total} images. Found ${broken} broken.`,
  });

  const config = getHealthCheckConfig();
  saveHealthCheckConfig({
    ...config,
    lastRunTimestamp: Date.now(),
  });

  return finalReport;
}

/**
 * Start global periodic background check listener.
 * This should be booted when App.tsx mounts or within the Admin Layout context.
 */
let backgroundInterval: NodeJS.Timeout | null = null;

export function initBackgroundHealthCheck() {
  if (typeof window === 'undefined') return;
  if (backgroundInterval) clearInterval(backgroundInterval);

  const runCheckIfTime = async () => {
    const config = getHealthCheckConfig();
    if (!config.periodicEnabled) return;

    const lastRun = config.lastRunTimestamp;
    const now = Date.now();
    const minMs = config.intervalMinutes * 60 * 1000;

    if (!lastRun || now - lastRun >= minMs) {
      console.log('[BackgroundHealthCheck] Time elapsed since last run. Booting background scan...');
      try {
        await runFullImageHealthCheck();
      } catch (err) {
        console.error('[BackgroundHealthCheck] Failed during background checking:', err);
      }
    }
  };

  // Run on startup
  runCheckIfTime();

  // Then check every 60 seconds
  backgroundInterval = setInterval(runCheckIfTime, 60000);
}
