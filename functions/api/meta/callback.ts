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

// Retrieve App Secret securely from Supabase system_settings or env
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
    console.warn('[Meta Callback] Supabase Secret Notice:', e);
  }

  const envSecret = env.META_APP_SECRET || env.FACEBOOK_APP_SECRET;
  if (envSecret && typeof envSecret === 'string') {
    return envSecret.trim();
  }

  return '';
}

export async function onRequest(context: { request: Request; env: CloudflareEnv }) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error_message') || url.searchParams.get('error') || url.searchParams.get('error_description');
  const state = url.searchParams.get('state') || '';

  // If no code and no error was provided (e.g. testing or direct verification of endpoint)
  if (!code && !error) {
    const isJsonRequested = request.headers.get('Accept')?.includes('application/json');
    if (isJsonRequested) {
      return new Response(JSON.stringify({
        success: true,
        status: 'ready',
        message: 'Meta OAuth Callback endpoint is active and listening.',
        endpoint: '/api/meta/callback'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meta OAuth Callback Endpoint</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; }
    .box { background: #1e293b; padding: 2.5rem; border-radius: 1rem; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 480px; width: 90%; }
    .badge { display: inline-block; background: #065f46; color: #34d399; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 9999px; margin-bottom: 1rem; }
    h2 { font-size: 1.25rem; margin: 0 0 0.5rem; color: #ffffff; }
    p { color: #94a3b8; font-size: 0.875rem; line-height: 1.5; margin: 0 0 1.5rem; }
    .btn { display: inline-block; background: #3b82f6; color: #ffffff; text-decoration: none; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; }
  </style>
</head>
<body>
  <div class="box">
    <div class="badge">Cloudflare Pages Functions</div>
    <h2>نقطة استقبال وتوثيق Meta OAuth جاهزة</h2>
    <p>هذا المسار مخصص لاستقبال رموز التفويض من Meta Business والتكامل الآمن مع خوادم Graph API.</p>
    <a href="/admin/social-commerce" class="btn">العودة إلى لوحة تحكم التجارة الاجتماعية</a>
  </div>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // If OAuth error returned by Meta
  if (error) {
    const safeError = encodeURIComponent(error);
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>فشل الربط مع Meta</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; }
    .box { background: #1e293b; padding: 2.5rem; border-radius: 1rem; border: 1px solid #ef4444; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 440px; width: 90%; }
    h2 { font-size: 1.25rem; margin-bottom: 0.5rem; color: #f87171; }
    p { color: #94a3b8; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="box">
    <h2>فشل التفويض مع Meta</h2>
    <p>${error}</p>
  </div>
  <script>
    (function() {
      const payload = {
        type: 'META_OAUTH_ERROR',
        error: decodeURIComponent('${safeError}'),
        state: '${state}'
      };
      if (window.opener) {
        window.opener.postMessage(payload, '*');
        setTimeout(() => window.close(), 1500);
      } else {
        setTimeout(() => { window.location.href = '/admin/social-commerce?error=' + '${safeError}'; }, 2000);
      }
    })();
  </script>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // Handle successful code reception
  // Try server-side code exchange if needed
  let exchangeResult: { success: boolean; accessToken?: string; user?: unknown } | null = null;
  const supabase = getSupabase(env);
  const appSecret = await getMetaAppSecret(env, supabase);
  const appId = env.META_APP_ID;

  if (code && appSecret && appId) {
    try {
      const redirectUri = `${url.origin}/api/meta/callback`;
      const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` + new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code: code
      }).toString();

      const shortRes = await fetch(tokenUrl);
      const shortData = await shortRes.json() as { access_token?: string; error?: { message: string } };

      if (shortData.access_token) {
        // Exchange for long-lived token
        const longUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` + new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortData.access_token
        }).toString();

        const longRes = await fetch(longUrl);
        const longData = await longRes.json() as { access_token?: string };
        const finalToken = longData.access_token || shortData.access_token;

        // Fetch user profile
        const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,email&access_token=${finalToken}`);
        const meData = await meRes.json();

        exchangeResult = {
          success: true,
          accessToken: finalToken,
          user: meData
        };
      }
    } catch (exchangeErr) {
      console.warn('[Meta Callback] Direct exchange notice (will delegate to client handler):', exchangeErr);
    }
  }

  const safeCode = encodeURIComponent(code || '');
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
    h2 { font-size: 1.25rem; margin-bottom: 0.5rem; color: #34d399; }
    p { color: #94a3b8; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <h2>تم استلام رمز التحقق من Meta بنجاح!</h2>
    <p>جاري استكمال التوصيل وتحديث لوحة تحكم Business Market...</p>
  </div>
  <script>
    (function() {
      const payload = {
        type: 'META_OAUTH_SUCCESS',
        code: decodeURIComponent('${safeCode}'),
        state: '${state}',
        exchangeResult: ${exchangeResult ? JSON.stringify(exchangeResult) : 'null'}
      };
      if (window.opener) {
        window.opener.postMessage(payload, '*');
        setTimeout(() => window.close(), 1000);
      } else {
        setTimeout(() => { window.location.href = '/admin/social-commerce?code=' + '${safeCode}' + '&state=' + '${state}'; }, 1500);
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
