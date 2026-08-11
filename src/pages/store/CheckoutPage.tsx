import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  User, Phone, Mail, Truck, Building2, Home,
  CreditCard, ShieldCheck, Check, Loader2,
  KeyRound, AlertCircle, Tag, X, Copy, Briefcase
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { Wilaya, Coupon, DeliveryType, Customer, PaymentTerms } from '../../types';
import { ALL_WILAYAS } from '../../constants/wilayas';
import { generateOtp, isValidAlgerianPhone, normalizePhone } from '../../lib/phone';
import { isWholesaleCustomer } from '../../lib/wholesale';
import { calculateShippingFee, getShippingProviders, createShipmentForOrder } from '../../lib/shipping/manager';
import { ShippingQuote } from '../../lib/shipping/types';
import { processDomainEvent } from '../../lib/automationEngine';

export default function CheckoutPage() {
  const { t, lang, formatPrice, dir } = useLanguage();
  const { items, subtotal, clearCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const couponCode = (location.state as { coupon?: string } | null)?.coupon || '';

  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [communesByWilaya, setCommunesByWilaya] = useState<Record<string, { id: string; name_ar: string; name_fr: string; daira?: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedWilaya, setSelectedWilaya] = useState<number | ''>('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('home');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cod');
  const [notes, setNotes] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponInput, setCouponInput] = useState(couponCode);
  const [couponError, setCouponError] = useState('');
  interface CustomPaymentMethod {
    id: string;
    name_ar: string;
    name_fr: string;
    description_ar: string;
    description_fr: string;
    icon_url: string;
    is_active: boolean;
    sort_order?: number;
  }

  const [dynamicPaymentMethods, setDynamicPaymentMethods] = useState<CustomPaymentMethod[]>([]);

  useEffect(() => {
    async function fetchPaymentMethods() {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'payment_methods')
          .single();
        if (data?.value && Array.isArray(data.value)) {
          const activeMethods = (data.value as CustomPaymentMethod[]).filter((m) => m.is_active);
          setDynamicPaymentMethods(activeMethods);
          if (activeMethods.length > 0) {
            setPaymentMethod(activeMethods[0].id);
          }
        } else {
          const defaultMethods: CustomPaymentMethod[] = [
            { id: 'cod', name_ar: 'الدفع عند الاستلام', name_fr: 'Paiement à la livraison', description_ar: 'ادفع نقداً عند استلام طلبيتك', description_fr: 'Payez en espèces à la réception de votre commande', is_active: true, icon_url: '', sort_order: 1 },
            { id: 'baridimob', name_ar: 'بريدي موب (BaridiMob)', name_fr: 'BaridiMob', description_ar: 'الدفع عبر تطبيق بريدي موب', description_fr: 'Payez via l\'application BaridiMob', is_active: true, icon_url: '', sort_order: 2 },
            { id: 'ccp', name_ar: 'حوالة بريدية (CCP)', name_fr: 'Virement CCP', description_ar: 'الدفع عبر الحساب الجاري البريدي', description_fr: 'Payez par virement CCP postal', is_active: true, icon_url: '', sort_order: 3 }
          ];
          setDynamicPaymentMethods(defaultMethods);
          setPaymentMethod('cod');
        }
      } catch (err) {
        console.warn('Error loading dynamic payment methods:', err);
      }
    }
    fetchPaymentMethods();
  }, []);

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpCopied, setOtpCopied] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [formError, setFormError] = useState('');

  // Wholesale state
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [poNumber, setPoNumber] = useState('');
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms[]>([]);
  const [selectedPaymentTermsId, setSelectedPaymentTermsId] = useState<string>('');
  const [useCreditAccount, setUseCreditAccount] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [creditLimit, setCreditLimit] = useState(0);

  const isWholesale = isWholesaleCustomer(customer);

  useEffect(() => {
    const saved = localStorage.getItem('customer');
    if (saved) { try { setCustomer(JSON.parse(saved)); } catch { /* ignore */ } }
  }, []);

  // Load payment terms for wholesale customers
  useEffect(() => {
    if (!isWholesale) return;
    (async () => {
      const { data } = await supabase.from('payment_terms').select('*').eq('is_active', true).order('days', { ascending: true });
      setPaymentTerms((data || []) as PaymentTerms[]);
      if (customer?.payment_terms_id) setSelectedPaymentTermsId(customer.payment_terms_id);
    })();
    // Load credit account
    if (customer) {
      setCreditLimit(customer.credit_limit || 0);
      setCreditBalance(customer.credit_balance || 0);
    }
  }, [isWholesale, customer]);

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase
        .from('wilayas')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (data && data.length > 0) {
        setWilayas(data as Wilaya[]);
      } else {
        setWilayas(ALL_WILAYAS);
      }

      const { data: cData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'communes_by_wilaya')
        .maybeSingle();
      if (cData) {
        setCommunesByWilaya((cData.value as unknown as { value: Record<string, { id: string; name_ar: string; name_fr: string; daira?: string }[]> }).value || {});
      }

      setLoading(false);
    }
    loadData();
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Auto-apply coupon from cart
  useEffect(() => {
    if (couponCode) {
      applyCoupon(couponCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedWilayaData = wilayas.find((w) => w.id === selectedWilaya);
  
  // Carrier Quotes state
  const [carrierQuotes, setCarrierQuotes] = useState<ShippingQuote[]>([]);
  const [selectedCarrierQuote, setSelectedCarrierQuote] = useState<ShippingQuote | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  const selectedWilayaCode = selectedWilayaData?.code;

  useEffect(() => {
    if (!selectedWilayaCode) {
      setCarrierQuotes([]);
      setSelectedCarrierQuote(null);
      return;
    }

    const fetchQuotes = async () => {
      setLoadingQuotes(true);
      try {
        const providers = await getShippingProviders();
        const activeProviders = providers.filter(p => p.is_active);

        const quotes: ShippingQuote[] = [];
        for (const prov of activeProviders) {
          const res = await calculateShippingFee(Number(selectedWilayaCode), deliveryType === 'desk' ? 'stop_desk' : 'home', subtotal, prov.id);
          if (res) {
            quotes.push({
              providerId: prov.id,
              providerName: lang === 'ar' ? prov.name_ar : prov.name_fr,
              price: res.shippingFee,
              isFreeShipping: res.isFreeShipping,
              deliveryDays: 2,
              success: true
            });
          }
        }

        setCarrierQuotes(quotes);

        if (quotes.length > 0) {
          const defaultProv = activeProviders.find(p => p.is_default);
          const defaultQuote = quotes.find(q => q.providerId === defaultProv?.id) || quotes[0];
          setSelectedCarrierQuote(defaultQuote);
        } else {
          setSelectedCarrierQuote(null);
        }
      } catch (err) {
        console.error('Failed to calculate carrier quotes:', err);
      } finally {
        setLoadingQuotes(false);
      }
    };

    fetchQuotes();
  }, [selectedWilayaCode, deliveryType, subtotal, lang]);

  const deliveryFee = selectedWilayaData
    ? deliveryType === 'home'
      ? selectedWilayaData.home_delivery_price
      : selectedWilayaData.desk_delivery_price
    : 0;

  const estimatedDays = selectedWilayaData
    ? deliveryType === 'home'
      ? selectedWilayaData.home_delivery_days
      : selectedWilayaData.desk_delivery_days
    : 0;

  // Dynamic pricing overrides from connected carriers
  const finalDeliveryFee = selectedCarrierQuote
    ? selectedCarrierQuote.price
    : deliveryFee;

  const finalEstimatedDays = selectedCarrierQuote
    ? selectedCarrierQuote.deliveryDays
    : estimatedDays;

  const discount = appliedCoupon
    ? appliedCoupon.discount_type === 'percentage'
      ? Math.min((subtotal * appliedCoupon.discount_value) / 100, appliedCoupon.max_discount_amount || Infinity)
      : Math.min(appliedCoupon.discount_value, appliedCoupon.max_discount_amount || Infinity)
    : 0;

  const total = Math.max(0, subtotal - discount + finalDeliveryFee);
  const availableCredit = Math.max(0, creditLimit - creditBalance);
  const creditSufficient = useCreditAccount && total <= availableCredit;

  const applyCoupon = async (code: string) => {
    if (!code.trim()) return;
    setCouponError('');
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('is_active', true)
      .single();
    if (!data) {
      setCouponError(t('cart.couponInvalid'));
      return;
    }
    if (data.min_order_amount && subtotal < data.min_order_amount) {
      setCouponError(lang === 'ar' ? `الحد الأدنى ${formatPrice(data.min_order_amount)}` : `Minimum ${formatPrice(data.min_order_amount)}`);
      return;
    }
    setAppliedCoupon(data as Coupon);
  };

  const sendOtp = async () => {
    if (!phone.trim()) {
      setOtpError(lang === 'ar' ? 'أدخل رقم الهاتف' : 'Entrez le téléphone');
      return;
    }
    if (!isValidAlgerianPhone(phone)) {
      setOtpError(lang === 'ar' ? 'رقم هاتف غير صحيح' : 'Numéro invalide');
      return;
    }

    setOtpSending(true);
    setOtpError('');
    const normalizedPhone = normalizePhone(phone);
    const code = generateOtp();

    await supabase.from('otp_codes').insert({
      phone: normalizedPhone,
      code,
      purpose: 'order',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    setGeneratedOtp(code);
    setOtpSent(true);
    setOtpSending(false);
    setResendTimer(60);
  };

  const verifyOtp = async () => {
    if (!otpCode.trim() || otpCode.length !== 6) {
      setOtpError(lang === 'ar' ? 'أدخل 6 أرقام' : 'Entrez 6 chiffres');
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    const { data } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('code', otpCode)
      .eq('purpose', 'order')
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data || new Date(data.expires_at) < new Date()) {
      setOtpError(lang === 'ar' ? 'رمز غير صحيح أو منتهي' : 'Code invalide ou expiré');
      return;
    }

    await supabase.from('otp_codes').update({ is_used: true }).eq('id', data.id);
    setOtpVerified(true);
    setOtpError('');
  };

  const validateForm = () => {
    if (!fullName.trim()) return t('checkout.fillAllFields');
    if (!phone.trim() || !isValidAlgerianPhone(phone)) return lang === 'ar' ? 'رقم هاتف غير صحيح' : 'Téléphone invalide';
    if (!otpVerified) return t('checkout.verifyPhoneFirst');
    if (!selectedWilaya) return t('checkout.fillAllFields');
    if (deliveryType === 'home' && !address.trim()) return t('checkout.fillAllFields');
    if (!city.trim()) return t('checkout.fillAllFields');
    return null;
  };

  const placeOrder = async () => {
    console.log('[CheckoutPage] Starting placeOrder flow...');
    const error = validateForm();
    if (error) {
      console.log('[CheckoutPage] Form validation failed:', error);
      setFormError(error);
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const normalizedPhone = normalizePhone(phone);
      const orderNumber = `BM-${Date.now().toString().slice(-8)}`;
      console.log('[CheckoutPage] Generated Order Number:', orderNumber);

      // Create or update customer
      console.log('[CheckoutPage] Querying existing customer with phone:', normalizedPhone);
      const { data: existingCustomer, error: customerFetchError } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (customerFetchError) {
        console.error('[CheckoutPage] Error fetching customer:', customerFetchError);
        throw new Error(`Failed to check customer: ${customerFetchError.message}`);
      }

      let customerId = existingCustomer?.id;

      if (!existingCustomer) {
        console.log('[CheckoutPage] Customer does not exist. Creating guest customer...');
        const { data: newCustomer, error: customerInsertError } = await supabase
          .from('customers')
          .insert({
            phone: normalizedPhone,
            full_name: fullName,
            email: email || null,
            is_verified: true,
            is_guest: true,
            wilaya_id: selectedWilaya as number,
            address: address || null,
            city,
            total_orders: 1,
            total_spent: total,
            segment: 'new',
          })
          .select()
          .single();

        if (customerInsertError) {
          console.error('[CheckoutPage] Error inserting new customer:', customerInsertError);
          throw new Error(`Failed to create customer record: ${customerInsertError.message}`);
        }
        customerId = newCustomer?.id;
        console.log('[CheckoutPage] Created new customer with ID:', customerId);
      } else {
        console.log('[CheckoutPage] Customer exists with ID:', customerId, '. Updating...');
        const { error: customerUpdateError } = await supabase
          .from('customers')
          .update({
            full_name: fullName,
            email: email || existingCustomer.email,
            wilaya_id: selectedWilaya as number,
            address: address || existingCustomer.address,
            city: city || existingCustomer.city,
            total_orders: (existingCustomer.total_orders || 0) + 1,
            total_spent: (existingCustomer.total_spent || 0) + total,
            segment: existingCustomer.total_orders >= 10 ? 'vip' : existingCustomer.total_orders >= 3 ? 'regular' : 'new',
          })
          .eq('id', existingCustomer.id);

        if (customerUpdateError) {
          console.error('[CheckoutPage] Error updating customer:', customerUpdateError);
          throw new Error(`Failed to update customer record: ${customerUpdateError.message}`);
        }
        console.log('[CheckoutPage] Updated existing customer.');
      }

      // Create order
      console.log('[CheckoutPage] Formatting order items...');
      const orderItems = items.map((i) => ({
        product_id: i.product_id,
        name: i.name,
        slug: i.slug,
        image: i.image,
        price: i.price,
        quantity: i.quantity,
        subtotal: i.price * i.quantity,
      }));

      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + finalEstimatedDays);

      console.log('[CheckoutPage] Inserting order into Supabase orders table...');
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_id: customerId || null,
          customer_phone: normalizedPhone,
          customer_name: fullName,
          customer_email: email || null,
          wilaya_id: selectedWilaya as number,
          delivery_type: deliveryType,
          address: address || null,
          city,
          items: orderItems,
          subtotal,
          delivery_fee: finalDeliveryFee,
          discount_amount: discount,
          total,
          payment_method: useCreditAccount ? 'credit' : paymentMethod,
          payment_status: useCreditAccount ? 'pending' : 'pending',
          status: 'pending',
          coupon_code: appliedCoupon?.code || null,
          notes: notes || null,
          is_phone_verified: true,
          estimated_delivery_date: estimatedDate.toISOString().split('T')[0],
        })
        .select()
        .single();

      if (orderError) {
        console.error('[CheckoutPage] Supabase Order Insertion Error:', orderError);
        throw new Error(`Database error creating order: ${orderError.message} (${orderError.code || 'no-code'})`);
      }

      console.log('[CheckoutPage] Order inserted successfully! ID:', order.id);

      // Trigger Automation Engine for OrderCreated event
      try {
        processDomainEvent('OrderCreated', {
          orderId: order.id,
          customerEmail: email,
          items: orderItems,
        }).catch((autoErr) => console.warn('[CheckoutPage] Automation trigger warning:', autoErr));
      } catch (autoErr) {
        console.warn('[CheckoutPage] Automation engine trigger failed:', autoErr);
      }

      // Add status history
      console.log('[CheckoutPage] Adding order status history...');
      const { error: historyError } = await supabase.from('order_status_history').insert({
        order_id: order.id,
        status: 'pending',
        notes: 'Order created',
        created_by: 'customer',
      });
      if (historyError) {
        console.error('[CheckoutPage] Non-blocking warning: Failed to create order status history:', historyError);
      }

      // Decrement stock
      console.log('[CheckoutPage] Decrementing stock for items...');
      for (const item of items) {
        try {
          await supabase.rpc('decrement_stock', {
            product_id: item.product_id,
            quantity: item.quantity,
          }).then(async (rpcRes) => {
            if (rpcRes.error) {
              console.warn('[CheckoutPage] RPC decrement_stock failed, trying direct update fallback...', rpcRes.error);
              const itemStock = (item as unknown as { stock_quantity?: number; sales_count?: number }).stock_quantity || 0;
              const itemSales = (item as unknown as { stock_quantity?: number; sales_count?: number }).sales_count || 0;
              const { error: directUpdateError } = await supabase
                .from('products')
                .update({
                  stock_quantity: Math.max(0, itemStock - item.quantity),
                  sales_count: itemSales + item.quantity,
                })
                .eq('id', item.product_id);
              if (directUpdateError) {
                console.error('[CheckoutPage] Fallback direct update also failed:', directUpdateError);
              }
            }
          });
        } catch (stockErr) {
          console.error('[CheckoutPage] Error updating stock for product:', item.product_id, stockErr);
        }
      }

      // Update coupon usage
      if (appliedCoupon) {
        console.log('[CheckoutPage] Updating coupon usage count...');
        const { error: couponUpdateErr } = await supabase
          .from('coupons')
          .update({ used_count: (appliedCoupon.used_count || 0) + 1 })
          .eq('id', appliedCoupon.id);
        if (couponUpdateErr) {
          console.error('[CheckoutPage] Non-blocking warning: Failed to update coupon:', couponUpdateErr);
        }
      }

      // Log audit
      console.log('[CheckoutPage] Logging audit trail...');
      const { error: auditError } = await supabase.from('audit_logs').insert({
        actor: normalizedPhone,
        action: 'OrderCreated',
        entity_type: 'order',
        entity_id: order.id,
        details: { order_number: orderNumber, total },
      });
      if (auditError) {
        console.error('[CheckoutPage] Non-blocking warning: Failed to create audit log:', auditError);
      }

      // Generate invoice safely
      console.log('[CheckoutPage] Creating invoice record if supported...');
      try {
        const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
        const dueDate = new Date();
        const terms = paymentTerms.find((pt) => pt.id === selectedPaymentTermsId);
        dueDate.setDate(dueDate.getDate() + (terms?.days || 0));
        
        const { error: invoiceErr } = await supabase.from('wholesale_invoices').insert({
          invoice_number: invoiceNumber,
          order_id: order.id,
          customer_id: customerId || null,
          total_amount: total,
          due_date: dueDate.toISOString(),
          status: 'unpaid'
        });
        if (invoiceErr) {
          console.warn('[CheckoutPage] Failed to write to wholesale_invoices (expected if schema not migrated):', invoiceErr.message);
        } else {
          console.log('[CheckoutPage] Created wholesale invoice successfully.');
        }
      } catch (invoiceEx) {
        console.warn('[CheckoutPage] Exception during invoice generation (non-blocking):', invoiceEx);
      }

      // Charge credit account if used
      if (useCreditAccount && customerId) {
        console.log('[CheckoutPage] Processing credit account charge...');
        try {
          const { data: creditAcct, error: creditAcctError } = await supabase.from('credit_accounts').select('*').eq('customer_id', customerId).maybeSingle();
          if (creditAcctError) {
            console.error('[CheckoutPage] Error querying credit account:', creditAcctError);
          } else if (creditAcct) {
            const newBalance = (creditAcct as { credit_balance: number }).credit_balance + total;
            const newAvailable = (creditAcct as { credit_limit: number }).credit_limit - newBalance;
            await supabase.from('credit_accounts').update({
              credit_balance: newBalance,
              available_credit: newAvailable,
            }).eq('id', (creditAcct as { id: string }).id);
            await supabase.from('credit_transactions').insert({
              credit_account_id: (creditAcct as { id: string }).id,
              order_id: order.id,
              type: 'charge',
              amount: total,
              balance_after: newBalance,
              description: `Order ${orderNumber}`,
              reference_number: poNumber || orderNumber,
            });
            await supabase.from('customers').update({
              credit_balance: creditBalance + total,
            }).eq('id', customerId);
            console.log('[CheckoutPage] Successfully charged credit account.');
          }
        } catch (creditEx) {
          console.error('[CheckoutPage] Exception during credit account charge (non-blocking):', creditEx);
        }
      }

      // Create background shipment if carrier integration is active
      if (selectedCarrierQuote) {
        console.log('[CheckoutPage] Creating background shipment via carrier quote...');
        try {
          await createShipmentForOrder({
            order_id: order.id,
            provider_id: selectedCarrierQuote.providerId,
            delivery_type: deliveryType === 'desk' ? 'stop_desk' : 'home',
            shipping_fee: finalDeliveryFee,
            cod_amount: total,
            recipient_name: fullName,
            recipient_phone: normalizedPhone,
            recipient_wilaya_id: Number(selectedWilaya),
            recipient_address: address,
            recipient_commune: city,
          });
          console.log('[CheckoutPage] Carrier shipment created successfully.');
        } catch (err) {
          console.error('[CheckoutPage] Failed to create carrier shipment during checkout:', err);
        }
      }

      console.log('[CheckoutPage] Ordering complete! Clearing cart and navigating...');
      clearCart();
      setSubmitting(false);

      // Trigger localized purchase success toast
      const purchaseSuccessMsg = lang === 'ar' 
        ? `شكراً لك! تم تقديم طلبك رقم ${orderNumber} بنجاح.` 
        : lang === 'fr' 
        ? `Merci ! Votre commande n° ${orderNumber} a été enregistrée avec succès.` 
        : `Thank you! Your order #${orderNumber} has been placed successfully.`;
      showToast(purchaseSuccessMsg, 'success', 5000);

      navigate(`/order/success/${orderNumber}`, { state: { orderNumber } });

    } catch (err: unknown) {
      const error = err as Error;
      console.error('[CheckoutPage] Critical error in placeOrder flow:', error);
      const exactMsg = error.message || String(error);
      setFormError(lang === 'ar' ? `فشل الطلب: ${exactMsg}` : `Échec de commande: ${exactMsg}`);
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center" dir={dir}>
        <p className="text-gray-500 mb-4">{t('cart.empty')}</p>
        <Link to="/products" className="btn-primary">{t('cart.continueShopping')}</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center" dir={dir}>
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" dir={dir}>
      <h1 className="text-2xl font-bold mb-6">{t('checkout.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <div className="card p-5">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary-600" />
              {t('checkout.contactInfo')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('checkout.fullName')} *</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" placeholder={lang === 'ar' ? 'محمد بن علي' : 'Mohamed Benali'} />
              </div>
              <div>
                <label className="label">{t('checkout.phone')} *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-gray-400" />
                  <input value={phone} onChange={(e) => { setPhone(e.target.value); setOtpVerified(false); setOtpSent(false); }} className="input ps-10" placeholder="0555 00 00 00" dir="ltr" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="label">{t('checkout.email')}</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-gray-400" />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="input ps-10" placeholder="email@example.com" dir="ltr" />
                </div>
              </div>
            </div>

            {/* OTP Verification */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              {!otpSent ? (
                <button onClick={sendOtp} disabled={otpSending || !phone} className="btn-outline w-full sm:w-auto">
                  {otpSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  {lang === 'ar' ? 'إرسال رمز التحقق' : 'Envoyer le code OTP'}
                </button>
              ) : otpVerified ? (
                <div className="flex items-center gap-2 text-accent-600">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">{lang === 'ar' ? 'تم التحقق من رقم الهاتف' : 'Téléphone vérifié'}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    {t('checkout.otpSent')} <span className="font-bold" dir="ltr">{phone}</span>
                  </p>
                  {/* OTP display box */}
                  <div className="bg-primary-50 border-2 border-primary-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-primary-600 font-medium mb-1">
                      {lang === 'ar' ? 'رمز التحقق' : lang === 'fr' ? 'Code de vérification' : 'Verification code'}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl font-bold tracking-[0.25em] text-primary-700" dir="ltr">{generatedOtp}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(generatedOtp); setOtpCode(generatedOtp); setOtpCopied(true); setTimeout(() => setOtpCopied(false), 2000); }}
                        className="p-1.5 rounded bg-primary-100 hover:bg-primary-200 text-primary-700 transition-colors"
                      >
                        {otpCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="input flex-1 text-center text-lg tracking-widest font-mono"
                      placeholder="000000"
                      dir="ltr"
                      maxLength={6}
                      autoFocus
                    />
                    <button onClick={verifyOtp} className="btn-primary">
                      <Check className="w-4 h-4" />
                      {t('checkout.verifyOtp')}
                    </button>
                  </div>
                  {otpError && <p className="text-error-500 text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4" />{otpError}</p>}
                  {resendTimer > 0 ? (
                    <p className="text-xs text-gray-500">
                      {lang === 'ar' ? `إعادة الإرسال خلال ${resendTimer}ث` : lang === 'fr' ? `Renvoyer dans ${resendTimer}s` : `Resend in ${resendTimer}s`}
                    </p>
                  ) : (
                    <button onClick={sendOtp} className="text-sm text-primary-600 hover:text-primary-700">
                      {t('checkout.resendOtp')}
                    </button>
                  )}
                </div>
              )}
              {otpError && !otpSent && <p className="text-error-500 text-sm mt-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{otpError}</p>}
            </div>
          </div>

          {/* Delivery Info */}
          <div className="card p-5">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary-600" />
              {t('checkout.deliveryInfo')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">{t('checkout.wilaya')} *</label>
                <select
                  value={selectedWilaya}
                  onChange={(e) => {
                    setSelectedWilaya(e.target.value ? Number(e.target.value) : '');
                    setCity('');
                  }}
                  className="input"
                >
                  <option value="">{t('checkout.selectWilaya')}</option>
                  {wilayas.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} - {lang === 'ar' ? w.name_ar : w.name_fr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">{t('checkout.deliveryType')} *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDeliveryType('home')}
                    className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${deliveryType === 'home' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <Home className="w-6 h-6 text-primary-600" />
                    <span className="font-medium text-sm">{t('checkout.homeDelivery')}</span>
                    {selectedWilayaData && <span className="text-xs text-gray-500">{formatPrice(selectedWilayaData.home_delivery_price)}</span>}
                  </button>
                  <button
                    onClick={() => setDeliveryType('desk')}
                    className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-all ${deliveryType === 'desk' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <Building2 className="w-6 h-6 text-primary-600" />
                    <span className="font-medium text-sm">{t('checkout.deskDelivery')}</span>
                    {selectedWilayaData && <span className="text-xs text-gray-500">{formatPrice(selectedWilayaData.desk_delivery_price)}</span>}
                  </button>
                </div>
              </div>

              {deliveryType === 'home' && (
                <div>
                  <label className="label">{t('checkout.address')} *</label>
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} className="input" rows={2} placeholder={lang === 'ar' ? 'الحي، الشارع، رقم المنزل' : 'Quartier, rue, numéro'} />
                </div>
              )}

              <div>
                <label className="label">{t('checkout.city')} *</label>
                {selectedWilaya && communesByWilaya[String(selectedWilaya)]?.length > 0 ? (
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="input"
                    required
                  >
                    <option value="">{lang === 'ar' ? 'اختر البلدية' : 'Sélectionner commune'}</option>
                    {communesByWilaya[String(selectedWilaya)].map((c) => (
                      <option key={c.id} value={lang === 'ar' ? c.name_ar : c.name_fr}>
                        {lang === 'ar' ? c.name_ar : c.name_fr}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="input"
                    placeholder={lang === 'ar' ? 'المدينة / البلدية' : 'Ville / Commune'}
                    required
                  />
                )}
              </div>

              {/* Dynamic Shipping Carrier Integrations Selector */}
              {selectedWilaya && (
                <div className="border-t border-gray-100 pt-4 mt-2">
                  <label className="label block font-bold text-gray-700 mb-2">
                    {lang === 'ar' ? 'اختر شركة التوصيل المتاحة *' : 'Sélectionner le transporteur disponible *'}
                  </label>
                  
                  {loadingQuotes ? (
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center gap-3">
                      <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
                      <span className="text-xs text-gray-500 font-semibold">
                        {lang === 'ar' ? 'جاري جلب أسعار شركات الشحن وتكاليف الولايات...' : 'Récupération des tarifs transporteurs...'}
                      </span>
                    </div>
                  ) : carrierQuotes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {carrierQuotes.map((q) => (
                        <button
                          key={q.providerId}
                          type="button"
                          onClick={() => setSelectedCarrierQuote(q)}
                          className={`p-3.5 border-2 rounded-xl flex items-center justify-between transition-all text-left ${
                            selectedCarrierQuote?.providerId === q.providerId
                              ? 'border-primary-600 bg-primary-50/50 shadow-sm'
                              : 'border-gray-100 hover:border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0">
                              {selectedCarrierQuote?.providerId === q.providerId && (
                                <span className="w-3 h-3 rounded-full bg-primary-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-xs">{q.providerName}</p>
                              <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                                {lang === 'ar' ? `التوصيل في غضون ${q.deliveryDays} أيام` : `Livraison en ${q.deliveryDays} jours`}
                              </p>
                            </div>
                          </div>
                          <span className="font-bold text-xs text-primary-700 font-mono">
                            {formatPrice(q.price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-xl text-[11px] text-gray-500">
                      {lang === 'ar'
                        ? 'توصيل قياسي (التسعيرة الرسمية للولاية)'
                        : 'Livraison Standard (Tarif officiel wilaya)'}
                    </div>
                  )}
                </div>
              )}

              {selectedWilayaData && (
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-accent-50 p-3 rounded-lg">
                  <Truck className="w-4 h-4 text-accent-600" />
                  {t('checkout.estimatedDelivery')} <span className="font-bold text-accent-700">{finalEstimatedDays} {t('checkout.days')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method */}
          <div className="card p-5">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary-600" />
              {t('checkout.paymentMethod')}
            </h2>
            <div className="space-y-2">
              {dynamicPaymentMethods.length > 0 ? (
                dynamicPaymentMethods.map((m) => (
                  <label 
                    key={m.id}
                    className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${paymentMethod === m.id ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <input 
                      type="radio" 
                      name="payment_choice"
                      checked={paymentMethod === m.id} 
                      onChange={() => setPaymentMethod(m.id)} 
                      className="text-primary-600 focus:ring-primary-500" 
                    />
                    {m.icon_url ? (
                      <img src={m.icon_url} alt="" className="w-8 h-8 object-contain rounded" referrerPolicy="no-referrer" />
                    ) : (
                      <CreditCard className="w-5 h-5 text-primary-600" />
                    )}
                    <div>
                      <div className="font-medium text-slate-800">{lang === 'ar' ? m.name_ar : m.name_fr}</div>
                      <div className="text-xs text-gray-500">{lang === 'ar' ? m.description_ar : m.description_fr}</div>
                    </div>
                    <span className="badge bg-emerald-50 text-emerald-700 ms-auto text-[10px] font-bold">
                      {lang === 'ar' ? 'متاح' : 'Disponible'}
                    </span>
                  </label>
                ))
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">
                  {lang === 'ar' ? 'لا توجد وسائل دفع نشطة' : 'Aucun moyen de paiement actif'}
                </div>
              )}
            </div>
          </div>

          {/* Wholesale-only fields */}
          {isWholesale && (
            <div className="card p-5 space-y-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary-600" />
                {lang === 'ar' ? 'خيارات الجملة' : 'Options de gros'}
              </h2>

              {/* PO Number */}
              <div>
                <label className="label">{lang === 'ar' ? 'رقم أمر الشراء (PO)' : 'Numéro de commande d\'achat (PO)'}</label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="input"
                  placeholder="PO-2026-001"
                  dir="ltr"
                />
              </div>

              {/* Payment Terms */}
              {paymentTerms.length > 0 && (
                <div>
                  <label className="label">{lang === 'ar' ? 'شروط الدفع' : 'Conditions de paiement'}</label>
                  <select
                    value={selectedPaymentTermsId}
                    onChange={(e) => setSelectedPaymentTermsId(e.target.value)}
                    className="input"
                  >
                    <option value="">{lang === 'ar' ? '— اختر —' : '— Choisir —'}</option>
                    {paymentTerms.map((pt) => (
                      <option key={pt.id} value={pt.id}>{pt.label} ({pt.days}j)</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Credit Account */}
              {creditLimit > 0 && (
                <div className={`rounded-xl border-2 p-4 transition-all ${useCreditAccount ? 'border-primary-600 bg-primary-50' : 'border-gray-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCreditAccount}
                      onChange={(e) => setUseCreditAccount(e.target.checked)}
                      className="h-5 w-5 rounded text-primary-600"
                    />
                    <div>
                      <div className="font-medium text-gray-800">
                        {lang === 'ar' ? 'الدفع من حساب الائتمان' : 'Payer avec le compte de crédit'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {lang === 'ar' ? `المتاح: ${formatPrice(availableCredit)}` : `Disponible: ${formatPrice(availableCredit)}`}
                      </div>
                    </div>
                  </label>
                  {useCreditAccount && !creditSufficient && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
                      <AlertCircle className="h-4 w-4" />
                      {lang === 'ar' ? 'رصيد الائتمان غير كافٍ' : 'Crédit insuffisant'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="card p-5">
            <label className="label">{t('checkout.orderNotes')}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} />
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-24">
            <h2 className="font-bold text-lg mb-4">{t('checkout.orderSummary')}</h2>

            {/* Coupon */}
            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="input flex-1 uppercase text-sm"
                  placeholder={t('cart.couponCode')}
                />
                <button onClick={() => applyCoupon(couponInput)} className="btn-outline px-3 text-sm">
                  <Tag className="w-4 h-4" />
                </button>
              </div>
              {couponError && <p className="text-error-500 text-xs mt-1">{couponError}</p>}
              {appliedCoupon && (
                <div className="flex items-center gap-1 text-accent-600 text-sm mt-1">
                  <Check className="w-4 h-4" />
                  {appliedCoupon.code}
                  <button onClick={() => { setAppliedCoupon(null); setCouponInput(''); }} className="ms-auto text-gray-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {items.map((item) => (
                <div key={item.product_id} className="flex gap-2 text-sm">
                  <img src={item.image} alt="" className="w-12 h-12 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{item.name}</p>
                    <p className="text-gray-500 text-xs">{item.quantity} × {formatPrice(item.price)}</p>
                  </div>
                  <p className="font-medium">{formatPrice(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-between text-gray-600 text-sm">
                <span>{t('cart.subtotal')}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-accent-600 text-sm">
                  <span>{t('cart.discount')}</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600 text-sm">
                <span>{t('cart.delivery')}</span>
                <span>{finalDeliveryFee > 0 ? formatPrice(finalDeliveryFee) : '-'}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>{t('cart.total')}</span>
                <span className="text-primary-600">{formatPrice(total)}</span>
              </div>
            </div>

            {formError && (
              <div className="mt-3 p-3 bg-error-50 text-error-600 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <button onClick={placeOrder} disabled={submitting} className="btn-primary w-full mt-4">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {t('checkout.placeOrder')}
            </button>

            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
              <ShieldCheck className="w-4 h-4 text-accent-500" />
              {lang === 'ar' ? 'معاملة آمنة 100%' : 'Transaction 100% sécurisée'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
