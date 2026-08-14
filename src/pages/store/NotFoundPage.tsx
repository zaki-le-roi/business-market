import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function NotFoundPage() {
  const { t, lang, dir } = useLanguage();
  return (
    <div dir={dir} className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center px-4 py-24 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-50">
        <Package className="h-10 w-10 text-gray-300" />
      </div>
      <h1 className="mt-6 text-2xl font-extrabold text-gray-900">
        {lang === 'ar' ? 'الصفحة غير موجودة' : 'Page introuvable'}
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        {lang === 'ar'
          ? 'عذراً، الصفحة التي تبحث عنها غير موجودة.'
          : 'Désolé, la page que vous recherchez est introuvable.'}
      </p>
      <Link
        to="/"
        className="mt-6 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600"
      >
        {t('nav.home')}
      </Link>
    </div>
  );
}
