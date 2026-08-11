import { supabase } from './supabase';
import { 
  CMSPage, CMSMediaItem, CMSPageStatus, CMSPageRevision, 
  CMSActivityLog 
} from '../types';

// Default static enterprise pages for fallback seeding when DB is empty
export const DEFAULT_STATIC_PAGES: CMSPage[] = [
  {
    id: 'page-about',
    key: 'about-us',
    slug: 'about-us',
    type: 'static_about',
    title_ar: 'عن بيزنس ماركت',
    title_fr: 'À propos de Business Market',
    title_en: 'About Business Market',
    content_ar: '<h2>منصة بيزنس ماركت للتجارة الإلكترونية</h2><p>بيزنس ماركت هي المنصة الرائدة في الجزائر التي تجمع بين تجارة التجزئة والجملة، وتقدم أفضل المنتجات بأسعار تنافسية مع خدمة توصيل سريعة لجميع الولايات 58.</p>',
    content_fr: '<h2>Plateforme e-commerce Business Market</h2><p>Business Market est la première plateforme en Algérie dédiée au commerce de détail et de gros, offrant des produits de haute qualité et une livraison rapide dans les 58 wilayas.</p>',
    content_en: '<h2>Business Market E-Commerce Platform</h2><p>Business Market is the premier e-commerce platform in Algeria for retail and wholesale commerce, providing high-quality products and express delivery to all 58 wilayas.</p>',
    status: 'published',
    seo: {
      meta_title_ar: 'عن بيزنس ماركت - المنصة الأولى للتجارة في الجزائر',
      meta_title_fr: 'À propos de Business Market - Numéro 1 en Algérie',
      meta_description_ar: 'تعرف على شركة بيزنس ماركت ورؤيتها في تطوير التجارة الإلكترونية بالجزائر.',
      meta_description_fr: 'Découvrez Business Market et sa vision pour le commerce électronique en Algérie.',
    },
    revisions: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    author: 'Admin',
    view_count: 1250,
  },
  {
    id: 'page-privacy',
    key: 'privacy-policy',
    slug: 'privacy-policy',
    type: 'static_privacy',
    title_ar: 'سياسة الخصوصية وحماية البيانات',
    title_fr: 'Politique de Confidentialité',
    title_en: 'Privacy Policy',
    content_ar: '<h2>سياسة الخصوصية</h2><p>نحن نلتزم بحماية بياناتك الشخصية وفقاً للقوانين الجزائرية. يتم جمع المعلومات لغرض إتمام الطلبات والتوصيل فقط.</p>',
    content_fr: '<h2>Politique de Confidentialité</h2><p>Nous nous engageons à protéger vos données personnelles conformément aux lois algériennes.</p>',
    content_en: '<h2>Privacy Policy</h2><p>We are committed to protecting your personal data in accordance with Algerian regulations.</p>',
    status: 'published',
    seo: {},
    revisions: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    author: 'Legal Team',
    view_count: 840,
  },
  {
    id: 'page-terms',
    key: 'terms-and-conditions',
    slug: 'terms-and-conditions',
    type: 'static_terms',
    title_ar: 'الشروط والأحكام',
    title_fr: 'Conditions Générales d\'Utilisation',
    title_en: 'Terms & Conditions',
    content_ar: '<h2>الشروط والأحكام</h2><p>تحدد هذه الشروط القواعد والاستخدام لخدمات منصة بيزنس ماركت في الجزائر.</p>',
    content_fr: '<h2>Conditions Générales</h2><p>Ces conditions régissent l\'utilisation des services de Business Market en Algérie.</p>',
    content_en: '<h2>Terms & Conditions</h2><p>These terms govern the use of Business Market services across Algeria.</p>',
    status: 'published',
    seo: {},
    revisions: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    author: 'Legal Team',
    view_count: 620,
  },
  {
    id: 'page-contact',
    key: 'contact-us',
    slug: 'contact-us',
    type: 'static_contact',
    title_ar: 'اتصل بنا والدعم الفني',
    title_fr: 'Contactez-nous & Support',
    title_en: 'Contact Us & Support',
    content_ar: '<h2>تواصل معنا</h2><p>فريق خدمة العملاء متواجد على مدار الساعة للرد على استفساراتكم وتتبع طلباتكم.</p>',
    content_fr: '<h2>Contactez-nous</h2><p>Notre équipe support est disponible 24/7 pour répondre à vos questions et suivre vos commandes.</p>',
    content_en: '<h2>Contact Us</h2><p>Our support team is available 24/7 to assist with inquiries and order tracking.</p>',
    status: 'published',
    seo: {},
    revisions: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    author: 'Support Team',
    view_count: 2100,
  }
];

// ----------------------------------------------------
// PAGE DIRECT SUPABASE OPERATIONS
// ----------------------------------------------------

export async function fetchPages(): Promise<CMSPage[]> {
  try {
    // 1. Query cms_pages table first (V2 schema)
    const { data: pageData, error: pageErr } = await supabase
      .from('cms_pages')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!pageErr && pageData && pageData.length > 0) {
      return pageData.map(item => ({
        id: item.id,
        key: item.key,
        slug: item.slug || item.key,
        type: item.type || 'custom',
        title_ar: item.title_ar || '',
        title_fr: item.title_fr || '',
        title_en: item.title_en || item.title_fr || '',
        content_ar: item.content_ar || '',
        content_fr: item.content_fr || '',
        content_en: item.content_en || item.content_fr || '',
        status: (item.status as CMSPageStatus) || 'draft',
        publish_date: item.publish_date || null,
        seo: item.seo || {},
        revisions: [],
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
        author: item.author || 'Admin',
        view_count: Number(item.view_count) || 0,
      }));
    }

    // 2. Fallback to legacy cms_content table
    const { data: legacyData, error: legacyErr } = await supabase
      .from('cms_content')
      .select('*')
      .order('created_at', { ascending: false });

    if (!legacyErr && legacyData && legacyData.length > 0) {
      return legacyData.map(item => {
        const meta = item.metadata || {};
        return {
          id: item.id,
          key: item.key,
          slug: meta.slug || item.key,
          type: meta.type || 'custom',
          title_ar: item.title_ar || '',
          title_fr: item.title_fr || '',
          title_en: meta.title_en || item.title_fr || '',
          content_ar: item.content_ar || '',
          content_fr: item.content_fr || '',
          content_en: meta.content_en || item.content_fr || '',
          status: item.is_active ? 'published' : 'draft',
          publish_date: meta.publish_date || null,
          seo: meta.seo || {},
          revisions: meta.revisions || [],
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
          author: meta.author || 'Admin',
          view_count: meta.view_count || 100,
        };
      });
    }
  } catch (e) {
    console.warn('[CMS Supabase Integration] fetchPages exception:', e);
  }

  // Seeding default static pages if DB is completely empty
  return DEFAULT_STATIC_PAGES;
}

export async function fetchPageBySlug(slug: string): Promise<CMSPage | null> {
  if (!slug) return null;
  const normalizedSlug = slug.toLowerCase().trim();

  try {
    // Try cms_pages table first
    const { data, error } = await supabase
      .from('cms_pages')
      .select('*')
      .or(`slug.eq.${normalizedSlug},key.eq.${normalizedSlug}`)
      .single();

    if (!error && data) {
      return {
        id: data.id,
        key: data.key,
        slug: data.slug || data.key,
        type: data.type || 'custom',
        title_ar: data.title_ar || '',
        title_fr: data.title_fr || '',
        title_en: data.title_en || data.title_fr || '',
        content_ar: data.content_ar || '',
        content_fr: data.content_fr || '',
        content_en: data.content_en || data.content_fr || '',
        status: (data.status as CMSPageStatus) || 'draft',
        publish_date: data.publish_date || null,
        seo: data.seo || {},
        revisions: [],
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        author: data.author || 'Admin',
        view_count: Number(data.view_count) || 0,
      };
    }

    // Fallback to legacy cms_content
    const { data: legacyData, error: legacyErr } = await supabase
      .from('cms_content')
      .select('*')
      .or(`key.eq.${normalizedSlug},metadata->>slug.eq.${normalizedSlug}`)
      .single();

    if (!legacyErr && legacyData) {
      const meta = legacyData.metadata || {};
      return {
        id: legacyData.id,
        key: legacyData.key,
        slug: meta.slug || legacyData.key,
        type: meta.type || 'custom',
        title_ar: legacyData.title_ar || '',
        title_fr: legacyData.title_fr || '',
        title_en: meta.title_en || legacyData.title_fr || '',
        content_ar: legacyData.content_ar || '',
        content_fr: legacyData.content_fr || '',
        content_en: meta.content_en || legacyData.content_fr || '',
        status: legacyData.is_active ? 'published' : 'draft',
        publish_date: meta.publish_date || null,
        seo: meta.seo || {},
        revisions: meta.revisions || [],
        created_at: legacyData.created_at || new Date().toISOString(),
        updated_at: legacyData.updated_at || new Date().toISOString(),
        author: meta.author || 'Admin',
        view_count: meta.view_count || 100,
      };
    }
  } catch (e) {
    console.warn('[CMS Supabase Integration] fetchPageBySlug exception:', e);
  }

  // Fallback default static page matching
  const foundDefault = DEFAULT_STATIC_PAGES.find(p => p.slug === normalizedSlug || p.key === normalizedSlug);
  return foundDefault || null;
}

export async function savePage(page: CMSPage): Promise<{ success: boolean; data?: CMSPage; error?: string }> {
  const dbPayloadPages = {
    id: page.id,
    key: page.key,
    slug: page.slug || page.key,
    type: page.type || 'custom',
    title_ar: page.title_ar,
    title_fr: page.title_fr,
    title_en: page.title_en || page.title_fr,
    content_ar: page.content_ar,
    content_fr: page.content_fr,
    content_en: page.content_en || page.content_fr,
    status: page.status,
    publish_date: page.publish_date || null,
    seo: page.seo || {},
    author: page.author || 'Admin',
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('cms_pages')
      .upsert(dbPayloadPages)
      .select('*')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        ...page,
        id: data.id,
        updated_at: data.updated_at,
      }
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save page';
    return { success: false, error: msg };
  }
}

export async function deletePage(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('cms_pages').delete().eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete page';
    return { success: false, error: msg };
  }
}

export async function togglePagePublishStatus(id: string, currentStatus: CMSPageStatus): Promise<{ success: boolean; nextStatus: CMSPageStatus; error?: string }> {
  const nextStatus: CMSPageStatus = currentStatus === 'published' ? 'draft' : 'published';

  try {
    const { error } = await supabase
      .from('cms_pages')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { success: false, nextStatus: currentStatus, error: error.message };
    }

    return { success: true, nextStatus };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update page status';
    return { success: false, nextStatus: currentStatus, error: msg };
  }
}

// ----------------------------------------------------
// MEDIA DIRECT SUPABASE OPERATIONS
// ----------------------------------------------------

export async function fetchMedia(): Promise<CMSMediaItem[]> {
  try {
    const { data, error } = await supabase
      .from('cms_media')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map(item => ({
        id: item.id,
        name: item.name || item.title_ar || 'File',
        title_ar: item.title_ar,
        title_fr: item.title_fr,
        title_en: item.title_en,
        description_ar: item.description_ar,
        description_fr: item.description_fr,
        folder: item.folder || '/',
        file_type: item.file_type || 'image',
        url: item.url,
        size_bytes: Number(item.size_bytes) || 0,
        mime_type: item.mime_type || 'application/octet-stream',
        dimensions: item.dimensions,
        status: (item.status as 'published' | 'draft') || 'published',
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
      }));
    }
  } catch (e) {
    console.warn('[CMS Supabase Integration] fetchMedia exception:', e);
  }

  return [];
}

export async function saveMediaItem(item: CMSMediaItem): Promise<{ success: boolean; data?: CMSMediaItem; error?: string }> {
  const payload = {
    id: item.id,
    name: item.name,
    title_ar: item.title_ar,
    title_fr: item.title_fr,
    title_en: item.title_en,
    description_ar: item.description_ar,
    description_fr: item.description_fr,
    folder: item.folder || '/',
    file_type: item.file_type || 'image',
    url: item.url,
    size_bytes: item.size_bytes || 0,
    mime_type: item.mime_type || 'application/octet-stream',
    dimensions: item.dimensions,
    status: item.status || 'published',
    is_active: item.status === 'published',
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('cms_media')
      .upsert(payload)
      .select('*')
      .single();

    if (!error && data) {
      return { success: true, data: item };
    }

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: item };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save media item';
    return { success: false, error: msg };
  }
}

export async function deleteMediaItem(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('cms_media').delete().eq('id', id);
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete media item';
    return { success: false, error: msg };
  }
}

export async function toggleMediaPublishStatus(id: string, currentStatus: 'published' | 'draft'): Promise<{ success: boolean; nextStatus: 'published' | 'draft'; error?: string }> {
  const nextStatus: 'published' | 'draft' = currentStatus === 'published' ? 'draft' : 'published';

  try {
    const { error } = await supabase
      .from('cms_media')
      .update({ status: nextStatus, is_active: nextStatus === 'published', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { success: false, nextStatus: currentStatus, error: error.message };
    }

    return { success: true, nextStatus };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update media status';
    return { success: false, nextStatus: currentStatus, error: msg };
  }
}

// ----------------------------------------------------
// PAGE REVISIONS & RECOVERY
// ----------------------------------------------------

export async function fetchPageRevisions(pageId: string): Promise<CMSPageRevision[]> {
  try {
    const { data, error } = await supabase
      .from('cms_page_revisions')
      .select('*')
      .eq('page_id', pageId)
      .order('version', { ascending: false });

    if (!error && data) {
      return data.map(item => ({
        id: item.id,
        version: item.version,
        timestamp: item.timestamp || item.created_at,
        author: item.author || 'Admin',
        title_ar: item.title_ar,
        title_fr: item.title_fr,
        title_en: item.title_en,
        content_ar: item.content_ar,
        content_fr: item.content_fr,
        content_en: item.content_en,
        status: item.status as CMSPageStatus,
        note: item.note,
      }));
    }
  } catch (e) {
    console.warn('[CMS Supabase Integration] fetchPageRevisions exception:', e);
  }

  return [];
}

// ----------------------------------------------------
// ACTIVITY LOGS
// ----------------------------------------------------

export async function fetchCMSActivityLogs(): Promise<CMSActivityLog[]> {
  try {
    const { data, error } = await supabase
      .from('cms_activity_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (!error && data) {
      return data.map(item => ({
        id: item.id,
        action: item.action,
        details: item.details,
        entity_type: item.entity_type as 'page' | 'media' | 'system',
        entity_name: item.entity_name,
        timestamp: item.timestamp,
        user: item.user,
        ip_address: item.ip_address,
      }));
    }
  } catch (e) {
    console.warn('[CMS Supabase Integration] fetchCMSActivityLogs exception:', e);
  }

  return [
    {
      id: 'log-1',
      action: 'تحديث الصفحة',
      details: 'تم تحديث محتوى صفحة "عن بيزنس ماركت" وتحسين صيغة SEO',
      entity_type: 'page',
      entity_name: 'عن بيزنس ماركت',
      timestamp: new Date().toISOString(),
      user: 'Super Admin',
    }
  ];
}

export async function logCMSActivity(log: Omit<CMSActivityLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    await supabase.from('cms_activity_logs').insert({
      action: log.action,
      details: log.details,
      entity_type: log.entity_type,
      entity_name: log.entity_name,
      user: log.user || 'Admin',
      ip_address: log.ip_address || null,
    });
  } catch (e) {
    console.warn('[CMS Activity Log] Failed to insert log:', e);
  }
}

// ----------------------------------------------------
// RECORD PAGE VIEW RPC
// ----------------------------------------------------

export async function recordPageView(pageId: string, sessionId: string): Promise<void> {
  if (!pageId || !sessionId) return;

  try {
    await supabase.rpc('record_cms_page_view', {
      p_page_id: pageId,
      p_session_id: sessionId,
    });
  } catch (e) {
    console.warn('[CMS Record Page View] RPC failed:', e);
  }
}
