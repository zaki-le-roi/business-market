import { useState, useEffect } from 'react';
import { HeadphonesIcon, MessageSquare, Send, Loader2, Package } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { SupportTicket, Customer } from '../../types';
import { normalizePhone } from '../../lib/phone';

export default function SupportPage() {
  const { t, lang, dir } = useLanguage();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [storePhone, setStorePhone] = useState('');
  const [storeEmail, setStoreEmail] = useState('');

  useEffect(() => {
    async function loadStoreInfo() {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['store_phone', 'store_email']);
      if (data) {
        const phone = data.find((s) => s.key === 'store_phone')?.value as { value?: string } | undefined;
        const email = data.find((s) => s.key === 'store_email')?.value as { value?: string } | undefined;
        if (phone?.value) setStorePhone(phone.value);
        if (email?.value) setStoreEmail(email.value);
      }
    }
    loadStoreInfo();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('customer');
    if (saved) {
      const c = JSON.parse(saved) as Customer;
      setCustomer(c);
      setPhone(c.phone);
      setName(c.full_name || '');
      loadTickets(c.phone);
    }
  }, []);

  const loadTickets = async (customerPhone: string) => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('customer_phone', customerPhone)
      .order('created_at', { ascending: false });
    if (data) setTickets(data as SupportTicket[]);
  };

  const submitTicket = async () => {
    if (!subject.trim() || !message.trim() || !phone.trim() || !name.trim()) return;
    setLoading(true);

    const ticketNumber = `TK-${Date.now().toString().slice(-6)}`;
    const normalizedPhone = normalizePhone(phone);

    await supabase.from('support_tickets').insert({
      ticket_number: ticketNumber,
      customer_id: customer?.id || null,
      customer_phone: normalizedPhone,
      customer_name: name,
      subject,
      category,
      priority: 'normal',
      status: 'open',
      messages: [{ sender: 'customer', message, created_at: new Date().toISOString() }],
    });

    setSuccess(true);
    setSubject('');
    setMessage('');
    setLoading(false);
    if (customer) loadTickets(customer.phone);
  };

  const categories = [
    { value: 'general', label_ar: 'عام', label_fr: 'Général' },
    { value: 'order', label_ar: 'طلب', label_fr: 'Commande' },
    { value: 'delivery', label_ar: 'توصيل', label_fr: 'Livraison' },
    { value: 'payment', label_ar: 'دفع', label_fr: 'Paiement' },
    { value: 'product', label_ar: 'منتج', label_fr: 'Produit' },
    { value: 'return', label_ar: 'إرجاع', label_fr: 'Retour' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" dir={dir}>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <HeadphonesIcon className="w-8 h-8 text-primary-600" />
        </div>
        <h1 className="text-2xl font-bold">{t('nav.support')}</h1>
        <p className="text-gray-500 mt-2">{lang === 'ar' ? 'نحن هنا لمساعدتك' : 'Nous sommes là pour vous aider'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* New ticket */}
        <div className="card p-5">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary-600" />
            {lang === 'ar' ? 'تذكرة دعم جديدة' : 'Nouveau ticket'}
          </h2>

          {success && (
            <div className="mb-4 p-3 bg-accent-50 text-accent-700 rounded-lg text-sm">
              {lang === 'ar' ? 'تم إرسال تذكرتك. سنتواصل معك قريباً.' : 'Ticket envoyé. Nous vous contacterons bientôt.'}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="label">{t('checkout.fullName')}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">{t('checkout.phone')}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="label">{lang === 'ar' ? 'الفئة' : 'Catégorie'}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {lang === 'ar' ? c.label_ar : c.label_fr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{lang === 'ar' ? 'الموضوع' : 'Sujet'}</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">{lang === 'ar' ? 'الرسالة' : 'Message'}</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="input" rows={4} />
            </div>
            <button onClick={submitTicket} disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {lang === 'ar' ? 'إرسال' : 'Envoyer'}
            </button>
          </div>
        </div>

        {/* Existing tickets */}
        <div>
          <h2 className="font-bold text-lg mb-4">{lang === 'ar' ? 'تذاكري' : 'Mes tickets'}</h2>
          {tickets.length === 0 ? (
            <div className="card p-8 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{lang === 'ar' ? 'لا توجد تذاكر' : 'Aucun ticket'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-sm text-primary-600" dir="ltr">{ticket.ticket_number}</p>
                    <span className={`badge text-xs ${
                      ticket.status === 'resolved' || ticket.status === 'closed' ? 'bg-accent-100 text-accent-700' :
                      ticket.status === 'pending' ? 'bg-warning-100 text-warning-700' :
                      'bg-primary-100 text-primary-700'
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                  <p className="font-medium text-sm">{ticket.subject}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {ticket.messages.length} {lang === 'ar' ? 'رسالة' : 'messages'}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="card p-4 mt-4 bg-primary-50 border-primary-200">
            <p className="text-sm text-gray-600 mb-2">{lang === 'ar' ? 'تواصل معنا مباشرة:' : 'Contactez-nous directement:'}</p>
            <p className="text-sm font-medium text-primary-700" dir="ltr">{storePhone || '+213 555 000 000'}</p>
            <p className="text-sm font-medium text-primary-700" dir="ltr">{storeEmail || 'contact@businessmarket.dz'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
