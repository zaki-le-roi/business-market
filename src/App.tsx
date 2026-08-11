import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { CartProvider } from './contexts/CartContext';
import AppUpdateChecker from './components/AppUpdateChecker';
import StoreLayout from './layouts/StoreLayout';
import AdminLayout from './layouts/AdminLayout';
import HomePage from './pages/store/HomePage';
import ProductsPage from './pages/store/ProductsPage';
import ProductDetailPage from './pages/store/ProductDetailPage';
import CartPage from './pages/store/CartPage';
import CheckoutPage from './pages/store/CheckoutPage';
import OrderSuccessPage from './pages/store/OrderSuccessPage';
import TrackOrderPage from './pages/store/TrackOrderPage';
import LoginPage from './pages/store/LoginPage';
import RegisterPage from './pages/store/RegisterPage';
import CompleteProfilePage from './pages/store/CompleteProfilePage';
import AccountPage from './pages/store/AccountPage';
import SupportPage from './pages/store/SupportPage';
import CMSPageViewer from './pages/store/CMSPageViewer';
import WholesalePortalPage from './pages/store/WholesalePortalPage';
import NotFoundPage from './pages/store/NotFoundPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminProducts from './pages/admin/AdminProducts';
import AdminCategories from './pages/admin/AdminCategories';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminMarketing from './pages/admin/AdminMarketing';
import AdminFinance from './pages/admin/AdminFinance';
import AdminWholesale from './pages/admin/AdminWholesale';
import AdminSupport from './pages/admin/AdminSupport';
import AdminCMS from './pages/admin/AdminCMS';
import AdminBanners from './pages/admin/AdminBanners';
import AdminSystem from './pages/admin/AdminSystem';
import AdminSecurity from './pages/admin/AdminSecurity';
import AdminObservability from './pages/admin/AdminObservability';
import AdminAutomation from './pages/admin/AdminAutomation';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminAdministrators from './pages/admin/AdminAdministrators';
import AdminLogin from './pages/admin/AdminLogin';
import AdminShipping from './pages/admin/AdminShipping';
import AdminCSVImportExport from './pages/admin/AdminCSVImportExport';
import AdminInventory from './pages/admin/AdminInventory';
import AndroidBackButtonHandler from './components/AndroidBackButtonHandler';

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <CartProvider>
          <BrowserRouter>
          <AndroidBackButtonHandler />
          <AppUpdateChecker />
          <Routes>
            <Route path="/" element={<StoreLayout />}>
              <Route index element={<HomePage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/:slug" element={<ProductDetailPage />} />
              <Route path="category/:slug" element={<ProductsPage />} />
              <Route path="category/:parentSlug/:childSlug" element={<ProductsPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="order/success/:orderNumber" element={<OrderSuccessPage />} />
              <Route path="track" element={<TrackOrderPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="complete-profile" element={<CompleteProfilePage />} />
              <Route path="account" element={<AccountPage />} />
              <Route path="wholesale" element={<WholesalePortalPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="p/:slug" element={<CMSPageViewer />} />
              <Route path="pages/:slug" element={<CMSPageViewer />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="marketing" element={<AdminMarketing />} />
              <Route path="finance" element={<AdminFinance />} />
              <Route path="wholesale" element={<AdminWholesale />} />
              <Route path="support" element={<AdminSupport />} />
              <Route path="cms" element={<AdminCMS />} />
              <Route path="banners" element={<AdminBanners />} />
              <Route path="system" element={<AdminSystem />} />
              <Route path="security" element={<AdminSecurity />} />
              <Route path="administrators" element={<AdminAdministrators />} />
              <Route path="observability" element={<AdminObservability />} />
              <Route path="automation" element={<AdminAutomation />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="shipping" element={<AdminShipping />} />
              <Route path="import-export" element={<AdminCSVImportExport />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </ToastProvider>
  </LanguageProvider>
  );
}
