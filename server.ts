import express from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import shippingRouter from './src/server/shippingApi';
import metaCommerceRouter from './src/server/metaCommerceApi';

const app = express();
const PORT = 3000;

// Set up memory storage for uploaded files
const storage = multer.memoryStorage();
const upload = multer({
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for APK
  },
  storage: storage,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount Module 5 Shipping & Logistics API router
app.use('/api/shipping', shippingRouter);

// Mount Meta Social Commerce Integration API router
app.use('/api/meta', metaCommerceRouter);

// API route to proxy the GitHub Release creation and APK upload
app.post('/api/github/publish-release', upload.single('apk'), async (req, res) => {
  try {
    const {
      version_code,
      version_name,
      notes_ar,
      notes_fr,
      is_mandatory
    } = req.body;

    // Target repository & token
    const owner = 'zaki-le-roi';
    const repo = 'business-market-releases';
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      console.error('[Server] Publish rejected: GITHUB_TOKEN environment variable is not configured.');
      return res.status(500).json({
        success: false,
        message: 'GITHUB_TOKEN environment variable is missing on the server. Please configure GITHUB_TOKEN in environment variables.'
      });
    }

    if (!version_name || !version_code) {
      return res.status(400).json({
        success: false,
        message: 'version_name and version_code parameters are required.'
      });
    }

    // MANDATORY: Verify APK exists in request BEFORE creating any release
    if (!req.file || !req.file.buffer || req.file.buffer.length < 100000) {
      console.error('[Server] Publish rejected: No valid APK file provided in request.');
      return res.status(400).json({
        success: false,
        message: 'A valid compiled APK file (size > 100KB) is required before creating a GitHub release. Empty releases are strictly forbidden.'
      });
    }

    const apkFileName = req.file.originalname || `Business-Market-v${version_name}.apk`;
    const apkSize = req.file.buffer.length;

    console.log(`==========================================`);
    console.log(`[Server] VERIFIED APK FOR PUBLISHING:`);
    console.log(`Name: ${apkFileName}`);
    console.log(`Size: ${apkSize} bytes`);
    console.log(`Target Tag: v${version_name}`);
    console.log(`==========================================`);

    const releaseRequestUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
    console.log(`[Server] Creating release at URL: ${releaseRequestUrl}`);

    // 1. Create GitHub Release
    const releasePayload = {
      tag_name: `v${version_name}`,
      name: `Release v${version_name}`,
      body: `Version Code: ${version_code}\nMandatory: ${is_mandatory}\n\nNotes (AR):\n${notes_ar || ''}\n\nNotes (FR):\n${notes_fr || ''}`,
      draft: false,
      prerelease: false,
    };

    const releaseResponse = await fetch(releaseRequestUrl, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Business-Market-Backend',
      },
      body: JSON.stringify(releasePayload),
    });

    let releaseData: unknown;
    const responseText = await releaseResponse.text();

    try {
      releaseData = JSON.parse(responseText);
    } catch {
      releaseData = responseText;
    }

    let releaseJson: Record<string, unknown> | null = null;
    let newlyCreatedReleaseId: number | null = null;

    if (!releaseResponse.ok) {
      console.warn(`[Server] Release creation returned status: ${releaseResponse.status}. Checking if release already exists...`);
      if (releaseResponse.status === 422) {
        // Fetch the existing release for this tag
        const tagUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/v${version_name}`;
        const tagResponse = await fetch(tagUrl, {
          method: 'GET',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Business-Market-Backend',
          },
        });

        if (tagResponse.ok) {
          try {
            const tagData = await tagResponse.json() as Record<string, unknown>;
            releaseJson = tagData;
            console.log(`[Server] Found existing release for tag v${version_name}. Using it.`);
          } catch (err) {
            console.error('[Server] Failed to parse existing release JSON:', err);
          }
        }
      }

      if (!releaseJson) {
        console.error(`[Server] Release creation failed. Status: ${releaseResponse.status}`);
        return res.status(releaseResponse.status).json({
          success: false,
          stage: 'create_release',
          request_url: releaseRequestUrl,
          status_code: releaseResponse.status,
          response_body: releaseData,
          message: `GitHub API error during release creation: ${releaseResponse.statusText}`
        });
      }
    } else {
      releaseJson = releaseData as Record<string, unknown>;
      if (releaseJson.id && typeof releaseJson.id === 'number') {
        newlyCreatedReleaseId = releaseJson.id;
      }
      console.log(`[Server] GitHub release created successfully! ID: ${releaseJson.id}`);
    }

    // 2. Upload APK Asset
    let uploadResult: unknown = null;
    let downloadUrl = '';

    const fileName = apkFileName;

    // If release already has assets, check if one exists with the same name and delete it first
    if (releaseJson && Array.isArray(releaseJson.assets)) {
      const existingAsset = releaseJson.assets.find((asset: unknown) => {
        const a = asset as Record<string, unknown>;
        return a.name === fileName;
      }) as Record<string, unknown> | undefined;

      if (existingAsset) {
        console.log(`[Server] Asset with name ${fileName} already exists (ID: ${existingAsset.id}). Deleting it first...`);
        const deleteUrl = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`;
        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Business-Market-Backend',
          }
        });
        if (deleteResponse.ok) {
          console.log(`[Server] Successfully deleted existing asset ${fileName}`);
        } else {
          console.warn(`[Server] Failed to delete existing asset ${fileName}. Status: ${deleteResponse.status}`);
        }
      }
    }

    const rawUploadUrl = releaseJson.upload_url as string;
    const cleanUploadUrl = rawUploadUrl.split('{')[0] + `?name=${encodeURIComponent(fileName)}`;

    console.log(`[Server] Uploading APK asset (${apkSize} bytes) to URL: ${cleanUploadUrl}`);

    const uploadResponse = await fetch(cleanUploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': String(req.file.buffer.length),
        'User-Agent': 'Business-Market-Backend',
      },
      body: req.file.buffer,
    });

    const uploadText = await uploadResponse.text();
    try {
      uploadResult = JSON.parse(uploadText);
    } catch {
      uploadResult = uploadText;
    }

    if (!uploadResponse.ok) {
      console.error(`[Server] APK asset upload failed. Status: ${uploadResponse.status}`);

      // Clean up / rollback empty release if newly created
      if (newlyCreatedReleaseId) {
        console.log(`[Server] Rolling back empty release ID ${newlyCreatedReleaseId}...`);
        await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${newlyCreatedReleaseId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Business-Market-Backend',
          }
        });
      }

      return res.status(uploadResponse.status).json({
        success: false,
        stage: 'upload_apk',
        request_url: cleanUploadUrl,
        status_code: uploadResponse.status,
        response_body: uploadResult,
        message: `GitHub API error during APK upload: ${uploadResponse.statusText}. Empty release rolled back.`
      });
    }

    console.log('[Server] APK asset uploaded successfully!');
    const uploadJson = uploadResult as Record<string, unknown>;
    downloadUrl = (uploadJson.browser_download_url as string) || '';

    // 3. Verify Asset exists in Release via REST API
    const verifyUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/v${version_name}`;
    const verifyRes = await fetch(verifyUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Business-Market-Backend'
      }
    });

    if (!verifyRes.ok) {
      console.error(`[Server] Verification failed for release v${version_name}`);
      return res.status(500).json({
        success: false,
        message: `Release created but verification on GitHub failed with status ${verifyRes.status}`
      });
    }

    const verifiedRelease = await verifyRes.json() as Record<string, unknown>;
    const assetsList = (Array.isArray(verifiedRelease.assets) ? verifiedRelease.assets : []) as Record<string, unknown>[];

    if (assetsList.length === 0) {
      console.error(`[Server] Verified release v${version_name} has NO uploaded assets! Rolling back...`);
      if (newlyCreatedReleaseId) {
        await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${newlyCreatedReleaseId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Business-Market-Backend',
          }
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Release verification failed: No assets found in the published release.'
      });
    }

    const finalDownloadUrl = downloadUrl || (assetsList[0]?.browser_download_url as string);

    // 4. Verify Download URL reachability
    try {
      console.log(`[Server] Testing download URL reachability: ${finalDownloadUrl}`);
      const downloadCheck = await fetch(finalDownloadUrl, { method: 'HEAD', redirect: 'follow' });
      console.log(`[Server] Download URL HEAD check returned status: ${downloadCheck.status}`);
      if (!downloadCheck.ok && downloadCheck.status !== 302 && downloadCheck.status !== 301) {
        console.warn(`[Server] Download URL check status is ${downloadCheck.status}`);
      }
    } catch (testErr) {
      console.warn(`[Server] Download URL reachability test warning:`, testErr);
    }

    console.log(`[Server] SUCCESS: Release v${version_name} published & verified with APK asset!`);

    return res.status(200).json({
      success: true,
      release: verifiedRelease,
      asset: uploadResult,
      apk_name: fileName,
      apk_size: apkSize,
      download_url: finalDownloadUrl,
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Server] Publish error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
});

/* --------------------------- Yalidine API Proxy --------------------------- */
function logYalidineCall(
  endpoint: string,
  method: string,
  headers: Record<string, string>,
  body: unknown,
  responseStatus: number,
  responseHeaders: Record<string, string>,
  responseBody: unknown
) {
  const redactedHeaders = { ...headers };
  if (redactedHeaders['X-API-TOKEN']) redactedHeaders['X-API-TOKEN'] = '[REDACTED]';
  if (redactedHeaders['x-api-token']) redactedHeaders['x-api-token'] = '[REDACTED]';
  if (redactedHeaders['Authorization']) redactedHeaders['Authorization'] = '[REDACTED]';

  console.log('=== YALIDINE HTTP REQUEST ===');
  console.log(`URL: ${endpoint}`);
  console.log(`Method: ${method}`);
  console.log('Headers:', JSON.stringify(redactedHeaders, null, 2));
  if (body) {
    console.log('Body:', JSON.stringify(body, null, 2));
  }
  console.log('=== YALIDINE HTTP RESPONSE ===');
  console.log(`Status: ${responseStatus}`);
  console.log('Headers:', JSON.stringify(responseHeaders, null, 2));
  console.log('Body:', JSON.stringify(responseBody, null, 2));
  console.log('==============================');
}

app.post('/api/yalidine/test', async (req: express.Request, res: express.Response) => {
  const apiId = req.headers['x-api-id'] as string;
  const apiToken = req.headers['x-api-token'] as string;

  if (!apiId || !apiToken) {
    return res.status(400).json({
      success: false,
      message: 'Both X-API-ID and X-API-TOKEN headers are required for Yalidine integration.'
    });
  }

  const endpoint = 'https://api.yalidine.com/v1/wilayas';
  const method = 'GET';
  const requestHeaders = {
    'X-API-ID': apiId,
    'X-API-TOKEN': apiToken,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    const apiResponse = await fetch(endpoint, {
      method,
      headers: requestHeaders
    });

    const responseStatus = apiResponse.status;
    const responseHeaders: Record<string, string> = {};
    apiResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let responseBody: unknown;
    const responseText = await apiResponse.text();
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    logYalidineCall(endpoint, method, requestHeaders, null, responseStatus, responseHeaders, responseBody);

    if (apiResponse.ok) {
      return res.status(200).json({
        success: true,
        message: 'Connected successfully',
        data: responseBody
      });
    } else {
      const respObj = responseBody as { message?: string; error?: string } | null;
      const errorMessage = respObj?.message || respObj?.error || responseText || `HTTP ${responseStatus}`;
      return res.status(responseStatus).json({
        success: false,
        message: `Yalidine API Error: ${errorMessage}`,
        status: responseStatus,
        details: responseBody
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Server] Yalidine Connection Test failed:', err);
    return res.status(500).json({
      success: false,
      message: `Connection failed: ${err.message || err}`
    });
  }
});

app.post('/api/yalidine/parcels', async (req: express.Request, res: express.Response) => {
  const apiId = req.headers['x-api-id'] as string;
  const apiToken = req.headers['x-api-token'] as string;

  if (!apiId || !apiToken) {
    return res.status(400).json({
      success: false,
      message: 'Both X-API-ID and X-API-TOKEN headers are required for Yalidine integration.'
    });
  }

  const endpoint = 'https://api.yalidine.com/v1/parcels';
  const method = 'POST';
  const requestHeaders = {
    'X-API-ID': apiId,
    'X-API-TOKEN': apiToken,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  const body = req.body;

  try {
    const apiResponse = await fetch(endpoint, {
      method,
      headers: requestHeaders,
      body: JSON.stringify(body)
    });

    const responseStatus = apiResponse.status;
    const responseHeaders: Record<string, string> = {};
    apiResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let responseBody: unknown;
    const responseText = await apiResponse.text();
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    logYalidineCall(endpoint, method, requestHeaders, body, responseStatus, responseHeaders, responseBody);

    if (apiResponse.ok) {
      return res.status(200).json({
        success: true,
        data: responseBody
      });
    } else {
      const respObj = responseBody as { message?: string; error?: string } | null;
      const errorMessage = respObj?.message || respObj?.error || responseText || `HTTP ${responseStatus}`;
      return res.status(responseStatus).json({
        success: false,
        message: `Yalidine API Error: ${errorMessage}`,
        status: responseStatus,
        details: responseBody
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Server] Yalidine Parcel creation failed:', err);
    return res.status(500).json({
      success: false,
      message: `Parcel creation failed: ${err.message || err}`
    });
  }
});

app.get('/api/yalidine/parcels/:tracking', async (req: express.Request, res: express.Response) => {
  const apiId = req.headers['x-api-id'] as string;
  const apiToken = req.headers['x-api-token'] as string;
  const tracking = req.params.tracking;

  if (!apiId || !apiToken) {
    return res.status(400).json({
      success: false,
      message: 'Both X-API-ID and X-API-TOKEN headers are required for Yalidine integration.'
    });
  }

  const endpoint = `https://api.yalidine.com/v1/parcels/${tracking}`;
  const method = 'GET';
  const requestHeaders = {
    'X-API-ID': apiId,
    'X-API-TOKEN': apiToken,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    const apiResponse = await fetch(endpoint, {
      method,
      headers: requestHeaders
    });

    const responseStatus = apiResponse.status;
    const responseHeaders: Record<string, string> = {};
    apiResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let responseBody: unknown;
    const responseText = await apiResponse.text();
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    logYalidineCall(endpoint, method, requestHeaders, null, responseStatus, responseHeaders, responseBody);

    if (apiResponse.ok) {
      return res.status(200).json({
        success: true,
        data: responseBody
      });
    } else {
      const respObj = responseBody as { message?: string; error?: string } | null;
      const errorMessage = respObj?.message || respObj?.error || responseText || `HTTP ${responseStatus}`;
      return res.status(responseStatus).json({
        success: false,
        message: `Yalidine API Error: ${errorMessage}`,
        status: responseStatus,
        details: responseBody
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Server] Yalidine Tracking fetch failed:', err);
    return res.status(500).json({
      success: false,
      message: `Tracking fetch failed: ${err.message || err}`
    });
  }
});

app.get('/api/yalidine/shipping-fees', async (req: express.Request, res: express.Response) => {
  const apiId = req.headers['x-api-id'] as string;
  const apiToken = req.headers['x-api-token'] as string;

  if (!apiId || !apiToken) {
    return res.status(400).json({
      success: false,
      message: 'Both X-API-ID and X-API-TOKEN headers are required for Yalidine integration.'
    });
  }

  const endpoint = 'https://api.yalidine.com/v1/shipping-fees';
  const method = 'GET';
  const requestHeaders = {
    'X-API-ID': apiId,
    'X-API-TOKEN': apiToken,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  try {
    const apiResponse = await fetch(endpoint, {
      method,
      headers: requestHeaders
    });

    const responseStatus = apiResponse.status;
    const responseHeaders: Record<string, string> = {};
    apiResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let responseBody: unknown;
    const responseText = await apiResponse.text();
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    logYalidineCall(endpoint, method, requestHeaders, null, responseStatus, responseHeaders, responseBody);

    if (apiResponse.ok) {
      return res.status(200).json({
        success: true,
        data: responseBody
      });
    } else {
      const respObj = responseBody as { message?: string; error?: string } | null;
      const errorMessage = respObj?.message || respObj?.error || responseText || `HTTP ${responseStatus}`;
      return res.status(responseStatus).json({
        success: false,
        message: `Yalidine API Error: ${errorMessage}`,
        status: responseStatus,
        details: responseBody
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Server] Yalidine Shipping Fees fetch failed:', err);
    return res.status(500).json({
      success: false,
      message: `Shipping Fees fetch failed: ${err.message || err}`
    });
  }
});

app.get('/api/yalidine/tickets', async (req: express.Request, res: express.Response) => {
  const apiId = req.query.apiId as string;
  const apiToken = req.query.apiToken as string;
  const ids = req.query.ids as string;

  if (!apiId || !apiToken || !ids) {
    return res.status(400).json({
      success: false,
      message: 'apiId, apiToken, and ids are required query parameters.'
    });
  }

  const endpoint = `https://api.yalidine.com/v1/tickets?ids=${ids}`;
  const method = 'GET';
  const requestHeaders = {
    'X-API-ID': apiId,
    'X-API-TOKEN': apiToken,
    'Accept': 'application/pdf'
  };

  try {
    const apiResponse = await fetch(endpoint, {
      method,
      headers: requestHeaders
    });

    if (apiResponse.ok) {
      const buffer = await apiResponse.arrayBuffer();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="yalidine_label_${ids}.pdf"`);
      return res.send(Buffer.from(buffer));
    } else {
      const responseText = await apiResponse.text();
      let responseBody: unknown;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }
      const respObj = responseBody as { message?: string; error?: string } | null;
      const errorMessage = respObj?.message || respObj?.error || responseText || `HTTP ${apiResponse.status}`;
      return res.status(apiResponse.status).json({
        success: false,
        message: `Yalidine Label API Error: ${errorMessage}`,
        status: apiResponse.status
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Server] Yalidine Ticket fetch failed:', err);
    return res.status(500).json({
      success: false,
      message: `Ticket fetch failed: ${err.message || err}`
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                       LOCAL AUTOMATION DEVELOPMENT API                      */
/* -------------------------------------------------------------------------- */
import { processScheduledTasks, processEmailQueue, processDomainEvent } from './src/lib/automationEngine';

app.all('/api/automation/cron', async (req: express.Request, res: express.Response) => {
  const cronSecret = process.env.CRON_SECRET || 'business_market_cron_secret_2026';
  const authHeader = req.headers['authorization'];
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : req.query.secret;

  if (process.env.CRON_SECRET && token !== cronSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid CRON_SECRET token.' });
  }

  try {
    const taskResult = await processScheduledTasks(undefined, process.env);
    const emailResult = await processEmailQueue(undefined, process.env);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      tasks: taskResult,
      emailQueue: emailResult,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

app.post('/api/automation/trigger-event', async (req: express.Request, res: express.Response) => {
  const { eventType, eventData } = req.body || {};
  if (!eventType) {
    return res.status(400).json({ success: false, error: 'eventType parameter is required.' });
  }

  try {
    const result = await processDomainEvent(eventType, eventData || {}, undefined, process.env);
    return res.status(200).json({ success: true, result });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Serve Vite-generated assets
const startServer = async () => {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1d',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
};

startServer();
