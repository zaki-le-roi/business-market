import { supabase } from './supabase';
import { 
  CMSPage, CMSMediaItem, CMSPageStatus, CMSPageRevision, 
  CMSActivityLog 
} from '../types';

// Default static enterprise pages for fallback seeding when DB is empty
export const DEFAULT_STATIC_PAGES: CMSPage[] = [
  {
    id: 'page-privacy',
    key: 'privacy-policy',
    slug: 'privacy-policy',
    type: 'static_privacy',
    title_ar: 'سياسة الخصوصية وحماية البيانات الشخصية',
    title_fr: 'Politique de Confidentialité et Protection des Données',
    title_en: 'Privacy Policy & Data Protection',
    content_ar: `
      <h2>سياسة الخصوصية وحماية المعطيات ذات الطابع الشخصي</h2>
      <p>تلتزم منصة <strong>بيزنس ماركت (Business Market)</strong> بحماية خصوصيتك ومعطياتك الشخصية وفقاً للتعديلات التشريعية الجزائرية والقانون رقم 18-07 المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي.</p>
      
      <h3>1. البيانات الشخصية التي نجمعها</h3>
      <p>عند استخدامك لمنصتنا أو تقديم طلب شراء أو التسجيل كتاجر جملة، قد نجمع المعلومات التالية:</p>
      <ul>
        <li><strong>بيانات الهوية والاتصال:</strong> الاسم الكامل، رقم الهاتف، والبريد الإلكتروني.</li>
        <li><strong>بيانات التوصيل:</strong> العنوان التجاري أو السكني، الولاية (من بين 58 ولاية)، والبلدية.</li>
        <li><strong>بيانات النشاط التجاري (خاص بالتجار والجملة):</strong> اسم الشركة/المحل، رقم السجل التجاري (RC)، الرقم التعريف الجبائي (NIF).</li>
        <li><strong>بيانات المعاملات:</strong> سجل الطلبات، الفواتير، وطريقة الدفع المحددة (الدفع عند الاستلام، البطاقة الذهبية/CIB، أو تحويل البريد موافق BaridiMob).</li>
      </ul>

      <h3>2. الغرض من معالجة البيانات</h3>
      <p>نستخدم بياناتك الشخصية للأغراض المحددة التالية فقط:</p>
      <ul>
        <li>معالجة وتأكيد الطلبيات وتوصيل البضائع إلى عنوانك عبر شركاء الشحن المعتمدين (Yalidine, Maystro, ZR Express).</li>
        <li>إصدار الفواتير الرسمية ووثائق التوصيل.</li>
        <li>تقديم خدمة الدعم الفني وتتبع الشحنات والتواصل المباشر بشأن طلبك.</li>
        <li>الامتثال للالتزامات القانونية والضريبية المعمول بها في الجمهورية الجزائرية.</li>
      </ul>

      <h3>3. حماية البيانات وعدم مشاركتها</h3>
      <p>بيزنس ماركت تتعهد بعدم بيع أو تأجير أو مشاركة بياناتك الشخصية مع أي أطراف ثالثة لأغراض تسويقية أو تجارية خارج نطاق المنصة. يتم مشاركة معلومات التوصيل الضرورية فقط (الاسم، الهاتف، العنوان) مع شركة التوصيل المكلفة بنقل طردك.</p>

      <h3>4. أمان البيانات والتشفير</h3>
      <p>نطبق أعلى معايير الأمان الرقمي والتشفير الإلكتروني (SSL/TLS) لحماية بياناتك من الوصول غير المصرح به أو التعديل أو الضياع.</p>

      <h3>5. حقوقك كزبون أو مستخدم</h3>
      <p>يحق لك في أي وقت طلب الوصول إلى بياناتك الشخصية أو تصحيحها أو تعديلها أو طلب حذفها من سجلاتنا عن طريق التواصل مع قسم الدعم على البريد الإلكتروني: <code>privacy@businessmarket.dz</code>.</p>
    `,
    content_fr: `
      <h2>Politique de Confidentialité et Protection des Données Personnelles</h2>
      <p>La plateforme <strong>Business Market</strong> s'engage formellement à protéger la vie privée et les données personnelles de ses utilisateurs conformément à la Loi Algérienne n° 18-07 relative à la protection des personnes physiques dans le traitement des données à caractère personnel.</p>
      
      <h3>1. Données collectées</h3>
      <p>Dans le cadre de l'utilisation de nos services e-commerce et B2B, nous collectons les informations nécessaires suivantes :</p>
      <ul>
        <li><strong>Identité & Contact :</strong> Nom, prénom, numéro de téléphone, adresse e-mail.</li>
        <li><strong>Livraison :</strong> Adresse complète, Wilaya (parmi les 58 wilayas), commune.</li>
        <li><strong>Informations Professionnelles (Grossistes/B2B) :</strong> Raison sociale, Registre du Commerce (RC), NIF.</li>
        <li><strong>Transactions :</strong> Historique des commandes, factures, mode de paiement choisi (Paiement à la livraison, Edahabia/CIB, BaridiMob).</li>
      </ul>

      <h3>2. Finalités du traitement</h3>
      <p>Vos données sont traitées exclusivement pour l'expédition de vos commandes via nos transporteurs agréés (Yalidine, ZR Express, Maystro), l'émission de vos factures et l'assistance client.</p>

      <h3>3. Sécurité & Confidentialité</h3>
      <p>Business Market garantit qu'aucune donnée personnelle ne sera vendue ni cédée à des tiers à des fins de prospection commerciale.</p>

      <h3>4. Vos Droits</h3>
      <p>Vous disposez d'un droit d'accès, de rectification et de suppression de vos données personnelles en contactant : <code>privacy@businessmarket.dz</code>.</p>
    `,
    content_en: `
      <h2>Privacy Policy & Personal Data Protection</h2>
      <p><strong>Business Market</strong> is committed to protecting your personal data in strict compliance with Algerian Law No. 18-07 regarding the protection of physical persons in the processing of personal data.</p>
      
      <h3>1. Information We Collect</h3>
      <p>We collect necessary information for order processing and account support, including full name, contact phone number, delivery address across 58 Wilayas, and business registration details for wholesale accounts.</p>

      <h3>2. How We Use Your Information</h3>
      <p>Your data is strictly utilized to process orders, fulfill parcel deliveries via official carrier logistics, issue tax invoices, and offer customer care support.</p>

      <h3>3. Data Protection</h3>
      <p>We implement SSL encryption and secure servers to protect your data. We never sell or share your personal data with unauthorized third parties.</p>
    `,
    status: 'published',
    seo: {
      meta_title_ar: 'سياسة الخصوصية وحماية البيانات - بيزنس ماركت الجزائر',
      meta_title_fr: 'Politique de Confidentialité - Business Market Algérie',
      meta_description_ar: 'حماية وتأمين بيانات الزبائن والتجار وفق القوانين الجزائرية للتجارة الإلكترونية.',
      meta_description_fr: 'Protection de vos données personnelles conformément à la loi 18-07 en Algérie.',
    },
    revisions: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    author: 'Legal Team',
    view_count: 1420,
  },
  {
    id: 'page-terms',
    key: 'terms-and-conditions',
    slug: 'terms-and-conditions',
    type: 'static_terms',
    title_ar: 'الشروط والأحكام العامة للبيع والخدمة',
    title_fr: 'Conditions Générales d\'Utilisation et de Vente (CGV)',
    title_en: 'Terms & Conditions of Service & Sale',
    content_ar: `
      <h2>الشروط والأحكام العامة للبيع والاستخدام</h2>
      <p>مرحباً بكم في منصة <strong>بيزنس ماركت (Business Market)</strong>. تُطبق هذه الشروط والأحكام على جميع عمليات الشراء والصفقات المبرمة عبر موقعنا الإلكتروني وتطبيقاتنا وفقاً للقانون رقم 18-05 المتعلق بالتجارة الإلكترونية في الجزائر.</p>

      <h3>1. قبول الشروط</h3>
      <p>تصفحك للموقع أو إتمام أي طلب شراء أو تسجيل حساب تجاري يُعتبر موافقة صريحة وغير مشروطة على هذه الشروط والأحكام.</p>

      <h3>2. الأسعار والعملة</h3>
      <ul>
        <li>جميع الأسعار المعروضة على المنصة مقومة بـ <strong>الدينار الجزائري (DZD)</strong> وموضحة بوضوح قبل تأكيد الطلب.</li>
        <li>تكاليف الشحن والتوصيل تُحسب بناءً على الولاية المحددة ونوع التوصيل (منزل أو مكتب Stop-Desk).</li>
        <li>تحتفظ منصة بيزنس ماركت بحق تعديل الأسعار في أي وقت، لكن التعديل لا يسري على الطلبات التي تم تأكيدها بالفعل.</li>
      </ul>

      <h3>3. إتمام وتأكيد الطلبيات</h3>
      <p>يتم تأكيد الطلبيات من خلال الاتصال الهاتفي من قسم خدمة العملاء أو عبر رسائل التأكيد النصية (SMS/OTP). في حال عدم الرد على اتصالات التثبيت خلال 48 ساعة، يحق للمنصة إلغاء الطلب تلقائياً.</p>

      <h3>4. وسائل الدفع المعتمدة</h3>
      <ul>
        <li><strong>الدفع نقدًا عند الاستلام (COD):</strong> يتم تسليم المبلغ لمندوب التوصيل بعد استلام الطرد.</li>
        <li><strong>الدفع الإلكتروني (البطاقة الذهبية / بطاقة CIB):</strong> عبر بوابة الدفع الآمنة لبريد الجزائر وبنوك الأوفشور المعتمدة.</li>
        <li><strong>التحويل البريدي (BaridiMob):</strong> متاح للطلبات الكبيرة وتجار الجملة.</li>
      </ul>

      <h3>5. مسؤولية المستهلك والالتزامات</h3>
      <p>يلتزم المشتري بتقديم معلومات هاتفية وعنوان توصيل دقيقين وصحيحين. إدخال معلومات وهمية قد يؤدي إلى تعليق الحساب وحظر العنوان.</p>

      <h3>6. القانون الواجب التطبيق والنظائر القضائية</h3>
      <p>تخضع هذه الشروط والأحكام للقوانين والتشريعات المعمول بها في الجمهورية الجزائرية الديمقراطية الشعبية.</p>
    `,
    content_fr: `
      <h2>Conditions Générales d'Utilisation et de Vente (CGU/CGV)</h2>
      <p>Les présentes Conditions Générales régissent l'ensemble des ventes et transactions effectuées sur la plateforme <strong>Business Market</strong> en Algérie, conformément à la Loi n° 18-05 relative au commerce électronique.</p>

      <h3>1. Acceptation des Conditions</h3>
      <p>Toute commande passée sur la plateforme implique l'acceptation sans réserve des présentes conditions générales de vente.</p>

      <h3>2. Prix et Monnaie</h3>
      <p>Tous les prix sont indiqués en <strong>Dinars Algériens (DZD)</strong>. Les frais de livraison sont calculés selon la Wilaya de destination.</p>

      <h3>3. Confirmation des Commandes</h3>
      <p>Les commandes sont confirmées par appel téléphonique ou validation SMS. En cas de non-réponse sous 48 heures, la commande peut être annulée.</p>

      <h3>4. Modes de Paiement</h3>
      <p>Paiement à la livraison (Cash on Delivery), Carte Edahabia / CIB, ou virement BaridiMob pour les achats en gros.</p>

      <h3>5. Droit Applicable</h3>
      <p>Les présentes conditions sont soumises à la législation algérienne en vigueur.</p>
    `,
    content_en: `
      <h2>Terms & Conditions of Service & Sale</h2>
      <p>Welcome to <strong>Business Market</strong>. These terms govern all purchases made through our e-commerce platform in Algeria, pursuant to Law No. 18-05 on Electronic Commerce.</p>
      
      <h3>1. General Terms</h3>
      <p>By placing an order, you agree to these terms. All transactions are billed in Algerian Dinars (DZD).</p>

      <h3>2. Order Confirmation & Payment</h3>
      <p>Orders are confirmed via phone call or SMS. Payment methods include Cash on Delivery, Edahabia/CIB card payment, and BaridiMob transfer.</p>

      <h3>3. Governing Law</h3>
      <p>These terms and conditions are governed by Algerian laws and regulations.</p>
    `,
    status: 'published',
    seo: {
      meta_title_ar: 'الشروط والأحكام العامة للبيع - بيزنس ماركت',
      meta_title_fr: 'Conditions Générales de Vente - Business Market',
      meta_description_ar: 'قواعد واستخدام خدمات البيع بالتجزئة والجملة على منصة بيزنس ماركت الجزائر.',
    },
    revisions: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    author: 'Legal Team',
    view_count: 1890,
  },
  {
    id: 'page-returns',
    key: 'return-policy',
    slug: 'return-policy',
    type: 'static_returns',
    title_ar: 'سياسة الإرجاع والاستبدال والاسترداد',
    title_fr: 'Politique de Retour, Échange et Remboursement',
    title_en: 'Return, Exchange & Refund Policy',
    content_ar: `
      <h2>سياسة الإرجاع والاستبدال والاسترداد المالي</h2>
      <p>في <strong>بيزنس ماركت</strong>، حرصاً منا على رضا زبائننا الكرام وتطبيقاً للقانون رقم 09-03 المتعلق بحماية المستهلك وقمع الغش، نوفر سياسة إرجاع واستبدال مرنة وواضحة.</p>

      <h3>1. المهلة المتاحة للإرجاع</h3>
      <p>يمكنك تقديم طلب إرجاع أو استبدال للمنتجات خلال <strong>7 أيام تقويمية</strong> من تاريخ استلام الطرد من شركة التوصيل.</p>

      <h3>2. شروط قبول الإرجاع</h3>
      <p>يُقبل طلب الإرجاع أو الاستبدال في الحالات التالية:</p>
      <ul>
        <li>وجود عيب مصنعي أو خلل وظيفي في المنتج.</li>
        <li>وصول منتج غير مطابق للمواصفات المطلوبة (لون مختلف، مقاس مختلف، أو موديل آخر).</li>
        <li>تلف الطرد أو المنتج أثناء عمليات النقل والشحن.</li>
      </ul>
      <p><strong>شروط المنتج:</strong> يجب أن يكون المنتج في حالته الأصلية، مع تغليفه الأصلي غير المفتوح (بالنسبة للمنتجات المغلقة)، ومرفقاً بجميع الملحقات ودليل الاستخدام والفاتورة.</p>

      <h3>3. المنتجات المستثناة من الإرجاع</h3>
      <p>حفاظاً على السلامة والنظافة العامة، تُستثنى المنتجات التالية من الإرجاع إلا في حالة العيب المصنعي المؤكد:</p>
      <ul>
        <li>منتجات العناية الشخصية ومستحضرات التجميل المفتوحة.</li>
        <li>الملابس الداخلية والمنتجات ذات الاستخدام الشديد المباشر.</li>
        <li>البرمجيات والبطاقات الرقمية بعد كشف رموز التفعيل.</li>
      </ul>

      <h3>4. إجراءات تقديم طلب الإرجاع</h3>
      <ol>
        <li>تواصل مع قسم خدمة العملاء عبر رقم الهاتف <code>+213 555 000 000</code> أو واتساب أو البريد الإلكتروني <code>returns@businessmarket.dz</code>.</li>
        <li>زودنا برقم الطلب وصورة أو فيديو يوضح حالة المنتج أو العيب.</li>
        <li>سيتولى فريقنا التنسيق مع شركة التوصيل لاستلام المنتج المرجع من عنوانك.</li>
      </ol>

      <h3>5. تكاليف الشحن والاسترداد المالي</h3>
      <ul>
        <li>إذا كان الإرجاع بسبب خطأ من المنصة أو عيب في المنتج، <strong>تحتفظ بيزنس ماركت بتحمل كامل تكاليف الشحن والإرجاع</strong>.</li>
        <li>في حال الاسترداد المالي، يتم تحويل المبلغ كاملاً عبر حساب بريدي (BaridiMob) أو صك أو رصيد شراء في الحساب خلال 3 إلى 5 أيام عمل من فحص المنتج.</li>
      </ul>
    `,
    content_fr: `
      <h2>Politique de Retour, Échange et Remboursement</h2>
      <p>Chez <strong>Business Market</strong>, votre satisfaction est notre priorité. Conformément à la Loi n° 09-03 relative à la protection du consommateur en Algérie, nous proposons un service de retour simple et équitable.</p>

      <h3>1. Délai de Rétractation et Retour</h3>
      <p>Vous disposez d'un délai de <strong>7 jours</strong> à compter de la date de réception de votre colis pour demander un retour ou un échange.</p>

      <h3>2. Conditions d'Acceptation</h3>
      <p>Le produit doit être renvoyé dans son état d'origine, complet avec son emballage et ses accessoires. Les retours sont acceptés en cas de défaut de fabrication, produit non conforme ou emballage endommagé lors du transport.</p>

      <h3>3. Modalités de Remboursement</h3>
      <p>En cas de retour validé, le remboursement est effectué par virement BaridiMob ou bon d'achat sous 3 à 5 jours ouvrables. Les frais de retour sont pris en charge par Business Market en cas d'erreur de notre part.</p>
    `,
    content_en: `
      <h2>Return, Exchange & Refund Policy</h2>
      <p>At <strong>Business Market</strong>, we strive to ensure 100% satisfaction. In compliance with Algerian Consumer Protection Law No. 09-03, we offer a hassle-free 7-day return policy.</p>

      <h3>1. 7-Day Return Window</h3>
      <p>You can request a return or exchange within 7 days of receiving your package.</p>

      <h3>2. Eligibility Criteria</h3>
      <p>Items must be unused, in their original packaging, and accompanied by the invoice. Accepted for factory defects, incorrect items, or transit damage.</p>

      <h3>3. Refund Processing</h3>
      <p>Refunds are processed via BaridiMob or store credit within 3 to 5 business days after quality inspection.</p>
    `,
    status: 'published',
    seo: {
      meta_title_ar: 'سياسة الإرجاع والاستبدال - بيزنس ماركت',
      meta_title_fr: 'Politique de Retour et Remboursement - Business Market',
      meta_description_ar: 'ضمان الإرجاع والاستبدال خلال 7 أيام واسترداد الأموال عبر بريدي موب.',
    },
    revisions: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    author: 'Support Team',
    view_count: 1120,
  },
  {
    id: 'page-shipping',
    key: 'shipping-policy',
    slug: 'shipping-policy',
    type: 'static_shipping',
    title_ar: 'سياسة الشحن والتوصيل للـ 58 ولاية',
    title_fr: 'Politique de Livraison et Expédition (58 Wilayas)',
    title_en: 'Shipping & Delivery Policy (58 Wilayas)',
    content_ar: `
      <h2>سياسة الشحن والتوصيل الشاملة عبر 58 ولاية</h2>
      <p>تقدم منصة <strong>بيزنس ماركت</strong> شبكة توصيل وسداسية متكاملة تغطي كامل التراب الوطني الجزائري من العاصمة إلى أقصى الجنوب الكبير عبر شركائنا المعتمدين (Yalidine Express, ZR Express, Maystro Delivery).</p>

      <h3>1. خيارات وأنواع التوصيل</h3>
      <ul>
        <li><strong>التوصيل للمنزل (Home Delivery):</strong> يتم تسليم الطرد مباشرة لمقر سكنك أو عملك مع الاتصال الهاتفي المسبق من السائق.</li>
        <li><strong>التوصيل للمكتب (Stop-Desk Delivery):</strong> استلام الطرد من أقرب مركز توصيل أو مكتب تابع لشركة الشحن في ولايتك بسعر مخفض.</li>
      </ul>

      <h3>2. آجال ومواعيد التوصيل المتوقعة</h3>
      <table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; text-align:center;">
        <thead>
          <tr style="background-color:#f1f5f9;">
            <th>المنطقة / الولايات</th>
            <th>التوصيل للمنزل</th>
            <th>التوصيل للمكتب (Stop-Desk)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>الجزائر العاصمة والولايات المجاورة (Blida, Tipaza, Boumerdès)</td>
            <td>24 - 48 ساعة</td>
            <td>24 ساعة</td>
          </tr>
          <tr>
            <td>ولايات الشمال والوسط والشرق والغرب</td>
            <td>2 - 4 أيام عمل</td>
            <td>1 - 3 أيام عمل</td>
          </tr>
          <tr>
            <td>ولايات الهضاب العليا والجنوب الكبير (Biskra, Ghardaïa, Ouargla, Béchar, etc.)</td>
            <td>3 - 6 أيام عمل</td>
            <td>2 - 5 أيام عمل</td>
          </tr>
          <tr>
            <td>ولايات الجنوب أقصى الحدود (Tamanrasset, Adrar, Djanet, Tindouf, In Salah)</td>
            <td>5 - 8 أيام عمل</td>
            <td>4 - 7 أيام عمل</td>
          </tr>
        </tbody>
      </table>

      <h3>3. معاينة ومعاينة الطرد عند الاستلام</h3>
      <p>يحق للزبون التأكد من السلامة الظاهرية للطرد ومطابقة اسم المنتج المكتوب على قسيمة الشحن قبل تسليم المبلغ للمندوب.</p>

      <h3>4. تتبع الشحنات بالزمن الحقيقي</h3>
      <p>بمجرد خروج طلبك من المستودع، تتلقى رسالة نصية ورمز تتبع يمكنك إدخاله في صفحة <a href="/track">تتبع الطلب</a> لمتابعة خط سير الطرد لحظة بلحظة.</p>
    `,
    content_fr: `
      <h2>Politique de Livraison et Expédition (58 Wilayas)</h2>
      <p><strong>Business Market</strong> assure la livraison expresse sur l'ensemble des 58 Wilayas d'Algérie grâce à un réseau de partenaires logistiques de confiance (Yalidine, ZR Express, Maystro).</p>

      <h3>1. Options de Livraison</h3>
      <ul>
        <li><strong>Livraison à Domicile :</strong> Remise en main propre à votre adresse résidentielle ou professionnelle.</li>
        <li><strong>Livraison en Stop-Desk (Bureau) :</strong> Retrait au bureau du transporteur le plus proche à tarif réduit.</li>
      </ul>

      <h3>2. Délais de Livraison</h3>
      <p>Alger & Environs : 24 à 48h. Nord & Ouest/Est : 2 à 4 jours. Grand Sud : 4 à 7 jours ouvrables.</p>

      <h3>3. Suivi des Colis</h3>
      <p>Un numéro de suivi unique vous est attribué dès l'expédition pour suivre votre colis en temps réel.</p>
    `,
    content_en: `
      <h2>Shipping & Delivery Policy (58 Wilayas)</h2>
      <p><strong>Business Market</strong> provides comprehensive logistics coverage across all 58 Wilayas of Algeria using top national shipping carriers.</p>

      <h3>1. Delivery Methods</h3>
      <p>Home Delivery directly to your doorstep, or Stop-Desk pickup at regional carrier centers.</p>

      <h3>2. Estimated Delivery Timeframes</h3>
      <p>Algiers: 24-48 hours. Northern & Coastal Wilayas: 2-4 business days. Southern Sahara Wilayas: 4-7 business days.</p>
    `,
    status: 'published',
    seo: {
      meta_title_ar: 'سياسة الشحن والتوصيل لـ 58 ولاية - بيزنس ماركت',
      meta_title_fr: 'Livraison 58 Wilayas Algérie - Business Market',
      meta_description_ar: 'توصيل سريع وسريع للمنزل والمكتب بجميع الولايات الجزائرية مع تتبع الشحنة.',
    },
    revisions: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    author: 'Logistics Team',
    view_count: 2310,
  },
  {
    id: 'page-wholesale',
    key: 'wholesale-terms',
    slug: 'wholesale-terms',
    type: 'static_wholesale',
    title_ar: 'شروط وأحكام تجارة الجملة والتجار (B2B)',
    title_fr: 'Conditions Générales de Vente en Gros (B2B)',
    title_en: 'Wholesale & B2B Terms of Business',
    content_ar: `
      <h2>شروط وأحكام تجارة الجملة والتعاملات التجارية (B2B)</h2>
      <p>تُقدم منصة <strong>بيزنس ماركت B2B</strong> حلاً كاملاً لتجار التجزئة، الجملة، الموزعين، وأصحاب المحلات في جميع أنحاء الجزائر للحصول على أفضل المنتجات بأسعار المصنع والمستوردين مباشرة.</p>

      <h3>1. أهلية التسجيل كحساب تجاري/جملة</h3>
      <p>للحصول على أسعار الجملة المعتمدة وتصفح الكتالوج المخصص، يجب تقديم إثبات نشاط تجاري قانوني يشمل إحدى الوثائق التالية:</p>
      <ul>
        <li>نسخة من السجل التجاري (Registre du Commerce - RC).</li>
        <li>بطاقة الحرفي أو اعتماد النشاط التجاري.</li>
        <li>الرقم التعريف الجبائي (NIF) للمؤسسات والشركات.</li>
      </ul>

      <h3>2. حد أدنى للطلب (MOQ) والأسعار المرجعية</h3>
      <ul>
        <li>تُطبق حدود أدنى للكمية (Minimum Order Quantity) تختلف بحسب طبيعة المنتج وتصنيفه.</li>
        <li>تتوفر مستويات أسعار تصاعدية (Tiered Pricing)؛ تزيد نسبة التخفيض كلما زادت كميات الشراء.</li>
      </ul>

      <h3>3. الفوترة والامتثال الضريبي</h3>
      <p>تلتزم منصة بيزنس ماركت بإصدار فواتير قانونية رسمية تتضمن جميع البيانات الضريبية (Facture Proforma & Facture Définitive) شاملة للرقم الجبائي (NIF)، الرقم الإحصائي (NIS)، ورقم السجل التجاري.</p>

      <h3>4. التوصيل والشحن للكميات الكبيرة</h3>
      <p>تتضمن طلبات الجملة ترتيبات لوجستية خاصة باستخدام شاحنات نقل البضائع أو الشحن الحاوي، مع أسعار شحن تفضيلية مخصصة للطلبات الضخمة.</p>

      <h3>5. خدمة دعم كبار التجار</h3>
      <p>يتم تعيين مدير حساب خاص (Account Manager) لكل تاجر جملة مسجل لتقديم المشورة الفنية وتوفير طلبيات استيراد خاصة حسب الطلب.</p>
    `,
    content_fr: `
      <h2>Conditions Générales de Vente en Gros (B2B)</h2>
      <p>La section B2B de <strong>Business Market</strong> est dédiée aux commerçants, revendeurs et entreprises en Algérie bénéficiant de tarifs grossistes directs.</p>

      <h3>1. Éligibilité</h3>
      <p>Accès réservé aux professionnels possédant un Registre du Commerce (RC) ou une Carte d'Artisan valide.</p>

      <h3>2. Quantités Minimales (MOQ) & Facturation</h3>
      <p>Des seuils minimaux de commande s'appliquent. Emission de factures proforma et définitives conformes aux normes fiscales algériennes (NIF/NIS/RC).</p>

      <h3>3. Logistique dédiée</h3>
      <p>Tarifs d'expédition préférentiels pour le transport de marchandises en gros sur les 58 Wilayas.</p>
    `,
    content_en: `
      <h2>Wholesale & B2B Terms of Business</h2>
      <p><strong>Business Market B2B Portal</strong> serves retail shop owners, distributors, and bulk buyers across Algeria with direct importer & factory prices.</p>

      <h3>1. Merchant Qualification</h3>
      <p>Access requires verified business credentials (Commercial Register RC or Tax ID NIF).</p>

      <h3>2. Bulk Pricing & Tax Invoicing</h3>
      <p>Tiered bulk discounts apply based on Minimum Order Quantities (MOQ). Formal proforma and tax invoices are issued for all B2B transactions.</p>
    `,
    status: 'published',
    seo: {
      meta_title_ar: 'شروط تجارة الجملة والتجار B2B - بيزنس ماركت',
      meta_title_fr: 'Conditions Vente en Gros B2B - Business Market',
      meta_description_ar: 'أسعار الجملة والفوترة الرسمية والتوصيل الضخم للتجار والمؤسسات بالجزائر.',
    },
    revisions: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    author: 'B2B Department',
    view_count: 980,
  },
  {
    id: 'page-legal',
    key: 'legal-notice',
    slug: 'legal-notice',
    type: 'static_legal',
    title_ar: 'الإشعار القانوني ومطابقة التجارة الإلكترونية',
    title_fr: 'Mentions Légales et Conformité E-Commerce',
    title_en: 'Legal Notice & E-Commerce Compliance',
    content_ar: `
      <h2>الإشعار القانوني ومطابقة معايير التجارة الإلكترونية</h2>
      <p>وفقاً للتشريعات القوانين الجزائرية المنظمة للخدمات الرقمية والتجارة الإلكترونية (القانون رقم 18-05):</p>

      <h3>1. معطيات مالك المنصة</h3>
      <ul>
        <li><strong>الاسم التجاري:</strong> بيزنس ماركت (Business Market).</li>
        <li><strong>الشكل القانوني:</strong> شركة ذات مسؤولية محدودة (SARL).</li>
        <li><strong>مقر الشركة:</strong> الجزائر العاصمة، الجزائر.</li>
        <li><strong>السجل التجاري (RC):</strong> مسجل بالمركز الوطني للغرفة التجارية.</li>
        <li><strong>الرقم التعريف الجبائي (NIF):</strong> متوفر في الفواتير الرسمية.</li>
        <li><strong>الرقم التعريف الإحصائي (NIS):</strong> مسجل رسمياً.</li>
      </ul>

      <h3>2. النشر وإدارة المحتوى</h3>
      <ul>
        <li><strong>مدير النشر المسؤول:</strong> قسم الشؤون القانونية والإعلامية بـ بيزنس ماركت.</li>
        <li><strong>البريد الإلكتروني الرسمي:</strong> <code>legal@businessmarket.dz</code></li>
        <li><strong>الهاتف الرسمي:</strong> <code>+213 23 00 00 00</code></li>
      </ul>

      <h3>3. استضافة الموقع والحماية</h3>
      <p>موقع وتطبيقات بيزنس ماركت مستضافة على بنية تحتية سحابية عالية الأمان ومزودة بشهادات التشفير الرقمي المعتمدة (SSL 256-bit Encryption).</p>

      <h3>4. الملكية الفكرية والعلامات المسجلة</h3>
      <p>جميع الشعارات، التصاميم، النصوص، البرمجيات، وقواعد البيانات المتاحة على المنصة هي ملكية فكرية حصريّة لـ Business Market وتخضع لقوانين حماية حقوق المؤلف والمجاورة في الجزائر.</p>
    `,
    content_fr: `
      <h2>Mentions Légales et Conformité E-Commerce</h2>
      <p>Conformément à la Loi n° 18-05 relative au commerce électronique en Algérie :</p>

      <h3>1. Éditeur de la Plateforme</h3>
      <ul>
        <li><strong>Raison Sociale :</strong> Business Market SARL</li>
        <li><strong>Siège Social :</strong> Alger, Algérie</li>
        <li><strong>Registre du Commerce (RC) :</strong> Immatriculé auprès du CNRC</li>
        <li><strong>Identifiant Fiscal (NIF) :</strong> Conforme sur toutes factures</li>
      </ul>

      <h3>2. Contact & Propriété Intellectuelle</h3>
      <p>Contact Légal : <code>legal@businessmarket.dz</code>. Tous droits réservés sur les éléments visuels, marques et contenus de la plateforme.</p>
    `,
    content_en: `
      <h2>Legal Notice & E-Commerce Compliance</h2>
      <p>In accordance with Algerian Law No. 18-05 regulating electronic commerce and digital services:</p>

      <h3>1. Corporate Identity</h3>
      <p>Platform operated by <strong>Business Market SARL</strong>, headquartered in Algiers, Algeria. Officially registered under Commercial Register (RC) and Tax ID (NIF).</p>

      <h3>2. Contact & Intellectual Property</h3>
      <p>Legal Inquiries: <code>legal@businessmarket.dz</code>. All trademarks, designs, and content are strictly protected under intellectual property laws.</p>
    `,
    status: 'published',
    seo: {
      meta_title_ar: 'الإشعار القانوني ومطابقة التجارة الإلكترونية - بيزنس ماركت',
      meta_title_fr: 'Mentions Légales - Business Market Algérie',
      meta_description_ar: 'معلومات الشركة والسجل التجاري والتراخيص القانونية للتجارة الإلكترونية.',
    },
    revisions: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    author: 'Legal Team',
    view_count: 650,
  },
  {
    id: 'page-faq',
    key: 'faq',
    slug: 'faq',
    type: 'static_faq',
    title_ar: 'الأسئلة الشائعة وإرشادات الشراء',
    title_fr: 'Foire Aux Questions (FAQ) & Guide d\'Achat',
    title_en: 'Frequently Asked Questions & Purchasing Guide',
    content_ar: `
      <h2>الأسئلة الشائعة وإرشادات استخدام المنصة</h2>

      <h3>1. كيف يمكنني تقديم طلب شراء على المنصة؟</h3>
      <p>الطلب بسيط جداً ولا يتطلب سوى دقيقة واحدة:</p>
      <ol>
        <li>تصفح المنتجات واختر المنتج الذي ترغب بشرائه.</li>
        <li>اضغط على زر <strong>"أطلب الآن"</strong> أو أضفه إلى سلة الشراء.</li>
        <li>أدخل معلوماتك الأساسية (الاسم، رقم الهاتف، والولاية).</li>
        <li>اختر طريقة التوصيل المفضل (إلى باب المنزل أو مكتب الشحن Stop-Desk).</li>
        <li>انقر على <strong>"تأكيد الطلب"</strong>. سيتصل بك فريقنا لتأكيد شحن الطلب!</li>
      </ol>

      <h3>2. هل يمكنني الدفع عند استلام البضاعة؟</h3>
      <p>نعم! نوفر خيار <strong>الدفع نقدًا عند الاستلام (Cash on Delivery)</strong> في جميع الولايات الـ 58. تدفع للمندوب فقط بعد وصول طردك واستلامه.</p>

      <h3>3. كيف أستطيع تتبع حالة طلبيتي؟</h3>
      <p>يمكنك التوجه إلى خيار <a href="/track">تتبع الطلب</a> في أعلى الصفحة وإدخال رقم طلبك أو رقم هاتفك لمعرفة مكان وجود طردك حالياً.</p>

      <h3>4. ما هي آجال التوصيل للولايات الجنوبية؟</h3>
      <p>تتراوح مدة التوصيل لولايات الجنوب الكبير بين 4 إلى 7 أيام عمل بحسب الولاية ونوع التوصيل المختار.</p>

      <h3>5. كيف أسجل كتاجر للاستفادة من أسعار الجملة؟</h3>
      <p>قم بالانتقال إلى صفحة <a href="/wholesale">بوابة الجملة B2B</a>، وأدخل بيانات مؤسستك وسجلك التجاري لتفعيل حساب الجملة فوراً.</p>
    `,
    content_fr: `
      <h2>Foire Aux Questions (FAQ) & Guide d'Achat</h2>

      <h3>1. Comment passer une commande ?</h3>
      <p>Sélectionnez vos produits, cliquez sur "Acheter maintenant", saisissez votre nom, numéro de téléphone et Wilaya, puis validez. Notre service client vous appellera pour confirmer la livraison.</p>

      <h3>2. Le paiement à la livraison est-il disponible ?</h3>
      <p>Oui, le paiement à la livraison est disponible sur l'ensemble des 58 Wilayas.</p>

      <h3>3. Comment suivre ma commande ?</h3>
      <p>Utilisez notre page <a href="/track">Suivi de Commande</a> munis de votre numéro de commande ou téléphone.</p>

      <h3>4. Comment accéder aux prix grossistes ?</h3>
      <p>Inscrivez-vous sur notre <a href="/wholesale">Portail Grossiste B2B</a> avec votre Registre du Commerce.</p>
    `,
    content_en: `
      <h2>Frequently Asked Questions & Purchasing Guide</h2>

      <h3>1. How do I place an order?</h3>
      <p>Select your desired item, click "Order Now", fill in your contact details and Wilaya, and confirm. Our support team will confirm your order via phone.</p>

      <h3>2. Do you offer Cash on Delivery?</h3>
      <p>Yes, Cash on Delivery is supported across all 58 Algerian Wilayas.</p>

      <h3>3. How can I track my package?</h3>
      <p>Visit the <a href="/track">Track Order</a> page and enter your order number or phone number.</p>
    `,
    status: 'published',
    seo: {
      meta_title_ar: 'الأسئلة الشائعة وإرشادات الشراء - بيزنس ماركت',
      meta_title_fr: 'FAQ et Guide d\'Achat - Business Market',
      meta_description_ar: 'إجابات كاملة على جميع التساؤلات حول الشراء، الدفع، والتوصيل والجملة.',
    },
    revisions: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    author: 'Support Team',
    view_count: 3100,
  },
  {
    id: 'page-about',
    key: 'about-us',
    slug: 'about-us',
    type: 'static_about',
    title_ar: 'عن بيزنس ماركت',
    title_fr: 'À propos de Business Market',
    title_en: 'About Business Market',
    content_ar: '<h2>منصة بيزنس ماركت للتجارة الإلكترونية والجملة</h2><p>بيزنس ماركت هي المنصة الرائدة في الجزائر التي تجمع بين تجارة التجزئة والجملة، وتقدم أفضل المنتجات العالمية والمحلية بأسعار تنافسية مع خدمة توصيل سريعة لجميع الولايات الـ 58.</p><h3>رؤيتنا</h3><p>تمكين المستهلك والتجّار في الجزائر من الحصول على منتجات عالية الجودة وخدمات توصيل موثوقة مع ضمان الشفافية التامة وحماية حقوق المستهلك.</p>',
    content_fr: '<h2>Plateforme E-Commerce Business Market</h2><p>Business Market est la première plateforme en Algérie dédiée au commerce de détail et de gros, offrant des produits de haute qualité et une livraison rapide dans les 58 wilayas.</p>',
    content_en: '<h2>Business Market E-Commerce Platform</h2><p>Business Market is the premier e-commerce platform in Algeria for retail and wholesale commerce, providing high-quality products and express delivery to all 58 wilayas.</p>',
    status: 'published',
    seo: {
      meta_title_ar: 'عن بيزنس ماركت - المنصة الأولى للتجارة في الجزائر',
      meta_title_fr: 'À propos de Business Market - Numéro 1 en Algérie',
      meta_description_ar: 'تعرف على شركة بيزنس ماركت ورؤيتها في تطوير التجارة الإلكترونية بالجزائر.',
      meta_description_fr: 'Découvrez Business Market et sa vision pour le commerce électronique en Algérie.',
    },
    revisions: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    author: 'Admin',
    view_count: 1250,
  },
  {
    id: 'page-contact',
    key: 'contact-us',
    slug: 'contact-us',
    type: 'static_contact',
    title_ar: 'اتصل بنا والدعم الفني',
    title_fr: 'Contactez-nous & Support',
    title_en: 'Contact Us & Support',
    content_ar: '<h2>تواصل معنا وخدمة العملاء</h2><p>فريق خدمة العملاء متواجد على مدار الساعة للرد على استفساراتكم وتتبع طلباتكم وتقديم الدعم للتجار والزبائن.</p>',
    content_fr: '<h2>Contactez-nous</h2><p>Notre équipe support est disponible 24/7 pour répondre à vos questions et suivre vos commandes.</p>',
    content_en: '<h2>Contact Us</h2><p>Our support team is available 24/7 to assist with inquiries and order tracking.</p>',
    status: 'published',
    seo: {},
    revisions: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-08-10T12:00:00Z',
    author: 'Support Team',
    view_count: 2100,
  }
];

// ----------------------------------------------------
// PAGE DIRECT SUPABASE OPERATIONS
// ----------------------------------------------------

export async function fetchPages(): Promise<CMSPage[]> {
  try {
    // 1. Query cms_pages table first (V2 schema)
    const { data: pageData, error: pageErr } = await supabase
      .from('cms_pages')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!pageErr && pageData && pageData.length > 0) {
      return pageData.map(item => ({
        id: item.id,
        key: item.key,
        slug: item.slug || item.key,
        type: item.type || 'custom',
        title_ar: item.title_ar || '',
        title_fr: item.title_fr || '',
        title_en: item.title_en || item.title_fr || '',
        content_ar: item.content_ar || '',
        content_fr: item.content_fr || '',
        content_en: item.content_en || item.content_fr || '',
        status: (item.status as CMSPageStatus) || 'draft',
        publish_date: item.publish_date || null,
        seo: item.seo || {},
        revisions: [],
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
        author: item.author || 'Admin',
        view_count: Number(item.view_count) || 0,
      }));
    }

    // 2. Fallback to legacy cms_content table
    const { data: legacyData, error: legacyErr } = await supabase
      .from('cms_content')
      .select('*')
      .order('created_at', { ascending: false });

    if (!legacyErr && legacyData && legacyData.length > 0) {
      return legacyData.map(item => {
        const meta = item.metadata || {};
        return {
          id: item.id,
          key: item.key,
          slug: meta.slug || item.key,
          type: meta.type || 'custom',
          title_ar: item.title_ar || '',
          title_fr: item.title_fr || '',
          title_en: meta.title_en || item.title_fr || '',
          content_ar: item.content_ar || '',
          content_fr: item.content_fr || '',
          content_en: meta.content_en || item.content_fr || '',
          status: item.is_active ? 'published' : 'draft',
          publish_date: meta.publish_date || null,
          seo: meta.seo || {},
          revisions: meta.revisions || [],
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
          author: meta.author || 'Admin',
          view_count: meta.view_count || 100,
        };
      });
    }
  } catch (e) {
    console.warn('[CMS Supabase Integration] fetchPages exception:', e);
  }

  // Seeding default static pages if DB is completely empty
  return DEFAULT_STATIC_PAGES;
}

export async function fetchPageBySlug(slug: string): Promise<CMSPage | null> {
  if (!slug) return null;
  const normalizedSlug = slug.toLowerCase().trim();

  try {
    // Try cms_pages table first
    const { data, error } = await supabase
      .from('cms_pages')
      .select('*')
      .or(`slug.eq.${normalizedSlug},key.eq.${normalizedSlug}`)
      .single();

    if (!error && data) {
      return {
        id: data.id,
        key: data.key,
        slug: data.slug || data.key,
        type: data.type || 'custom',
        title_ar: data.title_ar || '',
        title_fr: data.title_fr || '',
        title_en: data.title_en || data.title_fr || '',
        content_ar: data.content_ar || '',
        content_fr: data.content_fr || '',
        content_en: data.content_en || data.content_fr || '',
        status: (data.status as CMSPageStatus) || 'draft',
        publish_date: data.publish_date || null,
        seo: data.seo || {},
        revisions: [],
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        author: data.author || 'Admin',
        view_count: Number(data.view_count) || 0,
      };
    }

    // Fallback to legacy cms_content
    const { data: legacyData, error: legacyErr } = await supabase
      .from('cms_content')
      .select('*')
      .or(`key.eq.${normalizedSlug},metadata->>slug.eq.${normalizedSlug}`)
      .single();

    if (!legacyErr && legacyData) {
      const meta = legacyData.metadata || {};
      return {
        id: legacyData.id,
        key: legacyData.key,
        slug: meta.slug || legacyData.key,
        type: meta.type || 'custom',
        title_ar: legacyData.title_ar || '',
        title_fr: legacyData.title_fr || '',
        title_en: meta.title_en || legacyData.title_fr || '',
        content_ar: legacyData.content_ar || '',
        content_fr: legacyData.content_fr || '',
        content_en: meta.content_en || legacyData.content_fr || '',
        status: legacyData.is_active ? 'published' : 'draft',
        publish_date: meta.publish_date || null,
        seo: meta.seo || {},
        revisions: meta.revisions || [],
        created_at: legacyData.created_at || new Date().toISOString(),
        updated_at: legacyData.updated_at || new Date().toISOString(),
        author: meta.author || 'Admin',
        view_count: meta.view_count || 100,
      };
    }
  } catch (e) {
    console.warn('[CMS Supabase Integration] fetchPageBySlug exception:', e);
  }

  // Fallback default static page matching
  const foundDefault = DEFAULT_STATIC_PAGES.find(p => p.slug === normalizedSlug || p.key === normalizedSlug);
  return foundDefault || null;
}

export async function savePage(page: CMSPage): Promise<{ success: boolean; data?: CMSPage; error?: string }> {
  const dbPayloadPages = {
    id: page.id,
    key: page.key,
    slug: page.slug || page.key,
    type: page.type || 'custom',
    title_ar: page.title_ar,
    title_fr: page.title_fr,
    title_en: page.title_en || page.title_fr,
    content_ar: page.content_ar,
    content_fr: page.content_fr,
    content_en: page.content_en || page.content_fr,
    status: page.status,
    publish_date: page.publish_date || null,
    seo: page.seo || {},
    author: page.author || 'Admin',
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('cms_pages')
      .upsert(dbPayloadPages)
      .select('*')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        ...page,
        id: data.id,
        updated_at: data.updated_at,
      }
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save page';
    return { success: false, error: msg };
  }
}

export async function deletePage(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('cms_pages').delete().eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete page';
    return { success: false, error: msg };
  }
}

export async function togglePagePublishStatus(id: string, currentStatus: CMSPageStatus): Promise<{ success: boolean; nextStatus: CMSPageStatus; error?: string }> {
  const nextStatus: CMSPageStatus = currentStatus === 'published' ? 'draft' : 'published';

  try {
    const { error } = await supabase
      .from('cms_pages')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { success: false, nextStatus: currentStatus, error: error.message };
    }

    return { success: true, nextStatus };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update page status';
    return { success: false, nextStatus: currentStatus, error: msg };
  }
}

// ----------------------------------------------------
// MEDIA DIRECT SUPABASE OPERATIONS
// ----------------------------------------------------

export async function fetchMedia(): Promise<CMSMediaItem[]> {
  try {
    const { data, error } = await supabase
      .from('cms_media')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map(item => ({
        id: item.id,
        name: item.name || item.title_ar || 'File',
        title_ar: item.title_ar,
        title_fr: item.title_fr,
        title_en: item.title_en,
        description_ar: item.description_ar,
        description_fr: item.description_fr,
        folder: item.folder || '/',
        file_type: item.file_type || 'image',
        url: item.url,
        size_bytes: Number(item.size_bytes) || 0,
        mime_type: item.mime_type || 'application/octet-stream',
        dimensions: item.dimensions,
        status: (item.status as 'published' | 'draft') || 'published',
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
      }));
    }
  } catch (e) {
    console.warn('[CMS Supabase Integration] fetchMedia exception:', e);
  }

  return [];
}

export async function saveMediaItem(item: CMSMediaItem): Promise<{ success: boolean; data?: CMSMediaItem; error?: string }> {
  const payload = {
    id: item.id,
    name: item.name,
    title_ar: item.title_ar,
    title_fr: item.title_fr,
    title_en: item.title_en,
    description_ar: item.description_ar,
    description_fr: item.description_fr,
    folder: item.folder || '/',
    file_type: item.file_type || 'image',
    url: item.url,
    size_bytes: item.size_bytes || 0,
    mime_type: item.mime_type || 'application/octet-stream',
    dimensions: item.dimensions,
    status: item.status || 'published',
    is_active: item.status === 'published',
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('cms_media')
      .upsert(payload)
      .select('*')
      .single();

    if (!error && data) {
      return { success: true, data: item };
    }

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: item };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save media item';
    return { success: false, error: msg };
  }
}

export async function deleteMediaItem(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('cms_media').delete().eq('id', id);
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete media item';
    return { success: false, error: msg };
  }
}

export async function toggleMediaPublishStatus(id: string, currentStatus: 'published' | 'draft'): Promise<{ success: boolean; nextStatus: 'published' | 'draft'; error?: string }> {
  const nextStatus: 'published' | 'draft' = currentStatus === 'published' ? 'draft' : 'published';

  try {
    const { error } = await supabase
      .from('cms_media')
      .update({ status: nextStatus, is_active: nextStatus === 'published', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { success: false, nextStatus: currentStatus, error: error.message };
    }

    return { success: true, nextStatus };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update media status';
    return { success: false, nextStatus: currentStatus, error: msg };
  }
}

// ----------------------------------------------------
// PAGE REVISIONS & RECOVERY
// ----------------------------------------------------

export async function fetchPageRevisions(pageId: string): Promise<CMSPageRevision[]> {
  try {
    const { data, error } = await supabase
      .from('cms_page_revisions')
      .select('*')
      .eq('page_id', pageId)
      .order('version', { ascending: false });

    if (!error && data) {
      return data.map(item => ({
        id: item.id,
        version: item.version,
        timestamp: item.timestamp || item.created_at,
        author: item.author || 'Admin',
        title_ar: item.title_ar,
        title_fr: item.title_fr,
        title_en: item.title_en,
        content_ar: item.content_ar,
        content_fr: item.content_fr,
        content_en: item.content_en,
        status: item.status as CMSPageStatus,
        note: item.note,
      }));
    }
  } catch (e) {
    console.warn('[CMS Supabase Integration] fetchPageRevisions exception:', e);
  }

  return [];
}

// ----------------------------------------------------
// ACTIVITY LOGS
// ----------------------------------------------------

export async function fetchCMSActivityLogs(): Promise<CMSActivityLog[]> {
  try {
    const { data, error } = await supabase
      .from('cms_activity_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (!error && data) {
      return data.map(item => ({
        id: item.id,
        action: item.action,
        details: item.details,
        entity_type: item.entity_type as 'page' | 'media' | 'system',
        entity_name: item.entity_name,
        timestamp: item.timestamp,
        user: item.user,
        ip_address: item.ip_address,
      }));
    }
  } catch (e) {
    console.warn('[CMS Supabase Integration] fetchCMSActivityLogs exception:', e);
  }

  return [
    {
      id: 'log-1',
      action: 'تحديث الصفحة',
      details: 'تم تحديث محتوى صفحة "عن بيزنس ماركت" وتحسين صيغة SEO',
      entity_type: 'page',
      entity_name: 'عن بيزنس ماركت',
      timestamp: new Date().toISOString(),
      user: 'Super Admin',
    }
  ];
}

export async function logCMSActivity(log: Omit<CMSActivityLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    await supabase.from('cms_activity_logs').insert({
      action: log.action,
      details: log.details,
      entity_type: log.entity_type,
      entity_name: log.entity_name,
      user: log.user || 'Admin',
      ip_address: log.ip_address || null,
    });
  } catch (e) {
    console.warn('[CMS Activity Log] Failed to insert log:', e);
  }
}

// ----------------------------------------------------
// RECORD PAGE VIEW RPC
// ----------------------------------------------------

export async function recordPageView(pageId: string, sessionId: string): Promise<void> {
  if (!pageId || !sessionId) return;

  try {
    await supabase.rpc('record_cms_page_view', {
      p_page_id: pageId,
      p_session_id: sessionId,
    });
  } catch (e) {
    console.warn('[CMS Record Page View] RPC failed:', e);
  }
}

// ----------------------------------------------------
// SEED DEFAULT LEGAL & SYSTEM CMS PAGES TO SUPABASE
// ----------------------------------------------------

export async function seedDefaultCMSPages(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const dbPayloads = DEFAULT_STATIC_PAGES.map(page => ({
      id: page.id,
      key: page.key,
      slug: page.slug,
      type: page.type,
      title_ar: page.title_ar,
      title_fr: page.title_fr,
      title_en: page.title_en || page.title_fr,
      content_ar: page.content_ar,
      content_fr: page.content_fr,
      content_en: page.content_en || page.content_fr,
      status: page.status,
      publish_date: page.publish_date || null,
      seo: page.seo || {},
      author: page.author || 'Legal Team',
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('cms_pages')
      .upsert(dbPayloads, { onConflict: 'key' })
      .select();

    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: data ? data.length : dbPayloads.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to seed default legal pages';
    return { success: false, count: 0, error: msg };
  }
}
