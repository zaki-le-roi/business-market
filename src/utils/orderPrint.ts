import { Order } from '../types';
import { ALL_WILAYAS } from '../constants/wilayas';

function getWilayaText(order: Order, isAr: boolean): string {
  if (order.wilaya) return isAr ? order.wilaya.name_ar : order.wilaya.name_fr;
  if (order.wilaya_id) {
    const found = ALL_WILAYAS.find(w => w.id === order.wilaya_id);
    if (found) return isAr ? found.name_ar : found.name_fr;
  }
  return isAr ? 'الجزائر' : 'Alger';
}

export function printOrderInvoice(order: Order, lang: string = 'ar') {
  const isAr = lang === 'ar';
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) return;

  const itemsRows = (order.items || []).map((item, idx) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 600; color: #0f172a;">${item.name}</div>
        ${item.slug ? `<div style="font-size: 11px; color: #64748b;">SKU: ${item.slug}</div>` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${Number(item.price).toLocaleString()} DZD</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${Number(item.subtotal || item.price * item.quantity).toLocaleString()} DZD</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${lang}">
    <head>
      <meta charset="utf-8">
      <title>${isAr ? 'فاتورة طلب' : 'Facture'} #${order.order_number}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 25px; color: #1e293b; background: #fff; }
        .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 25px; }
        .logo { font-size: 24px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: #e0e7ff; color: #3730a3; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
        .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
        .box-title { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        th { background: #0f172a; color: #fff; font-size: 12px; font-weight: 600; padding: 10px; text-align: ${isAr ? 'right' : 'left'}; }
        th:first-child { text-align: center; }
        th:nth-child(3) { text-align: center; }
        th:last-child { text-align: right; }
        .totals { width: 300px; margin-${isAr ? 'right' : 'left'}: auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
        .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
        .totals-row.grand { border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 10px; font-weight: 800; font-size: 16px; color: #0f172a; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px; text-align: ${isAr ? 'left' : 'right'};">
        <button onclick="window.print()" style="padding: 8px 18px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
          ${isAr ? 'طباعة / حفظ PDF' : 'Imprimer / PDF'}
        </button>
      </div>

      <div class="invoice-header">
        <div>
          <div class="logo">E-COMMERCE STORE</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${isAr ? 'فاتورة بيع رسمية' : 'Facture Officielle'}</div>
        </div>
        <div style="text-align: ${isAr ? 'left' : 'right'};">
          <div style="font-size: 20px; font-weight: 800; color: #0f172a;">#${order.order_number}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${new Date(order.created_at).toLocaleDateString(isAr ? 'ar-DZ' : 'fr-FR')}</div>
          <div style="margin-top: 8px;">
            <span class="badge">${order.payment_status === 'paid' ? (isAr ? 'مدفوع' : 'Payé') : (isAr ? 'الدفع عند الاستلام' : 'Paiement à la livraison')}</span>
          </div>
        </div>
      </div>

      <div class="grid">
        <div class="box">
          <div class="box-title">${isAr ? 'معلومات العميل' : 'Client'}</div>
          <div style="font-weight: 700; font-size: 15px;">${order.customer_name || (isAr ? 'عميل عام' : 'Client')}</div>
          <div style="margin-top: 4px; font-size: 13px; color: #475569;">📞 ${order.customer_phone}</div>
          ${order.customer_email ? `<div style="font-size: 13px; color: #475569;">✉️ ${order.customer_email}</div>` : ''}
        </div>
        <div class="box">
          <div class="box-title">${isAr ? 'عنوان ووسيلة الشحن' : 'Expédition'}</div>
          <div style="font-weight: 700; font-size: 14px;">${getWilayaText(order, isAr)}</div>
          <div style="font-size: 13px; color: #475569; margin-top: 4px;">${order.address || ''} ${order.commune ? `- ${order.commune}` : ''}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
            ${order.delivery_type === 'home' ? (isAr ? 'توصيل للمنزل 🏠' : 'À domicile 🏠') : (isAr ? 'استلام من المكتب 🏢' : 'Au bureau 🏢')}
            ${order.shipping_company ? ` | ${order.shipping_company}` : ''}
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>${isAr ? 'المنتج' : 'Article'}</th>
            <th style="width: 70px;">${isAr ? 'الكمية' : 'Qté'}</th>
            <th style="width: 110px;">${isAr ? 'السعر الفردي' : 'Prix unitaire'}</th>
            <th style="width: 120px;">${isAr ? 'المجموع' : 'Total'}</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span>${isAr ? 'المجموع الفرعي:' : 'Sous-total:'}</span>
          <span>${Number(order.subtotal).toLocaleString()} DZD</span>
        </div>
        <div class="totals-row">
          <span>${isAr ? 'تكلفة الشحن:' : 'Frais de livraison:'}</span>
          <span>${Number(order.delivery_fee).toLocaleString()} DZD</span>
        </div>
        ${Number(order.discount_amount) > 0 ? `
          <div class="totals-row" style="color: #dc2626;">
            <span>${isAr ? 'الخصم:' : 'Remise:'}</span>
            <span>-${Number(order.discount_amount).toLocaleString()} DZD</span>
          </div>
        ` : ''}
        <div class="totals-row grand">
          <span>${isAr ? 'الإجمالي:' : 'Total net:'}</span>
          <span>${Number(order.total).toLocaleString()} DZD</span>
        </div>
      </div>

      ${order.notes ? `
        <div class="box" style="margin-top: 25px;">
          <div class="box-title">${isAr ? 'ملاحظات الطلب' : 'Notes'}</div>
          <div style="font-size: 13px; color: #334155;">${order.notes}</div>
        </div>
      ` : ''}

      <div class="footer">
        ${isAr ? 'شكراً لثقتكم بنا وبمحبتكم لمنتجاتنا!' : 'Merci pour votre confiance !'}
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function printPackingSlip(order: Order, lang: string = 'ar') {
  const isAr = lang === 'ar';
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) return;

  const itemsRows = (order.items || []).map((item, idx) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 16px;">[  ]</td>
      <td style="padding: 12px; border-bottom: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
      <td style="padding: 12px; border-bottom: 1px solid #cbd5e1;">
        <div style="font-weight: 700; font-size: 15px; color: #0f172a;">${item.name}</div>
        ${item.slug ? `<div style="font-size: 12px; color: #475569;">SKU / Code: <strong>${item.slug}</strong></div>` : ''}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #cbd5e1; text-align: center; font-size: 18px; font-weight: 800; color: #1e3a8a;">
        ${item.quantity}
      </td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${lang}">
    <head>
      <meta charset="utf-8">
      <title>${isAr ? 'وصل تجهيز الطلب (Bon de Préparation)' : 'Bon de Préparation'} #${order.order_number}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 25px; color: #0f172a; }
        .header { border-bottom: 3px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .title { font-size: 22px; font-weight: 900; text-transform: uppercase; }
        .box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #1e293b; color: #fff; padding: 12px; font-size: 13px; text-align: ${isAr ? 'right' : 'left'}; }
        th:first-child, th:nth-child(2), th:last-child { text-align: center; }
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px; text-align: ${isAr ? 'left' : 'right'};">
        <button onclick="window.print()" style="padding: 8px 18px; background: #059669; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
          ${isAr ? 'طباعة وصل التجهيز' : 'Imprimer Bon de Préparation'}
        </button>
      </div>

      <div class="header">
        <div>
          <div class="title">📋 ${isAr ? 'وصل تجهيز طلبية (Warehouse Packing Slip)' : 'Bon de Préparation'}</div>
          <div style="font-size: 13px; color: #475569;">${isAr ? 'قسم المستودع والتغليف' : 'Atelier d\'emballage'}</div>
        </div>
        <div style="text-align: ${isAr ? 'left' : 'right'}; font-size: 20px; font-weight: 900;">
          #${order.order_number}
        </div>
      </div>

      <div class="box">
        <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">${isAr ? 'تفاصيل المشتري والشحن' : 'Informations Expédition'}</div>
        <div style="font-size: 16px; font-weight: 800; margin-top: 4px;">👤 ${order.customer_name || 'Client'} — 📞 ${order.customer_phone}</div>
        <div style="font-size: 14px; margin-top: 4px; color: #334155;">
          📍 ${getWilayaText(order, isAr)} | ${order.address || ''} (${order.delivery_type === 'home' ? (isAr ? 'توصيل منزل' : 'A domicile') : (isAr ? 'مكتب' : 'Bureau')})
        </div>
        ${order.tracking_number ? `<div style="font-size: 13px; margin-top: 4px; font-family: monospace; font-weight: bold; color: #2563eb;">📦 Tracking: ${order.tracking_number} (${order.shipping_company || 'Yalidine'})</div>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 50px;">تم</th>
            <th style="width: 40px;">#</th>
            <th>${isAr ? 'المنتج / السلعة' : 'Désignation Produit'}</th>
            <th style="width: 100px;">${isAr ? 'الكمية المطلوبة' : 'Quantité'}</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      ${order.admin_notes || order.notes ? `
        <div class="box" style="border-left: 4px solid #f59e0b; background: #fffbeb;">
          <div style="font-size: 12px; font-weight: 800; color: #b45309;">⚠️ ${isAr ? 'تعليمات خاصة بالتغليف' : 'Instructions Spéciales Emballage'}</div>
          <div style="font-size: 13px; font-weight: 600; color: #78350f; margin-top: 4px;">
            ${order.notes ? `<div>ملاحظة الزبون: ${order.notes}</div>` : ''}
            ${order.admin_notes ? `<div>ملاحظة الأدمن: ${order.admin_notes}</div>` : ''}
          </div>
        </div>
      ` : ''}

      <div style="margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 15px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
        <div>توقيع المسؤول عن التجهيز: ..........................</div>
        <div>تاريخ الفحص والتغليف: ${new Date().toLocaleDateString()}</div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function printShippingLabel(order: Order, lang: string = 'ar') {
  const isAr = lang === 'ar';
  const printWindow = window.open('', '_blank', 'width=500,height=700');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${lang}">
    <head>
      <meta charset="utf-8">
      <title>Shipping Label #${order.order_number}</title>
      <style>
        @page { size: 100mm 150mm; margin: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 12px; box-sizing: border-box; background: #fff; color: #000; width: 100mm; }
        .label-container { border: 3px solid #000; padding: 10px; border-radius: 6px; box-sizing: border-box; min-height: 140mm; display: flex; flex-direction: column; justify-content: space-between; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
        .carrier { font-size: 18px; font-weight: 900; text-transform: uppercase; }
        .type-badge { font-size: 12px; font-weight: 900; padding: 3px 8px; background: #000; color: #fff; border-radius: 4px; text-transform: uppercase; }
        .section { border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
        .label-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #444; }
        .wilaya-box { background: #000; color: #fff; font-size: 22px; font-weight: 900; text-align: center; padding: 6px; border-radius: 4px; margin-bottom: 8px; }
        .customer-name { font-size: 16px; font-weight: 800; margin-top: 2px; }
        .phone { font-size: 16px; font-weight: 900; font-family: monospace; margin-top: 2px; }
        .cod-box { border: 2px solid #000; padding: 8px; text-align: center; background: #f0f0f0; border-radius: 4px; }
        .cod-amount { font-size: 22px; font-weight: 900; }
        .barcode { text-align: center; margin-top: 8px; font-family: 'Courier New', Courier, monospace; font-size: 20px; font-weight: 900; letter-spacing: 2px; border: 1px solid #000; padding: 6px; }
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 10px; text-align: center;">
        <button onclick="window.print()" style="padding: 6px 14px; background: #000; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
          ${isAr ? 'طباعة الملصق (A6)' : 'Imprimer Étiquette (A6)'}
        </button>
      </div>

      <div class="label-container">
        <div>
          <div class="header">
            <div class="carrier">${order.shipping_company || 'YALIDINE EXPRESS'}</div>
            <div class="type-badge">${order.delivery_type === 'home' ? (isAr ? 'منزل (Home)' : 'Domicile') : (isAr ? 'مكتب (Desk)' : 'Bureau')}</div>
          </div>

          <div class="wilaya-box">
            ${getWilayaText(order, isAr)}
          </div>

          <div class="section">
            <div class="label-title">${isAr ? 'المرسل إليه (DESTINATAIRE)' : 'DESTINATAIRE'}</div>
            <div class="customer-name">${order.customer_name || 'Client'}</div>
            <div class="phone">📞 ${order.customer_phone}</div>
            <div style="font-size: 12px; font-weight: 600; margin-top: 4px;">
              📍 ${order.address || ''} ${order.commune ? `- ${order.commune}` : ''}
            </div>
          </div>

          <div class="section" style="border-bottom: none;">
            <div class="label-title">${isAr ? 'المحتويات' : 'CONTENU'}</div>
            <div style="font-size: 11px; max-height: 40px; overflow: hidden; color: #222;">
              ${(order.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ')}
            </div>
          </div>
        </div>

        <div>
          <div class="cod-box">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase;">
              ${order.payment_status === 'paid' ? (isAr ? 'مدفوع بالكامل (NO COD)' : 'DEJA PAYE') : (isAr ? 'المبلغ المطلوب تحصيله (COD)' : 'MONTANT A COLLECTER (COD)')}
            </div>
            <div class="cod-amount">
              ${order.payment_status === 'paid' ? '0 DZD' : `${Number(order.total).toLocaleString()} DZD`}
            </div>
          </div>

          <div class="barcode">
            *${order.tracking_number || order.order_number}*
            <div style="font-size: 10px; font-weight: normal; margin-top: 2px;">Réf: #${order.order_number}</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
