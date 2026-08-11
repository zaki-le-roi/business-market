import { Link, useParams, useLocation } from 'react-router-dom';
import { CheckCircle2, Package, Truck, Home } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function OrderSuccessPage() {
  const { t, dir } = useLanguage();
  const { orderNumber } = useParams();
  const location = useLocation();
  const number = (location.state as { orderNumber?: string } | null)?.orderNumber || orderNumber;

  return (
    <div className="max-w-2xl mx-auto px-4 py-16" dir={dir}>
      <div className="card p-8 text-center">
        <div className="w-20 h-20 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-scale-in">
          <CheckCircle2 className="w-12 h-12 text-accent-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('orderSuccess.title')}</h1>
        <p className="text-gray-500 mb-6">{t('orderSuccess.message')}</p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-500 mb-1">{t('orderSuccess.orderNumber')}</p>
          <p className="text-2xl font-bold text-primary-600 tracking-wider" dir="ltr">{number}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to={`/track?order=${number}`} className="btn-primary">
            <Package className="w-4 h-4" />
            {t('orderSuccess.trackOrder')}
          </Link>
          <Link to="/products" className="btn-outline">
            <Home className="w-4 h-4" />
            {t('orderSuccess.continueShopping')}
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t">
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-primary-600" />
              </div>
              <span>{t('status.pending')}</span>
            </div>
            <div className="w-8 h-px bg-gray-300" />
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <Package className="w-4 h-4 text-gray-400" />
              </div>
              <span>{t('status.processing')}</span>
            </div>
            <div className="w-8 h-px bg-gray-300" />
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <Truck className="w-4 h-4 text-gray-400" />
              </div>
              <span>{t('status.delivered')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
