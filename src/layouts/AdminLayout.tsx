import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, ShoppingBag, Package, Boxes, FolderTree, Users, Building2, Megaphone,
  DollarSign, Truck, HeadphonesIcon, FileText, Image, Cpu, ShieldCheck,
  UserCheck, Activity, Bot, BarChart3, FileSpreadsheet, LogOut, Menu, X, ArrowLeft
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

export default function AdminLayout() {
  const { lang, dir } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: lang === 'ar' ? 'لوحة التحكم' : 'Dashboard' },
    { path: '/admin/orders', icon: ShoppingBag, label: lang === 'ar' ? 'الطلبات' : 'Orders' },
    { path: '/admin/products', icon: Package, label: lang === 'ar' ? 'المنتجات' : 'Products' },
    { path: '/admin/inventory', icon: Boxes, label: lang === 'ar' ? 'المخزون والمستودعات' : 'Inventory & Warehouses' },
    { path: '/admin/categories', icon: FolderTree, label: lang === 'ar' ? 'الفئات' : 'Categories' },
    { path: '/admin/customers', icon: Users, label: lang === 'ar' ? 'عملاء التجزئة' : 'Retail Customers' },
    { path: '/admin/wholesale', icon: Building2, label: lang === 'ar' ? 'عملاء الجملة (B2B)' : 'Wholesale Customers' },
    { path: '/admin/marketing', icon: Megaphone, label: lang === 'ar' ? 'التسويق' : 'Marketing' },
    { path: '/admin/finance', icon: DollarSign, label: lang === 'ar' ? 'المالية' : 'Finance' },
    { path: '/admin/shipping', icon: Truck, label: lang === 'ar' ? 'الشحن' : 'Shipping' },
    { path: '/admin/support', icon: HeadphonesIcon, label: lang === 'ar' ? 'الدعم' : 'Support' },
    { path: '/admin/cms', icon: FileText, label: lang === 'ar' ? 'المحتوى' : 'CMS' },
    { path: '/admin/banners', icon: Image, label: lang === 'ar' ? 'البانرات' : 'Banners' },
    { path: '/admin/import-export', icon: FileSpreadsheet, label: lang === 'ar' ? 'استيراد/تصدير CSV' : 'CSV Import/Export' },
    { path: '/admin/system', icon: Cpu, label: lang === 'ar' ? 'النظام والتحديثات' : 'System & Updates' },
    { path: '/admin/security', icon: ShieldCheck, label: lang === 'ar' ? 'الأمان' : 'Security' },
    { path: '/admin/administrators', icon: UserCheck, label: lang === 'ar' ? 'المشرفون' : 'Administrators' },
    { path: '/admin/observability', icon: Activity, label: lang === 'ar' ? 'المراقبة' : 'Observability' },
    { path: '/admin/automation', icon: Bot, label: lang === 'ar' ? 'الأتمتة' : 'Automation' },
    { path: '/admin/analytics', icon: BarChart3, label: lang === 'ar' ? 'التحليلات' : 'Analytics' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row" dir={dir}>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800 print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-300 hover:bg-slate-800 rounded-lg">
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <span className="font-bold text-lg text-emerald-400">Business Market Admin</span>
        </div>
        <Link to="/" className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> {lang === 'ar' ? 'المتجر' : 'Store'}
        </Link>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} z-50 w-64 bg-slate-950 border-r border-slate-800 p-4 flex flex-col justify-between transition-transform duration-200 md:static md:translate-x-0 print:hidden
        ${sidebarOpen ? 'translate-x-0' : (dir === 'rtl' ? 'translate-x-full' : '-translate-x-full')}
      `}>
        <div>
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800">
            <div>
              <h1 className="font-bold text-lg text-emerald-400">Business Market</h1>
              <p className="text-xs text-slate-400">{lang === 'ar' ? 'لوحة إدارة المتجر' : 'Admin Portal'}</p>
            </div>
          </div>

          <nav className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${isActive ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}
                  `}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-800 space-y-2">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <ArrowLeft className="w-5 h-5" />
            <span>{lang === 'ar' ? 'العودة للمتجر' : 'Return to Store'}</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-950/40 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden print:p-0 print:m-0 print:max-w-none print:w-full print:bg-white print:text-black">
        <Outlet />
      </main>
    </div>
  );
}
