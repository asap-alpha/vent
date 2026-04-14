import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency } from './currency'
import { formatDate } from './date'
import type { SalesInvoice } from '@/types/sales'
import type { PurchaseInvoice } from '@/types/purchases'
import type { Organization } from '@/types/auth'

export function exportInvoicePDF(
  invoice: SalesInvoice,
  org: Organization,
  customerInfo: { name: string; email: string; address: string; taxId: string }
) {
  const doc = new jsPDF()
  const currency = org.currency

  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', 14, 22)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(invoice.number, 14, 30)

  // Org block
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(org.name, 196, 22, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  // Bill To
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('BILL TO', 14, 50)
  doc.setFont('helvetica', 'normal')
  let y = 56
  doc.text(customerInfo.name || '—', 14, y); y += 5
  if (customerInfo.email) { doc.text(customerInfo.email, 14, y); y += 5 }
  if (customerInfo.address) {
    const lines = doc.splitTextToSize(customerInfo.address, 80)
    doc.text(lines, 14, y); y += 5 * lines.length
  }
  if (customerInfo.taxId) { doc.text(`Tax ID: ${customerInfo.taxId}`, 14, y); y += 5 }

  // Dates block
  doc.setFont('helvetica', 'bold')
  doc.text('Invoice Date:', 130, 50)
  doc.text('Due Date:', 130, 56)
  doc.text('Status:', 130, 62)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(invoice.date), 196, 50, { align: 'right' })
  doc.text(formatDate(invoice.dueDate), 196, 56, { align: 'right' })
  doc.text(invoice.status.replace('_', ' ').toUpperCase(), 196, 62, { align: 'right' })

  // Line items
  autoTable(doc, {
    startY: Math.max(y + 8, 90),
    head: [['Description', 'Qty', 'Unit Price', 'Tax %', 'Amount']],
    body: invoice.lines.map((l) => [
      l.description,
      String(l.quantity),
      formatCurrency(l.unitPrice, currency),
      `${l.taxRate}%`,
      formatCurrency(l.amount, currency),
    ]),
    headStyles: { fillColor: [21, 101, 192] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    foot: [
      ['', '', '', 'Subtotal', formatCurrency(invoice.subtotal, currency)],
      ['', '', '', 'Tax', formatCurrency(invoice.taxTotal, currency)],
      ['', '', '', 'Total', formatCurrency(invoice.total, currency)],
      ['', '', '', 'Paid', formatCurrency(invoice.amountPaid, currency)],
      ['', '', '', 'Amount Due', formatCurrency(invoice.amountDue, currency)],
    ],
    footStyles: { halign: 'right', fillColor: [245, 245, 245], textColor: 0 },
  })

  if (invoice.notes) {
    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Notes:', 14, finalY)
    doc.setFont('helvetica', 'normal')
    const noteLines = doc.splitTextToSize(invoice.notes, 180)
    doc.text(noteLines, 14, finalY + 6)
  }

  doc.save(`${invoice.number}.pdf`)
}

export function exportBillPDF(
  bill: PurchaseInvoice,
  org: Organization,
  supplierInfo: { name: string; email: string; address: string; taxId: string }
) {
  const doc = new jsPDF()
  const currency = org.currency

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('BILL', 14, 22)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(bill.number, 14, 30)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(org.name, 196, 22, { align: 'right' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('SUPPLIER', 14, 50)
  doc.setFont('helvetica', 'normal')
  let y = 56
  doc.text(supplierInfo.name || '—', 14, y); y += 5
  if (supplierInfo.email) { doc.text(supplierInfo.email, 14, y); y += 5 }
  if (supplierInfo.address) {
    const lines = doc.splitTextToSize(supplierInfo.address, 80)
    doc.text(lines, 14, y); y += 5 * lines.length
  }
  if (supplierInfo.taxId) { doc.text(`Tax ID: ${supplierInfo.taxId}`, 14, y); y += 5 }

  doc.setFont('helvetica', 'bold')
  doc.text('Bill Date:', 130, 50)
  doc.text('Due Date:', 130, 56)
  doc.text('Status:', 130, 62)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(bill.date), 196, 50, { align: 'right' })
  doc.text(formatDate(bill.dueDate), 196, 56, { align: 'right' })
  doc.text(bill.status.replace('_', ' ').toUpperCase(), 196, 62, { align: 'right' })

  autoTable(doc, {
    startY: Math.max(y + 8, 90),
    head: [['Description', 'Qty', 'Unit Price', 'Tax %', 'Amount']],
    body: bill.lines.map((l) => [
      l.description,
      String(l.quantity),
      formatCurrency(l.unitPrice, currency),
      `${l.taxRate}%`,
      formatCurrency(l.amount, currency),
    ]),
    headStyles: { fillColor: [21, 101, 192] },
    columnStyles: {
      1: { halign: 'right' }, 2: { halign: 'right' },
      3: { halign: 'right' }, 4: { halign: 'right' },
    },
    foot: [
      ['', '', '', 'Subtotal', formatCurrency(bill.subtotal, currency)],
      ['', '', '', 'Tax', formatCurrency(bill.taxTotal, currency)],
      ['', '', '', 'Total', formatCurrency(bill.total, currency)],
      ['', '', '', 'Paid', formatCurrency(bill.amountPaid, currency)],
      ['', '', '', 'Amount Due', formatCurrency(bill.amountDue, currency)],
    ],
    footStyles: { halign: 'right', fillColor: [245, 245, 245], textColor: 0 },
  })

  if (bill.notes) {
    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Notes:', 14, finalY)
    doc.setFont('helvetica', 'normal')
    const noteLines = doc.splitTextToSize(bill.notes, 180)
    doc.text(noteLines, 14, finalY + 6)
  }

  doc.save(`${bill.number}.pdf`)
}
