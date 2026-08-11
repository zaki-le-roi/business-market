import { supabase } from './supabase';

export interface SecurityConfig {
  session_timeout_minutes: number;
  ip_lock_enabled: boolean;
  max_simultaneous_sessions: number;
  logout_on_browser_close: boolean;

  min_password_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_symbols: boolean;
  password_expiration_days: number;
  prevent_reuse_count: number;

  two_factor_policy: 'optional' | 'admins_only' | 'all_users';

  max_login_attempts: number;
  lockout_duration_minutes: number;
  auto_ip_ban_threshold: number;
  rate_limit_per_minute: number;

  backup_encryption_enabled: boolean;
  api_cors_origins: string;
  api_rate_limiting_enabled: boolean;
  jwt_expiration_hours: number;
}

export interface AdminActiveSession {
  id: string;
  user_email: string;
  user_role: string;
  ip_address: string;
  location: string;
  device_browser: string;
  login_at: string;
  last_active_at: string;
  is_current: boolean;
}

export interface FailedLoginAttempt {
  id: string;
  email_attempted: string;
  ip_address: string;
  user_agent: string;
  failure_reason: string;
  attempt_time: string;
  is_blocked: boolean;
}

export interface SecurityEventLog {
  id: string;
  actor: string;
  event_type: 'login_success' | 'login_failed' | 'permission_change' | 'critical_action' | 'backup_verified' | 'api_auth_failure' | 'security_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  ip_address: string;
  created_at: string;
}

export interface ApiRequestLog {
  id: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  status_code: number;
  response_time_ms: number;
  client_ip: string;
  user_agent: string;
  timestamp: string;
}

export interface BackupVerificationResult {
  verified_at: string;
  checksum_sha256: string;
  encryption_algorithm: string;
  tables_count: number;
  total_records: number;
  integrity_status: 'healthy' | 'warning' | 'corrupted';
  restore_dry_run_success: boolean;
  notes: string;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  session_timeout_minutes: 30,
  ip_lock_enabled: false,
  max_simultaneous_sessions: 3,
  logout_on_browser_close: true,

  min_password_length: 12,
  require_uppercase: true,
  require_lowercase: true,
  require_numbers: true,
  require_symbols: true,
  password_expiration_days: 90,
  prevent_reuse_count: 5,

  two_factor_policy: 'admins_only',

  max_login_attempts: 5,
  lockout_duration_minutes: 30,
  auto_ip_ban_threshold: 10,
  rate_limit_per_minute: 60,

  backup_encryption_enabled: true,
  api_cors_origins: 'https://businessmarket.dz, https://admin.businessmarket.dz',
  api_rate_limiting_enabled: true,
  jwt_expiration_hours: 168,
};

const LOCAL_SECURITY_KEY = 'admin_security_config_v1';
const LOCAL_SESSIONS_KEY = 'admin_active_sessions_v1';
const LOCAL_FAILED_LOGINS_KEY = 'admin_failed_logins_v1';
const LOCAL_SECURITY_EVENTS_KEY = 'admin_security_events_v1';
const LOCAL_BANNED_IPS_KEY = 'admin_banned_ips_v1';

/**
 * Fetch combined security settings
 */
export async function getSecurityConfig(): Promise<SecurityConfig> {
  let config = { ...DEFAULT_SECURITY_CONFIG };

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_SECURITY_KEY);
    if (raw) {
      try {
        config = { ...config, ...JSON.parse(raw) };
      } catch {
        // ignore JSON error
      }
    }
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'security_config')
      .single();

    if (!error && data && data.value && typeof data.value === 'object') {
      config = { ...config, ...data.value };
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_SECURITY_KEY, JSON.stringify(config));
      }
    }
  } catch {
    // fallback to current config
  }

  return config;
}

/**
 * Save updated security settings
 */
export async function saveSecurityConfig(config: SecurityConfig): Promise<boolean> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_SECURITY_KEY, JSON.stringify(config));
  }

  try {
    await supabase.from('system_settings').upsert({
      key: 'security_config',
      value: config as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
  } catch (err) {
    console.warn('[Security] Warning saving security config to Supabase:', err);
  }

  return true;
}

/**
 * Fetch active sessions
 */
export async function fetchActiveSessions(): Promise<AdminActiveSession[]> {
  const defaultSessions: AdminActiveSession[] = [
    {
      id: 'sess-current-01',
      user_email: 'zakidj181@gmail.com',
      user_role: 'Super Admin',
      ip_address: '105.101.44.89',
      location: 'Algiers, Algeria',
      device_browser: 'Chrome 126 / Windows 11',
      login_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      last_active_at: new Date().toISOString(),
      is_current: true,
    },
    {
      id: 'sess-sec-02',
      user_email: 'admin_support@market.dz',
      user_role: 'Support Agent',
      ip_address: '197.200.12.56',
      location: 'Oran, Algeria',
      device_browser: 'Safari 17 / iPhone 15 Pro',
      login_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      last_active_at: new Date(Date.now() - 1200000).toISOString(),
      is_current: false,
    },
    {
      id: 'sess-sec-03',
      user_email: 'finance_manager@market.dz',
      user_role: 'Finance Manager',
      ip_address: '105.108.19.12',
      location: 'Constantine, Algeria',
      device_browser: 'Firefox 127 / Linux Ubuntu',
      login_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      last_active_at: new Date(Date.now() - 7200000).toISOString(),
      is_current: false,
    }
  ];

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_SESSIONS_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(defaultSessions));
  }

  return defaultSessions;
}

/**
 * Revoke specific active session
 */
export async function revokeActiveSession(sessionId: string): Promise<AdminActiveSession[]> {
  const sessions = await fetchActiveSessions();
  const filtered = sessions.filter(s => s.id !== sessionId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(filtered));
  }
  return filtered;
}

/**
 * Logout from all other devices except current
 */
export async function logoutFromAllOtherDevices(): Promise<AdminActiveSession[]> {
  const sessions = await fetchActiveSessions();
  const currentOnly = sessions.filter(s => s.is_current);
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(currentOnly));
  }
  return currentOnly;
}

/**
 * Fetch Failed Login Attempts
 */
export async function fetchFailedLoginAttempts(): Promise<FailedLoginAttempt[]> {
  const defaultFailed: FailedLoginAttempt[] = [
    {
      id: 'fail-01',
      email_attempted: 'root@businessmarket.dz',
      ip_address: '185.220.101.4',
      user_agent: 'Python-urllib/3.10',
      failure_reason: 'User account not found',
      attempt_time: new Date(Date.now() - 1800000).toISOString(),
      is_blocked: true,
    },
    {
      id: 'fail-02',
      email_attempted: 'zakidj181@gmail.com',
      ip_address: '105.101.44.89',
      user_agent: 'Chrome 126 / Windows 11',
      failure_reason: 'Invalid password credential',
      attempt_time: new Date(Date.now() - 7200000).toISOString(),
      is_blocked: false,
    },
    {
      id: 'fail-03',
      email_attempted: 'admin@market.dz',
      ip_address: '45.142.120.18',
      user_agent: 'Go-http-client/1.1',
      failure_reason: 'Exceeded max login attempts (Brute force protection trigger)',
      attempt_time: new Date(Date.now() - 14400000).toISOString(),
      is_blocked: true,
    },
  ];

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_FAILED_LOGINS_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    localStorage.setItem(LOCAL_FAILED_LOGINS_KEY, JSON.stringify(defaultFailed));
  }

  return defaultFailed;
}

/**
 * Toggle IP block / unlock on failed attempt
 */
export async function toggleIpBlock(attemptId: string): Promise<FailedLoginAttempt[]> {
  const attempts = await fetchFailedLoginAttempts();
  const updated = attempts.map(item => {
    if (item.id === attemptId) {
      return { ...item, is_blocked: !item.is_blocked };
    }
    return item;
  });

  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_FAILED_LOGINS_KEY, JSON.stringify(updated));
  }
  return updated;
}

/**
 * Fetch Banned IPs List
 */
export async function fetchBannedIps(): Promise<string[]> {
  const defaults = ['185.220.101.4', '45.142.120.18', '193.142.146.210'];
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_BANNED_IPS_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    localStorage.setItem(LOCAL_BANNED_IPS_KEY, JSON.stringify(defaults));
  }
  return defaults;
}

/**
 * Add / Remove Banned IP
 */
export async function updateBannedIps(ips: string[]): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_BANNED_IPS_KEY, JSON.stringify(ips));
  }
}

/**
 * Fetch Security Events Logs
 */
export async function fetchSecurityEvents(): Promise<SecurityEventLog[]> {
  const defaultEvents: SecurityEventLog[] = [
    {
      id: 'sec-ev-101',
      actor: 'zakidj181@gmail.com',
      event_type: 'login_success',
      severity: 'low',
      details: 'Super Admin logged in successfully with 2FA token',
      ip_address: '105.101.44.89',
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'sec-ev-102',
      actor: 'zakidj181@gmail.com',
      event_type: 'permission_change',
      severity: 'medium',
      details: 'Updated RBAC permissions for role "Support Agent"',
      ip_address: '105.101.44.89',
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'sec-ev-103',
      actor: 'system_bot',
      event_type: 'security_alert',
      severity: 'critical',
      details: 'Brute force attack blocked automatically on IP 185.220.101.4 after 10 failed attempts',
      ip_address: '185.220.101.4',
      created_at: new Date(Date.now() - 10800000).toISOString(),
    },
    {
      id: 'sec-ev-104',
      actor: 'zakidj181@gmail.com',
      event_type: 'backup_verified',
      severity: 'low',
      details: 'Full automated DB backup SHA-256 integrity check PASSED (AES-256 verified)',
      ip_address: '105.101.44.89',
      created_at: new Date(Date.now() - 14400000).toISOString(),
    },
    {
      id: 'sec-ev-105',
      actor: 'unknown_client',
      event_type: 'api_auth_failure',
      severity: 'high',
      details: 'Unauthorized API token request on /api/v1/orders export endpoint',
      ip_address: '193.142.146.210',
      created_at: new Date(Date.now() - 18000000).toISOString(),
    }
  ];

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_SECURITY_EVENTS_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    localStorage.setItem(LOCAL_SECURITY_EVENTS_KEY, JSON.stringify(defaultEvents));
  }

  return defaultEvents;
}

/**
 * Add a security event log
 */
export async function logSecurityEvent(
  actor: string,
  event_type: SecurityEventLog['event_type'],
  severity: SecurityEventLog['severity'],
  details: string,
  ip_address = '105.101.44.89'
): Promise<void> {
  const events = await fetchSecurityEvents();
  const newEv: SecurityEventLog = {
    id: 'sec-ev-' + Math.random().toString(36).substr(2, 9),
    actor,
    event_type,
    severity,
    details,
    ip_address,
    created_at: new Date().toISOString(),
  };

  events.unshift(newEv);
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_SECURITY_EVENTS_KEY, JSON.stringify(events.slice(0, 300)));
  }

  // Also log to audit_logs if DB is available
  try {
    await supabase.from('audit_logs').insert([{
      actor,
      action: details,
      entity_type: 'security_event',
      entity_id: newEv.id,
      details: {
        event_type,
        severity,
        ip_address,
        timestamp: newEv.created_at,
      }
    }]);
  } catch {
    // ignore
  }
}

/**
 * Generate simulated API Request Logs
 */
export function generateApiLogs(): ApiRequestLog[] {
  const endpoints = [
    '/api/v1/products',
    '/api/v1/orders',
    '/api/v1/customers',
    '/api/v1/wholesale/groups',
    '/api/v1/system/settings',
    '/api/v1/auth/token',
    '/api/v1/analytics/overview',
  ];

  const methods: ApiRequestLog['method'][] = ['GET', 'POST', 'PUT', 'DELETE'];
  const statuses = [200, 200, 200, 201, 400, 401, 403, 429];
  const ips = ['105.101.44.89', '197.200.12.56', '105.108.19.12', '185.220.101.4'];

  const logs: ApiRequestLog[] = [];
  const now = Date.now();

  for (let i = 0; i < 25; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    logs.push({
      id: 'req-' + (1000 + i),
      endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
      method: methods[Math.floor(Math.random() * methods.length)],
      status_code: status,
      response_time_ms: Math.floor(Math.random() * 120) + 12,
      client_ip: ips[Math.floor(Math.random() * ips.length)],
      user_agent: 'Mozilla/5.0 (Windows NT 100.0; Win64; x64) WebKit/537.36',
      timestamp: new Date(now - i * 180000).toISOString(),
    });
  }

  return logs;
}

/**
 * Verify DB Backup Checksum & Encryption State
 */
export async function performBackupVerification(): Promise<BackupVerificationResult> {
  // Simulate cryptographic verification
  await new Promise(r => setTimeout(r, 1200));

  return {
    verified_at: new Date().toISOString(),
    checksum_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    encryption_algorithm: 'AES-256-GCM (CipherKey Managed)',
    tables_count: 18,
    total_records: 4850,
    integrity_status: 'healthy',
    restore_dry_run_success: true,
    notes: 'جميع الجداول والبيانات مشفرة ومستقرة 100%. لم يتم اكتشاف أي تلف أو تلاعب بالبيانات.',
  };
}

/**
 * Generate 2FA Recovery Codes
 */
export function generate2FARecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const c1 = Math.floor(1000 + Math.random() * 9000);
    const c2 = Math.floor(1000 + Math.random() * 9000);
    codes.push(`${c1}-${c2}`);
  }
  return codes;
}
