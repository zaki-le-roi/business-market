export type CMSPageStatus = 'published' | 'draft' | 'scheduled';
export type CMSPageType = 
  | 'static_about' 
  | 'static_contact' 
  | 'static_privacy' 
  | 'static_terms' 
  | 'static_returns' 
  | 'static_shipping' 
  | 'static_faq' 
  | 'custom';

export interface CMSPageRevision {
  id: string;
  version: number;
  timestamp: string;
  author: string;
  title_ar: string;
  title_fr: string;
  title_en: string;
  content_ar: string;
  content_fr: string;
  content_en: string;
  status: CMSPageStatus;
  note?: string;
}

export interface CMSPageSEO {
  meta_title_ar?: string;
  meta_title_fr?: string;
  meta_title_en?: string;
  meta_description_ar?: string;
  meta_description_fr?: string;
  meta_description_en?: string;
  keywords?: string[];
  og_title?: string;
  og_description?: string;
  og_image?: string;
  twitter_card_type?: 'summary' | 'summary_large_image';
  twitter_title?: string;
  twitter_image?: string;
}

export interface CMSPage {
  id: string;
  key: string;
  slug: string;
  type: CMSPageType;
  title_ar: string;
  title_fr: string;
  title_en: string;
  content_ar: string;
  content_fr: string;
  content_en: string;
  status: CMSPageStatus;
  publish_date?: string | null;
  seo: CMSPageSEO;
  revisions: CMSPageRevision[];
  created_at: string;
  updated_at: string;
  author?: string;
  view_count?: number;
}

export interface CMSMediaItem {
  id: string;
  name: string;
  title_ar?: string;
  title_fr?: string;
  title_en?: string;
  description_ar?: string;
  description_fr?: string;
  folder: string;
  file_type: 'image' | 'pdf' | 'video' | 'document';
  url: string;
  size_bytes: number;
  mime_type: string;
  dimensions?: string;
  status?: 'published' | 'draft';
  created_at: string;
  updated_at?: string;
}

export interface CMSFolder {
  id: string;
  name: string;
  path: string;
  item_count?: number;
}

export interface CMSActivityLog {
  id: string;
  action: string;
  details: string;
  entity_type: 'page' | 'media' | 'system';
  entity_name: string;
  timestamp: string;
  user: string;
  ip_address?: string;
}
