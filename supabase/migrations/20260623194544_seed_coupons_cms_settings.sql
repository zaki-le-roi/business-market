-- Seed coupons
INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, used_count, is_active, starts_at, expires_at) VALUES
('WELCOME10', 'خصم 10% للعملاء الجدد / 10% de réduction nouveaux clients', 'percentage', 10, 0, 5000, 1000, 23, true, now(), now() + interval '90 days'),
('FREESHIP', 'توصيل مجاني / Livraison gratuite', 'fixed', 600, 5000, 600, 500, 12, true, now(), now() + interval '60 days'),
('FLASH20', 'خصم 20% عرض فلاش / 20% Flash Sale', 'percentage', 20, 10000, 10000, 200, 45, true, now(), now() + interval '7 days'),
('VIP15', 'خصم VIP 15% / VIP 15% de réduction', 'percentage', 15, 20000, 15000, 100, 8, true, now(), now() + interval '365 days');

-- Seed CMS content (banners)
INSERT INTO cms_content (type, key, title_ar, title_fr, content_ar, content_fr, metadata, is_active, sort_order) VALUES
('banner', 'hero-main', 'تسوق بثقة مع Business Market', 'Achetez en confiance avec Business Market', 'أفضل المنتجات بأسعار منافسة مع الدفع عند الاستلام في كل الولايات', 'Meilleurs produits à prix compétitifs avec paiement à la livraison dans toutes les wilayas', '{"image": "https://images.pexels.com/photos/5650024/pexels-photo-5650024.jpeg?auto=compress&cs=tinysrgb&w=1600", "cta_ar": "تسوق الآن", "cta_fr": "Acheter maintenant", "link": "/products"}'::jsonb, true, 1),
('banner', 'promo-cod', 'الدفع عند الاستلام في كل 58 ولاية', 'Paiement à la livraison dans les 58 wilayas', 'ادفع نقداً عند استلام طلبك في أي ولاية من ولايات الجزائر', 'Payez en espèces à la réception dans toute wilaya d''Algérie', '{"image": "https://images.pexels.com/photos/4397842/pexels-photo-4397842.jpeg?auto=compress&cs=tinysrgb&w=1600", "cta_ar": "اكتشف المزيد", "cta_fr": "En savoir plus", "link": "/products"}'::jsonb, true, 2),
('banner', 'promo-flash', 'عروض فلاش لفترة محدودة', 'Offres Flash à durée limitée', 'خصومات تصل إلى 50% على منتجات مختارة لفترة محدودة فقط', 'Jusqu''à 50% de réduction sur des produits sélectionnés', '{"image": "https://images.pexels.com/photos/230544/pexels-photo-230544.jpeg?auto=compress&cs=tinysrgb&w=1600", "cta_ar": "تسوق العروض", "cta_fr": "Voir les offres", "link": "/products?filter=flash_sale"}'::jsonb, true, 3);

-- Seed system settings
INSERT INTO system_settings (key, value, description, is_public) VALUES
('store_name', '{"ar": "بزنس ماركت", "fr": "Business Market"}'::jsonb, 'Store name', true),
('store_phone', '{"value": "+213 555 000 000"}'::jsonb, 'Store contact phone', true),
('store_email', '{"value": "contact@businessmarket.dz"}'::jsonb, 'Store contact email', true),
('maintenance_mode', '{"value": false}'::jsonb, 'Maintenance mode', true),
('cod_enabled', '{"value": true}'::jsonb, 'Cash on delivery enabled', true),
('online_payment_enabled', '{"value": false}'::jsonb, 'Online payment enabled', true),
('free_shipping_threshold', '{"value": 30000}'::jsonb, 'Free shipping threshold in DZD', true),
('currency', '{"code": "DZD", "symbol": "دج", "symbol_fr": "DA"}'::jsonb, 'Currency settings', true),
('flash_sale_active', '{"value": true}'::jsonb, 'Flash sale feature active', true),
('reviews_enabled', '{"value": true}'::jsonb, 'Reviews feature enabled', true),
('ai_chatbot_enabled', '{"value": true}'::jsonb, 'AI chatbot enabled', true),
('otp_expiry_minutes', '{"value": 5}'::jsonb, 'OTP expiry in minutes', true),
('max_otp_attempts', '{"value": 3}'::jsonb, 'Max OTP attempts', true),
('rate_limit_per_minute', '{"value": 60}'::jsonb, 'API rate limit per minute', false),
('fraud_detection_enabled', '{"value": true}'::jsonb, 'Fraud detection enabled', false),
('abandoned_cart_hours', '{"value": 24}'::jsonb, 'Hours before abandoned cart recovery', false);
