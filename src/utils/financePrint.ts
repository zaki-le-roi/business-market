import { FinanceInvoice, FinanceSettings } from '../types/finance';

export function printFinanceInvoice(invoice: FinanceInvoice, settings?: FinanceSettings, isAr: boolean = true) {
  const printWindow = window.open('', '_blank', 'width=850,height=950');
  if (!printWindow) return;

  const itemsRows = (invoice.items || []).map((item, idx) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #334155; text-align: center;">${idx + 1}</td>
      <td style="padding: 10px; border-bottom: 1px solid #334155;">
        <div style="font-weight: 600; color: #f8fafc;">${item.description}</div>
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #334155; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #334155; text-align: right;">${Number(item.unit_price).toLocaleString()} DZD</td>
      <td style="padding: 10px; border-bottom: 1px solid #334155; text-align: right; font-weight: 600; color: #10b981;">${Number(item.total).toLocaleString()} DZD</td>
    </tr>
  `).join('');

  const statusBg = invoice.status === 'paid' ? '#065f46' : invoice.status === 'partially_paid' ? '#155e75' : invoice.status === 'unpaid' ? '#92400e' : '#1e293b';
  const statusColor = invoice.status === 'paid' ? '#34d399' : invoice.status === 'partially_paid' ? '#22d3ee' : invoice.status === 'unpaid' ? '#fbbf24' : '#94a3b8';
  const statusLabel = invoice.status === 'paid' ? (isAr ? 'مدفوع بالكامل' : 'PAYÉ') : invoice.status === 'partially_paid' ? (isAr ? 'مدفوع جزئياً' : 'PAYÉ PARTIELLEMENT') : invoice.status === 'unpaid' ? (isAr ? 'غير مدفوع' : 'NON PAYÉ') : (isAr ? 'ملغى / مسترجع' : 'ANNULÉ / REMBOURSÉ');

  const html = `
    <!DOCTYPE html>
    <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'fr'}">
    <head>
      <meta charset="utf-8">
      <title>${isAr ? 'فاتورة' : 'Facture'} ${invoice.invoice_number}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 30px; color: #0f172a; background: #ffffff; }
        .invoice-card { border: 2px solid #0f172a; border-radius: 12px; padding: 25px; max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 20px; }
        .company-name { font-size: 24px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
        .sub-text { font-size: 12px; color: #475569; margin-top: 4px; }
        .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 800; background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusColor}; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
        .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
        .meta-title { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #0f172a; color: #ffffff; font-size: 12px; font-weight: 700; padding: 10px; text-align: ${isAr ? 'right' : 'left'}; }
        th:first-child { text-align: center; }
        th:nth-child(3) { text-align: center; }
        th:last-child { text-align: right; }
        .totals-box { width: 320px; margin-${isAr ? 'right' : 'left'}: auto; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; }
        .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; color: #334155; }
        .totals-row.grand { border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 8px; font-weight: 800; font-size: 16px; color: #0f172a; }
        .stamp-section { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #475569; }
        .stamp-box { border: 1px dashed #94a3b8; border-radius: 8px; padding: 25px; width: 180px; text-align: center; font-weight: 700; color: #64748b; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px; text-align: center;">
        <button onclick="window.print()" style="background: #0f172a; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px;">
          🖨️ ${isAr ? 'طباعة الفاتورة / حفظ PDF' : 'Imprimer la facture / Enregistrer PDF'}
        </button>
      </div>

      <div class="invoice-card">
        <div class="header">
          <div>
            <div class="company-name">STORE E-COMMERCE ALGERIA</div>
            <div class="sub-text">${isAr ? 'فاتورة مبيعات معتمدة' : 'Facture de vente officielle'}</div>
            ${settings?.fiscal_number ? `<div class="sub-text">N° Fiscal: ${settings.fiscal_number}</div>` : ''}
          </div>
          <div style="text-align: ${isAr ? 'left' : 'right'}">
            <div class="badge">${statusLabel}</div>
            <div style="font-size: 18px; font-weight: 800; margin-top: 8px; color: #0f172a;">${invoice.invoice_number}</div>
            <div class="sub-text">${isAr ? 'التاريخ:' : 'Date:'} ${invoice.issue_date}</div>
            <div class="sub-text">${isAr ? 'تاريخ الاستحقاق:' : 'Échéance:'} ${invoice.due_date}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-box">
            <div class="meta-title">${isAr ? 'معلومات العميل' : 'Client'}</div>
            <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${invoice.customer_name}</div>
            ${invoice.customer_phone ? `<div class="sub-text">📞 ${invoice.customer_phone}</div>` : ''}
            ${invoice.customer_email ? `<div class="sub-text">✉️ ${invoice.customer_email}</div>` : ''}
            <div style="margin-top: 6px;">
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: ${invoice.customer_type === 'wholesale' ? '#e0e7ff' : '#f1f5f9'}; color: ${invoice.customer_type === 'wholesale' ? '#3730a3' : '#475569'};">
                ${invoice.customer_type === 'wholesale' ? (isAr ? 'عميل جملة (B2B)' : 'Wholesale (B2B)') : (isAr ? 'عميل تجزئة' : 'Retail')}
              </span>
            </div>
          </div>

          <div class="meta-box">
            <div class="meta-title">${isAr ? 'تفاصيل الطلب والدفع' : 'Paiement & Commande'}</div>
            ${invoice.order_number ? `<div style="font-size: 13px; font-weight: 700; color: #0f172a;">${isAr ? 'مرجع الطلب:' : 'Réf. Commande:'} #${invoice.order_number}</div>` : ''}
            <div class="sub-text" style="margin-top: 4px;">
              ${isAr ? 'المبلغ المدفوع:' : 'Montant Payé:'} <strong style="color: #059669;">${Number(invoice.paid_amount).toLocaleString()} DZD</strong>
            </div>
            <div class="sub-text">
              ${isAr ? 'المبلغ المتبقي:' : 'Reste à Payer:'} <strong style="color: ${invoice.balance_due > 0 ? '#d97706' : '#059669'};">${Number(invoice.balance_due).toLocaleString()} DZD</strong>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>${isAr ? 'الوصف / المنتج' : 'Description'}</th>
              <th style="width: 80px;">${isAr ? 'الكمية' : 'Qté'}</th>
              <th style="width: 120px;">${isAr ? 'سعر الوحدة' : 'Prix Unitaire'}</th>
              <th style="width: 140px;">${isAr ? 'الإجمالي' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="totals-box">
          <div class="totals-row">
            <span>${isAr ? 'المجموع الفرعي:' : 'Sous-total:'}</span>
            <span>${Number(invoice.subtotal).toLocaleString()} DZD</span>
          </div>
          ${invoice.tax_amount > 0 ? `
            <div class="totals-row">
              <span>${isAr ? 'الضريبة (TVA' : 'Taxe (TVA'} ${invoice.tax_rate}%):</span>
              <span>+${Number(invoice.tax_amount).toLocaleString()} DZD</span>
            </div>
          ` : ''}
          ${invoice.shipping_amount > 0 ? `
            <div class="totals-row">
              <span>${isAr ? 'مصاريف الشحن:' : 'Frais de livraison:'}</span>
              <span>+${Number(invoice.shipping_amount).toLocaleString()} DZD</span>
            </div>
          ` : ''}
          ${invoice.discount_amount > 0 ? `
            <div class="totals-row" style="color: #dc2626;">
              <span>${isAr ? 'الخصم:' : 'Remise:'}</span>
              <span>-${Number(invoice.discount_amount).toLocaleString()} DZD</span>
            </div>
          ` : ''}
          <div class="totals-row grand">
            <span>${isAr ? 'الإجمالي النهائي:' : 'Montant Total:'}</span>
            <span>${Number(invoice.total_amount).toLocaleString()} DZD</span>
          </div>
        </div>

        ${invoice.notes ? `
          <div style="margin-top: 25px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; color: #475569;">
            <strong>${isAr ? 'ملاحظات:' : 'Notes:'}</strong> ${invoice.notes}
          </div>
        ` : ''}

        <div class="stamp-section">
          <div>
            <div>${isAr ? 'شكراً لتعاملكم معنا!' : 'Merci pour votre confiance !'}</div>
            <div style="font-size: 11px; margin-top: 4px; color: #94a3b8;">STORE E-COMMERCE © 2026</div>
          </div>
          <div class="stamp-box">
            ${isAr ? 'ختم وتوقيع المؤسسة' : 'Cachet & Signature'}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function printFinancialReport(
  periodLabel: string,
  metrics: {
    totalRevenue: number;
    retailRevenue: number;
    wholesaleRevenue: number;
    totalExpenses: number;
    supplierExpenses: number;
    operationalExpenses: number;
    netProfit: number;
    profitMargin: number;
    paidInvoicesCount: number;
    unpaidAmount: number;
  },
  isAr: boolean = true
) {
  const printWindow = window.open('', '_blank', 'width=850,height=950');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'fr'}">
    <head>
      <meta charset="utf-8">
      <title>${isAr ? 'تقرير مالي' : 'Rapport Financier'} - ${periodLabel}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 30px; color: #0f172a; background: #ffffff; }
        .report-card { border: 2px solid #0f172a; border-radius: 12px; padding: 25px; max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; }
        .title { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
        .val { font-size: 20px; font-weight: 800; margin-top: 4px; }
        .green { color: #059669; }
        .red { color: #dc2626; }
        .blue { color: #2563eb; }
        .purple { color: #7c3aed; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #0f172a; color: #fff; padding: 10px; font-size: 12px; text-align: ${isAr ? 'right' : 'left'}; }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
      </style>
    </head>
    <body>
      <div style="margin-bottom: 20px; text-align: center;" class="no-print">
        <button onclick="window.print()" style="background: #0f172a; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; cursor: pointer;">
          🖨️ ${isAr ? 'طباعة التقرير / حفظ PDF' : 'Imprimer le rapport / Enregistrer PDF'}
        </button>
      </div>
      <div class="report-card">
        <div class="header">
          <div>
            <h1 style="margin: 0; font-size: 22px;">${isAr ? 'التقرير المالي الرسمي' : 'Rapport Financier Officiel'}</h1>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">${isAr ? 'الفترة:' : 'Période:'} ${periodLabel}</p>
          </div>
          <div style="text-align: ${isAr ? 'left' : 'right'}; font-size: 12px; color: #64748b;">
            <div>STORE E-COMMERCE</div>
            <div>${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="title">${isAr ? 'إجمالي الإيرادات' : 'Revenu Total'}</div>
            <div class="val green">${metrics.totalRevenue.toLocaleString()} DZD</div>
          </div>
          <div class="card">
            <div class="title">${isAr ? 'إجمالي المصاريف' : 'Dépenses Totales'}</div>
            <div class="val red">${metrics.totalExpenses.toLocaleString()} DZD</div>
          </div>
          <div class="card">
            <div class="title">${isAr ? 'صافي الأرباح' : 'Bénéfice Net'}</div>
            <div class="val ${metrics.netProfit >= 0 ? 'green' : 'red'}">${metrics.netProfit.toLocaleString()} DZD (${metrics.profitMargin.toFixed(1)}%)</div>
          </div>
          <div class="card">
            <div class="title">${isAr ? 'المستحقات المعلقة' : 'Paiements en Attente'}</div>
            <div class="val purple">${metrics.unpaidAmount.toLocaleString()} DZD</div>
          </div>
        </div>

        <h3 style="margin-top: 25px; font-size: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">
          ${isAr ? 'تفاصيل المبيعات (تجزئة vs جملة)' : 'Détails des Ventes (Retail vs Wholesale)'}
        </h3>
        <table>
          <thead>
            <tr>
              <th>${isAr ? 'القطاع' : 'Secteur'}</th>
              <th>${isAr ? 'المبلغ' : 'Montant'}</th>
              <th>${isAr ? 'النسبة من الإيراد' : 'Part du Revenu'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${isAr ? 'مبيعات التجزئة (B2C)' : 'Ventes Retail (B2C)'}</strong></td>
              <td class="green font-bold">${metrics.retailRevenue.toLocaleString()} DZD</td>
              <td>${metrics.totalRevenue > 0 ? ((metrics.retailRevenue / metrics.totalRevenue) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr>
              <td><strong>${isAr ? 'مبيعات الجملة (B2B)' : 'Ventes Wholesale (B2B)'}</strong></td>
              <td class="blue font-bold">${metrics.wholesaleRevenue.toLocaleString()} DZD</td>
              <td>${metrics.totalRevenue > 0 ? ((metrics.wholesaleRevenue / metrics.totalRevenue) * 100).toFixed(1) : 0}%</td>
            </tr>
          </tbody>
        </table>

        <h3 style="margin-top: 25px; font-size: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">
          ${isAr ? 'تفاصيل المصاريف (موردين vs تشغيل)' : 'Détails des Dépenses (Fournisseurs vs Opérationnel)'}
        </h3>
        <table>
          <thead>
            <tr>
              <th>${isAr ? 'نوع المصروف' : 'Type de Dépense'}</th>
              <th>${isAr ? 'المبلغ' : 'Montant'}</th>
              <th>${isAr ? 'النسبة من المصاريف' : 'Part des Dépenses'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${isAr ? 'مصاريف الموردين والسلع (COGS)' : 'Achats & Fournisseurs (COGS)'}</strong></td>
              <td class="red font-bold">${metrics.supplierExpenses.toLocaleString()} DZD</td>
              <td>${metrics.totalExpenses > 0 ? ((metrics.supplierExpenses / metrics.totalExpenses) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr>
              <td><strong>${isAr ? 'المصاريف التشغيلية (تسويق، شحن، إيجار)' : 'Dépenses Opérationnelles'}</strong></td>
              <td class="red font-bold">${metrics.operationalExpenses.toLocaleString()} DZD</td>
              <td>${metrics.totalExpenses > 0 ? ((metrics.operationalExpenses / metrics.totalExpenses) * 100).toFixed(1) : 0}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
