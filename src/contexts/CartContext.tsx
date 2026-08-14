/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { CartItem, Product, Customer, CustomerPriceOverride, PriceListEntry, CustomerGroup } from '../types';
import { supabase } from '../lib/supabase';
import { getActiveProductPrice } from '../lib/wholesale';
import { useLanguage } from './LanguageContext';
import { useToast } from './ToastContext';

interface CartContextValue {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const CART_STORAGE_KEY = 'bm_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const { lang } = useLanguage();
  const { showToast } = useToast();

  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [isOpen, setIsOpen] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [overrides, setOverrides] = useState<CustomerPriceOverride[]>([]);
  const [entries, setEntries] = useState<PriceListEntry[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);

  // Load customer and wholesale rules
  useEffect(() => {
    const saved = localStorage.getItem('customer');
    if (saved) {
      try {
        setCustomer(JSON.parse(saved));
      } catch {
        /* Ignore */
      }
    }

    async function loadWholesaleRules() {
      try {
        const [oRes, eRes, gRes] = await Promise.all([
          supabase.from('customer_price_overrides').select('*'),
          supabase.from('price_list_entries').select('*'),
          supabase.from('customer_groups').select('*')
        ]);
        if (oRes.data) setOverrides(oRes.data as CustomerPriceOverride[]);
        if (eRes.data) setEntries(eRes.data as PriceListEntry[]);
        if (gRes.data) setGroups(gRes.data as CustomerGroup[]);
      } catch (e) {
        console.error('Failed to load wholesale pricing rules', e);
      }
    }
    loadWholesaleRules();
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product: Product, quantity = 1) => {
    const isWholesale = customer?.account_type === 'wholesale' && customer?.wholesale_status === 'approved';
    const finalPrice = getActiveProductPrice(product, customer, overrides, entries, groups);
    
    // For wholesale, enforce minimum order quantity (MOQ)
    const minQty = isWholesale ? (product.moq ?? 1) : 1;
    const qtyToAdd = Math.max(quantity, minQty);

    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, price: finalPrice, quantity: Math.min(i.quantity + quantity, product.stock_quantity) }
            : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name_ar,
          slug: product.slug,
          image: product.images[0] || '',
          price: finalPrice,
          quantity: Math.min(qtyToAdd, product.stock_quantity),
          stock_quantity: product.stock_quantity,
        },
      ];
    });
    setIsOpen(true);

    const productName = lang === 'ar' ? product.name_ar : product.name_fr;
    const message = lang === 'ar' 
      ? `تم إضافة "${productName}" إلى السلة` 
      : lang === 'fr' 
      ? `"${productName}" a été ajouté au panier` 
      : `Added "${productName}" to cart`;
    showToast(message, 'success');
  }, [customer, overrides, entries, groups, lang, showToast]);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === productId
          ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock_quantity)) }
          : i
      )
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal, isOpen, setIsOpen }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
