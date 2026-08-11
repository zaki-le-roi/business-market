import { supabase } from './supabase';
import { pathFromUrl } from './storage';

export interface DeleteEntityOptions {
  /** Database table name, e.g. 'homepage_banners' */
  tableName: string;
  /** Single ID or array of IDs to delete */
  id: string | string[];
  /** Column name for primary key / lookup. Default is 'id' */
  idColumn?: string;
  /** Storage bucket and image/file URLs to clean up */
  storageFiles?: { bucket: string; urlOrPath: string | null | undefined }[];
  /** LocalStorage keys to clean up or filter out deleted IDs */
  localStorageKeys?: string[];
  /** Optional soft delete column name if soft delete is used */
  softDeleteColumn?: string;
  /** Event name to dispatch to window, e.g. 'banners_updated' */
  eventToDispatch?: string;
}

export interface DeleteResult {
  success: boolean;
  deletedIds: string[];
  error: string | null;
  supabaseError?: unknown;
}

/**
 * Enterprise-Grade Unified Delete Service
 * Handles database removal, storage cleanup, localStorage sync,
 * error detection (including Supabase RLS failures), and live event broadcasting.
 */
export async function deleteEntity(options: DeleteEntityOptions): Promise<DeleteResult> {
  const {
    tableName,
    id,
    idColumn = 'id',
    storageFiles = [],
    localStorageKeys = [],
    softDeleteColumn,
    eventToDispatch,
  } = options;

  const idsToDelete = Array.isArray(id) ? id : [id];
  const validIds = idsToDelete.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);

  if (validIds.length === 0) {
    return {
      success: false,
      deletedIds: [],
      error: 'No valid ID(s) provided for deletion.',
    };
  }

  let dbSuccess = true;
  let dbErrorMessage: string | null = null;

  // 1. Database Deletion (Permanent or Soft)
  try {
    if (softDeleteColumn) {
      const { error } = await supabase
        .from(tableName)
        .update({ [softDeleteColumn]: true, deleted_at: new Date().toISOString() })
        .in(idColumn, validIds);

      if (error) {
        dbSuccess = false;
        dbErrorMessage = `Supabase Soft Delete Warning (${error.code}): ${error.message}`;
        console.warn(`[DeleteService] Soft delete warning on ${tableName}:`, error.message || error);
      }
    } else {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .in(idColumn, validIds);

      if (error) {
        dbSuccess = false;
        dbErrorMessage = `Supabase Delete Warning (${error.code}): ${error.message}`;
        console.warn(`[DeleteService] Permanent delete warning on ${tableName}:`, error.message || error);
      }
    }
  } catch (err: unknown) {
    dbSuccess = false;
    dbErrorMessage = (err as Error).message || 'Database connection warning during deletion.';
    console.warn(`[DeleteService] Non-blocking exception deleting from ${tableName}:`, err);
  }

  // 2. Storage File Cleanup (Best effort, non-blocking if storage file missing)
  if (storageFiles.length > 0) {
    for (const fileObj of storageFiles) {
      if (!fileObj.urlOrPath) continue;
      try {
        const path = pathFromUrl(fileObj.bucket, fileObj.urlOrPath) || fileObj.urlOrPath;
        if (path && !path.startsWith('http')) {
          const { error: storageErr } = await supabase.storage.from(fileObj.bucket).remove([path]);
          if (storageErr) {
            console.warn(`[DeleteService] Storage file removal warning (${fileObj.bucket}):`, storageErr.message);
          }
        }
      } catch (e) {
        console.warn('[DeleteService] Storage cleanup exception:', e);
      }
    }
  }

  // 3. LocalStorage Cleanup
  if (localStorageKeys.length > 0) {
    for (const key of localStorageKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((item: Record<string, unknown> | null) => {
              if (item && typeof item === 'object') {
                const itemKey = (item[idColumn] || item.id) as string | undefined;
                return itemKey ? !validIds.includes(itemKey) : true;
              }
              return typeof item === 'string' ? !validIds.includes(item) : true;
            });
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        }
      } catch (e) {
        console.warn(`[DeleteService] Error updating localStorage key ${key}:`, e);
      }
    }
  }

  // 4. Dispatch Custom Event for Real-Time UI Sync
  if (eventToDispatch) {
    try {
      window.dispatchEvent(new CustomEvent(eventToDispatch, { detail: { deletedIds: validIds } }));
    } catch (e) {
      console.warn('[DeleteService] Event dispatch warning:', e);
    }
  }

  return {
    success: dbSuccess,
    deletedIds: validIds,
    error: dbErrorMessage,
  };
}
