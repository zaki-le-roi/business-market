import { createClient } from '@supabase/supabase-js';
import { processScheduledTasks, processEmailQueue } from '../../../src/lib/automationEngine';

interface CloudflareEnv {
  CRON_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export async function onRequest(context: { request: Request; env: CloudflareEnv }) {
  const { request, env } = context;

  // 1. Authenticate Request via Authorization header or ?secret= query param
  const url = new URL(request.url);
  const cronSecret = env.CRON_SECRET || 'business_market_cron_secret_2026';
  
  const authHeader = request.headers.get('Authorization');
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : url.searchParams.get('secret');

  // Verify secret if CRON_SECRET is configured
  if (env.CRON_SECRET && token !== cronSecret) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized: Invalid CRON_SECRET token provided.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // 2. Initialize Supabase client using Cloudflare Pages environment variables
  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://dyhpfgjogdiongmcmoti.supabase.co';
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

  const dbClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    console.log('[Cloudflare Pages Cron Endpoint] Running automation cron job...');

    // 3. Process due scheduled tasks and pending email queue
    const taskResult = await processScheduledTasks(dbClient, env);
    const emailResult = await processEmailQueue(dbClient, env);

    const responsePayload = {
      success: true,
      timestamp: new Date().toISOString(),
      tasks: {
        processed: taskResult.tasksProcessed,
        success: taskResult.success,
      },
      emailQueue: {
        processed: emailResult.processed,
        successCount: emailResult.successCount,
        failedCount: emailResult.failedCount,
      },
      logs: [...taskResult.logs, ...emailResult.logs],
    };

    return new Response(JSON.stringify(responsePayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Cloudflare Pages Cron Endpoint Error]:', err);

    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || String(err),
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
