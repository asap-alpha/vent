import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from './date'
import type { SalesInvoice } from '@/types/sales'
import type { PurchaseInvoice } from '@/types/purchases'
import type { BankDetails, Organization } from '@/types/auth'

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
  /** Business location — printed in the header, inline with the document details. */
  orgAddress?: string
  orgEmail?: string
  orgPhone?: string
  orgTaxId?: string
  orgVatNumber?: string
  /** Org logo as a data URL (PNG/JPEG); omitted when the org hasn't uploaded one. */
  logo?: string
  /** Payment instructions — printed in a block below the document body. */
  bank?: BankDetails
  filename: string
}

/** Does this document carry tax? Drives the "VAT INVOICE" vs "INVOICE" heading. */
function hasVat(taxTotal: number, lines: Array<{ taxRate: number }>): boolean {
  return taxTotal > 0.005 || lines.some((l) => (l.taxRate || 0) > 0)
}

/** True when the bank block has at least one field worth printing. */
function hasBankDetails(bank?: BankDetails): bank is BankDetails {
  if (!bank) return false
  return Boolean(
    bank.bankName || bank.branch || bank.bankCode || bank.accountName || bank.accountNumber || bank.swift
  )
}

/** Logo box on the document header, in mm. The image is fitted inside it. */
const LOGO_MAX_W = 40
const LOGO_MAX_H = 18

/**
 * Draw the org logo right-aligned at `rightX`, scaled to fit the logo box while
 * keeping its aspect ratio. Returns the y-coordinate of its bottom edge, or
 * `null` when there is no logo (or it can't be decoded — a bad logo must never
 * cost the user their invoice).
 */
function drawLogo(doc: jsPDF, logo: string | undefined, rightX: number, topY: number): number | null {
  if (!logo) return null
  try {
    const props = doc.getImageProperties(logo)
    const scale = Math.min(LOGO_MAX_W / props.width, LOGO_MAX_H / props.height)
    const w = props.width * scale
    const h = props.height * scale
    doc.addImage(logo, props.fileType, rightX - w, topY, w, h)
    return topY + h
  } catch {
    return null
  }
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

  // ===== Header: doc label (left) + logo over the business block (right) =====
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...PRIMARY)
  doc.text(cfg.docLabel, margin, margin + 8)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  doc.text(`# ${cfg.number}`, margin, margin + 15)

  // Logo, right-aligned at the top. The business block flows beneath it, so the
  // location and contact details stay inline with the document details opposite.
  let orgY = margin + 8
  const logoBottom = drawLogo(doc, cfg.logo, pageWidth - margin, margin)
  if (logoBottom !== null) orgY = logoBottom + 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...DARK)
  doc.text(cfg.org.name, pageWidth - margin, orgY, { align: 'right' })
  orgY += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
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
  if (cfg.orgTaxId) {
    doc.text(`TIN: ${cfg.orgTaxId}`, pageWidth - margin, orgY, { align: 'right' })
    orgY += 4
  }
  if (cfg.orgVatNumber) {
    doc.text(`VAT No: ${cfg.orgVatNumber}`, pageWidth - margin, orgY, { align: 'right' })
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
  // Label sits at the left edge of the box — anchoring it at totalsLabelX ran it
  // into wide figures like "GHS 19,892.08"
  doc.text('Amount Due', totalsX + 4, y + 2)
  doc.text(formatMoney(cfg.amountDue, cfg.currency), totalsValueX - 4, y + 2, { align: 'right' })

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
    y += 5 + noteLines.length * 4
  }

  // ===== Payment details (bank block), below the document body =====
  if (hasBankDetails(cfg.bank)) {
    const rows: Array<[string, string]> = []
    if (cfg.bank.accountName) rows.push(['Account name', cfg.bank.accountName])
    if (cfg.bank.bankName) rows.push(['Bank', cfg.bank.bankName])
    if (cfg.bank.branch) rows.push(['Branch', cfg.bank.branch])
    if (cfg.bank.bankCode) rows.push(['Bank code', cfg.bank.bankCode])
    if (cfg.bank.accountNumber) rows.push(['Account number', cfg.bank.accountNumber])
    if (cfg.bank.swift) rows.push(['SWIFT / BIC', cfg.bank.swift])

    // Two balanced columns so the block stays shallow at the foot of the page
    const perColumn = Math.ceil(rows.length / 2)
    const boxHeight = 12 + perColumn * 5

    y += 10
    if (y + boxHeight > pageHeight - 14) {
      doc.addPage()
      y = margin
    }

    doc.setFillColor(247, 249, 252)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.3)
    doc.rect(margin, y, pageWidth - margin * 2, boxHeight, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...DARK)
    doc.text('BANK DETAILS', margin + 4, y + 6)

    const colWidth = (pageWidth - margin * 2) / 2
    doc.setFontSize(8.5)
    rows.forEach((row, i) => {
      const col = Math.floor(i / perColumn)
      const rowY = y + 12 + (i % perColumn) * 5
      const labelX = margin + 4 + col * colWidth
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...MUTED)
      doc.text(`${row[0]}:`, labelX, rowY)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...DARK)
      doc.text(row[1], labelX + 32, rowY)
    })

    y += boxHeight
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

/**
 * Pull the business profile (set in Settings → Business Profile) into the header
 * and payment blocks, so every caller brands documents the same way.
 */
function orgBranding(org: Organization) {
  return {
    logo: org.logo,
    orgAddress: org.address,
    orgEmail: org.email,
    orgPhone: org.phone,
    orgTaxId: org.taxId,
    orgVatNumber: org.vatNumber,
    bank: org.bankDetails,
  }
}

export function exportInvoicePDF(
  invoice: SalesInvoice,
  org: Organization,
  customerInfo: { name: string; email: string; phone?: string; address: string; taxId: string }
) {
  renderDocument({
    // A document that carries tax is a VAT invoice; without tax it's a plain invoice.
    docLabel: hasVat(invoice.taxTotal, invoice.lines) ? 'VAT INVOICE' : 'INVOICE',
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
    ...orgBranding(org),
    filename: `${invoice.number}.pdf`,
  })
}

export function exportBillPDF(
  bill: PurchaseInvoice,
  org: Organization,
  supplierInfo: { name: string; email: string; phone?: string; address: string; taxId: string }
) {
  renderDocument({
    docLabel: hasVat(bill.taxTotal, bill.lines) ? 'VAT BILL' : 'BILL',
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
    ...orgBranding(org),
    filename: `${bill.number}.pdf`,
  })
}

// ============================================================
// FINANCIAL STATEMENTS & REPORTS
// Branded PDF exports for the reports module (Balance Sheet, P&L, Cash Flow,
// Trial Balance, Aging, Tax Summary). The currency is stated once in the header
// ("Amounts in GHS") and figures are rendered accounting-style — plain numbers
// with negatives in parentheses — so per-line currency symbols never clutter the
// statement (and jsPDF's WinAnsi encoding never has to render a ₵/€ glyph).
// ============================================================

const REPORT_PRIMARY: [number, number, number] = [21, 101, 192]
const REPORT_DARK: [number, number, number] = [33, 33, 33]
const REPORT_MUTED: [number, number, number] = [120, 120, 120]
const REPORT_BORDER: [number, number, number] = [210, 210, 210]

/** Accounting-style figure: `1,234.00`, negatives as `(1,234.00)`, zero as `-`. */
function formatStatementAmount(amount: number): string {
  if (Math.abs(amount) < 0.005) return '-'
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  return amount < 0 ? `(${formatted})` : formatted
}

interface ReportMeta {
  org: Organization
  currency: string
  title: string
  periodLabel: string   // "As at 31 Dec 2025" or "For the period 01 Jan 2025 – 31 Dec 2025"
  basisLabel?: string   // e.g. "Accrual basis"
}

/**
 * Draw the centered statement header (org / title / period / basis / "Amounts in X")
 * and the top rule. Returns the y-coordinate to start the body from.
 */
function renderReportHeader(doc: jsPDF, meta: ReportMeta, margin: number): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const cx = pageWidth / 2
  let y = margin + 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...REPORT_DARK)
  doc.text(meta.org.name || 'Organization', cx, y, { align: 'center' })
  y += 8

  doc.setFontSize(18)
  doc.setTextColor(...REPORT_PRIMARY)
  doc.text(meta.title, cx, y, { align: 'center' })
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...REPORT_MUTED)
  doc.text(meta.periodLabel, cx, y, { align: 'center' })
  y += 5

  if (meta.basisLabel) {
    doc.text(meta.basisLabel, cx, y, { align: 'center' })
    y += 5
  }

  doc.setFontSize(8)
  doc.text(`Amounts in ${meta.currency}`, cx, y, { align: 'center' })
  y += 5

  doc.setDrawColor(...REPORT_BORDER)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  return y
}

/** Generated-timestamp footer, drawn on the current page. */
function renderReportFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...REPORT_MUTED)
  doc.text(
    `Generated ${formatDate(new Date(), 'dd MMM yyyy HH:mm')}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  )
}

export type StatementRow =
  | { kind: 'heading'; label: string }
  | { kind: 'line'; label: string; value: number; indent?: boolean }
  | { kind: 'subtotal'; label: string; value: number }
  | { kind: 'total'; label: string; value: number }
  | { kind: 'note'; label: string }
  | { kind: 'spacer' }

interface StatementConfig extends ReportMeta {
  rows: StatementRow[]
  filename: string
}

/**
 * Render a two-column financial statement (label left, figure right) with section
 * headings, subtotals and a grand total — the shape of a Balance Sheet, P&L or
 * Cash Flow Statement.
 */
export function exportStatementPDF(cfg: StatementConfig) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const valueX = pageWidth - margin

  let y = renderReportHeader(doc, cfg, margin)

  function ensureSpace(rowHeight: number) {
    if (y + rowHeight > pageHeight - 16) {
      renderReportFooter(doc)
      doc.addPage()
      y = renderReportHeader(doc, cfg, margin)
    }
  }

  for (const row of cfg.rows) {
    switch (row.kind) {
      case 'spacer':
        y += 4
        break
      case 'heading':
        ensureSpace(8)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(...REPORT_DARK)
        doc.text(row.label, margin, y)
        y += 6
        break
      case 'note':
        ensureSpace(6)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8.5)
        doc.setTextColor(...REPORT_MUTED)
        doc.text(doc.splitTextToSize(row.label, pageWidth - margin * 2), margin, y)
        y += 6
        break
      case 'line':
        ensureSpace(6)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(...REPORT_DARK)
        doc.text(row.label, margin + (row.indent ? 6 : 0), y)
        doc.text(formatStatementAmount(row.value), valueX, y, { align: 'right' })
        y += 5.5
        break
      case 'subtotal':
        ensureSpace(8)
        doc.setDrawColor(...REPORT_BORDER)
        doc.setLineWidth(0.2)
        doc.line(valueX - 45, y - 3.5, valueX, y - 3.5)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.setTextColor(...REPORT_DARK)
        doc.text(row.label, margin, y)
        doc.text(formatStatementAmount(row.value), valueX, y, { align: 'right' })
        y += 6
        break
      case 'total':
        ensureSpace(10)
        doc.setDrawColor(...REPORT_DARK)
        doc.setLineWidth(0.4)
        doc.line(margin, y - 4, valueX, y - 4)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(...REPORT_PRIMARY)
        doc.text(row.label, margin, y)
        doc.text(formatStatementAmount(row.value), valueX, y, { align: 'right' })
        doc.setDrawColor(...REPORT_DARK)
        doc.setLineWidth(0.4)
        doc.line(margin, y + 2, valueX, y + 2)
        y += 8
        break
    }
  }

  renderReportFooter(doc)
  doc.save(cfg.filename)
}

interface TableReportConfig extends ReportMeta {
  head: string[][]
  body: string[][]
  foot?: string[][]
  /** Per-column horizontal alignment; defaults to left. */
  aligns?: Array<'left' | 'right' | 'center'>
  filename: string
}

/**
 * Render a multi-column tabular report (Trial Balance, Aging, Tax Summary). Cells
 * are pre-formatted strings so each page controls its own number formatting.
 */
export function exportTableReportPDF(cfg: TableReportConfig) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 15

  const startY = renderReportHeader(doc, cfg, margin)

  const columnStyles: Record<number, any> = {}
  cfg.aligns?.forEach((a, i) => {
    columnStyles[i] = { halign: a }
  })

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: cfg.head,
    body: cfg.body,
    foot: cfg.foot,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      lineColor: REPORT_BORDER,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: REPORT_PRIMARY,
      textColor: 255,
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: REPORT_DARK,
      fontStyle: 'bold',
    },
    columnStyles,
    didDrawPage: () => renderReportFooter(doc),
  })

  doc.save(cfg.filename)
}

/** Accounting-style amount for tabular report cells (shared with statements). */
export function reportAmount(amount: number): string {
  return formatStatementAmount(amount)
}
