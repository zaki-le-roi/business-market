import { supabase } from './supabase';

export interface AdminRole {
  id: string;
  name: string;
  description?: string;
  is_custom?: boolean;
  is_super_admin?: boolean;
  permissions: string[];
  created_at?: string;
}

export interface AdminProfile {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  role_id: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface AdminLoginHistory {
  id: string;
  admin_id: string;
  email: string;
  device: string;
  browser: string;
  ip_address: string;
  created_at: string;
  is_active: boolean;
}

export interface AdminAuditLog {
  id: string;
  performed_by: string; // Actor email
  action: string;
  affected_record: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// 17 Required Permission Modules
export interface PermissionModule {
  id: string;
  name: { ar: string; fr: string; en: string };
}

export const PERMISSION_MODULES: PermissionModule[] = [
  { id: 'dashboard', name: { ar: 'لوحة التحكم الرئيسية', fr: 'Tableau de bord', en: 'Dashboard' } },
  { id: 'products', name: { ar: 'المنتجات والمخزون', fr: 'Produits & Stock', en: 'Products & Inventory' } },
  { id: 'categories', name: { ar: 'الفئات والتصنيفات', fr: 'Catégories', en: 'Categories' } },
  { id: 'retail_customers', name: { ar: 'عملاء التجزئة B2C', fr: 'Clients détail B2C', en: 'Retail Customers' } },
  { id: 'wholesale_customers', name: { ar: 'عملاء الجملة B2B', fr: 'Clients gros B2B', en: 'Wholesale Customers' } },
  { id: 'orders', name: { ar: 'الطلبات والمبيعات', fr: 'Commandes & Ventes', en: 'Orders & Sales' } },
  { id: 'shipping', name: { ar: 'الشحن والتوصيل', fr: 'Expédition & Livraison', en: 'Shipping & Delivery' } },
  { id: 'marketing', name: { ar: 'التسويق والكوبونات', fr: 'Marketing & Coupons', en: 'Marketing & Coupons' } },
  { id: 'finance', name: { ar: 'المالية والحسابات', fr: 'Finance & Comptabilité', en: 'Finance & Accounts' } },
  { id: 'support', name: { ar: 'الدعم الفني والخدمة', fr: 'Support Client', en: 'Support & Tickets' } },
  { id: 'content', name: { ar: 'المحتوى والمدونة CMS', fr: 'Contenu & CMS', en: 'Content & CMS' } },
  { id: 'banners', name: { ar: 'الإعلانات والبنرات', fr: 'Bannières', en: 'Banners' } },
  { id: 'system', name: { ar: 'إعدادات النظام العامة', fr: 'Paramètres Système', en: 'System Settings' } },
  { id: 'security', name: { ar: 'الأمان وحماية الحسابات', fr: 'Sécurité & Accès', en: 'Security & Access' } },
  { id: 'monitoring', name: { ar: 'المراقبة والسجلات', fr: 'Surveillance & Logs', en: 'Monitoring & Logs' } },
  { id: 'automation', name: { ar: 'الأتمتة وسير العمل', fr: 'Automation', en: 'Automation' } },
  { id: 'analytics', name: { ar: 'التحليلات والتقارير', fr: 'Analytique & Rapports', en: 'Analytics & Reports' } },
];

export const PERMISSION_ACTIONS = [
  { id: 'view', name: { ar: 'عرض', fr: 'Voir', en: 'View' } },
  { id: 'create', name: { ar: 'إنشاء', fr: 'Créer', en: 'Create' } },
  { id: 'edit', name: { ar: 'تعديل', fr: 'Éditer', en: 'Edit' } },
  { id: 'delete', name: { ar: 'حذف', fr: 'Supprimer', en: 'Delete' } },
  { id: 'export', name: { ar: 'تصدير', fr: 'Exporter', en: 'Export' } },
  { id: 'import', name: { ar: 'استيراد', fr: 'Importer', en: 'Import' } },
  { id: 'approve', name: { ar: 'اعتماد', fr: 'Approuver', en: 'Approve' } },
];

// Helper to generate full permission keys for a module
export function getAllModulePermissions(moduleId: string): string[] {
  return PERMISSION_ACTIONS.map(act => `${moduleId}:${act.id}`);
}

// Generate all possible permissions
export const ALL_FULL_PERMISSIONS: string[] = PERMISSION_MODULES.flatMap(m =>
  getAllModulePermissions(m.id)
);

// Backward compatible ALL_PERMISSIONS list for legacy selectors
export const ALL_PERMISSIONS = [
  { id: 'manage_products', label: { ar: 'إدارة المنتجات', fr: 'Gérer les produits', en: 'Manage products' } },
  { id: 'manage_categories', label: { ar: 'إدارة الفئات', fr: 'Gérer les catégories', en: 'Manage categories' } },
  { id: 'manage_orders', label: { ar: 'إدارة الطلبات', fr: 'Gérer les commandes', en: 'Manage orders' } },
  { id: 'manage_customers', label: { ar: 'إدارة العملاء', fr: 'Gérer les clients', en: 'Manage customers' } },
  { id: 'manage_wholesale_customers', label: { ar: 'إدارة عملاء الجملة B2B', fr: 'Gérer les clients de gros B2B', en: 'Manage wholesale customers' } },
  { id: 'manage_discounts', label: { ar: 'إدارة الخصومات والأسعار B2B', fr: 'Gérer les remises et tarifs B2B', en: 'Manage discounts and prices' } },
  { id: 'manage_coupons', label: { ar: 'إدارة قسائم التخفيض', fr: 'Gérer les coupons', en: 'Manage coupons' } },
  { id: 'manage_shipping', label: { ar: 'إدارة الشحن وتكاليف الولايات', fr: 'Gérer l\'expédition', en: 'Manage shipping' } },
  { id: 'manage_reports', label: { ar: 'عرض التقارير المالية والتحليلات', fr: 'Gérer les rapports financiers', en: 'Manage reports and finance' } },
  { id: 'manage_settings', label: { ar: 'إدارة الإعدادات والصفحات (CMS)', fr: 'Gérer les paramètres & CMS', en: 'Manage settings & CMS' } },
  { id: 'manage_administrators', label: { ar: 'إدارة المسؤولين والصلاحيات والأدوار', fr: 'Gérer les administrateurs & rôles', en: 'Manage administrators & roles' } },
];

export const DEFAULT_ROLES: AdminRole[] = [
  {
    id: 'super-admin',
    name: 'Super Administrator',
    description: 'وصول مطلق وشفاف لجميع وحدات النظام بدون استثناء',
    permissions: ALL_FULL_PERMISSIONS.concat(ALL_PERMISSIONS.map(p => p.id)),
  },
  {
    id: 'admin',
    name: 'Administrator',
    description: 'صلاحيات كاملة لإدارة المتجر مع عدم صلاحية تعديل السوبر أدمن',
    permissions: ALL_FULL_PERMISSIONS.filter(p => !p.startsWith('security:delete') && !p.startsWith('system:delete')),
  },
  {
    id: 'store-manager',
    name: 'Store Manager',
    description: 'إدارة شاملة للمنتجات، الطلبات، العملاء، والتسويق',
    permissions: [
      ...getAllModulePermissions('dashboard'),
      ...getAllModulePermissions('products'),
      ...getAllModulePermissions('categories'),
      ...getAllModulePermissions('retail_customers'),
      ...getAllModulePermissions('wholesale_customers'),
      ...getAllModulePermissions('orders'),
      ...getAllModulePermissions('shipping'),
      ...getAllModulePermissions('marketing'),
      ...getAllModulePermissions('banners'),
      'manage_products', 'manage_categories', 'manage_orders', 'manage_customers',
      'manage_wholesale_customers', 'manage_discounts', 'manage_coupons', 'manage_shipping'
    ],
  },
  {
    id: 'support',
    name: 'Customer Support',
    description: 'خدمة العملاء، معالجة استفسارات الشحن والطلبات',
    permissions: [
      ...getAllModulePermissions('dashboard'),
      ...getAllModulePermissions('retail_customers'),
      ...getAllModulePermissions('support'),
      'orders:view', 'orders:edit', 'shipping:view',
      'manage_customers'
    ],
  },
  {
    id: 'finance',
    name: 'Finance & Accountant',
    description: 'إدارة الحسابات والتقارير المالية والتحليلات والمدفوعات',
    permissions: [
      ...getAllModulePermissions('dashboard'),
      ...getAllModulePermissions('finance'),
      ...getAllModulePermissions('analytics'),
      'orders:view', 'orders:export', 'wholesale_customers:view',
      'manage_reports'
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing Specialist',
    description: 'إدارة الحملات الترويجية، الخصومات والبنرات والمحتوى',
    permissions: [
      ...getAllModulePermissions('dashboard'),
      ...getAllModulePermissions('marketing'),
      ...getAllModulePermissions('banners'),
      ...getAllModulePermissions('content'),
      ...getAllModulePermissions('analytics'),
      'manage_discounts', 'manage_coupons'
    ],
  },
  {
    id: 'warehouse',
    name: 'Warehouse Manager',
    description: 'متابعة المخزون، معالجة الطلبات والتسليم لشركات الشحن',
    permissions: [
      ...getAllModulePermissions('dashboard'),
      ...getAllModulePermissions('products'),
      ...getAllModulePermissions('orders'),
      ...getAllModulePermissions('shipping'),
      'manage_products', 'manage_orders', 'manage_shipping'
    ],
  },
  {
    id: 'content-manager',
    name: 'Content Manager',
    description: 'إدارة مقالات المدونة، الصفحات التعريفية والبنرات',
    permissions: [
      ...getAllModulePermissions('dashboard'),
      ...getAllModulePermissions('content'),
      ...getAllModulePermissions('banners'),
      ...getAllModulePermissions('categories')
    ],
  }
];

// Fallback Mock State Keys for LocalStorage
const MOCK_ROLES_KEY = 'mock_admin_roles';
const MOCK_PROFILES_KEY = 'mock_admin_profiles';
const MOCK_LOGS_KEY = 'mock_admin_audit_logs';
const MOCK_LOGIN_HISTORY_KEY = 'mock_admin_login_history';

function initMockStorage() {
  if (!localStorage.getItem(MOCK_ROLES_KEY)) {
    localStorage.setItem(MOCK_ROLES_KEY, JSON.stringify(DEFAULT_ROLES));
  }
  if (!localStorage.getItem(MOCK_PROFILES_KEY)) {
    const initialProfiles: AdminProfile[] = [
      {
        id: 'super-admin-uid-zaki',
        name: 'Zaki SuperAdmin',
        email: 'zakidj181@gmail.com',
        phone: '+213 550 12 34 56',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        role_id: 'super-admin',
        is_active: true,
        last_login_at: new Date().toISOString(),
        created_at: new Date(Date.now() - 30 * 86400000).toISOString()
      },
      {
        id: 'super-admin-uid-zaki-typo',
        name: 'Zaki Admin Backup',
        email: 'zakidj181@gmial.com',
        phone: '+213 550 12 34 57',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        role_id: 'super-admin',
        is_active: true,
        last_login_at: new Date(Date.now() - 3600000).toISOString(),
        created_at: new Date(Date.now() - 25 * 86400000).toISOString()
      },
      {
        id: 'admin-profile-karim',
        name: 'Karim Mansouri',
        email: 'k.mansouri@businessmarket.dz',
        phone: '+213 661 22 33 44',
        avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        role_id: 'store-manager',
        is_active: true,
        last_login_at: new Date(Date.now() - 7200000).toISOString(),
        created_at: new Date(Date.now() - 20 * 86400000).toISOString()
      },
      {
        id: 'admin-profile-amina',
        name: 'Amina Saidi',
        email: 'a.saidi@businessmarket.dz',
        phone: '+213 770 99 88 77',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        role_id: 'support',
        is_active: true,
        last_login_at: new Date(Date.now() - 14400000).toISOString(),
        created_at: new Date(Date.now() - 15 * 86400000).toISOString()
      },
      {
        id: 'admin-profile-yacine',
        name: 'Yacine Benali',
        email: 'y.benali@businessmarket.dz',
        phone: '+213 552 44 55 66',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
        role_id: 'finance',
        is_active: false,
        last_login_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        created_at: new Date(Date.now() - 10 * 86400000).toISOString()
      }
    ];
    localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(initialProfiles));
  }
  if (!localStorage.getItem(MOCK_LOGS_KEY)) {
    const initialAuditLogs: AdminAuditLog[] = [
      {
        id: 'log-101',
        performed_by: 'zakidj181@gmail.com',
        action: 'تعديل صلاحيات دور مدير المتجر (Store Manager)',
        affected_record: 'store-manager',
        ip_address: '105.101.42.18 (Algiers, DZ)',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        created_at: new Date(Date.now() - 1800000).toISOString()
      },
      {
        id: 'log-102',
        performed_by: 'zakidj181@gmail.com',
        action: 'إنشاء حساب مسؤول جديد: k.mansouri@businessmarket.dz',
        affected_record: 'k.mansouri@businessmarket.dz',
        ip_address: '105.101.42.18 (Algiers, DZ)',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'log-103',
        performed_by: 'k.mansouri@businessmarket.dz',
        action: 'تحديث حالة منتج: Smartphone Galaxy S24 Ultra',
        affected_record: 'PROD-8821',
        ip_address: '105.102.19.88 (Oran, DZ)',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        created_at: new Date(Date.now() - 7200000).toISOString()
      },
      {
        id: 'log-104',
        performed_by: 'a.saidi@businessmarket.dz',
        action: 'إعادة تعيين كلمة مرور العميل: customer@example.com',
        affected_record: 'CUST-3312',
        ip_address: '41.200.15.11 (Constantine, DZ)',
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
        created_at: new Date(Date.now() - 14400000).toISOString()
      }
    ];
    localStorage.setItem(MOCK_LOGS_KEY, JSON.stringify(initialAuditLogs));
  }
  if (!localStorage.getItem(MOCK_LOGIN_HISTORY_KEY)) {
    const initialLoginHistory: AdminLoginHistory[] = [
      {
        id: 'lh-1',
        admin_id: 'super-admin-uid-zaki',
        email: 'zakidj181@gmail.com',
        device: 'MacBook Pro M2 (macOS 14.5)',
        browser: 'Google Chrome 126.0',
        ip_address: '105.101.42.18 (Algiers, DZ)',
        created_at: new Date(Date.now() - 600000).toISOString(),
        is_active: true
      },
      {
        id: 'lh-2',
        admin_id: 'admin-profile-karim',
        email: 'k.mansouri@businessmarket.dz',
        device: 'Dell XPS 15 (Windows 11)',
        browser: 'Microsoft Edge 125.0',
        ip_address: '105.102.19.88 (Oran, DZ)',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        is_active: true
      },
      {
        id: 'lh-3',
        admin_id: 'admin-profile-amina',
        email: 'a.saidi@businessmarket.dz',
        device: 'iPhone 15 Pro (iOS 17.5)',
        browser: 'Safari Mobile 17.4',
        ip_address: '41.200.15.11 (Constantine, DZ)',
        created_at: new Date(Date.now() - 14400000).toISOString(),
        is_active: false
      }
    ];
    localStorage.setItem(MOCK_LOGIN_HISTORY_KEY, JSON.stringify(initialLoginHistory));
  }
}

// Check database table presence helper
let databaseSupportsRBAC: boolean | null = null;

async function checkDatabasePresence(): Promise<boolean> {
  if (databaseSupportsRBAC !== null) return databaseSupportsRBAC;
  try {
    const { error } = await supabase.from('admin_roles').select('id').limit(1);
    if (error) {
      if (error.code === '42P01') { // relation does not exist
        databaseSupportsRBAC = false;
        return false;
      }
    }
    databaseSupportsRBAC = true;
    return true;
  } catch {
    databaseSupportsRBAC = false;
    return false;
  }
}

export async function checkIsAdmin(): Promise<boolean> {
  // 1. Check Supabase Auth Session
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const email = session.user.email?.toLowerCase();
      // Auto-grant super-admin role to primary Super Admin
      if (email === 'zakidj181@gmail.com' || email === 'zakidj181@gmial.com') {
        return true;
      }

      // Check against real DB if available
      const hasDb = await checkDatabasePresence();
      if (hasDb) {
        const { data, error } = await supabase
          .from('admin_profiles')
          .select('is_active')
          .eq('id', session.user.id)
          .single();
        if (data && !error) {
          return data.is_active;
        }
      }

      // Fallback check in local state
      initMockStorage();
      const profiles: AdminProfile[] = JSON.parse(localStorage.getItem(MOCK_PROFILES_KEY) || '[]');
      const match = profiles.find(p => p.email.toLowerCase() === email);
      if (match) {
        return match.is_active;
      }
    }
  } catch (e) {
    console.error('Error in checkIsAdmin:', e);
  }

  // 2. Check Mock admin session
  const mockSessionStr = localStorage.getItem('mock_admin_session');
  if (mockSessionStr) {
    try {
      const mockSession = JSON.parse(mockSessionStr);
      if (mockSession?.user?.email) {
        return true;
      }
    } catch (e) {
      console.error(e);
    }
  }

  // 3. Removed customer local storage backup check to prevent customer logins from accessing admin privileges
  return false;
}

export async function getCurrentAdminInfo(): Promise<{
  id: string;
  email: string;
  role_id: string;
  permissions: string[];
  is_super_admin: boolean;
} | null> {
  let email = '';
  let id = '';

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    email = session.user.email || '';
    id = session.user.id;
  } else if (typeof window !== 'undefined') {
    const mockSessionStr = localStorage.getItem('mock_admin_session');
    if (mockSessionStr) {
      try {
        const mockSession = JSON.parse(mockSessionStr);
        email = mockSession?.user?.email || '';
        id = mockSession?.user?.id || 'mock-id';
      } catch (e) {
        console.error(e);
      }
    }
  }

  if (!email && typeof window !== 'undefined') {
    // Check if customer session has admin properties
    const customerStr = localStorage.getItem('customer');
    if (customerStr) {
      try {
        const customer = JSON.parse(customerStr);
        if (customer.email && (customer.email === 'zakidj181@gmail.com' || customer.email === 'zakidj181@gmial.com' || customer.is_admin === true)) {
          email = customer.email;
          id = customer.id || 'cust-admin-id';
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  if (!email) return null;

  const emailLower = email.toLowerCase();

  // Try Database
  try {
    const hasDb = await checkDatabasePresence();
    if (hasDb) {
      const { data: profile } = await supabase
        .from('admin_profiles')
        .select('*, admin_roles(*)')
        .eq('email', emailLower)
        .single();
      
      if (profile) {
        const role = profile.admin_roles;
        const perms = role?.permissions || [];
        const isSuper = profile.role_id === 'super-admin' || emailLower === 'zakidj181@gmail.com' || emailLower === 'zakidj181@gmial.com';
        return {
          id: profile.id,
          email: profile.email,
          role_id: profile.role_id,
          permissions: isSuper ? ALL_PERMISSIONS.map(p => p.id) : perms,
          is_super_admin: isSuper
        };
      }
    }
  } catch (e) {
    console.error('Error fetching admin from database:', e);
  }

  // Fallback to LocalStorage RBAC
  initMockStorage();
  const profiles: AdminProfile[] = JSON.parse(localStorage.getItem(MOCK_PROFILES_KEY) || '[]');
  const roles: AdminRole[] = JSON.parse(localStorage.getItem(MOCK_ROLES_KEY) || '[]');

  let profile = profiles.find(p => p.email.toLowerCase() === emailLower);
  if (!profile && (emailLower === 'zakidj181@gmail.com' || emailLower === 'zakidj181@gmial.com')) {
    // Auto provision primary Super Admin
    profile = {
      id: id || 'super-admin-uid-zaki',
      email: emailLower,
      role_id: 'super-admin',
      is_active: true,
      last_login_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    profiles.push(profile);
    localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(profiles));
  }

  if (profile) {
    const role = roles.find(r => r.id === profile?.role_id);
    const perms = role?.permissions || [];
    const isSuper = profile.role_id === 'super-admin' || emailLower === 'zakidj181@gmail.com' || emailLower === 'zakidj181@gmial.com';
    return {
      id: profile.id,
      email: profile.email,
      role_id: profile.role_id,
      permissions: isSuper ? ALL_PERMISSIONS.map(p => p.id) : perms,
      is_super_admin: isSuper
    };
  }

  return null;
}

export async function hasPermission(permission: string): Promise<boolean> {
  const admin = await getCurrentAdminInfo();
  if (!admin) return false;
  if (admin.is_super_admin) return true;
  return admin.permissions.includes(permission);
}

export async function logAdminAction(action: string, affected_record: string | null = null): Promise<void> {
  const admin = await getCurrentAdminInfo();
  const actor = admin ? admin.email : 'system@businessmarket.dz';

  // Attempt database log
  try {
    const { error } = await supabase.from('audit_logs').insert([{
      actor,
      action,
      entity_type: 'admin_rbac',
      entity_id: affected_record,
      details: {
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent
      }
    }]);
    if (!error) return;
  } catch (e) {
    console.warn('Could not insert audit log to DB, falling back to local storage', e);
  }

  // Fallback Mock Log
  initMockStorage();
  const logs: AdminAuditLog[] = JSON.parse(localStorage.getItem(MOCK_LOGS_KEY) || '[]');
  const newLog: AdminAuditLog = {
    id: Math.random().toString(36).substr(2, 9),
    performed_by: actor,
    action,
    affected_record,
    ip_address: '127.0.0.1 (Local Client)',
    user_agent: navigator.userAgent,
    created_at: new Date().toISOString()
  };
  logs.unshift(newLog);
  localStorage.setItem(MOCK_LOGS_KEY, JSON.stringify(logs.slice(0, 500))); // Cap at 500
}

// --- CRUD Functions for Admin Management ---

// Fetch Roles
export async function fetchAdminRoles(): Promise<AdminRole[]> {
  try {
    const hasDb = await checkDatabasePresence();
    if (hasDb) {
      const { data, error } = await supabase.from('admin_roles').select('*').order('name');
      if (data && !error) return data as AdminRole[];
    }
  } catch (e) {
    console.error(e);
  }
  initMockStorage();
  return JSON.parse(localStorage.getItem(MOCK_ROLES_KEY) || '[]');
}

// Save Role Permissions (Configurable permissions)
export async function saveRolePermissions(roleId: string, permissions: string[]): Promise<boolean> {
  try {
    const hasDb = await checkDatabasePresence();
    if (hasDb) {
      const { error } = await supabase
        .from('admin_roles')
        .update({ permissions })
        .eq('id', roleId);
      if (!error) {
        await logAdminAction(`Updated permissions for role ${roleId}`, roleId);
        return true;
      }
    }
  } catch (e) {
    console.error(e);
  }
  
  initMockStorage();
  const roles: AdminRole[] = JSON.parse(localStorage.getItem(MOCK_ROLES_KEY) || '[]');
  const idx = roles.findIndex(r => r.id === roleId);
  if (idx !== -1) {
    roles[idx].permissions = permissions;
    localStorage.setItem(MOCK_ROLES_KEY, JSON.stringify(roles));
    await logAdminAction(`Updated permissions for role ${roleId} (Offline)`, roleId);
    return true;
  }
  return false;
}

// Fetch Admin Profiles
export async function fetchAdminProfiles(): Promise<AdminProfile[]> {
  try {
    const hasDb = await checkDatabasePresence();
    if (hasDb) {
      const { data, error } = await supabase
        .from('admin_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (data && !error) return data as AdminProfile[];
    }
  } catch (e) {
    console.error(e);
  }
  initMockStorage();
  return JSON.parse(localStorage.getItem(MOCK_PROFILES_KEY) || '[]');
}

// Add/Invite Admin
export async function createAdminProfile(email: string, roleId: string): Promise<{ success: boolean; error?: string }> {
  const emailLower = email.toLowerCase().trim();
  const current = await getCurrentAdminInfo();
  if (!current?.is_super_admin) {
    return { success: false, error: 'Only Super Administrators can manage administrators.' };
  }

  // Create profile in Database
  try {
    const hasDb = await checkDatabasePresence();
    if (hasDb) {
      // In a real environment, inviting or signing up a user requires Supabase auth.signUp or auth.admin API.
      // Since admin key is not public, we insert a placeholder profile and let them log in using Auth.
      // Here we insert it directly to the admin_profiles table.
      const tempId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const { error } = await supabase
        .from('admin_profiles')
        .insert([{
          id: tempId, // This will map to their user ID once they log in/sign up
          email: emailLower,
          role_id: roleId,
          is_active: true,
          created_at: new Date().toISOString()
        }]);
      if (!error) {
        await logAdminAction(`Invited new administrator: ${emailLower}`, emailLower);
        return { success: true };
      } else {
        // If it fails (e.g. because of foreign key constraint on auth.users), fallback gracefully
        console.warn('Real DB insert failed, adding via local sync fallback.', error.message);
      }
    }
  } catch (e) {
    console.error(e);
  }

  // Fallback Offline/Mock
  initMockStorage();
  const profiles: AdminProfile[] = JSON.parse(localStorage.getItem(MOCK_PROFILES_KEY) || '[]');
  if (profiles.some(p => p.email.toLowerCase() === emailLower)) {
    return { success: false, error: 'Administrator with this email already exists.' };
  }

  const newProfile: AdminProfile = {
    id: 'mock-admin-' + Math.random().toString(36).substring(2, 9),
    email: emailLower,
    role_id: roleId,
    is_active: true,
    last_login_at: null,
    created_at: new Date().toISOString()
  };
  profiles.push(newProfile);
  localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(profiles));
  await logAdminAction(`Created administrator account: ${emailLower} (Offline)`, emailLower);
  return { success: true };
}

// Update Admin Profile (Role / Status)
export async function updateAdminProfile(id: string, updates: Partial<AdminProfile>): Promise<boolean> {
  const current = await getCurrentAdminInfo();
  if (!current?.is_super_admin) return false;

  try {
    const hasDb = await checkDatabasePresence();
    if (hasDb) {
      const { error } = await supabase
        .from('admin_profiles')
        .update(updates)
        .eq('id', id);
      if (!error) {
        await logAdminAction(`Updated administrator status/role for ID: ${id}`, id);
        return true;
      }
    }
  } catch (e) {
    console.error(e);
  }

  // Fallback Mock
  initMockStorage();
  const profiles: AdminProfile[] = JSON.parse(localStorage.getItem(MOCK_PROFILES_KEY) || '[]');
  const idx = profiles.findIndex(p => p.id === id);
  if (idx !== -1) {
    profiles[idx] = { ...profiles[idx], ...updates, updated_at: new Date().toISOString() };
    localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(profiles));
    await logAdminAction(`Updated administrator: ${profiles[idx].email} (Offline)`, profiles[idx].email);
    return true;
  }
  return false;
}

// Delete Admin
export async function deleteAdminProfile(id: string): Promise<boolean> {
  const current = await getCurrentAdminInfo();
  if (!current?.is_super_admin) return false;

  let deleted = false;
  try {
    const hasDb = await checkDatabasePresence();
    if (hasDb) {
      const { error } = await supabase
        .from('admin_profiles')
        .delete()
        .eq('id', id);
      if (!error) {
        await logAdminAction(`Deleted administrator account ID: ${id}`, id);
        deleted = true;
      }
    }
  } catch (e) {
    console.error(e);
  }

  // Also clean up local mock profiles storage
  initMockStorage();
  const profiles: AdminProfile[] = JSON.parse(localStorage.getItem(MOCK_PROFILES_KEY) || '[]');
  const match = profiles.find(p => p.id === id);
  if (match) {
    const email = match.email;
    const filtered = profiles.filter(p => p.id !== id);
    localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(filtered));
    if (!deleted) {
      await logAdminAction(`Deleted administrator account: ${email} (Offline)`, email);
    }
    deleted = true;
  }
  return deleted;
}

// Add/Create Custom Role
export async function createCustomRole(name: string, description: string, permissions: string[]): Promise<{ success: boolean; role?: AdminRole; error?: string }> {
  const roleId = 'custom-role-' + Math.random().toString(36).substring(2, 9);
  const newRole: AdminRole = {
    id: roleId,
    name,
    description,
    is_custom: true,
    permissions,
    created_at: new Date().toISOString()
  };

  try {
    const hasDb = await checkDatabasePresence();
    if (hasDb) {
      const { error } = await supabase.from('admin_roles').insert([newRole]);
      if (!error) {
        await logAdminAction(`Created new custom role: ${name}`, roleId);
        return { success: true, role: newRole };
      }
    }
  } catch (e) {
    console.error(e);
  }

  // Fallback Mock
  initMockStorage();
  const roles: AdminRole[] = JSON.parse(localStorage.getItem(MOCK_ROLES_KEY) || '[]');
  roles.push(newRole);
  localStorage.setItem(MOCK_ROLES_KEY, JSON.stringify(roles));
  await logAdminAction(`Created new custom role: ${name} (Offline)`, roleId);
  return { success: true, role: newRole };
}

// Update Role Info & Permissions
export async function updateAdminRole(id: string, name: string, description: string, permissions: string[]): Promise<boolean> {
  try {
    const hasDb = await checkDatabasePresence();
    if (hasDb) {
      const { error } = await supabase
        .from('admin_roles')
        .update({ name, description, permissions })
        .eq('id', id);
      if (!error) {
        await logAdminAction(`Updated role details & permissions: ${name}`, id);
        return true;
      }
    }
  } catch (e) {
    console.error(e);
  }

  // Fallback Mock
  initMockStorage();
  const roles: AdminRole[] = JSON.parse(localStorage.getItem(MOCK_ROLES_KEY) || '[]');
  const idx = roles.findIndex(r => r.id === id);
  if (idx !== -1) {
    roles[idx] = { ...roles[idx], name, description, permissions };
    localStorage.setItem(MOCK_ROLES_KEY, JSON.stringify(roles));
    await logAdminAction(`Updated role: ${name} (Offline)`, id);
    return true;
  }
  return false;
}

// Delete Custom Role
export async function deleteAdminRole(id: string): Promise<boolean> {
  if (id === 'super-admin') return false; // Never allow deleting super-admin role

  try {
    const hasDb = await checkDatabasePresence();
    if (hasDb) {
      const { error } = await supabase.from('admin_roles').delete().eq('id', id);
      if (!error) {
        await logAdminAction(`Deleted custom role: ${id}`, id);
        return true;
      }
    }
  } catch (e) {
    console.error(e);
  }

  initMockStorage();
  const roles: AdminRole[] = JSON.parse(localStorage.getItem(MOCK_ROLES_KEY) || '[]');
  const filtered = roles.filter(r => r.id !== id);
  localStorage.setItem(MOCK_ROLES_KEY, JSON.stringify(filtered));
  await logAdminAction(`Deleted custom role: ${id} (Offline)`, id);
  return true;
}

// Add/Invite Admin with full profile details
export async function createAdminProfileFull(profileData: {
  email: string;
  name?: string;
  phone?: string;
  avatar_url?: string;
  role_id: string;
}): Promise<{ success: boolean; profile?: AdminProfile; error?: string }> {
  const emailLower = profileData.email.toLowerCase().trim();
  const current = await getCurrentAdminInfo();
  if (!current?.is_super_admin) {
    return { success: false, error: 'Only Super Administrators can manage administrators.' };
  }

  const newProfile: AdminProfile = {
    id: 'admin-profile-' + Math.random().toString(36).substring(2, 9),
    name: profileData.name || emailLower.split('@')[0],
    email: emailLower,
    phone: profileData.phone || '',
    avatar_url: profileData.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    role_id: profileData.role_id,
    is_active: true,
    last_login_at: null,
    created_at: new Date().toISOString()
  };

  try {
    const hasDb = await checkDatabasePresence();
    if (hasDb) {
      const { error } = await supabase
        .from('admin_profiles')
        .insert([newProfile]);
      if (!error) {
        await logAdminAction(`Created administrator profile: ${emailLower}`, emailLower);
        return { success: true, profile: newProfile };
      }
    }
  } catch (e) {
    console.error(e);
  }

  // Fallback Offline/Mock
  initMockStorage();
  const profiles: AdminProfile[] = JSON.parse(localStorage.getItem(MOCK_PROFILES_KEY) || '[]');
  if (profiles.some(p => p.email.toLowerCase() === emailLower)) {
    return { success: false, error: 'Administrator with this email already exists.' };
  }

  profiles.unshift(newProfile);
  localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(profiles));
  await logAdminAction(`Created administrator profile: ${emailLower} (Offline)`, emailLower);
  return { success: true, profile: newProfile };
}

// Bulk update admin active status
export async function bulkUpdateAdminStatus(ids: string[], is_active: boolean): Promise<boolean> {
  const current = await getCurrentAdminInfo();
  if (!current?.is_super_admin) return false;

  initMockStorage();
  const profiles: AdminProfile[] = JSON.parse(localStorage.getItem(MOCK_PROFILES_KEY) || '[]');
  const updated = profiles.map(p => ids.includes(p.id) ? { ...p, is_active, updated_at: new Date().toISOString() } : p);
  localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(updated));
  await logAdminAction(`Bulk status update (${is_active ? 'Activated' : 'Suspended'}) for ${ids.length} admins`, ids.join(','));
  return true;
}

// Bulk delete admin profiles
export async function bulkDeleteAdminProfiles(ids: string[]): Promise<boolean> {
  const current = await getCurrentAdminInfo();
  if (!current?.is_super_admin) return false;

  try {
    const hasDb = await checkDatabasePresence();
    if (hasDb) {
      await supabase.from('admin_profiles').delete().in('id', ids);
    }
  } catch (e) {
    console.error(e);
  }

  initMockStorage();
  const profiles: AdminProfile[] = JSON.parse(localStorage.getItem(MOCK_PROFILES_KEY) || '[]');
  const filtered = profiles.filter(p => !ids.includes(p.id) || p.email === current.email);
  localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(filtered));
  await logAdminAction(`Bulk deleted ${ids.length} admin accounts`, ids.join(','));
  return true;
}

// Fetch Admin Login History
export async function fetchAdminLoginHistory(): Promise<AdminLoginHistory[]> {
  initMockStorage();
  return JSON.parse(localStorage.getItem(MOCK_LOGIN_HISTORY_KEY) || '[]');
}

// Revoke Admin Login Session
export async function revokeAdminLoginSession(sessionId: string): Promise<boolean> {
  initMockStorage();
  const history: AdminLoginHistory[] = JSON.parse(localStorage.getItem(MOCK_LOGIN_HISTORY_KEY) || '[]');
  const updated = history.map(h => h.id === sessionId ? { ...h, is_active: false } : h);
  localStorage.setItem(MOCK_LOGIN_HISTORY_KEY, JSON.stringify(updated));
  await logAdminAction(`Revoked active login session ID: ${sessionId}`, sessionId);
  return true;
}

// Fetch Logs
export async function fetchAdminAuditLogs(): Promise<AdminAuditLog[]> {
  initMockStorage();
  return JSON.parse(localStorage.getItem(MOCK_LOGS_KEY) || '[]');
}
