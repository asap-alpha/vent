import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from './date'
import type { SalesInvoice } from '@/types/sales'
import type { PurchaseInvoice } from '@/types/purchases'
import type { Organization } from '@/types/auth'

/**
 * PDF-safe currency formatter.
 *
 * jsPDF uses WinAnsi encoding by default (no Unicode for symbols like ₵, €, ¥).
 * Using Intl.NumberFormat with style: 'currency' would emit those symbols and
 * produce garbled output. Instead we render `<CODE> <amount>` with comma
 * separators — clean, unambiguous, and font-safe.
 */
function formatMoney(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  const sign = amount < 0 ? '-' : ''
  return `${sign}${currency} ${formatted}`
}

interface PartyInfo {
  name: string
  email: string
  phone?: string
  address: string
  taxId: string
}

interface DocConfig {
  docLabel: string            // "INVOICE" or "BILL"
  number: string
  date: Date
  dueDate: Date
  status: string
  partyHeading: string        // "BILL TO" or "SUPPLIER"
  party: PartyInfo
  lines: Array<{
    description: string
    quantity: number
    unitPrice: number
    taxRate: number
    amount: number
  }>
  subtotal: number
  taxTotal: number
  total: number
  amountPaid: number
  amountDue: number
  notes: string
  currency: string
  org: Organization
  orgAddress?: string
  orgEmail?: string
  orgPhone?: string
  filename: string
}

function renderDocument(cfg: DocConfig) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15

  const PRIMARY: [number, number, number] = [21, 101, 192]
  const DARK: [number, number, number] = [33, 33, 33]
  const MUTED: [number, number, number] = [120, 120, 120]
  const BORDER: [number, number, number] = [220, 220, 220]

  // ===== Header: doc label + org name =====
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...PRIMARY)
  doc.text(cfg.docLabel, margin, margin + 8)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  doc.text(`# ${cfg.number}`, margin, margin + 15)

  // Org block (right)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...DARK)
  doc.text(cfg.org.name, pageWidth - margin, margin + 8, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  let orgY = margin + 14
  if (cfg.orgAddress) {
    const addrLines = doc.splitTextToSize(cfg.orgAddress, 70)
    doc.text(addrLines, pageWidth - margin, orgY, { align: 'right' })
    orgY += addrLines.length * 4
  }
  if (cfg.orgEmail) {
    doc.text(cfg.orgEmail, pageWidth - margin, orgY, { align: 'right' })
    orgY += 4
  }
  if (cfg.orgPhone) {
    doc.text(cfg.orgPhone, pageWidth - margin, orgY, { align: 'right' })
    orgY += 4
  }

  // Divider
  const dividerY = Math.max(margin + 22, orgY + 2)
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(margin, dividerY, pageWidth - margin, dividerY)

  // ===== Party block (left) + Dates block (right) =====
  const blockY = dividerY + 8

  // Party (left)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(cfg.partyHeading, margin, blockY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  let partyY = blockY + 6
  doc.text(cfg.party.name || '—', margin, partyY)
  partyY += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  if (cfg.party.email) { doc.text(cfg.party.email, margin, partyY); partyY += 4 }
  if (cfg.party.phone) { doc.text(cfg.party.phone, margin, partyY); partyY += 4 }
  if (cfg.party.address) {
    const addrLines = doc.splitTextToSize(cfg.party.address, 85)
    doc.text(addrLines, margin, partyY)
    partyY += addrLines.length * 4
  }
  if (cfg.party.taxId) {
    doc.text(`Tax ID: ${cfg.party.taxId}`, margin, partyY)
    partyY += 4
  }

  // Dates (right)
  const labelX = pageWidth - margin - 45
  const valueX = pageWidth - margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  doc.text('Date', labelX, blockY + 6)
  doc.text('Due Date', labelX, blockY + 12)
  doc.text('Status', labelX, blockY + 18)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  doc.text(formatDate(cfg.date), valueX, blockY + 6, { align: 'right' })
  doc.text(formatDate(cfg.dueDate), valueX, blockY + 12, { align: 'right' })

  // Status badge
  const statusText = cfg.status.replace(/_/g, ' ').toUpperCase()
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...statusColor(cfg.status))
  doc.text(statusText, valueX, blockY + 18, { align: 'right' })

  // ===== Line items table =====
  const tableStartY = Math.max(partyY + 8, blockY + 28)

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [['Description', 'Qty', 'Unit Price', 'Tax', 'Amount']],
    body: cfg.lines.map((l) => [
      l.description || '—',
      String(l.quantity),
      formatMoney(l.unitPrice, cfg.currency),
      `${l.taxRate}%`,
      formatMoney(l.amount, cfg.currency),
    ]),
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      lineColor: BORDER,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: PRIMARY,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 18, halign: 'right' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 32, halign: 'right' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        doc.setDrawColor(...BORDER)
        doc.setLineWidth(0.1)
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height)
      }
    },
  })

  // ===== Totals box (right side) =====
  let y = (doc as any).lastAutoTable.finalY + 6
  const totalsX = pageWidth - margin - 80
  const totalsLabelX = pageWidth - margin - 45
  const totalsValueX = pageWidth - margin

  doc.setFontSize(9)

  function drawTotalsRow(label: string, value: string, opts: { bold?: boolean; color?: [number, number, number]; size?: number } = {}) {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    if (opts.size) doc.setFontSize(opts.size)
    doc.setTextColor(...(opts.color || MUTED))
    doc.text(label, totalsLabelX, y)
    doc.setTextColor(...(opts.color || DARK))
    doc.text(value, totalsValueX, y, { align: 'right' })
    doc.setFontSize(9)
    y += 5
  }

  drawTotalsRow('Subtotal', formatMoney(cfg.subtotal, cfg.currency))
  drawTotalsRow('Tax', formatMoney(cfg.taxTotal, cfg.currency))

  // Separator before Total
  doc.setDrawColor(...BORDER)
  doc.line(totalsX, y - 1, totalsValueX, y - 1)
  y += 2

  drawTotalsRow('Total', formatMoney(cfg.total, cfg.currency), { bold: true, color: DARK, size: 11 })

  if (cfg.amountPaid > 0) {
    drawTotalsRow('Paid', formatMoney(cfg.amountPaid, cfg.currency), { color: [76, 175, 80] })
  }

  // Amount Due box
  y += 2
  doc.setFillColor(cfg.amountDue > 0 ? 244 : 237, cfg.amountDue > 0 ? 67 : 247, cfg.amountDue > 0 ? 54 : 237)
  doc.rect(totalsX, y - 4, 80, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(cfg.amountDue > 0 ? 255 : 66, cfg.amountDue > 0 ? 255 : 66, cfg.amountDue > 0 ? 255 : 66)
  doc.text('Amount Due', totalsLabelX, y + 2)
  doc.text(formatMoney(cfg.amountDue, cfg.currency), totalsValueX, y + 2, { align: 'right' })

  // ===== Notes =====
  if (cfg.notes) {
    y += 14
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...DARK)
    doc.text('Notes', margin, y)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    const noteLines = doc.splitTextToSize(cfg.notes, pageWidth - margin * 2)
    doc.text(noteLines, margin, y + 5)
  }

  // ===== Footer =====
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(
    `Generated ${formatDate(new Date(), 'dd MMM yyyy HH:mm')}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  )

  doc.save(cfg.filename)
}

function statusColor(status: string): [number, number, number] {
  const s = status.toLowerCase()
  if (s === 'paid') return [76, 175, 80]
  if (s === 'overdue') return [244, 67, 54]
  if (s.includes('partial')) return [255, 152, 0]
  if (s === 'draft') return [120, 120, 120]
  if (s === 'void' || s === 'cancelled') return [120, 120, 120]
  return [21, 101, 192]
}

export function exportInvoicePDF(
  invoice: SalesInvoice,
  org: Organization,
  customerInfo: { name: string; email: string; phone?: string; address: string; taxId: string }
) {
  renderDocument({
    docLabel: 'INVOICE',
    number: invoice.number,
    date: invoice.date,
    dueDate: invoice.dueDate,
    status: invoice.status,
    partyHeading: 'BILL TO',
    party: customerInfo,
    lines: invoice.lines,
    subtotal: invoice.subtotal,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    amountDue: invoice.amountDue,
    notes: invoice.notes,
    currency: org.currency,
    org,
    filename: `${invoice.number}.pdf`,
  })
}

export function exportBillPDF(
  bill: PurchaseInvoice,
  org: Organization,
  supplierInfo: { name: string; email: string; phone?: string; address: string; taxId: string }
) {
  renderDocument({
    docLabel: 'BILL',
    number: bill.number,
    date: bill.date,
    dueDate: bill.dueDate,
    status: bill.status,
    partyHeading: 'SUPPLIER',
    party: supplierInfo,
    lines: bill.lines,
    subtotal: bill.subtotal,
    taxTotal: bill.taxTotal,
    total: bill.total,
    amountPaid: bill.amountPaid,
    amountDue: bill.amountDue,
    notes: bill.notes,
    currency: org.currency,
    org,
    filename: `${bill.number}.pdf`,
  })
}
