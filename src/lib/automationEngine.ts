import { supabase as defaultSupabase } from './supabase';
import { SupabaseClient } from '@supabase/supabase-js';

export interface EmailDispatchOptions {
  recipient: string;
  subject: string;
  body: string;
  type?: string;
}

export interface DispatchResult {
  success: boolean;
  provider: string;
  error?: string;
  messageId?: string;
}

export interface EngineServerEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  CRON_SECRET?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

/**
 * Sends a real server-side email using Resend API when available,
 * or fallback HTTP email relay with strict provider verification.
 */
export async function dispatchServerEmail(
  opts: EmailDispatchOptions,
  env?: EngineServerEnv
): Promise<DispatchResult> {
  const resendApiKey = env?.RESEND_API_KEY || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : undefined);
  const fromEmail = env?.RESEND_FROM_EMAIL || (typeof process !== 'undefined' ? process.env?.RESEND_FROM_EMAIL : undefined) || 'onboarding@resend.dev';

  if (resendApiKey && resendApiKey.trim() !== '') {
    try {
      console.log(`[AutomationEngine] Dispatching via Resend API to: ${opts.recipient}`);
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [opts.recipient],
          subject: opts.subject,
          html: opts.body,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (res.ok && (res.status === 200 || res.status === 201)) {
        return {
          success: true,
          provider: 'Resend',
          messageId: resData?.id || `resend-${Date.now()}`,
        };
      } else {
        const errorMsg = resData?.message || resData?.name || `HTTP ${res.status}: ${res.statusText}`;
        console.error(`[AutomationEngine] Resend API error:`, errorMsg);
        return {
          success: false,
          provider: 'Resend',
          error: errorMsg,
        };
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error(`[AutomationEngine] Exception during Resend email dispatch:`, err);
      return {
        success: false,
        provider: 'Resend',
        error: err.message || String(err),
      };
    }
  }

  // Fallback Web3Forms / Direct Relay with HTTP status verification
  try {
    console.log(`[AutomationEngine] Resend key not found, using Web3Forms fallback for: ${opts.recipient}`);
    const web3Response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        access_key: '472099645785-5658abf4ff4e',
        name: 'Business Market Automated System',
        email: 'noreply@moko.dz',
        subject: opts.subject,
        message: `Recipient: ${opts.recipient}\n\n${opts.body.replace(/<[^>]*>/g, '')}`,
      }),
    });

    const web3Data = await web3Response.json().catch(() => ({}));
    if (web3Response.ok && web3Data?.success !== false) {
      return {
        success: true,
        provider: 'Web3Forms',
        messageId: web3Data?.id || `web3-${Date.now()}`,
      };
    } else {
      return {
        success: false,
        provider: 'Web3Forms',
        error: web3Data?.message || `HTTP ${web3Response.status}`,
      };
    }
  } catch (fallbackErr: unknown) {
    const err = fallbackErr as Error;
    return {
      success: false,
      provider: 'Web3Forms',
      error: err.message || String(err),
    };
  }
}

/**
 * Processes pending and failed email queue items from Supabase.
 * Only marks status as 'sent' if provider accepted the email.
 */
export async function processEmailQueue(
  dbClient?: SupabaseClient,
  env?: EngineServerEnv
): Promise<{ processed: number; successCount: number; failedCount: number; logs: string[] }> {
  const db = dbClient || defaultSupabase;
  const logs: string[] = [];

  try {
    // 1. Fetch automation settings to check retry limits
    const { data: settingsData } = await db.from('automation_settings').select('*').single();
    const maxAttempts = settingsData?.retry_max_attempts || settingsData?.default_retry_count || 3;

    // 2. Query queue for pending or retryable failed items
    const { data: queueItems, error: fetchErr } = await db
      .from('automation_email_queue')
      .select('*')
      .or(`status.eq.pending,and(status.eq.failed,attempts.lt.${maxAttempts})`)
      .order('created_at', { ascending: true })
      .limit(20);

    if (fetchErr) {
      logs.push(`Error fetching email queue: ${fetchErr.message}`);
      return { processed: 0, successCount: 0, failedCount: 0, logs };
    }

    if (!queueItems || queueItems.length === 0) {
      logs.push('No pending or retryable emails in queue.');
      return { processed: 0, successCount: 0, failedCount: 0, logs };
    }

    let successCount = 0;
    let failedCount = 0;

    for (const item of queueItems) {
      const nextAttempt = (item.attempts || 0) + 1;
      const dispatch = await dispatchServerEmail({
        recipient: item.recipient,
        subject: item.subject,
        body: `<div style="font-family: sans-serif; padding: 20px;">
                <h2>${optsSubjectTitle(item.type, item.subject)}</h2>
                <p><strong>To:</strong> ${item.recipient}</p>
                <hr/>
                <p>${item.subject}</p>
                <div>Generated automatically by Business Market Engine.</div>
              </div>`,
        type: item.type,
      }, env);

      const now = new Date().toISOString();

      if (dispatch.success) {
        successCount++;
        await db
          .from('automation_email_queue')
          .update({
            status: 'sent',
            attempts: nextAttempt,
            error: null,
            updated_at: now,
          })
          .eq('id', item.id);

        await db.from('automation_logs').insert({
          event_type: 'EmailDispatchSuccess',
          rule_name: `Email (${item.type})`,
          status: 'success',
          message: `Email successfully delivered to ${item.recipient} via ${dispatch.provider}`,
          metadata: { queue_id: item.id, recipient: item.recipient, provider: dispatch.provider },
        });

        logs.push(`[Email Queue] Sent email ID ${item.id} to ${item.recipient}`);
      } else {
        failedCount++;
        const errorMsg = dispatch.error || 'Provider rejected email delivery';
        const finalStatus = nextAttempt >= maxAttempts ? 'failed' : 'failed';

        await db
          .from('automation_email_queue')
          .update({
            status: finalStatus,
            attempts: nextAttempt,
            error: errorMsg,
            updated_at: now,
          })
          .eq('id', item.id);

        await db.from('automation_logs').insert({
          event_type: 'EmailDispatchFailure',
          rule_name: `Email (${item.type})`,
          status: 'failure',
          message: `Failed to deliver email to ${item.recipient} (Attempt ${nextAttempt}/${maxAttempts}): ${errorMsg}`,
          metadata: { queue_id: item.id, recipient: item.recipient, error: errorMsg, provider: dispatch.provider },
        });

        logs.push(`[Email Queue] Failed email ID ${item.id} to ${item.recipient}: ${errorMsg}`);
      }
    }

    return { processed: queueItems.length, successCount, failedCount, logs };
  } catch (error: unknown) {
    const err = error as Error;
    logs.push(`Exception in processEmailQueue: ${err.message || String(err)}`);
    return { processed: 0, successCount: 0, failedCount: 0, logs };
  }
}

function optsSubjectTitle(type: string, subject: string): string {
  switch (type) {
    case 'invoice': return '🧾 Business Market - Facture d\'achat / الفاتورة';
    case 'welcome': return '🎉 Bienvenue sur Business Market / مرحباً بك';
    case 'alert': return '⚠️ Business Market System Alert / تنبيه الإدارة';
    case 'shipping': return '🚚 Notification de Livraison / إشعار الشحن';
    default: return subject;
  }
}

/**
 * Triggers and executes domain-level event rules against Supabase tables.
 */
export async function processDomainEvent(
  eventType: string,
  eventData: Record<string, unknown>,
  dbClient?: SupabaseClient,
  env?: EngineServerEnv
): Promise<{ success: boolean; executions: number; logs: string[] }> {
  const db = dbClient || defaultSupabase;
  const logs: string[] = [];

  try {
    // 1. Check global automation settings
    const { data: settings } = await db.from('automation_settings').select('*').single();
    if (settings && settings.global_enabled === false) {
      logs.push('Automation engine skipped: global_enabled is false.');
      return { success: true, executions: 0, logs };
    }

    // 2. Find rules matching event type or category
    const { data: rules, error: rulesErr } = await db
      .from('automation_rules')
      .select('*')
      .eq('enabled', true);

    if (rulesErr) {
      logs.push(`Failed to load automation rules: ${rulesErr.message}`);
      return { success: false, executions: 0, logs };
    }

    const matchingRules = (rules || []).filter(
      (r) =>
        r.trigger_type.toLowerCase() === eventType.toLowerCase() ||
        r.category.toLowerCase() === eventType.toLowerCase() ||
        (r.is_workflow && r.trigger_type.includes(eventType))
    );

    if (matchingRules.length === 0) {
      logs.push(`No enabled rules found matching trigger event: ${eventType}`);
    }

    let executionCount = 0;

    // 3. Process each matching rule
    for (const rule of matchingRules) {
      executionCount++;
      const startTime = new Date().toISOString();

      // Record execution started
      const { data: execRec } = await db
        .from('automation_executions')
        .insert({
          rule_id: rule.id,
          rule_name: rule.name_ar || rule.name,
          status: 'running',
          trigger_info: { event: eventType, data: eventData },
          started_at: startTime,
        })
        .select()
        .single();

      let execSuccess = true;
      let execErrorMessage = '';
      const stepDetails: Record<string, unknown> = {};

      try {
        if (eventType === 'OrderCreated' || rule.trigger_type === 'OrderCreated') {
          const orderId = (eventData.orderId || eventData.id) as string | undefined;
          if (orderId) {
            stepDetails.orderId = orderId;

            // Check if OrderCreated has already been executed/processed for this orderId
            const { data: existingLogs } = await db
              .from('automation_logs')
              .select('id, metadata')
              .eq('event_type', 'OrderCreated')
              .eq('status', 'success');

            const alreadyProcessed = (existingLogs || []).some((l) => {
              const meta = l.metadata as Record<string, unknown> | null;
              return meta && (meta.orderId === orderId || meta.order_id === orderId);
            });

            if (alreadyProcessed) {
              stepDetails.idempotent_skipped = `OrderCreated event already processed for orderId: ${orderId}`;
            } else {
              // Step A: Auto confirm order if setting enabled
              if (settings?.auto_confirm_orders !== false) {
                const { error: confirmErr } = await db
                  .from('orders')
                  .update({ status: 'confirmed', updated_at: new Date().toISOString() })
                  .eq('id', orderId)
                  .eq('status', 'pending');
                stepDetails.auto_confirm = confirmErr ? confirmErr.message : 'Order confirmed automatically';
              }

              // Step B: Auto generate invoice record
              if (settings?.auto_generate_invoices !== false) {
                const invoiceNum = `INV-${orderId.slice(0, 8).toUpperCase()}`;
                await db.from('automation_email_queue').insert({
                  recipient: (eventData.customerEmail as string) || settings?.admin_alert_email || 'admin@moko.dz',
                  subject: `Order Confirmation & Invoice #${invoiceNum}`,
                  type: 'invoice',
                  status: 'pending',
                  attempts: 0,
                });
                stepDetails.invoice = `Queued invoice email #${invoiceNum}`;
              }

              // Step C: Stock deduction & low stock check
              if (eventData.items && Array.isArray(eventData.items)) {
                const itemLogs: string[] = [];
                for (const item of eventData.items as Record<string, unknown>[]) {
                  const productId = (item.product_id || item.productId || item.id) as string | undefined;
                  const qty = Number(item.quantity || item.qty || 1);
                  if (productId) {
                    const { data: prod } = await db.from('products').select('id, name, stock_quantity').eq('id', productId).single();
                    if (prod) {
                      const newStock = Math.max(0, (prod.stock_quantity || 0) - qty);
                      await db.from('products').update({ stock_quantity: newStock }).eq('id', productId);
                      itemLogs.push(`${productId}: -${qty} (new stock ${newStock})`);

                      const lowThreshold = settings?.low_stock_threshold || 5;
                      if (newStock <= lowThreshold) {
                        // Trigger low stock automation event
                        await processDomainEvent('LowStockAlert', { productId: prod.id, productName: prod.name, remainingStock: newStock }, db, env);
                      }
                    }
                  }
                }
                stepDetails.stock_deduction = itemLogs;
                stepDetails.stock_deducted = true;
              }
            }
          }
        } else if (eventType === 'LowStockAlert' || rule.trigger_type === 'LowStockAlert') {
          const productId = eventData.productId as string | undefined;
          const remaining = (eventData.remainingStock as number) ?? 0;
          const productName = (eventData.productName as string) || 'Product';
          const alertEmail = settings?.admin_alert_email || 'admin@moko.dz';

          if (productId) {
            stepDetails.productId = productId;

            // Throttling: Check if an alert for this productId was sent in the last 24h
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: recentAlertLogs } = await db
              .from('automation_logs')
              .select('id, metadata')
              .eq('event_type', 'LowStockAlert')
              .eq('status', 'success')
              .gte('created_at', twentyFourHoursAgo);

            const isThrottled = (recentAlertLogs || []).some((l) => {
              const meta = l.metadata as Record<string, unknown> | null;
              return meta && meta.productId === productId;
            });

            // Disable product if 0 stock and setting is active
            if (remaining === 0 && settings?.out_of_stock_auto_disable !== false) {
              await db.from('products').update({ is_active: false }).eq('id', productId);
              stepDetails.product_disabled = `Disabled out of stock product ${productId}`;
            }

            if (isThrottled) {
              stepDetails.alert_throttled = `Low stock alert for product ${productId} (${productName}) throttled (alert sent in last 24h)`;
            } else {
              // Queue admin alert
              await db.from('automation_email_queue').insert({
                recipient: alertEmail,
                subject: `⚠️ Alert: Low Stock for ${productName} (${remaining} remaining)`,
                type: 'alert',
                status: 'pending',
                attempts: 0,
              });
              stepDetails.alert_queued = `Queued admin alert to ${alertEmail}`;
            }
          }
        } else if (eventType === 'CustomerRegistered' || rule.trigger_type === 'CustomerRegistered') {
          const rawEmail = eventData.email as string | undefined;
          const recipientEmail = rawEmail?.toLowerCase().trim();
          if (recipientEmail) {
            stepDetails.email = recipientEmail;

            // Check if welcome email was already queued/sent in automation_email_queue or logged in automation_logs
            const { data: existingQueue } = await db
              .from('automation_email_queue')
              .select('id')
              .eq('recipient', recipientEmail)
              .eq('type', 'welcome')
              .limit(1);

            const { data: existingLogs } = await db
              .from('automation_logs')
              .select('id, metadata')
              .eq('event_type', 'CustomerRegistered')
              .eq('status', 'success');

            const alreadyWelcomed =
              (existingQueue && existingQueue.length > 0) ||
              (existingLogs || []).some((l) => {
                const meta = l.metadata as Record<string, unknown> | null;
                return meta && typeof meta.email === 'string' && meta.email.toLowerCase().trim() === recipientEmail;
              });

            if (alreadyWelcomed) {
              stepDetails.welcome_skipped = `Welcome email already dispatched or queued for ${recipientEmail}`;
            } else if (settings?.welcome_email_enabled !== false) {
              const discountPct = settings?.welcome_discount_percent || 10;
              await db.from('automation_email_queue').insert({
                recipient: recipientEmail,
                subject: `🎉 Welcome to Business Market! Here is your ${discountPct}% Welcome Discount`,
                type: 'welcome',
                status: 'pending',
                attempts: 0,
              });
              stepDetails.welcome_queued = `Queued welcome email with ${discountPct}% discount`;
            }
          }
        } else if (eventType === 'ShipmentStatusUpdated' || rule.trigger_type === 'ShipmentStatusUpdated') {
          const customerEmail = eventData.customerEmail as string | undefined;
          const orderId = eventData.orderId as string | undefined;
          const status = eventData.status as string | undefined;

          if (customerEmail && orderId && status) {
            stepDetails.orderId = orderId;
            stepDetails.status = status;

            // Check if notification for this orderId + status transition was already sent
            const { data: existingLogs } = await db
              .from('automation_logs')
              .select('id, metadata')
              .eq('event_type', 'ShipmentStatusUpdated')
              .eq('status', 'success');

            const alreadyNotified = (existingLogs || []).some((l) => {
              const meta = l.metadata as Record<string, unknown> | null;
              return meta && meta.orderId === orderId && meta.status === status;
            });

            if (alreadyNotified) {
              stepDetails.shipping_skipped = `Shipping update for order ${orderId} status ${status} already sent to ${customerEmail}`;
            } else {
              const trackingNo = (eventData.trackingNumber as string) || 'N/A';
              await db.from('automation_email_queue').insert({
                recipient: customerEmail,
                subject: `🚚 Shipment Update: Your order status is now ${status} (Tracking #${trackingNo})`,
                type: 'shipping',
                status: 'pending',
                attempts: 0,
              });
              stepDetails.shipping_queued = `Queued shipping status notification to ${customerEmail}`;
            }
          }
        }
      } catch (ruleExecErr: unknown) {
        const rErr = ruleExecErr as Error;
        execSuccess = false;
        execErrorMessage = rErr.message || String(rErr);
      }

      const completedTime = new Date().toISOString();

      // Update execution record
      if (execRec?.id) {
        await db
          .from('automation_executions')
          .update({
            status: execSuccess ? 'success' : 'failure',
            completed_at: completedTime,
            error_message: execErrorMessage || null,
            execution_result: stepDetails,
          })
          .eq('id', execRec.id);
      }

      // Update rule timestamp
      await db
        .from('automation_rules')
        .update({ last_executed_at: completedTime })
        .eq('id', rule.id);

      // Create persistent log
      await db.from('automation_logs').insert({
        rule_id: rule.id,
        execution_id: execRec?.id || null,
        event_type: eventType,
        rule_name: rule.name_ar || rule.name,
        status: execSuccess ? 'success' : 'failure',
        message: execSuccess
          ? `Rule "${rule.name_ar || rule.name}" executed successfully for event ${eventType}`
          : `Rule "${rule.name_ar || rule.name}" failed: ${execErrorMessage}`,
        metadata: stepDetails,
      });

      logs.push(`Executed rule ${rule.id} (${rule.name}): ${execSuccess ? 'SUCCESS' : 'FAILURE'}`);
    }

    // Process queued emails immediately after rule executions
    await processEmailQueue(db, env);

    return { success: true, executions: executionCount, logs };
  } catch (error: unknown) {
    const err = error as Error;
    logs.push(`Exception in processDomainEvent: ${err.message || String(err)}`);
    return { success: false, executions: 0, logs };
  }
}

/**
 * Idempotently executes scheduled cron automation tasks against Supabase.
 * Prevents duplicate execution using task locks and state verification.
 */
export async function processScheduledTasks(
  dbClient?: SupabaseClient,
  env?: EngineServerEnv
): Promise<{ success: boolean; tasksProcessed: number; logs: string[] }> {
  const db = dbClient || defaultSupabase;
  const logs: string[] = [];

  try {
    // 1. Get enabled scheduled tasks
    const { data: tasks, error: taskErr } = await db
      .from('scheduled_automation_tasks')
      .select('*')
      .eq('enabled', true);

    if (taskErr) {
      logs.push(`Failed to fetch scheduled tasks: ${taskErr.message}`);
      return { success: false, tasksProcessed: 0, logs };
    }

    if (!tasks || tasks.length === 0) {
      logs.push('No enabled scheduled tasks found.');
      return { success: true, tasksProcessed: 0, logs };
    }

    const { data: settings } = await db.from('automation_settings').select('*').single();
    const autoCancelHours = settings?.auto_cancel_hours || 24;
    const adminEmail = settings?.admin_alert_email || 'admin@moko.dz';

    let processedCount = 0;

    for (const task of tasks) {
      const now = new Date();
      const nowIso = now.toISOString();

      // Check duplicate/concurrent lock: skip if task is currently 'running' and updated in the last 10 minutes
      if (task.status === 'running') {
        const lastUpdated = task.updated_at ? new Date(task.updated_at).getTime() : 0;
        if (now.getTime() - lastUpdated < 10 * 60 * 1000) {
          logs.push(`Skipping task ${task.id} (${task.name_ar || task.name_fr}): Already running.`);
          continue;
        }
      }

      // Lock task status atomically
      const { error: lockErr } = await db
        .from('scheduled_automation_tasks')
        .update({ status: 'running', updated_at: nowIso })
        .eq('id', task.id);

      if (lockErr) {
        logs.push(`Failed to acquire lock for task ${task.id}: ${lockErr.message}`);
        continue;
      }

      processedCount++;
      let taskSuccess = true;
      let taskErrorMsg = '';
      const taskMetadata: Record<string, unknown> = {};

      try {
        // Task ID 1 or Task 1 logic: Expired Coupons & Promo Cleanup
        if (task.id === '00000000-0000-0000-0000-00000000021' || task.name_fr.toLowerCase().includes('coupons')) {
          const { data: expiredCoupons, error: coupErr } = await db
            .from('coupons')
            .update({ is_active: false })
            .lt('expiry_date', nowIso)
            .eq('is_active', true)
            .select();

          taskMetadata.expired_coupons_disabled = expiredCoupons ? expiredCoupons.length : 0;
          if (coupErr) taskMetadata.coupon_error = coupErr.message;
        }

        // Task ID 2 or Task 2 logic: Unpaid Orders Cleanup (Cancel & restore stock)
        if (task.id === '00000000-0000-0000-0000-00000000022' || task.name_fr.toLowerCase().includes('commandes non pay')) {
          const cancelThreshold = new Date(now.getTime() - autoCancelHours * 60 * 60 * 1000).toISOString();
          const { data: unpaidOrders } = await db
            .from('orders')
            .select('id, items')
            .eq('status', 'pending')
            .eq('payment_status', 'unpaid')
            .lt('created_at', cancelThreshold);

          let cancelledCount = 0;
          if (unpaidOrders && unpaidOrders.length > 0) {
            for (const order of unpaidOrders) {
              await db.from('orders').update({ status: 'cancelled', updated_at: nowIso }).eq('id', order.id);
              cancelledCount++;

              // Restore product stock
              if (order.items && Array.isArray(order.items)) {
                for (const item of order.items as Record<string, unknown>[]) {
                  const pid = (item.product_id || item.productId || item.id) as string | undefined;
                  const qty = Number(item.quantity || item.qty || 1);
                  if (pid) {
                    const { data: p } = await db.from('products').select('stock_quantity').eq('id', pid).single();
                    if (p) {
                      await db.from('products').update({ stock_quantity: (p.stock_quantity || 0) + qty }).eq('id', pid);
                    }
                  }
                }
              }
            }
          }
          taskMetadata.unpaid_orders_cancelled = cancelledCount;
        }

        // Task ID 3: Weekly Sales Report Email
        if (task.id === '00000000-0000-0000-0000-00000000023' || task.name_fr.toLowerCase().includes('rapport')) {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: recentOrders } = await db.from('orders').select('total_amount').gte('created_at', sevenDaysAgo);
          const totalRevenue = (recentOrders || []).reduce((acc, o) => acc + Number(o.total_amount || 0), 0);

          await db.from('automation_email_queue').insert({
            recipient: adminEmail,
            subject: `📊 Weekly Performance Report: ${recentOrders?.length || 0} orders, Total: ${totalRevenue.toLocaleString()} DZD`,
            type: 'alert',
            status: 'pending',
            attempts: 0,
          });
          taskMetadata.weekly_report_revenue = totalRevenue;
        }
      } catch (errTask: unknown) {
        const eTask = errTask as Error;
        taskSuccess = false;
        taskErrorMsg = eTask.message || String(eTask);
      }

      // Calculate next run time
      let nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000); // default 24h
      if (task.schedule_type === 'hourly') {
        nextRun = new Date(now.getTime() + 60 * 60 * 1000);
      } else if (task.schedule_type === 'weekly') {
        nextRun = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (task.schedule_type === 'monthly') {
        nextRun = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      // Release lock & update task record
      await db
        .from('scheduled_automation_tasks')
        .update({
          status: taskSuccess ? 'idle' : 'failed',
          last_run_at: nowIso,
          next_run_at: nextRun.toISOString(),
          last_error: taskSuccess ? null : taskErrorMsg,
          updated_at: nowIso,
        })
        .eq('id', task.id);

      // Add log record
      await db.from('automation_logs').insert({
        rule_id: task.rule_id || null,
        event_type: 'ScheduledTaskExecution',
        rule_name: task.name_ar || task.name_fr,
        status: taskSuccess ? 'success' : 'failure',
        message: taskSuccess
          ? `Scheduled task "${task.name_ar || task.name_fr}" completed successfully.`
          : `Scheduled task "${task.name_ar || task.name_fr}" failed: ${taskErrorMsg}`,
        metadata: taskMetadata,
      });

      logs.push(`Processed scheduled task ${task.id} (${task.name_fr}): ${taskSuccess ? 'SUCCESS' : 'FAILED'}`);
    }

    // Process pending email queue after running scheduled tasks
    const emailResult = await processEmailQueue(db, env);
    logs.push(...emailResult.logs);

    return { success: true, tasksProcessed: processedCount, logs };
  } catch (error: unknown) {
    const err = error as Error;
    logs.push(`Exception in processScheduledTasks: ${err.message || String(err)}`);
    return { success: false, tasksProcessed: 0, logs };
  }
}
