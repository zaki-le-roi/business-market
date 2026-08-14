import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search, Package, CheckCircle2, Clock, XCircle,
  MapPin, Loader2
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { Order, OrderStatus } from '../../types';

const STATUS_STEPS: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered'];

export default function TrackOrderPage() {
  const { t, lang, formatPrice, formatDate, dir } = useLanguage();
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('order') || '');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!orderNumber.trim()) return;
    setLoading(true);
    setError('');
    setSearched(true);

    let query = supabase.from('orders').select('*, wilaya:wilayas(*)').eq('order_number', orderNumber.trim().toUpperCase());
    if (phone.trim()) {
      query = query.eq('customer_phone', phone.trim());
    }

    const { data, error: err } = await query.single();

    if (err || !data) {
      setError(t('tracking.notFound'));
      setOrder(null);
    } else {
      setOrder(data as Order);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (searchParams.get('order')) {
      search();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStepIndex = order ? STATUS_STEPS.indexOf(order.status) : -1;
  const isCancelled = order?.status === 'cancelled';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8" dir={dir}>
      <h1 className="text-2xl font-bold mb-6 text-center">{t('tracking.title')}</h1>

      {/* Search */}
      <div className="card p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">{t('tracking.orderNumber')} *</label>
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="input"
              placeholder="BM-00000001"
              dir="ltr"
            />
          </div>
          <div>
            <label className="label">{t('tracking.phone')}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="0555 00 00 00"
              dir="ltr"
            />
          </div>
        </div>
        <button onClick={search} disabled={loading || !orderNumber} className="btn-primary w-full mt-4">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {t('tracking.track')}
        </button>
      </div>

      {/* Results */}
      {error && (
        <div className="card p-8 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{error}</p>
        </div>
      )}

      {order && (
        <div className="space-y-4 animate-fade-in max-w-full overflow-hidden">
          {/* Status tracker */}
          <div className="card p-4 sm:p-6 overflow-x-auto max-w-full scrollbar-thin">
            {isCancelled ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <XCircle className="w-10 h-10 text-error-500" />
                </div>
                <h2 className="text-xl font-bold text-error-600">{t('status.cancelled')}</h2>
              </div>
            ) : (
              <div className="flex items-center justify-between min-w-[300px] sm:min-w-full">
                {STATUS_STEPS.map((step, i) => (
                  <div key={step} className="flex flex-col items-center flex-1 relative px-1">
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`absolute top-4 sm:top-5 ${dir === 'rtl' ? 'right-1/2' : 'left-1/2'} w-full h-1 ${i < currentStepIndex ? 'bg-accent-500' : 'bg-gray-200'}`} />
                    )}
                    <div className={`relative z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${i <= currentStepIndex ? 'bg-accent-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {i < currentStepIndex ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : i === currentStepIndex ? <Clock className="w-4 h-4 sm:w-5 sm:h-5" /> : <span className="text-xs sm:text-sm font-bold">{i + 1}</span>}
                    </div>
                    <span className={`text-[10px] sm:text-xs mt-1.5 text-center leading-tight break-words max-w-[75px] sm:max-w-none ${i <= currentStepIndex ? 'text-accent-700 font-medium' : 'text-gray-400'}`}>
                      {t(`status.${step}` as never)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order details */}
          <div className="card p-4 sm:p-5 max-w-full overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('tracking.orderNumber')}</p>
                <p className="font-bold text-primary-600 break-all" dir="ltr">{order.order_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('tracking.status')}</p>
                <span className={`badge ${order.status === 'delivered' ? 'bg-accent-100 text-accent-700' : order.status === 'cancelled' ? 'bg-error-100 text-error-700' : 'bg-primary-100 text-primary-700'}`}>
                  {t(`status.${order.status}` as never)}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('tracking.orderDate')}</p>
                <p className="text-sm">{formatDate(order.created_at)}</p>
              </div>
              {order.estimated_delivery_date && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('tracking.estimatedDelivery')}</p>
                  <p className="text-sm">{formatDate(order.estimated_delivery_date)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('tracking.paymentMethod')}</p>
                <p className="text-sm">{order.payment_method === 'cod' ? t('checkout.cod') : order.payment_method.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('tracking.deliveryAddress')}</p>
                <p className="text-sm flex items-center gap-1 flex-wrap break-words">
                  <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                  <span>
                    {order.wilaya ? (lang === 'ar' ? order.wilaya.name_ar : order.wilaya.name_fr) : ''}
                    {order.city && `, ${order.city}`}
                  </span>
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="border-t pt-4">
              <p className="font-medium mb-3">{t('tracking.items')}</p>
              <div className="space-y-2">
                {order.items.map((item, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <img src={item.image} alt="" className="w-12 h-12 object-cover rounded shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Link to={`/products/${item.slug}`} className="text-sm hover:text-primary-600 truncate block">
                        {item.name}
                      </Link>
                      <p className="text-xs text-gray-500">{item.quantity} × {formatPrice(item.price)}</p>
                    </div>
                    <p className="font-medium text-sm whitespace-nowrap shrink-0 ms-2">{formatPrice(item.subtotal)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="border-t pt-4 mt-4 space-y-1">
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('cart.subtotal')}</span>
                <span className="shrink-0">{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('cart.delivery')}</span>
                <span className="shrink-0">{formatPrice(order.delivery_fee)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-accent-600">
                  <span>{t('cart.discount')}</span>
                  <span className="shrink-0">-{formatPrice(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>{t('cart.total')}</span>
                <span className="text-primary-600 shrink-0">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          <Link to="/support" className="btn-outline w-full">
            {t('nav.support')}
          </Link>
        </div>
      )}

      {!searched && !order && (
        <div className="card p-8 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{lang === 'ar' ? 'أدخل رقم طلبك لتتبعه' : 'Entrez votre numéro de commande pour la suivre'}</p>
        </div>
      )}
    </div>
  );
}
