import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Product } from '../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  products?: Product[];
}

export default function AIChatbot() {
  const { t, lang, formatPrice } = useLanguage();
  const isAr = lang === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: t('ai.chatGreeting') },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const productName = (p: Product) => isAr ? p.name_ar : p.name_fr;

  const reply = (ar: string, fr: string, en: string) =>
    lang === 'ar' ? ar : lang === 'fr' ? fr : en;

  const getAIResponse = async (userMessage: string): Promise<ChatMessage> => {
    const lower = userMessage.toLowerCase();

    if (lower.includes('price') || lower.includes('سعر') || lower.includes('ثمن') || lower.includes('prix') || lower.includes('cost')) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('sales_count', { ascending: false })
        .limit(3);
      if (data && data.length > 0) {
        const productList = (data as Product[])
          .map((p) => `${productName(p)}: ${formatPrice(p.price)}`)
          .join('\n');
        return {
          role: 'assistant',
          content: reply(
            `إليك بعض منتجاتنا الأكثر مبيعاً:\n\n${productList}`,
            `Voici nos produits les plus vendus:\n\n${productList}`,
            `Here are our best-selling products:\n\n${productList}`
          ),
          products: data as Product[],
        };
      }
    }

    if (lower.includes('delivery') || lower.includes('توصيل') || lower.includes('livraison') || lower.includes('شحن') || lower.includes('shipping')) {
      return {
        role: 'assistant',
        content: reply(
          'نوفر التوصيل لجميع الولايات الـ58 في الجزائر. يمكنك اختيار التوصيل للمنزل أو التوصيل للمكتب. أسعار التوصيل تبدأ من 300 دج للجزائر العاصمة. الدفع عند الاستلام متاح في كل الولايات.',
          "Nous livrons dans les 58 wilayas d'Algérie. Vous pouvez choisir la livraison à domicile ou au bureau. Les prix commencent à 300 DA pour Alger. Le paiement à la livraison est disponible partout.",
          'We deliver to all 58 wilayas in Algeria. You can choose home delivery or desk pickup. Prices start from 300 DA for Alger. Cash on Delivery is available everywhere.'
        ),
      };
    }

    if (lower.includes('payment') || lower.includes('دفع') || lower.includes('paiement') || lower.includes('cod') || lower.includes('pay')) {
      return {
        role: 'assistant',
        content: reply(
          'نوفر الدفع عند الاستلام (COD) في جميع الولايات. كما نعمل على إضافة الدفع ببطاقات CIB والبطاقة الذهبية قريباً.',
          'Nous proposons le paiement à la livraison (COD) dans toutes les wilayas. Le paiement par carte CIB et Edahabia sera bientôt disponible.',
          'We offer Cash on Delivery (COD) in all wilayas. CIB card and Edahabia payments are coming soon.'
        ),
      };
    }

    if (lower.includes('track') || lower.includes('تتبع') || lower.includes('suivi') || lower.includes('order') || lower.includes('طلب') || lower.includes('commande')) {
      return {
        role: 'assistant',
        content: reply(
          'يمكنك تتبع طلبك من صفحة "تتبع الطلب". أدخل رقم الطلب ورقم الهاتف المستخدم في الطلب لمعرفة حالة طلبك.',
          'Vous pouvez suivre votre commande sur la page "Suivre commande". Entrez votre numéro de commande et le téléphone utilisé pour la commande.',
          'You can track your order on the "Track Order" page. Enter your order number and the phone number used to place the order.'
        ),
      };
    }

    if (lower.includes('product') || lower.includes('منتج') || lower.includes('produit') || lower.includes('search') || lower.includes('بحث')) {
      const col = isAr ? 'name_ar' : 'name_fr';
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .ilike(col, `%${userMessage}%`)
        .limit(3);
      if (data && data.length > 0) {
        return {
          role: 'assistant',
          content: reply('وجدت هذه المنتجات لك:', "J'ai trouvé ces produits pour vous:", 'I found these products for you:'),
          products: data as Product[],
        };
      }
    }

    return {
      role: 'assistant',
      content: reply(
        'أنا هنا لمساعدتك! يمكنك سؤالي عن المنتجات، الأسعار، التوصيل، طرق الدفع، أو تتبع طلبك. كيف يمكنني مساعدتك؟',
        "Je suis là pour vous aider! Vous pouvez me demander sur les produits, les prix, la livraison, les paiements, ou le suivi de commande. Comment puis-je vous aider?",
        "I'm here to help! You can ask me about products, prices, delivery, payment methods, or order tracking. How can I assist you?"
      ),
    };
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    const response = await getAIResponse(userMsg);
    setMessages((prev) => [...prev, response]);
    setLoading(false);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 end-6 z-40 w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 animate-pulse-slow"
          aria-label="AI Chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <div
          className="fixed bottom-6 end-6 z-40 w-[calc(100vw-3rem)] max-w-md bg-white rounded-2xl shadow-2xl flex flex-col animate-scale-in"
          style={{ height: 'min(600px, calc(100vh-3rem))' }}
        >
          {/* Header — black + emerald */}
          <div className="flex items-center justify-between p-4 bg-secondary-950 text-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary-600/30 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm">{t('ai.chatTitle')}</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-pulse" />
                  <span className="text-xs text-gray-400">Online</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-secondary-800 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl p-3 ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-800 shadow-sm border border-gray-100'
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{msg.content}</p>
                  {msg.products && msg.products.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.products.map((p) => (
                        <a
                          key={p.id}
                          href={`/products/${p.slug}`}
                          className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <img src={p.images[0]} alt="" className="w-10 h-10 object-cover rounded" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{productName(p)}</p>
                            <p className="text-xs text-primary-600 font-bold">{formatPrice(p.price)}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t bg-white rounded-b-2xl">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={t('ai.chatPlaceholder')}
                className="flex-1 px-4 py-2.5 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700 disabled:opacity-50 transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
