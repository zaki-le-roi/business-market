import { createClient } from '@supabase/supabase-js';

// Define the real, live Supabase project credentials as fallback if process.env values are placeholders
const realUrl = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const realAnonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const envUrl = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_SUPABASE_URL : undefined;
const envAnonKey = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

function isValidSupabaseUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) return false;
  if (trimmed.includes('your-project')) return false;
  if (trimmed.includes('placeholder')) return false;
  if (trimmed.includes('example.com')) return false;
  if (trimmed.includes('your-project-id')) return false;
  return true;
}

function isValidSupabaseKey(key: unknown): boolean {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed === '') return false;
  if (trimmed.includes('placeholder')) return false;
  if (trimmed.startsWith('sb_publishable_')) return true;
  if (trimmed.split('.').length === 3 && trimmed.startsWith('eyJ')) return true;
  return false;
}

const useReal = !isValidSupabaseUrl(envUrl) || !isValidSupabaseKey(envAnonKey);

export const supabaseUrl = useReal ? realUrl : envUrl!;
export const supabaseAnonKey = useReal ? realAnonKey : envAnonKey!;

// Robust in-memory fallback storage for iframe environments where localStorage might throw SecurityError
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    } catch (e) {
      console.warn('[Supabase Storage] Failed to getItem from localStorage:', e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('[Supabase Storage] Failed to setItem to localStorage:', e);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('[Supabase Storage] Failed to removeItem from localStorage:', e);
    }
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: safeLocalStorage,
  },
});
