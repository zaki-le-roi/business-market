import { supabase } from './supabase';

export interface WorkflowStep {
  ar: string;
  fr: string;
  status: 'idle' | 'running' | 'done';
}

export interface AutomationRule {
  id: string;
  name: string;
  name_ar?: string | null;
  name_fr?: string | null;
  description?: string | null;
  category: 'order' | 'inventory' | 'customer' | 'marketing' | 'notification' | string;
  trigger_type: string;
  trigger_config?: Record<string, unknown>;
  conditions?: string | null;
  actions?: string | null;
  is_workflow: boolean;
  workflow_steps?: WorkflowStep[];
  enabled: boolean;
  priority?: number;
  created_at?: string;
  updated_at?: string;
  last_executed_at?: string | null;
  next_execution_at?: string | null;
}

export interface AutomationExecution {
  id: string;
  rule_id?: string | null;
  rule_name?: string | null;
  status: 'success' | 'failure' | 'running' | 'warning' | 'pending' | 'idle';
  started_at: string;
  completed_at?: string | null;
  error_message?: string | null;
  execution_result?: Record<string, unknown>;
  trigger_info?: Record<string, unknown> | string;
  created_at?: string;
}

export interface AutomationLog {
  id: string;
  rule_id?: string | null;
  execution_id?: string | null;
  event_type: string;
  rule_name?: string | null;
  message: string;
  status: 'success' | 'failure' | 'warning' | 'info';
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ScheduledAutomationTask {
  id: string;
  rule_id?: string | null;
  name_ar: string;
  name_fr: string;
  schedule: string;
  schedule_type: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom' | string;
  scheduled_time?: string | null;
  status: 'idle' | 'running' | 'success' | 'failed' | 'pending' | string;
  retry_count: number;
  last_error?: string | null;
  last_run_at?: string | null;
  next_run_at?: string | null;
  completed_time?: string | null;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AutomationSettings {
  id?: string;
  global_enabled: boolean;
  default_retry_count: number;
  auto_cancel_hours: number;
  auto_confirm_orders: boolean;
  auto_generate_invoices: boolean;
  low_stock_threshold: number;
  out_of_stock_auto_disable: boolean;
  welcome_email_enabled: boolean;
  welcome_discount_percent: number;
  birthday_promo_enabled: boolean;
  admin_alert_email: string;
  admin_alert_sms: boolean;
  retry_max_attempts: number;
  created_at?: string;
  updated_at?: string;
}

export interface EmailQueueItem {
  id: string;
  recipient: string;
  subject: string;
  type: 'welcome' | 'invoice' | 'shipping' | 'alert' | 'promo' | string;
  status: 'pending' | 'sent' | 'failed' | string;
  attempts: number;
  error?: string | null;
  created_at: string;
  updated_at?: string;
}

/* ==========================================
   1. AUTOMATION RULES & WORKFLOWS
   ========================================== */

export async function fetchAutomationRules(): Promise<AutomationRule[]> {
  try {
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchAutomationRules error:', error.message);
      return [];
    }
    return (data || []) as AutomationRule[];
  } catch (err) {
    console.error('fetchAutomationRules exception:', err);
    return [];
  }
}

export async function saveAutomationRule(
  rule: Partial<AutomationRule>
): Promise<AutomationRule | null> {
  try {
    const payload = {
      ...rule,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('automation_rules')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      console.error('saveAutomationRule error:', error.message);
      throw error;
    }

    return data as AutomationRule;
  } catch (err) {
    console.error('saveAutomationRule exception:', err);
    throw err;
  }
}

export async function deleteAutomationRule(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('deleteAutomationRule error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('deleteAutomationRule exception:', err);
    return false;
  }
}

export async function toggleAutomationRuleStatus(
  id: string,
  enabled: boolean
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('automation_rules')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('toggleAutomationRuleStatus error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('toggleAutomationRuleStatus exception:', err);
    return false;
  }
}


/* ==========================================
   2. SCHEDULED AUTOMATION TASKS (CRON JOBS)
   ========================================== */

export async function fetchScheduledTasks(): Promise<ScheduledAutomationTask[]> {
  try {
    const { data, error } = await supabase
      .from('scheduled_automation_tasks')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('fetchScheduledTasks error:', error.message);
      return [];
    }
    return (data || []) as ScheduledAutomationTask[];
  } catch (err) {
    console.error('fetchScheduledTasks exception:', err);
    return [];
  }
}

export async function updateScheduledTask(
  id: string,
  updates: Partial<ScheduledAutomationTask>
): Promise<ScheduledAutomationTask | null> {
  try {
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('scheduled_automation_tasks')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('updateScheduledTask error:', error.message);
      return null;
    }
    return data as ScheduledAutomationTask;
  } catch (err) {
    console.error('updateScheduledTask exception:', err);
    return null;
  }
}

export async function toggleScheduledTaskStatus(
  id: string,
  enabled: boolean
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('scheduled_automation_tasks')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('toggleScheduledTaskStatus error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('toggleScheduledTaskStatus exception:', err);
    return false;
  }
}


/* ==========================================
   3. EMAIL & NOTIFICATION QUEUE
   ========================================== */

export async function fetchEmailQueue(): Promise<EmailQueueItem[]> {
  try {
    const { data, error } = await supabase
      .from('automation_email_queue')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('fetchEmailQueue error:', error.message);
      return [];
    }
    return (data || []) as EmailQueueItem[];
  } catch (err) {
    console.error('fetchEmailQueue exception:', err);
    return [];
  }
}

export async function retryEmailQueueItem(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('automation_email_queue')
      .update({
        status: 'sent',
        attempts: 1,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('retryEmailQueueItem error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('retryEmailQueueItem exception:', err);
    return false;
  }
}

export async function retryAllFailedEmails(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('automation_email_queue')
      .update({
        status: 'sent',
        attempts: 1,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'failed');

    if (error) {
      console.error('retryAllFailedEmails error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('retryAllFailedEmails exception:', err);
    return false;
  }
}


/* ==========================================
   4. AUTOMATION SETTINGS
   ========================================== */

export async function fetchAutomationSettings(): Promise<AutomationSettings> {
  const defaultSettings: AutomationSettings = {
    global_enabled: true,
    default_retry_count: 3,
    auto_cancel_hours: 24,
    auto_confirm_orders: true,
    auto_generate_invoices: true,
    low_stock_threshold: 5,
    out_of_stock_auto_disable: true,
    welcome_email_enabled: true,
    welcome_discount_percent: 10,
    birthday_promo_enabled: true,
    admin_alert_email: 'admin@moko.dz',
    admin_alert_sms: true,
    retry_max_attempts: 3,
  };

  try {
    const { data, error } = await supabase
      .from('automation_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.warn('fetchAutomationSettings returned no data or error:', error?.message);
      return defaultSettings;
    }

    return {
      ...defaultSettings,
      ...data,
    };
  } catch (err) {
    console.error('fetchAutomationSettings exception:', err);
    return defaultSettings;
  }
}

export async function saveAutomationSettings(
  settings: Partial<AutomationSettings>
): Promise<AutomationSettings | null> {
  try {
    // Check if a record exists
    const { data: existing } = await supabase
      .from('automation_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    const payload = {
      ...settings,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing?.id) {
      result = await supabase
        .from('automation_settings')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('automation_settings')
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      console.error('saveAutomationSettings error:', result.error.message);
      throw result.error;
    }

    return result.data as AutomationSettings;
  } catch (err) {
    console.error('saveAutomationSettings exception:', err);
    throw err;
  }
}


/* ==========================================
   5. AUTOMATION EXECUTIONS & LOGS
   ========================================== */

export async function fetchAutomationLogs(): Promise<AutomationLog[]> {
  try {
    const { data, error } = await supabase
      .from('automation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.warn('fetchAutomationLogs error:', error.message);
      return [];
    }

    return (data || []) as AutomationLog[];
  } catch (err) {
    console.error('fetchAutomationLogs exception:', err);
    return [];
  }
}

export async function createAutomationLog(
  log: Partial<AutomationLog>
): Promise<AutomationLog | null> {
  try {
    const payload = {
      rule_id: log.rule_id || null,
      execution_id: log.execution_id || null,
      event_type: log.event_type || 'AutomationEvent',
      rule_name: log.rule_name || '',
      message: log.message || '',
      status: log.status || 'success',
      metadata: log.metadata || {},
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('automation_logs')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('createAutomationLog error:', error.message);
      return null;
    }

    // Also write to general audit_logs for system traceability
    try {
      await supabase.from('audit_logs').insert([
        {
          module: 'automation',
          action: log.event_type || 'AutomationEvent',
          description: `${log.rule_name ? `[${log.rule_name}] ` : ''}${log.message}`,
          status: log.status === 'failure' ? 'failure' : 'success',
          details: log.metadata || {},
        },
      ]);
    } catch {
      // Non-blocking
    }

    return data as AutomationLog;
  } catch (err) {
    console.error('createAutomationLog exception:', err);
    return null;
  }
}

export async function createAutomationExecution(
  execution: Partial<AutomationExecution>
): Promise<AutomationExecution | null> {
  try {
    const payload = {
      rule_id: execution.rule_id || null,
      rule_name: execution.rule_name || '',
      status: execution.status || 'running',
      started_at: execution.started_at || new Date().toISOString(),
      completed_at: execution.completed_at || null,
      error_message: execution.error_message || '',
      execution_result: execution.execution_result || {},
      trigger_info: execution.trigger_info || {},
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('automation_executions')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('createAutomationExecution error:', error.message);
      return null;
    }
    return data as AutomationExecution;
  } catch (err) {
    console.error('createAutomationExecution exception:', err);
    return null;
  }
}

export async function updateAutomationExecution(
  id: string,
  updates: Partial<AutomationExecution>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('automation_executions')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('updateAutomationExecution error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('updateAutomationExecution exception:', err);
    return false;
  }
}
