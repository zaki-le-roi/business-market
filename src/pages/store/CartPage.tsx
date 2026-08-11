import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, Tag, X, ArrowRight, Check, Briefcase } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useCart } from '../../contexts/CartContext';
import { supabase } from '../../lib/supabase';
import { Coupon, Customer, Product } from '../../types';


export default function CartPage() {
  const { t, lang, formatPrice, dir } = useLanguage();
  const { items, removeItem, updateQuantity, subtotal, clearCart } = useCart();
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [dbProducts, setDbProducts] = useState<Record<string, Product>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem('customer');
    if (saved) { try { setCustomer(JSON.parse(saved)); } catch { /* ignore */ } }
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    async function loadProducts() {
      try {
        const productIds = items.map(i => i.product_id);
        const { data } = await supabase
          .from('products')
          .select('*')
          .in('id', productIds);
        if (data) {
          const prodMap: Record<string, Product> = {};
          data.forEach(p => {
            prodMap[p.id] = p;
          });
          setDbProducts(prodMap);
        }
      } catch (e) {
        console.error('Error fetching cart products:', e);
      }
    }
    loadProducts();
  }, [items]);

  useEffect(() => {
    const isWholesale = customer?.account_type === 'wholesale' && customer?.wholesale_status === 'approved';
    if (!isWholesale) {
      setValidationErrors({});
      return;
    }

    const errors: Record<string, string> = {};
    items.forEach(item => {
      const dbProd = dbProducts[item.product_id];
      if (dbProd) {
        const moq = dbProd.moq ?? 1;
        const inc = dbProd.qty_increment ?? 1;
        if (item.quantity < moq) {
          errors[item.product_id] = lang === 'ar'
            ? `الحد الأدنى للطلب (MOQ) هو ${moq} وحدة`
            : `La quantité minimale de commande (MOQ) est de ${moq} unités.`;
        } else if (inc > 1 && (item.quantity - moq) % inc !== 0) {
          errors[item.product_id] = lang === 'ar'
            ? `الكمية يجب أن تكون بمضاعفات ${inc} بعد الحد الأدنى (${moq})`
            : `La quantité doit être un multiple de ${inc} après le MOQ (${moq}).`;
        }
      }
    });
    setValidationErrors(errors);
  }, [items, dbProducts, customer, lang]);

  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  const discount = appliedCoupon
    ? appliedCoupon.discount_type === 'percentage'
      ? Math.min(
          (subtotal * appliedCoupon.discount_value) / 100,
          appliedCoupon.max_discount_amount || Infinity
        )
      : Math.min(appliedCoupon.discount_value, appliedCoupon.max_discount_amount || Infinity)
    : 0;

  const total = Math.max(0, subtotal - discount);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError('');
    setCouponSuccess('');

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !data) {
      setCouponError(t('cart.couponInvalid'));
      return;
    }

    if (data.min_order_amount && subtotal < data.min_order_amount) {
      setCouponError(
        lang === 'ar'
          ? `الحد الأدنى للطلب ${formatPrice(data.min_order_amount)}`
          : `Minimum de commande ${formatPrice(data.min_order_amount)}`
      );
      return;
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      setCouponError(t('cart.couponInvalid'));
      return;
    }

    setAppliedCoupon(data as Coupon);
    setCouponSuccess(t('cart.couponApplied'));
  };

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16" dir={dir}>
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <ShoppingBag className="w-12 h-12 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('cart.empty')}</h1>
          <p className="text-gray-500 mb-6">{t('cart.emptyDesc')}</p>
          <Link to="/products" className="btn-primary">
            {t('cart.continueShopping')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" dir={dir}>
      <h1 className="text-2xl font-bold mb-6">{t('cart.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div key={item.product_id} className="card p-4 flex gap-4">
              <Link to={`/products/${item.slug}`}>
                <img src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded-lg" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/products/${item.slug}`}>
                  <h3 className="font-medium text-gray-900 hover:text-primary-600 transition-colors line-clamp-2">
                    {item.name}
                  </h3>
                </Link>
                <p className="text-primary-600 font-bold text-lg mt-1">{formatPrice(item.price)}</p>
                {validationErrors[item.product_id] && (
                  <p className="text-xs font-semibold text-rose-600 mt-1.5 p-2 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    {validationErrors[item.product_id]}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-r-lg"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock_quantity}
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-l-lg disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.product_id)}
                    className="text-error-500 hover:text-error-600 text-sm flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('cart.removeItem')}
                  </button>
                </div>
              </div>
              <div className="text-end">
                <p className="font-bold text-lg">{formatPrice(item.price * item.quantity)}</p>
              </div>
            </div>
          ))}

          <div className="flex justify-between items-center pt-2">
            <button onClick={clearCart} className="text-sm text-error-500 hover:text-error-600">
              {lang === 'ar' ? 'إفراغ السلة' : 'Vider le panier'}
            </button>
            <Link to="/products" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              {t('cart.continueShopping')}
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
            {customer?.account_type === 'wholesale' && customer?.wholesale_status === 'approved' && (
              <Link to="/wholesale/bulk-order" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {lang === 'ar' ? 'طلب جملة سريع' : 'Commande en gros'}
              </Link>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-24">
            <h2 className="font-bold text-lg mb-4">{t('checkout.orderSummary')}</h2>

            {/* Coupon */}
            <div className="mb-4">
              <label className="label">{t('cart.couponCode')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="WELCOME10"
                  className="input flex-1 uppercase"
                />
                <button onClick={applyCoupon} className="btn-outline px-4">
                  <Tag className="w-4 h-4" />
                  {t('cart.applyCoupon')}
                </button>
              </div>
              {couponError && <p className="text-error-500 text-sm mt-1">{couponError}</p>}
              {couponSuccess && (
                <div className="flex items-center gap-1 text-accent-600 text-sm mt-1">
                  <Check className="w-4 h-4" />
                  {couponSuccess}
                  {appliedCoupon && (
                    <button
                      onClick={() => { setAppliedCoupon(null); setCouponSuccess(''); setCouponCode(''); }}
                      className="ms-auto text-gray-400 hover:text-error-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-between text-gray-600">
                <span>{t('cart.subtotal')}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-accent-600">
                  <span>{t('cart.discount')}</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>{t('cart.delivery')}</span>
                <span className="text-gray-400">{lang === 'ar' ? 'يحسب عند الدفع' : 'Calculé au paiement'}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>{t('cart.total')}</span>
                <span className="text-primary-600">{formatPrice(total)}</span>
              </div>
            </div>

            {Object.keys(validationErrors).length > 0 && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-semibold">
                {lang === 'ar' 
                  ? 'يرجى تصحيح كميات منتجات الجملة لتتوافق مع الحد الأدنى والعبوات قبل إتمام الطلب.'
                  : 'Veuillez corriger les quantités de gros pour respecter les MOQ et paquets avant de commander.'}
              </div>
            )}

            <button
              onClick={() => navigate('/checkout', { state: { coupon: appliedCoupon?.code } })}
              disabled={Object.keys(validationErrors).length > 0}
              className="btn-primary w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('cart.checkout')}
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
              <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIxMCIgd2lkdGg9IjE4IiBoZWlnaHQ9IjQiIHJ4PSIxIi8+PC9zdmc+" alt="COD" className="w-6 h-6" />
              {t('checkout.cod')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
