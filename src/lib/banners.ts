import { supabase } from './supabase';
import { HomepageBanner } from '../types';
import { removeImage, pathFromUrl } from './storage';

const LOCAL_STORAGE_BANNERS_KEY = 'store_banners_v1';

export const INITIAL_BANNERS: HomepageBanner[] = [];

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getLocalItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('[banners] LocalStorage read error:', e);
    return null;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[banners] LocalStorage write error:', e);
  }
}

/**
 * Check whether a banner is active based on manual toggle AND start/end scheduling
 */
export function isBannerCurrentlyActive(banner: HomepageBanner): boolean {
  if (!banner.active) return false;
  const now = new Date().getTime();

  if (banner.start_date) {
    const start = new Date(banner.start_date).getTime();
    if (!isNaN(start) && now < start) return false;
  }

  if (banner.end_date) {
    const end = new Date(banner.end_date).getTime();
    if (!isNaN(end) && now > end) return false;
  }

  return true;
}

/**
 * Fetch Banners from Supabase (Source of Truth)
 */
export async function getBanners(): Promise<HomepageBanner[]> {
  try {
    const { data, error } = await supabase
      .from('homepage_banners')
      .select('*')
      .order('display_order', { ascending: true });

    if (!error && data !== null) {
      const dbBanners = data as HomepageBanner[];
      setLocalItem(LOCAL_STORAGE_BANNERS_KEY, dbBanners);
      return dbBanners;
    }

    if (error) {
      console.warn('[banners] Supabase fetch warning:', error.message);
    }
  } catch (e) {
    console.warn('[banners] Supabase fetch exception:', e);
  }

  // Fallback to local cache only if network/fetch exception occurred
  const localBanners = getLocalItem<HomepageBanner[]>(LOCAL_STORAGE_BANNERS_KEY);
  if (localBanners && Array.isArray(localBanners)) {
    return localBanners.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }

  return INITIAL_BANNERS;
}

/**
 * Save or Update a banner in Supabase
 */
export async function saveBanner(bannerPayload: Partial<HomepageBanner>): Promise<HomepageBanner> {
  const now = new Date().toISOString();

  const isEditing = !!bannerPayload.id;
  const bannerId = isEditing && isValidUUID(bannerPayload.id!) ? bannerPayload.id! : generateUUID();

  const currentBanners = await getBanners();
  const existing = currentBanners.find(b => b.id === bannerPayload.id || b.id === bannerId);

  const fullBanner: HomepageBanner = {
    id: bannerId,
    title: bannerPayload.title || bannerPayload.title_ar || bannerPayload.title_fr || bannerPayload.title_en || 'Banner',
    title_ar: bannerPayload.title_ar || bannerPayload.title || null,
    title_fr: bannerPayload.title_fr || bannerPayload.title || null,
    title_en: bannerPayload.title_en || null,
    subtitle: bannerPayload.subtitle || bannerPayload.subtitle_ar || bannerPayload.subtitle_fr || bannerPayload.subtitle_en || null,
    subtitle_ar: bannerPayload.subtitle_ar || null,
    subtitle_fr: bannerPayload.subtitle_fr || null,
    subtitle_en: bannerPayload.subtitle_en || null,
    description_ar: bannerPayload.description_ar || null,
    description_fr: bannerPayload.description_fr || null,
    description_en: bannerPayload.description_en || null,
    banner_type: bannerPayload.banner_type || 'hero',
    target_page: bannerPayload.target_page || 'homepage',
    image_url: bannerPayload.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=80',
    mobile_image_url: bannerPayload.mobile_image_url || null,
    button_text: bannerPayload.button_text || bannerPayload.button_text_ar || bannerPayload.button_text_fr || bannerPayload.button_text_en || null,
    button_text_ar: bannerPayload.button_text_ar || null,
    button_text_fr: bannerPayload.button_text_fr || null,
    button_text_en: bannerPayload.button_text_en || null,
    button_link: bannerPayload.button_link || null,
    button_color: bannerPayload.button_color || '#4f46e5',
    text_color: bannerPayload.text_color || '#ffffff',
    text_alignment: bannerPayload.text_alignment || 'center',
    display_order: bannerPayload.display_order ?? (existing ? existing.display_order : currentBanners.length + 1),
    active: bannerPayload.active ?? true,
    desktop_visibility: bannerPayload.desktop_visibility ?? true,
    mobile_visibility: bannerPayload.mobile_visibility ?? true,
    start_date: bannerPayload.start_date || null,
    end_date: bannerPayload.end_date || null,
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  // 1. Sync Supabase
  const { data, error } = await supabase
    .from('homepage_banners')
    .upsert({
      id: fullBanner.id,
      title: fullBanner.title,
      title_ar: fullBanner.title_ar,
      title_fr: fullBanner.title_fr,
      title_en: fullBanner.title_en,
      subtitle: fullBanner.subtitle,
      subtitle_ar: fullBanner.subtitle_ar,
      subtitle_fr: fullBanner.subtitle_fr,
      subtitle_en: fullBanner.subtitle_en,
      description_ar: fullBanner.description_ar,
      description_fr: fullBanner.description_fr,
      description_en: fullBanner.description_en,
      banner_type: fullBanner.banner_type,
      target_page: fullBanner.target_page,
      image_url: fullBanner.image_url,
      mobile_image_url: fullBanner.mobile_image_url,
      button_text: fullBanner.button_text,
      button_text_ar: fullBanner.button_text_ar,
      button_text_fr: fullBanner.button_text_fr,
      button_text_en: fullBanner.button_text_en,
      button_link: fullBanner.button_link,
      button_color: fullBanner.button_color,
      text_color: fullBanner.text_color,
      text_alignment: fullBanner.text_alignment,
      display_order: fullBanner.display_order,
      active: fullBanner.active,
      desktop_visibility: fullBanner.desktop_visibility,
      mobile_visibility: fullBanner.mobile_visibility,
      start_date: fullBanner.start_date,
      end_date: fullBanner.end_date,
      created_at: fullBanner.created_at,
      updated_at: fullBanner.updated_at,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[banners] Supabase banner upsert error:', error.message);
    throw new Error(`Failed to save banner to database: ${error.message}`);
  }

  const savedBanner = (data as HomepageBanner) || fullBanner;

  // 2. Sync LocalStorage cache
  const updatedList = existing
    ? currentBanners.map(b => b.id === savedBanner.id ? savedBanner : b)
    : [...currentBanners, savedBanner];
  updatedList.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  setLocalItem(LOCAL_STORAGE_BANNERS_KEY, updatedList);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('banners_updated'));
  }

  return savedBanner;
}

/**
 * Delete a banner
 */
export async function deleteBanner(id: string): Promise<HomepageBanner[]> {
  const currentBanners = await getBanners();
  const target = currentBanners.find(b => b.id === id);

  if (isValidUUID(id)) {
    const { error } = await supabase.from('homepage_banners').delete().eq('id', id);
    if (error) {
      console.warn('[banners] Delete error from Supabase:', error.message);
    }
  }

  if (target) {
    if (target.image_url) {
      const p = pathFromUrl('cms-images', target.image_url);
      if (p) await removeImage('cms-images', p);
    }
    if (target.mobile_image_url) {
      const p = pathFromUrl('cms-images', target.mobile_image_url);
      if (p) await removeImage('cms-images', p);
    }
  }

  const updatedList = await getBanners();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('banners_updated'));
  }

  return updatedList;
}

/**
 * Duplicate a banner
 */
export async function duplicateBanner(id: string): Promise<{ newBanner: HomepageBanner, allBanners: HomepageBanner[] }> {
  const currentBanners = await getBanners();
  const target = currentBanners.find(b => b.id === id);
  if (!target) throw new Error('Banner not found');

  const newId = generateUUID();
  const copyBanner: HomepageBanner = {
    ...target,
    id: newId,
    title: `${target.title || 'Banner'} (نسخة مكررة)`,
    title_ar: target.title_ar ? `${target.title_ar} (نسخة مكررة)` : null,
    title_fr: target.title_fr ? `${target.title_fr} (Copie)` : null,
    display_order: currentBanners.length + 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const saved = await saveBanner(copyBanner);
  const refreshedList = await getBanners();

  return { newBanner: saved, allBanners: refreshedList };
}

/**
 * Reorder Banners
 */
export async function updateBannersOrder(reorderedBanners: HomepageBanner[]): Promise<HomepageBanner[]> {
  const updated = reorderedBanners.map((b, idx) => ({
    ...b,
    display_order: idx + 1,
    updated_at: new Date().toISOString(),
  }));

  for (const b of updated) {
    if (isValidUUID(b.id)) {
      await supabase
        .from('homepage_banners')
        .update({ display_order: b.display_order, updated_at: b.updated_at })
        .eq('id', b.id);
    }
  }

  const refreshedList = await getBanners();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('banners_updated'));
  }

  return refreshedList;
}

/**
 * Bulk Actions
 */
export async function bulkUpdateBannersStatus(ids: string[], active: boolean): Promise<HomepageBanner[]> {
  const validUuidIds = ids.filter(isValidUUID);
  if (validUuidIds.length > 0) {
    const { error } = await supabase
      .from('homepage_banners')
      .update({ active, updated_at: new Date().toISOString() })
      .in('id', validUuidIds);

    if (error) {
      console.warn('[banners] Supabase bulk update status warning:', error.message);
    }
  }

  const refreshedList = await getBanners();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('banners_updated'));
  }

  return refreshedList;
}

export async function bulkDeleteBanners(ids: string[]): Promise<HomepageBanner[]> {
  const currentBanners = await getBanners();
  const targets = currentBanners.filter(b => ids.includes(b.id));

  const validUuidIds = ids.filter(isValidUUID);

  if (validUuidIds.length > 0) {
    const { error } = await supabase
      .from('homepage_banners')
      .delete()
      .in('id', validUuidIds);

    if (error) {
      console.warn('[banners] Bulk delete warning:', error.message);
    }
  }

  for (const b of targets) {
    if (b.image_url) {
      const p = pathFromUrl('cms-images', b.image_url);
      if (p) await removeImage('cms-images', p);
    }
    if (b.mobile_image_url) {
      const p = pathFromUrl('cms-images', b.mobile_image_url);
      if (p) await removeImage('cms-images', p);
    }
  }

  const refreshedList = await getBanners();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('banners_updated'));
  }

  return refreshedList;
}


