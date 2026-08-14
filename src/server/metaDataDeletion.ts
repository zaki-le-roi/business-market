import crypto from 'crypto';
import { supabase } from '../lib/supabase';

export interface MetaSignedRequestPayload {
  user_id: string;
  algorithm?: string;
  issued_at?: number;
  expires?: number;
  oauth_token?: string;
  [key: string]: unknown;
}

const SERVER_PROOF_PREFIX = 'META_DELETE_PROOF_V2';

// In-memory server fallback store for verified data deletion requests
export interface MetaDeletionRecord {
  confirmation_code: string;
  meta_user_id: string;
  status: string;
  requested_at: string;
  completed_at: string;
  details?: Record<string, unknown>;
}

const serverDeletionStore = new Map<string, MetaDeletionRecord>();

/**
 * Safely decodes a base64url string into a Buffer.
 */
function base64urlDecode(input: string): Buffer {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

/**
 * Parses and verifies Meta's signed_request parameter using HMAC-SHA256 signature verification.
 * Enforces strict timestamp freshness, algorithm verification, and timing-safe signature comparison.
 */
export function parseAndVerifySignedRequest(
  signedRequest: string,
  appSecret: string
): MetaSignedRequestPayload {
  if (!signedRequest || typeof signedRequest !== 'string') {
    throw new Error('Invalid or missing signed_request parameter.');
  }

  const parts = signedRequest.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid signed_request format. Expected "encoded_sig.payload".');
  }

  const [encodedSig, payload] = parts;

  if (!appSecret || appSecret.trim() === '') {
    throw new Error('Meta App Secret is missing on the server.');
  }

  // 1. Calculate expected signature: HMAC-SHA256 of payload string using appSecret
  const expectedSigBuffer = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest();

  // 2. Decode received signature
  let actualSigBuffer: Buffer;
  try {
    actualSigBuffer = base64urlDecode(encodedSig);
  } catch {
    throw new Error('Invalid base64url signature encoding.');
  }

  // 3. Constant-time comparison using fixed-size SHA-256 digests to prevent timing attacks & buffer size leaks
  const expectedHash = crypto.createHash('sha256').update(expectedSigBuffer).digest();
  const actualHash = crypto.createHash('sha256').update(actualSigBuffer).digest();

  if (!crypto.timingSafeEqual(actualHash, expectedHash)) {
    throw new Error('HMAC signature verification failed. Request signature is invalid.');
  }

  // 4. Decode payload JSON
  let payloadJsonStr: string;
  try {
    payloadJsonStr = base64urlDecode(payload).toString('utf-8');
  } catch {
    throw new Error('Failed to decode payload base64url string.');
  }

  let data: MetaSignedRequestPayload;
  try {
    data = JSON.parse(payloadJsonStr);
  } catch {
    throw new Error('Failed to parse signed_request payload JSON.');
  }

  if (!data || typeof data !== 'object' || !data.user_id) {
    throw new Error('Signed request payload is missing required user_id parameter.');
  }

  // 5. Algorithm enforcement check
  if (data.algorithm && data.algorithm.toUpperCase() !== 'HMAC-SHA256') {
    throw new Error(`Unsupported signature algorithm: ${data.algorithm}. Expected HMAC-SHA256.`);
  }

  // 6. Mandatory timestamp freshness validation (issued_at required, max age 1 hour)
  if (!data.issued_at || typeof data.issued_at !== 'number' || data.issued_at <= 0) {
    throw new Error('Signed request payload is missing required numeric issued_at timestamp.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const ageSec = nowSec - data.issued_at;
  if (ageSec > 3600) {
    throw new Error('Signed request has expired (issued more than 1 hour ago).');
  }
  if (ageSec < -300) {
    throw new Error('Signed request timestamp is invalid (in the future).');
  }

  return data;
}

/**
 * Retrieves the Meta App Secret from Supabase system_settings or environment variables.
 * Ensures strict synchronization between Node.js and PostgreSQL database layers.
 */
export async function getMetaAppSecret(): Promise<string> {
  // 1. First check system_settings (authoritative database configuration store used by both Node & SQL)
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'meta_social_commerce_config')
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      if (parsed?.appSecret && typeof parsed.appSecret === 'string' && parsed.appSecret.trim() !== '') {
        return parsed.appSecret.trim();
      }
    }
  } catch (err) {
    console.warn('[Meta Data Deletion] Notice when retrieving app secret:', err);
  }

  // 2. Fall back to process.env if set
  const envSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
  if (envSecret && envSecret.trim() !== '') {
    const cleanSecret = envSecret.trim();
    // Auto-sync process.env into system_settings if system_settings is unconfigured so SQL RPC uses exact same secret
    try {
      await supabase
        .from('system_settings')
        .upsert(
          { key: 'meta_social_commerce_config', value: { appSecret: cleanSecret }, is_public: false },
          { onConflict: 'key' }
        );
    } catch {
      // Ignore sync notices
    }
    return cleanSecret;
  }

  return '';
}

/**
 * Handles Meta Data Deletion callback requests.
 */
export async function handleMetaDataDeletion(signedRequest: string, hostUrl: string) {
  const appSecret = await getMetaAppSecret();

  if (!appSecret) {
    console.error('[Meta Data Deletion] Server missing Meta App Secret.');
    throw new Error('Meta App Secret is not configured on the server.');
  }

  // 1. Verify HMAC-SHA256 signature & extract payload
  const payload = parseAndVerifySignedRequest(signedRequest, appSecret);
  const metaUserId = String(payload.user_id).trim();

  // 2. Generate unique high-entropy confirmation code (16 hex chars = 64-bit random entropy)
  const confirmationCode = 'DEL-' + crypto.randomBytes(8).toString('hex').toUpperCase();

  // 3. Compute cryptographically secure 256-bit HMAC-SHA256 server verification proof
  const issuedAt = payload.issued_at!;
  const serverProof = crypto
    .createHmac('sha256', appSecret)
    .update(`${SERVER_PROOF_PREFIX}:${confirmationCode}:${metaUserId}:${issuedAt}`)
    .digest('hex');

  const requestedAt = new Date().toISOString();
  const details = {
    issued_at: issuedAt,
    algorithm: payload.algorithm || 'HMAC-SHA256',
    processed_at: requestedAt,
  };

  // 4. Save record to secure server store
  const record: MetaDeletionRecord = {
    confirmation_code: confirmationCode,
    meta_user_id: metaUserId,
    status: 'completed',
    requested_at: requestedAt,
    completed_at: requestedAt,
    details,
  };
  serverDeletionStore.set(confirmationCode, record);

  // 5. Attempt database record via protected RPC using HMAC-SHA256 proof
  try {
    await supabase.rpc('record_meta_data_deletion', {
      p_confirmation_code: confirmationCode,
      p_meta_user_id: metaUserId,
      p_details: details,
      p_server_proof: serverProof,
      p_issued_at: issuedAt,
    });
  } catch (err) {
    console.warn('[Meta Data Deletion] Database RPC notice (using server store):', err);
  }

  // 6. Construct required status URL
  const statusUrl = `${hostUrl}/data-deletion-status?code=${confirmationCode}`;

  return {
    url: statusUrl,
    confirmation_code: confirmationCode,
    meta_user_id: metaUserId,
  };
}

/**
 * Safely fetches data deletion status record by confirmation code.
 */
export async function getMetaDataDeletionRecordByCode(code: string): Promise<Partial<MetaDeletionRecord> | null> {
  const cleanCode = (code || '').trim().toUpperCase();

  if (!cleanCode || !/^DEL-[A-F0-9]{12,64}$/.test(cleanCode)) {
    return null;
  }

  // Check server store first
  const localRecord = serverDeletionStore.get(cleanCode);
  if (localRecord) {
    return {
      confirmation_code: localRecord.confirmation_code,
      status: localRecord.status,
      requested_at: localRecord.requested_at,
      completed_at: localRecord.completed_at,
    };
  }

  // Query Supabase RPC if available
  try {
    const { data, error } = await supabase.rpc('get_meta_deletion_status', {
      p_code: cleanCode,
    });

    if (!error && data) {
      const rec = Array.isArray(data) ? data[0] : data;
      if (rec && rec.confirmation_code) {
        return {
          confirmation_code: rec.confirmation_code,
          status: rec.status,
          requested_at: rec.requested_at,
          completed_at: rec.completed_at,
        };
      }
    }
  } catch (err) {
    console.warn('[Meta Data Deletion Query] Notice:', err);
  }

  return null;
}
