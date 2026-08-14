import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, Users, Key, CheckCircle, AlertTriangle, Loader2, Plus, Trash2, 
  UserX, UserCheck, ShieldCheck, RefreshCw, Settings, X, Info, Search,
  Download, Edit, Laptop, Activity, Check, Copy,
  ChevronLeft, ChevronRight, Filter
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import { supabase } from '../../lib/supabase';
import { 
  fetchAdminRoles, 
  fetchAdminProfiles, 
  createAdminProfileFull, 
  updateAdminProfile, 
  deleteAdminProfile, 
  logAdminAction,
  getCurrentAdminInfo,
  createCustomRole,
  updateAdminRole,
  deleteAdminRole,
  bulkUpdateAdminStatus,
  bulkDeleteAdminProfiles,
  fetchAdminLoginHistory,
  revokeAdminLoginSession,
  fetchAdminAuditLogs,
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  getAllModulePermissions,
  AdminRole, 
  AdminProfile,
  AdminLoginHistory,
  AdminAuditLog
} from '../../lib/admin';

export default function AdminAdministrators() {
  const { lang, dir, formatDate } = useLanguage();
  
  // Base Data States
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [loginHistory, setLoginHistory] = useState<AdminLoginHistory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    role_id: string;
    permissions: string[];
    is_super_admin: boolean;
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'history' | 'audit'>('users');
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [checkingDb, setCheckingDb] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  
  // Search, Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // History & Audit Search
  const [historySearch, setHistorySearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  // Modals & Forms States
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AdminProfile | null>(null);
  
  // Form Fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAvatar, setFormAvatar] = useState('');
  const [formRoleId, setFormRoleId] = useState('store-manager');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  
  // Role Editor States
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<string[]>([]);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDesc, setEditRoleDesc] = useState('');
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  
  // Password Reset / Temp Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [targetPasswordAdmin, setTargetPasswordAdmin] = useState<AdminProfile | null>(null);
  const [tempPasswordGenerated, setTempPasswordGenerated] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);
  
  // Delete Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAdmin, setDeletingAdmin] = useState<AdminProfile | null>(null);

  // Bulk & Role Delete Modal State
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  const [deleteTargetRoleId, setDeleteTargetRoleId] = useState<string | null>(null);
  const [isDeletingRole, setIsDeletingRole] = useState(false);
  const [deleteRoleError, setDeleteRoleError] = useState<string | null>(null);
  
  // Toast Notification State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  // Database status checker
  const checkDbStatus = useCallback(async () => {
    setCheckingDb(true);
    try {
      const { error } = await supabase.from('admin_roles').select('id').limit(1);
      if (error && error.code === '42P01') {
        setDbOk(false);
      } else {
        setDbOk(true);
      }
    } catch {
      setDbOk(false);
    } finally {
      setCheckingDb(false);
    }
  }, []);

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchAdminRoles();
      setRoles(r);
      const p = await fetchAdminProfiles();
      setProfiles(p);
      const h = await fetchAdminLoginHistory();
      setLoginHistory(h);
      const logs = await fetchAdminAuditLogs();
      setAuditLogs(logs);
      
      const cur = await getCurrentAdminInfo();
      setCurrentUser(cur);
      
      if (r.length > 0 && !selectedRoleId) {
        setSelectedRoleId(r[0].id);
        setSelectedRolePermissions(r[0].permissions);
        setEditRoleName(r[0].name);
        setEditRoleDesc(r[0].description || '');
      }
    } catch (e) {
      console.error(e);
      showToast('error', lang === 'ar' ? 'فشل تحميل البيانات' : 'Échec du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [lang, selectedRoleId, showToast]);

  useEffect(() => {
    loadData();
    checkDbStatus();
    // eslint-disable-next-deps
  }, [loadData, checkDbStatus]);

  // Update role selection
  const handleRoleSelect = (roleId: string) => {
    setSelectedRoleId(roleId);
    const role = roles.find(r => r.id === roleId);
    if (role) {
      setSelectedRolePermissions(role.permissions || []);
      setEditRoleName(role.name);
      setEditRoleDesc(role.description || '');
    }
  };

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        p.email.toLowerCase().includes(q) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.phone && p.phone.includes(q)) ||
        p.role_id.toLowerCase().includes(q)
      );
      const matchesRole = roleFilter === 'all' || p.role_id === roleFilter;
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && p.is_active) || 
        (statusFilter === 'suspended' && !p.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [profiles, searchQuery, roleFilter, statusFilter]);

  // Paginated profiles
  const totalPages = Math.ceil(filteredProfiles.length / pageSize) || 1;
  const paginatedProfiles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProfiles.slice(start, start + pageSize);
  }, [filteredProfiles, currentPage, pageSize]);

  // Filtered Login History
  const filteredLoginHistory = useMemo(() => {
    return loginHistory.filter(lh => {
      const q = historySearch.toLowerCase().trim();
      return !q || (
        lh.email.toLowerCase().includes(q) ||
        lh.device.toLowerCase().includes(q) ||
        lh.browser.toLowerCase().includes(q) ||
        lh.ip_address.toLowerCase().includes(q)
      );
    });
  }, [loginHistory, historySearch]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const q = auditSearch.toLowerCase().trim();
      return !q || (
        log.performed_by.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        (log.affected_record && log.affected_record.toLowerCase().includes(q)) ||
        (log.ip_address && log.ip_address.toLowerCase().includes(q))
      );
    });
  }, [auditLogs, auditSearch]);

  // Handle Create Administrator
  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail || !formEmail.includes('@')) {
      setFormError(lang === 'ar' ? 'الرجاء إدخال بريد إلكتروني صحيح' : 'Email invalide');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const res = await createAdminProfileFull({
        email: formEmail,
        name: formName || formEmail.split('@')[0],
        phone: formPhone,
        avatar_url: formAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        role_id: formRoleId
      });

      if (res.success) {
        showToast('success', lang === 'ar' ? 'تم إنشاء حساب المسؤول بنجاح' : 'Administrateur créé avec succès');
        setShowAddUserModal(false);
        setFormEmail('');
        setFormName('');
        setFormPhone('');
        setFormAvatar('');
        await loadData();
      } else {
        setFormError(res.error || (lang === 'ar' ? 'حدث خطأ أثناء الإنشاء' : 'Erreur de création'));
      }
    } catch (err) {
      console.error(err);
      setFormError(lang === 'ar' ? 'حدث خطأ في النظام' : 'Erreur système');
    } finally {
      setSaving(false);
    }
  };

  // Handle Edit Administrator
  const handleOpenEditModal = (profile: AdminProfile) => {
    setEditingProfile(profile);
    setFormName(profile.name || '');
    setFormEmail(profile.email || '');
    setFormPhone(profile.phone || '');
    setFormAvatar(profile.avatar_url || '');
    setFormRoleId(profile.role_id || 'store-manager');
    setFormIsActive(profile.is_active);
    setShowEditUserModal(true);
  };

  const handleUpdateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    setSaving(true);
    try {
      const updated = await updateAdminProfile(editingProfile.id, {
        name: formName,
        phone: formPhone,
        avatar_url: formAvatar,
        role_id: formRoleId,
        is_active: formIsActive
      });

      if (updated) {
        showToast('success', lang === 'ar' ? 'تم تحديث بيانات المسؤول بنجاح' : 'Profil mis à jour');
        setShowEditUserModal(false);
        await loadData();
      } else {
        showToast('error', lang === 'ar' ? 'فشل تحديث الحساب' : 'Échec de la mise à jour');
      }
    } catch (err) {
      console.error(err);
      showToast('error', lang === 'ar' ? 'حدث خطأ غير متوقع' : 'Erreur inattendue');
    } finally {
      setSaving(false);
    }
  };

  // Single Active Status Toggle
  const handleToggleActive = async (user: AdminProfile) => {
    if (user.email === currentUser?.email) {
      showToast('error', lang === 'ar' ? 'لا يمكنك تغيير حالة حسابك الحالي' : 'Action non autorisée sur votre propre compte');
      return;
    }

    try {
      const success = await updateAdminProfile(user.id, { is_active: !user.is_active });
      if (success) {
        showToast('success', user.is_active 
          ? (lang === 'ar' ? 'تم تعطيل الحساب' : 'Compte désactivé') 
          : (lang === 'ar' ? 'تم تنشيط الحساب' : 'Compte activé'));
        await loadData();
      }
    } catch (err) {
      console.error(err);
      showToast('error', lang === 'ar' ? 'فشل تغيير حالة الحساب' : 'Erreur de mise à jour');
    }
  };

  // Delete Admin
  const handleDeleteUserClick = (user: AdminProfile) => {
    if (user.email === currentUser?.email) {
      showToast('error', lang === 'ar' ? 'لا يمكنك حذف حسابك الحالي' : 'Impossible de supprimer votre propre compte');
      return;
    }
    setDeletingAdmin(user);
    setShowDeleteModal(true);
  };

  const confirmDeleteAdmin = async () => {
    if (!deletingAdmin) return;
    setSaving(true);
    try {
      const deleted = await deleteAdminProfile(deletingAdmin.id);
      if (deleted) {
        showToast('success', lang === 'ar' ? 'تم حذف حساب المسؤول بنجاح' : 'Administrateur supprimé');
        setShowDeleteModal(false);
        setDeletingAdmin(null);
        await loadData();
      } else {
        showToast('error', lang === 'ar' ? 'فشل حذف الحساب' : 'Échec de la suppression');
      }
    } catch (err) {
      console.error(err);
      showToast('error', lang === 'ar' ? 'خطأ أثناء الحذف' : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  // Bulk Actions
  const handleSelectAllProfiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProfileIds(paginatedProfiles.map(p => p.id));
    } else {
      setSelectedProfileIds([]);
    }
  };

  const handleSelectProfileRow = (id: string) => {
    setSelectedProfileIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkActivate = async () => {
    if (selectedProfileIds.length === 0) return;
    setSaving(true);
    await bulkUpdateAdminStatus(selectedProfileIds, true);
    showToast('success', lang === 'ar' ? `تم تفعيل ${selectedProfileIds.length} حسابات` : `${selectedProfileIds.length} comptes activés`);
    setSelectedProfileIds([]);
    await loadData();
    setSaving(false);
  };

  const handleBulkSuspend = async () => {
    if (selectedProfileIds.length === 0) return;
    setSaving(true);
    await bulkUpdateAdminStatus(selectedProfileIds, false);
    showToast('success', lang === 'ar' ? `تم إيقاف ${selectedProfileIds.length} حسابات` : `${selectedProfileIds.length} comptes suspendus`);
    setSelectedProfileIds([]);
    await loadData();
    setSaving(false);
  };

  const handleBulkDelete = () => {
    if (selectedProfileIds.length === 0) return;
    setBulkDeleteError(null);
    setShowBulkDeleteModal(true);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedProfileIds.length === 0) return;
    setIsBulkDeleting(true);
    setBulkDeleteError(null);
    try {
      await bulkDeleteAdminProfiles(selectedProfileIds);
      showToast('success', lang === 'ar' ? `تم حذف ${selectedProfileIds.length} حسابات` : `${selectedProfileIds.length} comptes supprimés`);
      setSelectedProfileIds([]);
      setShowBulkDeleteModal(false);
      await loadData();
    } catch (e: unknown) {
      const msg = (e as Error)?.message || (lang === 'ar' ? 'حدث خطأ أثناء الحذف' : 'Erreur de suppression');
      setBulkDeleteError(msg);
      showToast('error', msg);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // CSV Export
  const exportProfilesToCSV = (items: AdminProfile[]) => {
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Role ID', 'Is Active', 'Created At', 'Last Login'];
    const rows = items.map(p => [
      p.id,
      `"${p.name || ''}"`,
      p.email,
      `"${p.phone || ''}"`,
      p.role_id,
      p.is_active ? 'Active' : 'Suspended',
      p.created_at,
      p.last_login_at || 'Never'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `admin_users_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', lang === 'ar' ? 'تم تصدير ملف CSV بنجاح' : 'Fichier CSV exporté');
  };

  // Password Reset / Temp Password Trigger
  const handleOpenPasswordModal = (user: AdminProfile) => {
    setTargetPasswordAdmin(user);
    const temp = 'Pass-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '@' + Math.floor(100 + Math.random() * 900);
    setTempPasswordGenerated(temp);
    setPasswordCopied(false);
    setShowPasswordModal(true);
  };

  const handleSendResetLinkEmail = async () => {
    if (!targetPasswordAdmin) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetPasswordAdmin.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      await logAdminAction(`Requested password reset email link for: ${targetPasswordAdmin.email}`, targetPasswordAdmin.email);
      showToast('success', lang === 'ar' ? 'تم إرسال رابط إعادة التعيين إلى البريد بنجاح' : 'Lien envoyé');
      setShowPasswordModal(false);
    } catch (err) {
      console.error(err);
      showToast('error', lang === 'ar' ? 'فشل إرسال البريد' : 'Échec de l\'envoi');
    }
  };

  const copyTempPassword = () => {
    navigator.clipboard.writeText(tempPasswordGenerated);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
    logAdminAction(`Generated temp password for admin: ${targetPasswordAdmin?.email}`, targetPasswordAdmin?.email || null);
    showToast('success', lang === 'ar' ? 'تم نسخ كلمة المرور المؤقتة إلى الحافظة' : 'Mot de passe copié');
  };

  // Permission Matrix Toggles
  const handlePermissionToggle = (permissionId: string) => {
    if (selectedRoleId === 'super-admin') return;
    setSelectedRolePermissions(prev => 
      prev.includes(permissionId)
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleToggleModuleAll = (moduleId: string) => {
    if (selectedRoleId === 'super-admin') return;
    const modulePerms = getAllModulePermissions(moduleId);
    const allChecked = modulePerms.every(p => selectedRolePermissions.includes(p));

    if (allChecked) {
      setSelectedRolePermissions(prev => prev.filter(p => !modulePerms.includes(p)));
    } else {
      setSelectedRolePermissions(prev => Array.from(new Set([...prev, ...modulePerms])));
    }
  };

  const handleToggleActionAll = (actionId: string) => {
    if (selectedRoleId === 'super-admin') return;
    const actionPerms = PERMISSION_MODULES.map(m => `${m.id}:${actionId}`);
    const allChecked = actionPerms.every(p => selectedRolePermissions.includes(p));

    if (allChecked) {
      setSelectedRolePermissions(prev => prev.filter(p => !actionPerms.includes(p)));
    } else {
      setSelectedRolePermissions(prev => Array.from(new Set([...prev, ...actionPerms])));
    }
  };

  // Save Role Permissions & Details
  const handleSaveRolePermissions = async () => {
    if (!selectedRoleId || selectedRoleId === 'super-admin') return;
    setSaving(true);
    try {
      const updated = await updateAdminRole(
        selectedRoleId,
        editRoleName,
        editRoleDesc,
        selectedRolePermissions
      );
      if (updated) {
        showToast('success', lang === 'ar' ? 'تم حفظ الصلاحيات والتفاصيل بنجاح' : 'Savoir les permissions');
        await loadData();
      } else {
        showToast('error', lang === 'ar' ? 'فشل حفظ الصلاحيات' : 'Échec de la sauvegarde');
      }
    } catch (e) {
      console.error(e);
      showToast('error', lang === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  // Create Custom Role
  const handleCreateCustomRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    setSaving(true);
    try {
      const res = await createCustomRole(newRoleName, newRoleDesc, []);
      if (res.success && res.role) {
        showToast('success', lang === 'ar' ? 'تمت إضافة الدور المخصص بنجاح' : 'Rôle créé');
        setShowAddRoleModal(false);
        setNewRoleName('');
        setNewRoleDesc('');
        await loadData();
        handleRoleSelect(res.role.id);
      } else {
        showToast('error', res.error || (lang === 'ar' ? 'فشل إنشائه' : 'Erreur'));
      }
    } catch (e) {
      console.error(e);
      showToast('error', lang === 'ar' ? 'خطأ في النظام' : 'Erreur système');
    } finally {
      setSaving(false);
    }
  };

  // Delete Role Handlers
  const handleDeleteRoleClick = (roleId: string) => {
    if (roleId === 'super-admin') return;
    setDeleteRoleError(null);
    setDeleteTargetRoleId(roleId);
  };

  const handleConfirmDeleteRole = async () => {
    if (!deleteTargetRoleId || deleteTargetRoleId === 'super-admin') return;
    setIsDeletingRole(true);
    setDeleteRoleError(null);
    try {
      const res = await deleteAdminRole(deleteTargetRoleId);
      if (res) {
        showToast('success', lang === 'ar' ? 'تم حذف الدور المخصص' : 'Rôle supprimé');
        await loadData();
        setSelectedRoleId('store-manager');
        setDeleteTargetRoleId(null);
      } else {
        const msg = lang === 'ar' ? 'فشل حذف الدور المخصص' : 'Échec de la suppression';
        setDeleteRoleError(msg);
        showToast('error', msg);
      }
    } catch (e: unknown) {
      console.error(e);
      const msg = (e as Error)?.message || (lang === 'ar' ? 'حدث خطأ أثناء الحذف' : 'Erreur de suppression');
      setDeleteRoleError(msg);
      showToast('error', msg);
    } finally {
      setIsDeletingRole(false);
    }
  };

  // Revoke Login Session
  const handleRevokeSession = async (sessionId: string) => {
    const ok = await revokeAdminLoginSession(sessionId);
    if (ok) {
      showToast('success', lang === 'ar' ? 'تم إلغاء الجلسة بنجاح' : 'Session révoquée');
      await loadData();
    }
  };

  const sqlCode = `-- Create Admin Roles table
CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_custom BOOLEAN DEFAULT false,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Admin Profiles table
CREATE TABLE IF NOT EXISTS admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role_id TEXT REFERENCES admin_roles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for security
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read of roles" ON admin_roles FOR SELECT TO public USING (true);
CREATE POLICY "Allow authenticated read of admin profiles" ON admin_profiles FOR SELECT TO public USING (true);
`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-gray-500 text-sm">{lang === 'ar' ? 'جاري تحميل وحدة إدارة المسؤولين والصلاحيات...' : 'Chargement...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      {/* Toast Notification */}
      {toast && (
        <div 
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl animate-in fade-in slide-in-from-top-4 duration-300 ${
            toast.type === 'success' 
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700' 
              : 'bg-rose-900 text-rose-100 border-rose-700'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-950/80 border border-emerald-800/80 rounded-xl text-emerald-400 shadow-inner">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              {lang === 'ar' ? 'إدارة المسؤولين والصلاحيات' : 'Gestion des Administrateurs'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {lang === 'ar' ? 'نظام التحكم بالمستوى المؤسسي (RBAC)، سجلات النشاط وجلسات الوصول.' : 'Système de gestion des rôles, permissions (RBAC) et journaux d\'accès.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {currentUser?.is_super_admin && activeTab === 'users' && (
            <>
              <button
                onClick={() => exportProfilesToCSV(filteredProfiles)}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors shadow"
              >
                <Download className="w-4 h-4 text-blue-400" />
                {lang === 'ar' ? 'تصدير CSV' : 'Exporter CSV'}
              </button>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/60 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                {lang === 'ar' ? 'إضافة مسؤول جديد' : 'Ajouter un administrateur'}
              </button>
            </>
          )}

          {activeTab === 'roles' && currentUser?.is_super_admin && (
            <button
              onClick={() => setShowAddRoleModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/60 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              {lang === 'ar' ? 'إضافة دور مخصص' : 'Créer un rôle mâtiné'}
            </button>
          )}
        </div>
      </div>

      {/* Database Warning */}
      {dbOk === false && (
        <div className="rounded-2xl border border-amber-800/80 bg-amber-950/40 p-5 shadow-xl text-amber-200 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-900/60 p-2.5 text-amber-400 shrink-0 border border-amber-700/60">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-amber-200">
                {lang === 'ar' ? 'إعداد جداول قاعدة البيانات مطلوب' : 'Initialisation de la base de données requise'}
              </h3>
              <p className="mt-1 text-xs text-amber-300/80 leading-relaxed max-w-xl">
                {lang === 'ar' 
                  ? 'يرجى تشغيل كود SQL لإنشاء جداول الأدوار والصلاحيات (admin_roles) وحسابات المسؤولين (admin_profiles). يعمل النظام حالياً بوضع التزامن المحلي الهجين.' 
                  : 'Veuillez exécuter le script SQL dans votre console Supabase pour créer les tables requises.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 self-end md:self-center">
            <button
              onClick={() => setShowSqlModal(true)}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 text-xs transition-colors shadow-sm"
            >
              {lang === 'ar' ? 'عرض كود SQL' : 'Afficher script SQL'}
            </button>
            <button
              onClick={checkDbStatus}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              {checkingDb && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
              <RefreshCw className="h-3.5 w-3.5" />
              {lang === 'ar' ? 'تحديث الفحص' : 'Actualiser'}
            </button>
          </div>
        </div>
      )}

      {/* User Info & Scope Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-slate-100 rounded-2xl p-5 shadow-xl flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-950/60 flex items-center justify-center shrink-0 border border-emerald-800/60 shadow-inner">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base tracking-tight text-slate-100">{currentUser?.email}</span>
              <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider">
                {currentUser?.is_super_admin ? 'Super Administrator' : roles.find(r => r.id === currentUser?.role_id)?.name || 'Admin'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {currentUser?.is_super_admin 
                ? (lang === 'ar' ? 'تمتلك صلاحيات شاملة ومباشرة لإدارة الأدوار والحسابات وإعادة الضبط الأمنية.' : 'Accès illimité à l\'ensemble du système.')
                : (lang === 'ar' ? 'الوصول مقيد حسب الصلاحيات المسندة لدورك المعتمد.' : 'Accès limité selon les permissions accordées.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-300 bg-slate-900 rounded-xl px-4 py-2 border border-slate-800 text-right rtl:text-right ltr:text-left">
            <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
              {lang === 'ar' ? 'إجمالي المسؤولين' : 'Total Admins'}
            </span>
            <span className="text-sm font-bold text-emerald-400">{profiles.length} {lang === 'ar' ? 'حسابات' : 'Comptes'}</span>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-slate-950 border border-slate-800 p-2 rounded-2xl shadow-lg flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'users' 
              ? 'bg-emerald-600 text-white shadow-md font-bold' 
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          {lang === 'ar' ? 'حسابات المسؤولين' : 'Comptes Administrateurs'}
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'users' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {profiles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'roles' 
              ? 'bg-emerald-600 text-white shadow-md font-bold' 
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          {lang === 'ar' ? 'مصفوفة الأدوار والصلاحيات' : 'Matrice des Rôles'}
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'roles' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {roles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'history' 
              ? 'bg-emerald-600 text-white shadow-md font-bold' 
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Laptop className="w-4 h-4" />
          {lang === 'ar' ? 'سجل الدخول والجلسات' : 'Sessions & Connexions'}
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {loginHistory.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'audit' 
              ? 'bg-emerald-600 text-white shadow-md font-bold' 
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          {lang === 'ar' ? 'سجل العمليات والأمان' : 'Journal d\'Audit'}
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'audit' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* TAB 1: ACCOUNTS & MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Controls Bar: Search & Filters */}
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute top-3.5 right-3.5 rtl:right-3.5 ltr:left-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'ar' ? 'البحث بالإسم، البريد أو الهاتف...' : 'Rechercher un administrateur...'}
                className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-9 py-2.5 text-slate-100 placeholder-slate-400 caret-emerald-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-300">{lang === 'ar' ? 'الدور:' : 'Rôle:'}</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-900 border-none text-xs font-semibold focus:outline-none text-slate-100 cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-slate-100">{lang === 'ar' ? 'جميع الأدوار' : 'Tous les rôles'}</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id} className="bg-slate-900 text-slate-100">{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                <span className="font-semibold text-slate-300">{lang === 'ar' ? 'الحالة:' : 'Statut:'}</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'suspended')}
                  className="bg-slate-900 border-none text-xs font-semibold focus:outline-none text-slate-100 cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-slate-100">{lang === 'ar' ? 'جميع الحالات' : 'Tous'}</option>
                  <option value="active" className="bg-slate-900 text-slate-100">{lang === 'ar' ? 'نشط' : 'Actif'}</option>
                  <option value="suspended" className="bg-slate-900 text-slate-100">{lang === 'ar' ? 'معطل' : 'Inactif'}</option>
                </select>
              </div>

              {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setRoleFilter('all');
                    setStatusFilter('all');
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 transition-colors"
                >
                  {lang === 'ar' ? 'مسح الفلاتر' : 'Réinitialiser'}
                </button>
              )}
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedProfileIds.length > 0 && currentUser?.is_super_admin && (
            <div className="bg-indigo-950 border border-indigo-800/80 text-slate-100 rounded-2xl p-3.5 shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="bg-white/20 px-2.5 py-1 rounded-lg font-bold">
                  {selectedProfileIds.length}
                </span>
                <span>{lang === 'ar' ? 'عنصر مسمى محدد' : 'élément(s) sélectionné(s)'}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleBulkActivate}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  {lang === 'ar' ? 'تفعيل المحدد' : 'Activer'}
                </button>
                <button
                  onClick={handleBulkSuspend}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <UserX className="w-3.5 h-3.5" />
                  {lang === 'ar' ? 'تعطيل المحدد' : 'Désactiver'}
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {lang === 'ar' ? 'حذف المحدد' : 'Supprimer'}
                </button>
                <button
                  onClick={() => setSelectedProfileIds([])}
                  className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء التحديد' : 'Annuler'}
                </button>
              </div>
            </div>
          )}

          {/* Profiles Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            {filteredProfiles.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 font-medium text-sm">{lang === 'ar' ? 'لم يتم العثور على أي حسابات مسؤولين تطابق البحث.' : 'Aucun administrateur trouvé.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right rtl:text-right ltr:text-left">
                  <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold">
                    <tr>
                      {currentUser?.is_super_admin && (
                        <th className="px-4 py-3.5 w-10">
                          <input
                            type="checkbox"
                            checked={selectedProfileIds.length === paginatedProfiles.length && paginatedProfiles.length > 0}
                            onChange={handleSelectAllProfiles}
                            className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3.5">{lang === 'ar' ? 'المسؤول' : 'Administrateur'}</th>
                      <th className="px-6 py-3.5">{lang === 'ar' ? 'الدور الوظيفي' : 'Rôle'}</th>
                      <th className="px-6 py-3.5">{lang === 'ar' ? 'الحالة' : 'Statut'}</th>
                      <th className="px-6 py-3.5">{lang === 'ar' ? 'تاريخ الإنشاء' : 'Création'}</th>
                      <th className="px-6 py-3.5">{lang === 'ar' ? 'آخر دخول' : 'Dernière connexion'}</th>
                      <th className="px-6 py-3.5 text-center">{lang === 'ar' ? 'إجراءات التحكم' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {paginatedProfiles.map((user) => {
                      const userRole = roles.find(r => r.id === user.role_id);
                      const isSelf = user.email === currentUser?.email;
                      const isSelected = selectedProfileIds.includes(user.id);
                      
                      return (
                        <tr key={user.id} className={`hover:bg-slate-900/60 transition-colors ${isSelected ? 'bg-indigo-950/40' : ''}`}>
                          {currentUser?.is_super_admin && (
                            <td className="px-4 py-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectProfileRow(user.id)}
                                className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                              />
                            </td>
                          )}

                          <td className="px-6 py-4 font-semibold text-slate-100">
                            <div className="flex items-center gap-3">
                              <img
                                src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                                alt={user.name || user.email}
                                className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-slate-100">{user.name || user.email.split('@')[0]}</span>
                                  {isSelf && (
                                    <span className="bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                      {lang === 'ar' ? 'أنت' : 'Vous'}
                                    </span>
                                  )}
                                </div>
                                <span className="text-slate-400 font-normal block">{user.email}</span>
                                {user.phone && <span className="text-[11px] text-slate-400 dir-ltr inline-block">{user.phone}</span>}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              user.role_id === 'super-admin'
                                ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60'
                                : 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60'
                            }`}>
                              <Shield className="w-3.5 h-3.5" />
                              {userRole?.name || user.role_id}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              user.is_active 
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' 
                                : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {user.is_active 
                                ? (lang === 'ar' ? 'نشط' : 'Actif') 
                                : (lang === 'ar' ? 'معطل' : 'Inactif')}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-xs text-slate-400">
                            {formatDate(user.created_at)}
                          </td>

                          <td className="px-6 py-4 text-xs text-slate-400">
                            {user.last_login_at ? formatDate(user.last_login_at) : (lang === 'ar' ? 'لم يسجل دخول بعد' : 'Jamais')}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Edit Profile */}
                              <button
                                onClick={() => handleOpenEditModal(user)}
                                className="p-1.5 text-slate-300 hover:bg-slate-800 rounded-lg transition-all"
                                title={lang === 'ar' ? 'تعديل الملف الشخصي' : 'Éditer'}
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {/* Activate/Deactivate */}
                              {currentUser?.is_super_admin && (
                                <button
                                  onClick={() => handleToggleActive(user)}
                                  disabled={isSelf}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    isSelf 
                                      ? 'text-slate-600 border-slate-800 cursor-not-allowed'
                                      : user.is_active 
                                        ? 'text-amber-400 hover:bg-amber-950/40 border-amber-800/60' 
                                        : 'text-emerald-400 hover:bg-emerald-950/40 border-emerald-800/60'
                                  }`}
                                  title={user.is_active ? (lang === 'ar' ? 'إلغاء تنشيط الحساب' : 'Désactiver') : (lang === 'ar' ? 'تنشيط الحساب' : 'Activer')}
                                >
                                  {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                </button>
                              )}

                              {/* Password Reset */}
                              <button
                                onClick={() => handleOpenPasswordModal(user)}
                                className="p-1.5 text-blue-400 hover:bg-blue-950/40 border border-blue-800/60 rounded-lg transition-all"
                                title={lang === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Réinitialiser mot de passe'}
                              >
                                <Key className="w-4 h-4" />
                              </button>

                              {/* Delete */}
                              {currentUser?.is_super_admin && (
                                <button
                                  onClick={() => handleDeleteUserClick(user)}
                                  disabled={isSelf}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    isSelf 
                                      ? 'text-slate-600 border-slate-800 cursor-not-allowed'
                                      : 'text-rose-400 hover:bg-rose-950/40 border-rose-800/60'
                                  }`}
                                  title={lang === 'ar' ? 'حذف الحساب' : 'Supprimer'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredProfiles.length > 0 && (
              <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span>{lang === 'ar' ? 'عرض' : 'Afficher'}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-semibold text-slate-100 focus:outline-none"
                  >
                    <option value={5} className="bg-slate-900 text-slate-100">5</option>
                    <option value={10} className="bg-slate-900 text-slate-100">10</option>
                    <option value={20} className="bg-slate-900 text-slate-100">20</option>
                  </select>
                  <span>{lang === 'ar' ? `من أصل ${filteredProfiles.length} مسؤول` : `sur ${filteredProfiles.length}`}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition-colors text-slate-200"
                  >
                    <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  </button>
                  <span className="px-3 font-semibold text-slate-200">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition-colors text-slate-200"
                  >
                    <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS MATRIX */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Roles Selector Sidebar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-4 h-fit space-y-2">
            <h3 className="font-bold text-gray-900 dark:text-white px-2 pb-2 border-b border-gray-100 dark:border-slate-800 text-xs uppercase tracking-wider">
              {lang === 'ar' ? 'الأدوار الوظيفية المعتمدة' : 'Rôles disponibles'}
            </h3>
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-right rtl:text-right ltr:text-left transition-all ${
                  selectedRoleId === role.id 
                    ? 'bg-emerald-600 text-white font-semibold shadow-md' 
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Shield className={`w-4 h-4 shrink-0 ${selectedRoleId === role.id ? 'text-white' : 'text-emerald-400'}`} />
                  <span className="text-xs truncate">{role.name}</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold shrink-0 ${
                  selectedRoleId === role.id 
                    ? 'bg-white/20 text-white' 
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {role.permissions ? role.permissions.length : 0}
                </span>
              </button>
            ))}
          </div>

          {/* Permissions Matrix Configurator */}
          <div className="lg:col-span-3 bg-slate-950 border border-slate-800 rounded-2xl shadow-xl p-6 space-y-6">
            {selectedRoleId ? (
              <>
                {/* Role Header Info */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-100">
                        {editRoleName}
                      </h2>
                      {roles.find(r => r.id === selectedRoleId)?.is_custom && (
                        <span className="bg-amber-950/60 text-amber-300 text-[10px] px-2 py-0.5 rounded font-bold border border-amber-800/60">
                          {lang === 'ar' ? 'دور مخصص' : 'Rôle personnalisé'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {selectedRoleId === 'super-admin'
                        ? (lang === 'ar' ? 'Super Administrator يتميز بوصول كامل ومطلق لجميع صلاحيات الوحدات والأنظمة.' : 'Le Super Administrateur dispose de toutes les permissions.')
                        : editRoleDesc || (lang === 'ar' ? 'حدد الصلاحيات والإجراءات التفصيلية المتاحة لهذا الدور.' : 'Cochez ou décochez les permissions accordées à ce rôle.')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {roles.find(r => r.id === selectedRoleId)?.is_custom && currentUser?.is_super_admin && (
                      <button
                        onClick={() => handleDeleteRoleClick(selectedRoleId)}
                        className="bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 font-semibold px-3 py-2 rounded-xl text-xs transition-colors flex items-center gap-1 border border-rose-800/60"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {lang === 'ar' ? 'حذف الدور' : 'Supprimer'}
                      </button>
                    )}

                    {selectedRoleId !== 'super-admin' && currentUser?.is_super_admin && (
                      <button
                        onClick={handleSaveRolePermissions}
                        disabled={saving}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-colors shadow-md disabled:opacity-75"
                      >
                        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {lang === 'ar' ? 'حفظ الصلاحيات' : 'Enregistrer'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Role Description Editable (If permitted) */}
                {selectedRoleId !== 'super-admin' && currentUser?.is_super_admin && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        {lang === 'ar' ? 'اسم الدور' : 'Nom du rôle'}
                      </label>
                      <input
                        type="text"
                        value={editRoleName}
                        onChange={(e) => setEditRoleName(e.target.value)}
                        className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 caret-emerald-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        {lang === 'ar' ? 'الوصف' : 'Description'}
                      </label>
                      <input
                        type="text"
                        value={editRoleDesc}
                        onChange={(e) => setEditRoleDesc(e.target.value)}
                        className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 caret-emerald-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

                {/* Enterprise Matrix Grid */}
                <div className="space-y-3 overflow-x-auto">
                  <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                    {lang === 'ar' ? 'مصفوفة التحكم بالصلاحيات تفصيلياً (Module & Actions Matrix)' : 'Matrice Détaillée par Module & Action'}
                  </h4>

                  <table className="w-full text-xs text-right rtl:text-right ltr:text-left border border-slate-800 rounded-xl overflow-hidden">
                    <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3 text-sm">{lang === 'ar' ? 'الوحدة / الصفحة' : 'Module'}</th>
                        {PERMISSION_ACTIONS.map(act => (
                          <th key={act.id} className="p-2.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span>{act.name[lang] || act.name.en}</span>
                              {selectedRoleId !== 'super-admin' && currentUser?.is_super_admin && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleActionAll(act.id)}
                                  className="text-[10px] text-emerald-400 hover:underline font-normal"
                                >
                                  {lang === 'ar' ? 'الكل' : 'Tous'}
                                </button>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="p-2.5 text-center">{lang === 'ar' ? 'تحديد الكل' : 'Tout'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {PERMISSION_MODULES.map(mod => {
                        const modPerms = getAllModulePermissions(mod.id);
                        const allChecked = modPerms.every(p => selectedRolePermissions.includes(p) || selectedRoleId === 'super-admin');

                        return (
                          <tr key={mod.id} className="hover:bg-slate-900/60 transition-colors">
                            <td className="p-3 font-semibold text-slate-200">
                              {mod.name[lang] || mod.name.en}
                            </td>

                            {PERMISSION_ACTIONS.map(act => {
                              const permKey = `${mod.id}:${act.id}`;
                              const isChecked = selectedRolePermissions.includes(permKey) || selectedRoleId === 'super-admin';
                              const isDisabled = selectedRoleId === 'super-admin' || !currentUser?.is_super_admin;

                              return (
                                <td key={act.id} className="p-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isDisabled}
                                    onChange={() => handlePermissionToggle(permKey)}
                                    className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                </td>
                              );
                            })}

                            <td className="p-2.5 text-center">
                              {selectedRoleId !== 'super-admin' && currentUser?.is_super_admin && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleModuleAll(mod.id)}
                                  className={`text-[10px] px-2 py-1 rounded font-bold transition-colors ${
                                    allChecked 
                                      ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60' 
                                      : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                  }`}
                                >
                                  {allChecked ? (lang === 'ar' ? 'إلغاء' : 'Désélect.') : (lang === 'ar' ? 'تحديد' : 'Sélect.')}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Info className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">{lang === 'ar' ? 'يرجى اختيار دور وظيفي لعرض مصفوفة الصلاحيات الخاص به' : 'Sélectionnez un rôle'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LOGIN HISTORY & ACTIVE SESSIONS */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute top-3.5 right-3.5 rtl:right-3.5 ltr:left-3.5 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder={lang === 'ar' ? 'البحث بالبريد، المتصفح أو عنوان IP...' : 'Rechercher une session...'}
                className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-9 py-2.5 text-slate-100 placeholder-slate-400 caret-emerald-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors"
              />
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {lang === 'ar' ? 'يتم مراقبة أجهزة ومواقع الدخول لحظياً لضمان الأمان.' : 'Surveillance en temps réel des connexions.'}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right rtl:text-right ltr:text-left">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">{lang === 'ar' ? 'المسؤول' : 'Administrateur'}</th>
                    <th className="px-6 py-3.5">{lang === 'ar' ? 'الجهاز والمنصة' : 'Appareil'}</th>
                    <th className="px-6 py-3.5">{lang === 'ar' ? 'المتصفح' : 'Navigateur'}</th>
                    <th className="px-6 py-3.5">{lang === 'ar' ? 'عنوان IP والموقع' : 'Adresse IP'}</th>
                    <th className="px-6 py-3.5">{lang === 'ar' ? 'تاريخ الدخول' : 'Horodatage'}</th>
                    <th className="px-6 py-3.5">{lang === 'ar' ? 'الحالة' : 'Statut'}</th>
                    <th className="px-6 py-3.5 text-center">{lang === 'ar' ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredLoginHistory.map((lh) => (
                    <tr key={lh.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-100">{lh.email}</td>
                      <td className="px-6 py-4 font-medium text-slate-300">{lh.device}</td>
                      <td className="px-6 py-4 text-slate-400">{lh.browser}</td>
                      <td className="px-6 py-4 font-mono text-slate-300 dir-ltr text-right rtl:text-right">{lh.ip_address}</td>
                      <td className="px-6 py-4 text-slate-400">{formatDate(lh.created_at)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          lh.is_active 
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' 
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${lh.is_active ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                          {lh.is_active ? (lang === 'ar' ? 'جلسة نشطة' : 'Session active') : (lang === 'ar' ? 'منتهية' : 'Expirée')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {lh.is_active && (
                          <button
                            onClick={() => handleRevokeSession(lh.id)}
                            className="bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-rose-800/60 transition-colors"
                          >
                            {lang === 'ar' ? 'إلغاء الجلسة' : 'Révoquer'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute top-3.5 right-3.5 rtl:right-3.5 ltr:left-3.5 text-slate-400" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder={lang === 'ar' ? 'البحث بالمنفذ، العملية أو السجل...' : 'Rechercher une action...'}
                className="w-full text-xs bg-slate-900 border border-slate-800 rounded-xl px-9 py-2.5 text-slate-100 placeholder-slate-400 caret-emerald-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 hover:border-slate-700 transition-colors"
              />
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {lang === 'ar' ? 'سجل غير قابل للتعديل يوثق كافة تغييرات النظام والصلاحيات.' : 'Journal d\'audit inaltérable.'}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right rtl:text-right ltr:text-left">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">{lang === 'ar' ? 'التاريخ والوقت' : 'Horodatage'}</th>
                    <th className="px-6 py-3.5">{lang === 'ar' ? 'منفذ العملية' : 'Acteur'}</th>
                    <th className="px-6 py-3.5">{lang === 'ar' ? 'وصف الإجراء' : 'Description'}</th>
                    <th className="px-6 py-3.5">{lang === 'ar' ? 'السجل المتأثر' : 'Cible'}</th>
                    <th className="px-6 py-3.5">{lang === 'ar' ? 'عنوان IP' : 'IP'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">{formatDate(log.created_at)}</td>
                      <td className="px-6 py-4 font-bold text-slate-100">{log.performed_by}</td>
                      <td className="px-6 py-4 font-medium text-emerald-400">{log.action}</td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">{log.affected_record || '-'}</td>
                      <td className="px-6 py-4 text-slate-400 font-mono dir-ltr text-right rtl:text-right">{log.ip_address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD ADMIN */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4" dir={dir}>
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h2 className="text-base font-bold text-slate-100">
                {lang === 'ar' ? 'إضافة مسؤول جديد للنظام' : 'Ajouter un administrateur'}
              </h2>
              <button onClick={() => setShowAddUserModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdminSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-xl bg-rose-950/60 border border-rose-800/60 p-3 text-xs text-rose-300 font-medium">
                  {formError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  {lang === 'ar' ? 'الاسم الكامل' : 'Nom complet'}
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Karim Mansouri"
                  className="w-full text-xs border border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-950 text-slate-100 placeholder-slate-400 caret-emerald-500 focus:outline-none focus:border-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  {lang === 'ar' ? 'البريد الإلكتروني' : 'Adresse E-mail'} *
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="admin@businessmarket.dz"
                  required
                  className="w-full text-xs border border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-950 text-slate-100 placeholder-slate-400 caret-emerald-500 focus:outline-none focus:border-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  {lang === 'ar' ? 'رقم الهاتف' : 'Téléphone'}
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+213 550 00 00 00"
                  className="w-full text-xs border border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-950 text-slate-100 placeholder-slate-400 caret-emerald-500 focus:outline-none focus:border-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  {lang === 'ar' ? 'الدور الوظيفي الممنوح' : 'Rôle'}
                </label>
                <select
                  value={formRoleId}
                  onChange={(e) => setFormRoleId(e.target.value)}
                  className="w-full text-xs border border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-950 text-slate-100 focus:outline-none focus:border-emerald-500 hover:border-slate-700 transition-colors"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id} className="bg-slate-900 text-slate-100">{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 disabled:opacity-75"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {lang === 'ar' ? 'تأكيد الحساب' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ADMIN PROFILE */}
      {showEditUserModal && editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4" dir={dir}>
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h2 className="text-base font-bold text-slate-100">
                {lang === 'ar' ? 'تعديل بيانات المسؤول' : 'Éditer l\'administrateur'}
              </h2>
              <button onClick={() => setShowEditUserModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAdminSubmit} className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <img
                  src={formAvatar || editingProfile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                  alt={formName}
                  className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/50"
                />
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {lang === 'ar' ? 'رابط الصورة Symbol Avatar URL' : 'Avatar URL'}
                  </label>
                  <input
                    type="text"
                    value={formAvatar}
                    onChange={(e) => setFormAvatar(e.target.value)}
                    placeholder="https://..."
                    className="w-full text-xs border border-slate-800 rounded-lg px-2.5 py-1.5 bg-slate-950 text-slate-100 placeholder-slate-400 caret-emerald-500 focus:outline-none focus:border-emerald-500 hover:border-slate-700 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  {lang === 'ar' ? 'الاسم الكامل' : 'Nom complet'}
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs border border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-950 text-slate-100 placeholder-slate-400 caret-emerald-500 focus:outline-none focus:border-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  {lang === 'ar' ? 'رقم الهاتف' : 'Téléphone'}
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full text-xs border border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-950 text-slate-100 placeholder-slate-400 caret-emerald-500 focus:outline-none focus:border-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  {lang === 'ar' ? 'الدور الوظيفي' : 'Rôle'}
                </label>
                <select
                  value={formRoleId}
                  onChange={(e) => setFormRoleId(e.target.value)}
                  className="w-full text-xs border border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-950 text-slate-100 focus:outline-none focus:border-emerald-500 hover:border-slate-700 transition-colors"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id} className="bg-slate-900 text-slate-100">{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-semibold text-slate-300">
                  {lang === 'ar' ? 'حالة الحساب (نشط / معطل)' : 'Statut du compte'}
                </span>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 h-5 w-5 cursor-pointer"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="flex-1 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 disabled:opacity-75"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {lang === 'ar' ? 'حفظ التغييرات' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD & TEMP PASSWORD */}
      {showPasswordModal && targetPasswordAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4" dir={dir}>
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                {lang === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Réinitialiser le mot de passe'}
              </h2>
              <button onClick={() => setShowPasswordModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                  {lang === 'ar' ? 'الحساب المستهدف:' : 'Compte cible :'}
                </span>
                <p className="text-sm font-bold text-slate-100">{targetPasswordAdmin.email}</p>
              </div>

              {/* Option 1: Send Reset Link Email */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-100">
                  {lang === 'ar' ? 'الخيار الأول: إرسال رابط مباشر لبريد المسؤول' : 'Option 1: Envoyer par email'}
                </h4>
                <button
                  type="button"
                  onClick={handleSendResetLinkEmail}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  {lang === 'ar' ? 'إرسال رابط تعيين كلمة المرور البريدي' : 'Envoyer le lien de réinitialisation'}
                </button>
              </div>

              <div className="relative border-t border-slate-800 my-2">
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-3 text-[10px] text-slate-400 font-bold uppercase">
                  {lang === 'ar' ? 'أو' : 'OU'}
                </span>
              </div>

              {/* Option 2: Temp Password Generation */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-100">
                  {lang === 'ar' ? 'الخيار الثاني: كلمة مرور مؤقتة فورية' : 'Option 2: Mot de passe temporaire'}
                </h4>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={tempPasswordGenerated}
                    className="w-full text-xs font-mono font-bold bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-emerald-400 dir-ltr text-center"
                  />
                  <button
                    type="button"
                    onClick={copyTempPassword}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors shrink-0 flex items-center gap-1.5"
                  >
                    {passwordCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {passwordCopied ? (lang === 'ar' ? 'تم النسخ' : 'Copié') : (lang === 'ar' ? 'نسخ' : 'Copier')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {showDeleteModal && deletingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4" dir={dir}>
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-800">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/60 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">
                {lang === 'ar' ? 'تأكيد حذف حساب المسؤول' : 'Confirmer la suppression'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {lang === 'ar' 
                  ? `هل أنت متأكد من حذف حساب المسؤول (${deletingAdmin.email})؟ هذا الإجراء سيؤدي إلى سحب كافة صلاحيات الدخول وإلغاء الجلسات النشطة فوراً.`
                  : `Êtes-vous sûr de vouloir supprimer le compte (${deletingAdmin.email}) ?Cette action est irréversible.`}
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAdmin}
                  disabled={saving}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 disabled:opacity-75"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {lang === 'ar' ? 'تأكيد الحذف' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE CUSTOM ROLE */}
      {showAddRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4" dir={dir}>
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h2 className="text-base font-bold text-slate-100">
                {lang === 'ar' ? 'إنشاء دور مخصص جديد' : 'Créer un rôle mâtiné'}
              </h2>
              <button onClick={() => setShowAddRoleModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomRoleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  {lang === 'ar' ? 'اسم الدور الوظيفي' : 'Nom du rôle'} *
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. B2B Account Manager"
                  required
                  className="w-full text-xs border border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-950 text-slate-100 placeholder-slate-400 caret-emerald-500 focus:outline-none focus:border-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  {lang === 'ar' ? 'وصف المسئوليات والصلاحيات' : 'Description'}
                </label>
                <textarea
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  rows={3}
                  placeholder={lang === 'ar' ? 'أدخل وصفاً توضيحياً لهذا الدور...' : 'Description du rôle...'}
                  className="w-full text-xs border border-slate-800 rounded-xl px-3.5 py-2.5 bg-slate-950 text-slate-100 placeholder-slate-400 caret-emerald-500 focus:outline-none focus:border-emerald-500 hover:border-slate-700 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRoleModal(false)}
                  className="flex-1 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 disabled:opacity-75"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {lang === 'ar' ? 'إنشاء الدور' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SQL Setup Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" dir={dir}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-slate-900 shadow-2xl overflow-hidden border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-100">
                {lang === 'ar' ? 'إعداد جداول نظام الصلاحيات (SQL)' : 'Script SQL RBAC'}
              </h2>
              <button onClick={() => setShowSqlModal(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="relative">
                <pre className="max-h-[250px] overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-300 text-left ltr:text-left rtl:text-left border border-slate-800" style={{ direction: 'ltr' }}>
                  <code>{sqlCode}</code>
                </pre>
                <button
                  onClick={copySql}
                  className="absolute top-3 right-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition"
                >
                  {copiedSql ? (lang === 'ar' ? 'تم النسخ!' : 'Copié !') : (lang === 'ar' ? 'نسخ الكود' : 'Copier')}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-800 px-6 py-4 bg-slate-950">
              <button
                onClick={() => setShowSqlModal(false)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
              >
                {lang === 'ar' ? 'إغلاق' : 'Fermer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ADMIN DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleConfirmBulkDelete}
        isDeleting={isBulkDeleting}
        title={lang === 'ar' ? 'تأكيد الحذف الجماعي لحسابات المسؤولين' : 'Confirmer la suppression des comptes'}
        description={lang === 'ar' ? `هل أنت متأكد من حذف ${selectedProfileIds.length} حساب مسؤل؟` : `Supprimer ${selectedProfileIds.length} comptes ?`}
        error={bulkDeleteError}
      />

      {/* ROLE DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={!!deleteTargetRoleId}
        onClose={() => setDeleteTargetRoleId(null)}
        onConfirm={handleConfirmDeleteRole}
        isDeleting={isDeletingRole}
        title={lang === 'ar' ? 'تأكيد حذف الدور المخصص' : 'Confirmer la suppression du rôle'}
        description={lang === 'ar' ? 'هل أنت متأكد من حذف هذا الدور المخصص؟' : 'Supprimer ce rôle ?'}
        error={deleteRoleError}
      />
    </div>
  );
}
