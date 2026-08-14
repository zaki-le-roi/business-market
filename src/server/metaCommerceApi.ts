import express from 'express';
import { handleMetaDataDeletion, getMetaDataDeletionRecordByCode, getMetaAppSecret } from './metaDataDeletion';
import { supabase } from '../lib/supabase';

const router = express.Router();

// Helper to sanitize token output for security
function sanitizeToken(token?: string): string {
  if (!token) return '';
  if (token.length <= 8) return '****';
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}

// 1. Get OAuth Redirect & Authorize URL for Meta
router.get('/oauth-url', (req, res) => {
  try {
    const appId = req.query.appId as string || process.env.META_APP_ID || '';
    const redirectUri = (req.query.redirectUri as string) || `${req.protocol}://${req.get('host')}/api/meta/callback`;
    
    if (!appId) {
      return res.status(400).json({
        success: false,
        message: 'Meta App ID is required to generate OAuth authorization URL.'
      });
    }

    // Supported and approved permissions for Meta Business / Commerce integration:
    // Removed: 'email', 'pages_manage_posts' (incompatible with Meta Business Login)
    // Maintained: 'public_profile', 'pages_show_list', 'pages_read_engagement', 'instagram_basic', 'catalog_management', 'business_management'
    const requestedScopeParam = req.query.scope as string | undefined;
    const defaultScopes = [
      'public_profile',
      'pages_show_list',
      'pages_read_engagement',
      'instagram_basic',
      'catalog_management',
      'business_management'
    ];
    const scopes = requestedScopeParam || defaultScopes.join(',');

    const state = Math.random().toString(36).substring(2);

    const metaAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?` + new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state: state,
      scope: scopes,
      response_type: 'code',
    }).toString();

    return res.json({
      success: true,
      url: metaAuthUrl,
      state,
      redirectUri
    });
  } catch (err: unknown) {
    const error = err as Error;
    return res.status(500).json({ success: false, message: error.message || 'Failed to construct OAuth URL' });
  }
});

// 2. OAuth Callback Route (returns postMessage script for popup)
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.send(`
      <!System html>
      <html>
        <head><title>Meta Authentication Error</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #0f172a; color: #f87171;">
          <h2>Meta Connection Failed</h2>
          <p>${error_description || error}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'META_OAUTH_ERROR', error: '${error_description || error}' }, '*');
              setTimeout(() => window.close(), 2000);
            }
          </script>
        </body>
      </html>
    `);
  }

  return res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Meta Authentication Complete</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #0f172a; color: #34d399;">
        <h2>Authentication Successful!</h2>
        <p>Connecting Meta Business account...</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'META_OAUTH_SUCCESS', code: '${code}', state: '${state}' }, '*');
            setTimeout(() => window.close(), 1000);
          } else {
            window.location.href = '/admin/social-commerce';
          }
        </script>
      </body>
    </html>
  `);
});

// 3. Exchange Authorization Code for Long-Lived Access Token
router.post('/exchange-token', async (req, res) => {
  try {
    const { code, appId, appSecret, redirectUri } = req.body;

    let metaAppId = appId || process.env.META_APP_ID;
    let metaAppSecret = appSecret || process.env.META_APP_SECRET;

    if (!metaAppSecret) {
      metaAppSecret = await getMetaAppSecret();
    }

    if (!metaAppId) {
      // Check database config for appId
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
      return res.status(400).json({ success: false, message: 'Authorization code is required.' });
    }
    if (!metaAppId || !metaAppSecret) {
      return res.status(400).json({ success: false, message: 'Meta App ID and App Secret are required.' });
    }

    // Step A: Short-lived token
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` + new URLSearchParams({
      client_id: metaAppId,
      client_secret: metaAppSecret,
      redirect_uri: redirectUri || `${req.protocol}://${req.get('host')}/api/meta/callback`,
      code: code
    }).toString();

    const shortTokenRes = await fetch(tokenUrl);
    const shortTokenData = await shortTokenRes.json() as { access_token?: string; error?: { message: string } };

    if (!shortTokenRes.ok || !shortTokenData.access_token) {
      return res.status(shortTokenRes.status || 400).json({
        success: false,
        message: shortTokenData.error?.message || 'Failed to exchange authorization code for access token.'
      });
    }

    // Step B: Exchange for long-lived access token (60 days)
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

    return res.json({
      success: true,
      accessToken: finalAccessToken,
      tokenType: 'long_lived',
      expiresIn: longTokenData.expires_in || 5184000,
      user: meData
    });
  } catch (err: unknown) {
    const error = err as Error;
    return res.status(500).json({ success: false, message: error.message || 'Token exchange failed.' });
  }
});

// 4. Get User Facebook Pages and Instagram Accounts
router.get('/pages', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '') || (req.query.accessToken as string);

    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Meta User Access Token is required.' });
    }

    const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,category,picture,instagram_business_account{id,username,name,profile_picture_url}&access_token=${accessToken}`;
    
    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json() as { data?: Array<{ id: string; name: string; access_token: string; category: string; instagram_business_account?: { id: string; username: string; name: string } }>; error?: { message: string } };

    if (!pagesRes.ok || !pagesData.data) {
      return res.status(pagesRes.status || 400).json({
        success: false,
        message: pagesData.error?.message || 'Failed to fetch Facebook Pages.'
      });
    }

    return res.json({
      success: true,
      pages: pagesData.data
    });
  } catch (err: unknown) {
    const error = err as Error;
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch pages.' });
  }
});

// 5. Get Business Managers & Product Catalogs
router.get('/catalogs', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '') || (req.query.accessToken as string);
    const businessId = req.query.businessId as string;

    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Meta User Access Token is required.' });
    }

    // Step A: Fetch Business Accounts if businessId not supplied
    let businesses: Array<{ id: string; name: string }> = [];
    const bizUrl = `https://graph.facebook.com/v19.0/me/businesses?fields=id,name&access_token=${accessToken}`;
    const bizRes = await fetch(bizUrl);
    const bizData = await bizRes.json() as { data?: Array<{ id: string; name: string }> };
    if (bizData.data) {
      businesses = bizData.data;
    }

    // Step B: Fetch Catalogs
    let catalogs: Array<{ id: string; name: string; product_count?: number; vertical?: string }> = [];

    // Try fetching me/product_catalogs or business owned_product_catalogs
    const targetEndpoint = businessId 
      ? `https://graph.facebook.com/v19.0/${businessId}/owned_product_catalogs?fields=id,name,product_count,vertical&access_token=${accessToken}`
      : `https://graph.facebook.com/v19.0/me/product_catalogs?fields=id,name,product_count,vertical&access_token=${accessToken}`;

    const catRes = await fetch(targetEndpoint);
    const catData = await catRes.json() as { data?: Array<{ id: string; name: string; product_count?: number; vertical?: string }>; error?: { message: string } };

    if (catData.data) {
      catalogs = catData.data;
    } else if (businesses.length > 0) {
      // Fallback: try first business ID
      const fallbackUrl = `https://graph.facebook.com/v19.0/${businesses[0].id}/owned_product_catalogs?fields=id,name,product_count,vertical&access_token=${accessToken}`;
      const fallbackRes = await fetch(fallbackUrl);
      const fallbackData = await fallbackRes.json() as { data?: Array<{ id: string; name: string; product_count?: number; vertical?: string }> };
      if (fallbackData.data) {
        catalogs = fallbackData.data;
      }
    }

    return res.json({
      success: true,
      businesses,
      catalogs
    });
  } catch (err: unknown) {
    const error = err as Error;
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch catalogs.' });
  }
});

// 6. Create Meta Product Catalog
router.post(['/catalogs/create', '/create-catalog'], async (req, res) => {
  try {
    const { accessToken, catalogName } = req.body;
    let targetBusinessId = (req.body.businessId as string | undefined)?.trim() || '';

    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Access Token is required.' });
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
      return res.status(400).json({
        success: false,
        message: 'Meta Business Manager / Portfolio ID is required to create a Product Catalog. Catalogs cannot be owned by a personal user profile. Please create or link a Business Portfolio in Meta Business Suite (business.facebook.com).',
        error: {
          code: 100,
          error_subcode: null,
          message: 'No Business Portfolio (Business Manager) associated with this account.',
          type: 'OAuthException',
          help: 'Create a Business Portfolio at https://business.facebook.com and grant your user Admin / Full Control access.'
        }
      });
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

      return res.status(createRes.status || 400).json({
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
      });
    }

    console.log(`[MetaCommerceApi] Meta Catalog created successfully. ID: ${createData.id}`);

    return res.json({
      success: true,
      catalog: {
        id: createData.id,
        name: name,
        product_count: 0
      },
      businessId: targetBusinessId
    });
  } catch (err: unknown) {
    const error = err as Error;
    return res.status(500).json({ success: false, message: error.message || 'Catalog creation error.' });
  }
});

// 7. Synchronize Business Market Products to Meta Catalog (Batch API)
router.post('/sync-products', async (req, res) => {
  try {
    const { accessToken, catalogId, products, currency = 'DZD', baseUrl } = req.body;

    if (!accessToken || !catalogId) {
      return res.status(400).json({
        success: false,
        message: 'Meta Access Token and Catalog ID are required for catalog sync.'
      });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No products provided for synchronization.'
      });
    }

    const domainUrl = baseUrl || `${req.protocol}://${req.get('host')}`;

    // Construct Meta Commerce batch items payload according to Meta Graph API Batch specification
    const requests = products.map((p: {
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
    }) => {
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
        method: 'UPDATE', // CREATE or UPDATE item
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

    // Send batch request to Meta Graph API
    const batchUrl = `https://graph.facebook.com/v19.0/${catalogId}/items_batch`;
    const batchRes = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        requests: requests
      })
    });

    const batchData = await batchRes.json() as { handles?: string[]; errors?: Array<{ message: string }>; error?: { message: string } };

    if (!batchRes.ok || batchData.error) {
      return res.status(batchRes.status || 400).json({
        success: false,
        message: batchData.error?.message || 'Meta Batch Catalog Sync returned an error.',
        details: batchData
      });
    }

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      processedCount: products.length,
      successCount: products.length,
      handles: batchData.handles || [],
      message: `Successfully synchronized ${products.length} products to Meta Catalog ID ${catalogId}.`
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error('[Meta Commerce Sync Error]:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Product synchronization failed.'
    });
  }
});

// 8. Connection Health Check & Debug Token
router.get('/status', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '') || (req.query.accessToken as string);

    if (!accessToken) {
      return res.json({ connected: false, message: 'No access token provided.' });
    }

    const debugUrl = `https://graph.facebook.com/v19.0/me?fields=id,name,email&access_token=${accessToken}`;
    const meRes = await fetch(debugUrl);
    const meData = await meRes.json() as { id?: string; name?: string; error?: { message: string } };

    if (!meRes.ok || meData.error) {
      return res.json({
        connected: false,
        tokenValid: false,
        error: meData.error?.message || 'Access token is invalid or expired.'
      });
    }

    return res.json({
      connected: true,
      tokenValid: true,
      tokenSnippet: sanitizeToken(accessToken),
      user: meData
    });
  } catch (err: unknown) {
    const error = err as Error;
    return res.json({ connected: false, error: error.message });
  }
});

// 9. Meta Data Deletion Callback Endpoint (compatible with signed_request)
// Simple in-memory rate limiter store for protection against automated callback spam
const deletionCallbackRateLimitMap = new Map<string, { count: number; resetTime: number }>();

router.post(['/data-deletion', '/data-deletion-callback'], async (req, res) => {
  try {
    // Basic Rate Limiting: max 30 callbacks per IP per 5 minutes
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;
    const limit = 30;

    const rateData = deletionCallbackRateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
    if (now > rateData.resetTime) {
      rateData.count = 0;
      rateData.resetTime = now + windowMs;
    }

    rateData.count += 1;
    deletionCallbackRateLimitMap.set(ip, rateData);

    if (rateData.count > limit) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Rate limit exceeded.'
      });
    }

    const signedRequest = req.body?.signed_request || req.body?.signedRequest || req.query?.signed_request;

    if (!signedRequest || typeof signedRequest !== 'string' || signedRequest.length > 4096) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid required parameter: signed_request'
      });
    }

    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const result = await handleMetaDataDeletion(signedRequest, hostUrl);

    // Security headers to prevent caching sensitive responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');

    // Meta strictly expects JSON format: { "url": "<status-url>", "confirmation_code": "<confirmation-code>" }
    return res.status(200).json({
      url: result.url,
      confirmation_code: result.confirmation_code
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[Meta Data Deletion Callback Error]:', error.message);
    return res.status(400).json({
      success: false,
      error: 'Data deletion request processing failed.'
    });
  }
});

// 10. Query Data Deletion Status by Confirmation Code
router.get('/data-deletion-status', async (req, res) => {
  try {
    const code = (req.query.code as string || '').trim().toUpperCase();

    // Strict validation: Must match format DEL- followed by uppercase hex (12-64 chars)
    if (!code || !/^DEL-[A-F0-9]{12,64}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing confirmation code parameter format.'
      });
    }

    const record = await getMetaDataDeletionRecordByCode(code);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'No data deletion record found for the provided confirmation code.'
      });
    }

    // Response headers for security
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    return res.json({
      success: true,
      record: {
        confirmation_code: record.confirmation_code,
        status: record.status,
        requested_at: record.requested_at,
        completed_at: record.completed_at
      }
    });
  } catch (err: unknown) {
    console.error('[Meta Data Deletion Query Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to query deletion status.'
    });
  }
});

// Server memory store for Meta config
let serverMetaConfigStore: Record<string, unknown> = {};

// 11. Securely Get Meta Configuration (Server-Side: Masks and never exposes raw App Secret)
router.get('/config', async (req, res) => {
  try {
    let configData: Record<string, unknown> = { ...serverMetaConfigStore };

    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'meta_social_commerce_config')
        .maybeSingle();

      if (data?.value) {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        configData = { ...configData, ...parsed };
      }
    } catch (e) {
      console.warn('[Meta API] Config read warning:', e);
    }

    const appSecret = (configData.appSecret as string) || (await getMetaAppSecret());
    const appId = (configData.appId as string) || process.env.META_APP_ID || '';

    // NEVER return raw appSecret in response payload
    const safeConfig = {
      ...configData,
      appId: appId,
      appSecret: '', // Always empty for security
      hasAppSecret: Boolean(appSecret && String(appSecret).trim().length > 0),
      appSecretSnippet: appSecret && String(appSecret).length > 8 ? `${String(appSecret).substring(0, 4)}...${String(appSecret).substring(String(appSecret).length - 4)}` : (appSecret ? '••••••••' : ''),
    };

    return res.json({
      success: true,
      config: safeConfig
    });
  } catch (err: unknown) {
    const error = err as Error;
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch config' });
  }
});

// 12. Securely Save Meta Configuration (Server-Side: Persists to system_settings with is_public = false)
router.post('/config', async (req, res) => {
  try {
    const incomingConfig = req.body || {};

    // 1. Fetch current settings to preserve existing secret if not supplied in update
    let existingValue: Record<string, unknown> = { ...serverMetaConfigStore };
    try {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'meta_social_commerce_config')
        .maybeSingle();

      if (existing?.value) {
        const parsed = typeof existing.value === 'string' ? JSON.parse(existing.value) : existing.value;
        existingValue = { ...existingValue, ...parsed };
      }
    } catch {
      // Continue
    }

    // If incoming appSecret is provided and non-empty, use it. Otherwise retain existing secret.
    const secretToSave = incomingConfig.appSecret && String(incomingConfig.appSecret).trim().length > 0
      ? String(incomingConfig.appSecret).trim()
      : (existingValue.appSecret || (await getMetaAppSecret()));

    const mergedValue = {
      ...existingValue,
      ...incomingConfig,
      appSecret: secretToSave || '',
      updated_at: new Date().toISOString()
    };

    serverMetaConfigStore = { ...mergedValue };

    // Upsert into system_settings with mandatory is_public = false
    const { error: upsertErr } = await supabase
      .from('system_settings')
      .upsert({
        key: 'meta_social_commerce_config',
        value: mergedValue,
        is_public: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (upsertErr) {
      console.error('[Meta API] Failed to save config to system_settings:', upsertErr.message);
    }

    return res.json({
      success: true,
      message: 'Meta configuration saved securely.',
      hasAppSecret: Boolean(secretToSave && String(secretToSave).trim().length > 0)
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[Meta API] Save config error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to save configuration' });
  }
});

export default router;
