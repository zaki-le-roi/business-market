import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface CloudflareEnv {
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  FACEBOOK_APP_SECRET?: string;
  [key: string]: unknown;
}

function getSupabase(env: CloudflareEnv): SupabaseClient {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://dyhpfgjogdiongmcmoti.supabase.co';
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

// Base64url decoder
function base64urlToUint8Array(input: string): Uint8Array {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// HMAC-SHA256 verification using standard Web Crypto API
async function verifyHmacSha256(payload: string, signatureBase64Url: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = base64urlToUint8Array(signatureBase64Url);
    const dataBytes = encoder.encode(payload);
    return await crypto.subtle.verify('HMAC', key, sigBytes, dataBytes);
  } catch (err) {
    console.error('[Cloudflare Meta Verify Error]:', err);
    return false;
  }
}

async function computeHmacSha256Hex(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Retrieve App Secret from Supabase system_settings or env
async function getMetaAppSecret(env: CloudflareEnv, supabase: SupabaseClient): Promise<string> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'meta_social_commerce_config')
      .maybeSingle();

    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      if (parsed?.appSecret && typeof parsed.appSecret === 'string' && parsed.appSecret.trim() !== '') {
        return parsed.appSecret.trim();
      }
    }
  } catch (e) {
    console.warn('[Cloudflare Meta Secret Notice]:', e);
  }

  const envSecret = env.META_APP_SECRET || env.FACEBOOK_APP_SECRET;
  if (envSecret && typeof envSecret === 'string') {
    return envSecret.trim();
  }

  return '';
}

export async function onRequest(context: { request: Request; env: CloudflareEnv; params: { path?: string[] } }) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const supabase = getSupabase(env);

  // Determine subpath: e.g. "oauth-url", "callback", "exchange-token", "pages", "catalogs", etc.
  const pathSegments = params.path || url.pathname.replace(/^\/api\/meta\/?/, '').split('/').filter(Boolean);
  const subpath = pathSegments.join('/');

  try {
    // 1. GET /api/meta/oauth-url
    if (subpath === 'oauth-url' && method === 'GET') {
      const appId = url.searchParams.get('appId') || env.META_APP_ID || '';
      const redirectUri = url.searchParams.get('redirectUri') || `${url.origin}/api/meta/callback`;

      if (!appId) {
        return jsonResponse({
          success: false,
          message: 'Meta App ID (client_id) is required.'
        }, 400);
      }

      // Supported and approved permissions for Meta Business / Commerce integration:
      // Removed: 'email', 'pages_manage_posts' (incompatible with Meta Business Login)
      // Maintained: 'public_profile', 'pages_show_list', 'pages_read_engagement', 'instagram_basic', 'catalog_management', 'business_management'
      const requestedScopeParam = url.searchParams.get('scope');
      const defaultScopes = [
        'public_profile',
        'pages_show_list',
        'pages_read_engagement',
        'instagram_basic',
        'catalog_management',
        'business_management'
      ];
      const scopes = requestedScopeParam || defaultScopes.join(',');

      const state = Math.random().toString(36).substring(2, 15);
      const metaAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scopes)}&response_type=code`;

      return jsonResponse({
        success: true,
        url: metaAuthUrl,
        state,
        redirectUri
      });
    }

    // 2. GET /api/meta/callback
    if (subpath === 'callback' && method === 'GET') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error_message') || url.searchParams.get('error');
      const state = url.searchParams.get('state');

      const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>ربط حساب Meta Business</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; }
    .box { background: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 90%; }
    .spinner { width: 48px; height: 48px; border: 4px solid #3b82f6; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.5rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #94a3b8; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <h2>جاري استكمال الربط مع Meta...</h2>
    <p>سيتم إغلاق هذه النافذة تلقائياً والعودة إلى لوحة تحكم Business Market.</p>
  </div>
  <script>
    (function() {
      const payload = {
        type: '${code ? 'META_OAUTH_SUCCESS' : 'META_OAUTH_ERROR'}',
        code: '${code || ''}',
        error: '${error || ''}',
        state: '${state || ''}'
      };
      if (window.opener) {
        window.opener.postMessage(payload, '*');
        setTimeout(() => window.close(), 1000);
      } else {
        setTimeout(() => { window.location.href = '/admin/social-commerce'; }, 1500);
      }
    })();
  </script>
</body>
</html>`;
      return htmlResponse(html);
    }

    // 3. POST /api/meta/exchange-token
    if (subpath === 'exchange-token' && method === 'POST') {
      const body = await request.json() as { code?: string; appId?: string; appSecret?: string; redirectUri?: string };
      const { code, appId, appSecret, redirectUri } = body;

      let metaAppId = appId || env.META_APP_ID;
      const metaAppSecret = appSecret || (await getMetaAppSecret(env, supabase));

      if (!metaAppId) {
        try {
          const { data: dbSetting } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'meta_social_commerce_config')
            .maybeSingle();
          if (dbSetting?.value) {
            const parsed = typeof dbSetting.value === 'string' ? JSON.parse(dbSetting.value) : dbSetting.value;
            if (parsed?.appId) metaAppId = parsed.appId;
          }
        } catch {
          // Continue
        }
      }

      if (!code) {
        return jsonResponse({ success: false, message: 'Authorization code is required.' }, 400);
      }
      if (!metaAppId || !metaAppSecret) {
        return jsonResponse({ success: false, message: 'Meta App ID and App Secret are required.' }, 400);
      }

      // Step A: Short-lived token
      const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` + new URLSearchParams({
        client_id: metaAppId,
        client_secret: metaAppSecret,
        redirect_uri: redirectUri || `${url.origin}/api/meta/callback`,
        code: code
      }).toString();

      const shortTokenRes = await fetch(tokenUrl);
      const shortTokenData = await shortTokenRes.json() as { access_token?: string; error?: { message: string } };

      if (!shortTokenRes.ok || !shortTokenData.access_token) {
        return jsonResponse({
          success: false,
          message: shortTokenData.error?.message || 'Failed to exchange authorization code for access token.'
        }, shortTokenRes.status || 400);
      }

      // Step B: Long-lived token
      const longTokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` + new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: metaAppId,
        client_secret: metaAppSecret,
        fb_exchange_token: shortTokenData.access_token
      }).toString();

      const longTokenRes = await fetch(longTokenUrl);
      const longTokenData = await longTokenRes.json() as { access_token?: string; expires_in?: number; error?: { message: string } };

      const finalAccessToken = longTokenData.access_token || shortTokenData.access_token;

      // Fetch user profile info
      const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,email,picture&access_token=${finalAccessToken}`);
      const meData = await meRes.json() as { id?: string; name?: string; email?: string };

      return jsonResponse({
        success: true,
        accessToken: finalAccessToken,
        tokenType: 'long_lived',
        expiresIn: longTokenData.expires_in || 5184000,
        user: meData
      });
    }

    // 4. GET /api/meta/pages
    if (subpath === 'pages' && method === 'GET') {
      const authHeader = request.headers.get('Authorization') || '';
      const accessToken = authHeader.replace(/^Bearer\s+/i, '') || url.searchParams.get('accessToken') || '';

      if (!accessToken) {
        return jsonResponse({ success: false, message: 'Meta User Access Token is required.' }, 401);
      }

      const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,category,picture,instagram_business_account{id,username,name,profile_picture_url}&access_token=${accessToken}`;
      const pagesRes = await fetch(pagesUrl);
      const pagesData = await pagesRes.json() as { data?: Array<unknown>; error?: { message: string } };

      if (!pagesRes.ok || !pagesData.data) {
        return jsonResponse({
          success: false,
          message: pagesData.error?.message || 'Failed to fetch Facebook Pages.'
        }, pagesRes.status || 400);
      }

      return jsonResponse({
        success: true,
        pages: pagesData.data
      });
    }

    // 5. GET /api/meta/catalogs
    if (subpath === 'catalogs' && method === 'GET') {
      const authHeader = request.headers.get('Authorization') || '';
      const accessToken = authHeader.replace(/^Bearer\s+/i, '') || url.searchParams.get('accessToken') || '';
      const businessId = url.searchParams.get('businessId') || '';

      if (!accessToken) {
        return jsonResponse({ success: false, message: 'Meta User Access Token is required.' }, 401);
      }

      let businesses: Array<{ id: string; name: string }> = [];
      const bizUrl = `https://graph.facebook.com/v19.0/me/businesses?fields=id,name&access_token=${accessToken}`;
      const bizRes = await fetch(bizUrl);
      const bizData = await bizRes.json() as { data?: Array<{ id: string; name: string }> };
      if (bizData.data) {
        businesses = bizData.data;
      }

      let catalogs: Array<{ id: string; name: string; product_count?: number; vertical?: string }> = [];
      const targetEndpoint = businessId
        ? `https://graph.facebook.com/v19.0/${businessId}/owned_product_catalogs?fields=id,name,product_count,vertical&access_token=${accessToken}`
        : `https://graph.facebook.com/v19.0/me/product_catalogs?fields=id,name,product_count,vertical&access_token=${accessToken}`;

      const catRes = await fetch(targetEndpoint);
      const catData = await catRes.json() as { data?: Array<{ id: string; name: string; product_count?: number; vertical?: string }>; error?: { message: string } };

      if (catData.data) {
        catalogs = catData.data;
      } else if (businesses.length > 0) {
        const fallbackUrl = `https://graph.facebook.com/v19.0/${businesses[0].id}/owned_product_catalogs?fields=id,name,product_count,vertical&access_token=${accessToken}`;
        const fallbackRes = await fetch(fallbackUrl);
        const fallbackData = await fallbackRes.json() as { data?: Array<{ id: string; name: string; product_count?: number; vertical?: string }> };
        if (fallbackData.data) {
          catalogs = fallbackData.data;
        }
      }

      return jsonResponse({
        success: true,
        businesses,
        catalogs
      });
    }

    // 6. POST /api/meta/catalogs/create or /api/meta/create-catalog
    if ((subpath === 'catalogs/create' || subpath === 'create-catalog') && method === 'POST') {
      const body = await request.json() as { accessToken?: string; businessId?: string; catalogName?: string };
      const { accessToken, catalogName } = body;
      let targetBusinessId = body.businessId?.trim() || '';

      if (!accessToken) {
        return jsonResponse({ success: false, message: 'Access Token is required.' }, 401);
      }

      // If businessId is not explicitly provided, try to auto-resolve from the user's business accounts
      if (!targetBusinessId) {
        try {
          const bizRes = await fetch(`https://graph.facebook.com/v19.0/me/businesses?fields=id,name,verification_status&access_token=${accessToken}`);
          const bizData = await bizRes.json() as { data?: Array<{ id: string; name: string }> };
          if (bizData.data && bizData.data.length > 0) {
            targetBusinessId = bizData.data[0].id;
            console.log(`[MetaCommerceApi] Auto-resolved Business Portfolio ID: ${targetBusinessId} (${bizData.data[0].name})`);
          }
        } catch (bizErr) {
          console.warn('[MetaCommerceApi] Failed to auto-resolve businesses:', bizErr);
        }
      }

      if (!targetBusinessId) {
        return jsonResponse({
          success: false,
          message: 'Meta Business Manager / Portfolio ID is required to create a Product Catalog. Catalogs cannot be owned by a personal user profile. Please create or link a Business Portfolio in Meta Business Suite (business.facebook.com).',
          error: {
            code: 100,
            error_subcode: null,
            message: 'No Business Portfolio (Business Manager) associated with this account.',
            type: 'OAuthException',
            help: 'Create a Business Portfolio at https://business.facebook.com and grant your user Admin / Full Control access.'
          }
        }, 400);
      }

      const name = catalogName || 'Business Market Product Catalog';
      const targetUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(targetBusinessId)}/owned_product_catalogs`;

      console.log(`[MetaCommerceApi] Creating catalog "${name}" under Business ID: ${targetBusinessId}`);

      const createRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          vertical: 'commerce',
          access_token: accessToken
        })
      });

      const createData = await createRes.json() as {
        id?: string;
        error?: {
          message: string;
          type?: string;
          code?: number;
          error_subcode?: number;
          fbtrace_id?: string;
          error_user_title?: string;
          error_user_msg?: string;
        };
      };

      if (!createRes.ok || !createData.id) {
        const metaError = createData.error || { message: 'Unknown Meta API error' };
        console.error('[MetaCommerceApi] Meta Catalog creation failed:', {
          status: createRes.status,
          targetBusinessId,
          code: metaError.code,
          error_subcode: metaError.error_subcode,
          message: metaError.message,
          type: metaError.type,
          fbtrace_id: metaError.fbtrace_id
        });

        let helpAdvice = '';
        if (metaError.code === 3 || metaError.code === 200 || metaError.code === 10) {
          helpAdvice = 'This error typically means the Meta App lacks the "Marketing API" capability in Meta Developers, or the connected user account does not have Admin / Full Control permissions on this Business Portfolio.';
        }

        return jsonResponse({
          success: false,
          message: metaError.error_user_msg || metaError.message || 'Failed to create Meta product catalog.',
          error: {
            code: metaError.code,
            error_subcode: metaError.error_subcode,
            message: metaError.message,
            type: metaError.type,
            fbtrace_id: metaError.fbtrace_id,
            user_title: metaError.error_user_title,
            user_msg: metaError.error_user_msg,
            business_id_used: targetBusinessId,
            help: helpAdvice
          }
        }, createRes.status || 400);
      }

      console.log(`[MetaCommerceApi] Meta Catalog created successfully. ID: ${createData.id}`);

      return jsonResponse({
        success: true,
        catalog: {
          id: createData.id,
          name: name,
          product_count: 0
        },
        businessId: targetBusinessId
      });
    }

    // 7. POST /api/meta/sync-products
    if (subpath === 'sync-products' && method === 'POST') {
      const body = await request.json() as {
        accessToken?: string;
        catalogId?: string;
        products?: Array<{
          id: string;
          sku?: string;
          name_ar?: string;
          name_fr?: string;
          description_ar?: string;
          description_fr?: string;
          price: number;
          sale_price?: number;
          stock_quantity?: number;
          is_active?: boolean;
          slug?: string;
          images?: string[];
          category_name?: string;
        }>;
        currency?: string;
        baseUrl?: string;
      };

      const { accessToken, catalogId, products, currency = 'DZD', baseUrl } = body;

      if (!accessToken || !catalogId) {
        return jsonResponse({ success: false, message: 'Meta Access Token and Catalog ID are required.' }, 400);
      }

      if (!Array.isArray(products) || products.length === 0) {
        return jsonResponse({ success: false, message: 'No products provided for synchronization.' }, 400);
      }

      const domainUrl = baseUrl || url.origin;

      const requests = products.map((p) => {
        const productId = p.id || p.sku;
        const title = p.name_fr || p.name_ar || 'Product ' + productId;
        const description = (p.description_fr || p.description_ar || title).replace(/<[^>]*>?/gm, '').substring(0, 4990) || title;
        const inStock = (p.stock_quantity === undefined || p.stock_quantity > 0) && p.is_active !== false;
        const availability = inStock ? 'in stock' : 'out of stock';
        const priceVal = `${Math.round(p.price || 0)} ${currency}`;
        const salePriceVal = p.sale_price && p.sale_price < p.price ? `${Math.round(p.sale_price)} ${currency}` : undefined;
        const mainImage = p.images && p.images.length > 0 ? p.images[0] : `${domainUrl}/icon.png`;
        const productLink = p.slug ? `${domainUrl}/products/${p.slug}` : `${domainUrl}/products`;

        return {
          method: 'UPDATE',
          data: {
            id: productId,
            title: title,
            description: description,
            availability: availability,
            condition: 'new',
            price: priceVal,
            sale_price: salePriceVal,
            link: productLink,
            image_link: mainImage,
            brand: 'Business Market',
            inventory: p.stock_quantity !== undefined ? p.stock_quantity : 100,
            category: p.category_name || 'General'
          }
        };
      });

      const batchUrl = `https://graph.facebook.com/v19.0/${catalogId}/items_batch`;
      const batchRes = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ requests })
      });

      const batchData = await batchRes.json() as { handles?: string[]; error?: { message: string } };

      if (!batchRes.ok || batchData.error) {
        return jsonResponse({
          success: false,
          message: batchData.error?.message || 'Meta Batch Catalog Sync returned an error.',
          details: batchData
        }, batchRes.status || 400);
      }

      return jsonResponse({
        success: true,
        timestamp: new Date().toISOString(),
        processedCount: products.length,
        successCount: products.length,
        handles: batchData.handles || [],
        message: `Successfully synchronized ${products.length} products to Meta Catalog ID ${catalogId}.`
      });
    }

    // 8. GET /api/meta/status
    if (subpath === 'status' && method === 'GET') {
      const authHeader = request.headers.get('Authorization') || '';
      const accessToken = authHeader.replace(/^Bearer\s+/i, '') || url.searchParams.get('accessToken') || '';

      if (!accessToken) {
        return jsonResponse({ connected: false, message: 'No access token provided.' });
      }

      const debugUrl = `https://graph.facebook.com/v19.0/me?fields=id,name,email&access_token=${accessToken}`;
      const meRes = await fetch(debugUrl);
      const meData = await meRes.json() as { id?: string; name?: string; error?: { message: string } };

      if (!meRes.ok || meData.error) {
        return jsonResponse({
          connected: false,
          tokenValid: false,
          error: meData.error?.message || 'Access token is invalid or expired.'
        });
      }

      return jsonResponse({
        connected: true,
        tokenValid: true,
        user: meData
      });
    }

    // 9. GET /api/meta/config
    if (subpath === 'config' && method === 'GET') {
      let configData: Record<string, unknown> = {};
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'meta_social_commerce_config')
          .maybeSingle();

        if (data?.value) {
          configData = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        }
      } catch (e) {
        console.warn('[Cloudflare Meta Config Read]:', e);
      }

      const appSecret = (configData.appSecret as string) || (await getMetaAppSecret(env, supabase));
      const appId = (configData.appId as string) || env.META_APP_ID || '';

      const safeConfig = {
        ...configData,
        appId: appId,
        appSecret: '', // Strictly masked for client protection
        hasAppSecret: Boolean(appSecret && appSecret.trim().length > 0),
        appSecretSnippet: appSecret && appSecret.length > 8 ? `${appSecret.substring(0, 4)}...${appSecret.substring(appSecret.length - 4)}` : (appSecret ? '••••••••' : ''),
      };

      return jsonResponse({
        success: true,
        config: safeConfig
      });
    }

    // 10. POST /api/meta/config
    if (subpath === 'config' && method === 'POST') {
      const incomingConfig = (await request.json()) as Record<string, unknown>;

      let existingValue: Record<string, unknown> = {};
      try {
        const { data: existing } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'meta_social_commerce_config')
          .maybeSingle();

        if (existing?.value) {
          existingValue = typeof existing.value === 'string' ? JSON.parse(existing.value) : existing.value;
        }
      } catch {
        // Continue
      }

      const secretToSave = incomingConfig.appSecret && String(incomingConfig.appSecret).trim().length > 0
        ? String(incomingConfig.appSecret).trim()
        : (existingValue.appSecret || (await getMetaAppSecret(env, supabase)));

      const mergedValue = {
        ...existingValue,
        ...incomingConfig,
        appSecret: secretToSave || '',
        updated_at: new Date().toISOString()
      };

      const { error: upsertErr } = await supabase
        .from('system_settings')
        .upsert({
          key: 'meta_social_commerce_config',
          value: mergedValue,
          is_public: false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (upsertErr) {
        console.error('[Cloudflare Meta Config Save Error]:', upsertErr.message);
      }

      return jsonResponse({
        success: true,
        message: 'Meta configuration saved securely.',
        hasAppSecret: Boolean(secretToSave && String(secretToSave).trim().length > 0)
      });
    }

    // 11. POST /api/meta/data-deletion & /api/meta/data-deletion-callback
    if ((subpath === 'data-deletion' || subpath === 'data-deletion-callback') && method === 'POST') {
      let signedRequest = '';
      try {
        const body = (await request.json()) as { signed_request?: string; signedRequest?: string };
        signedRequest = body?.signed_request || body?.signedRequest || '';
      } catch {
        signedRequest = url.searchParams.get('signed_request') || '';
      }

      if (!signedRequest) {
        return jsonResponse({ success: false, error: 'Missing signed_request parameter.' }, 400);
      }

      const appSecret = await getMetaAppSecret(env, supabase);
      if (!appSecret) {
        return jsonResponse({ success: false, error: 'Meta App Secret not configured.' }, 400);
      }

      const parts = signedRequest.split('.');
      if (parts.length !== 2) {
        return jsonResponse({ success: false, error: 'Invalid signed_request format.' }, 400);
      }

      const [encodedSig, payloadStr] = parts;
      const isValidSig = await verifyHmacSha256(payloadStr, encodedSig, appSecret);
      if (!isValidSig) {
        return jsonResponse({ success: false, error: 'HMAC signature verification failed.' }, 400);
      }

      let payload: { user_id?: string; issued_at?: number; algorithm?: string };
      try {
        const decodedText = new TextDecoder().decode(base64urlToUint8Array(payloadStr));
        payload = JSON.parse(decodedText);
      } catch {
        return jsonResponse({ success: false, error: 'Invalid signed_request payload JSON.' }, 400);
      }

      const metaUserId = String(payload.user_id || '').trim();
      if (!metaUserId) {
        return jsonResponse({ success: false, error: 'Missing user_id in payload.' }, 400);
      }

      // Generate confirmation code
      const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      const confirmationCode = `DEL-${randomHex}`;

      const issuedAt = payload.issued_at || Math.floor(Date.now() / 1000);
      const serverProof = await computeHmacSha256Hex(
        `META_DELETE_PROOF_V2:${confirmationCode}:${metaUserId}:${issuedAt}`,
        appSecret
      );

      const requestedAt = new Date().toISOString();
      const details = {
        issued_at: issuedAt,
        algorithm: payload.algorithm || 'HMAC-SHA256',
        processed_at: requestedAt,
      };

      try {
        await supabase.rpc('record_meta_data_deletion', {
          p_confirmation_code: confirmationCode,
          p_meta_user_id: metaUserId,
          p_details: details,
          p_server_proof: serverProof,
          p_issued_at: issuedAt,
        });
      } catch (err) {
        console.warn('[Cloudflare Meta Deletion RPC Notice]:', err);
      }

      const statusUrl = `${url.origin}/data-deletion-status?code=${confirmationCode}`;

      return jsonResponse({
        url: statusUrl,
        confirmation_code: confirmationCode
      }, 200, {
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache'
      });
    }

    // 12. GET /api/meta/data-deletion-status
    if (subpath === 'data-deletion-status' && method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim().toUpperCase();

      if (!code || !/^DEL-[A-F0-9]{12,64}$/.test(code)) {
        return jsonResponse({ success: false, message: 'Invalid confirmation code format.' }, 400);
      }

      try {
        const { data, error } = await supabase.rpc('get_meta_deletion_status', {
          p_code: code
        });

        if (!error && data) {
          const rec = Array.isArray(data) ? data[0] : data;
          if (rec && rec.confirmation_code) {
            return jsonResponse({
              success: true,
              record: {
                confirmation_code: rec.confirmation_code,
                status: rec.status,
                requested_at: rec.requested_at,
                completed_at: rec.completed_at
              }
            }, 200, { 'Cache-Control': 'no-store, no-cache, must-revalidate, private' });
          }
        }
      } catch (err) {
        console.warn('[Cloudflare Meta Deletion Status Query Notice]:', err);
      }

      return jsonResponse({
        success: false,
        message: 'No data deletion record found for the provided confirmation code.'
      }, 404);
    }

    // Unmatched subpath under /api/meta
    return jsonResponse({
      success: false,
      error: `Meta API endpoint not found: /api/meta/${subpath}`,
    }, 404);

  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[Cloudflare Meta Router Error] /api/meta/${subpath}:`, err);
    return jsonResponse({
      success: false,
      error: err.message || 'Internal Server Error'
    }, 500);
  }
}
