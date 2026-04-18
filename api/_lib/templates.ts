// Shared email wrapper
function wrap(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1565C0; padding: 24px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .body { padding: 32px; color: #333333; line-height: 1.6; }
    .body h2 { color: #1565C0; margin-top: 0; }
    .btn { display: inline-block; background: #1565C0; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; margin: 16px 0; }
    .footer { padding: 24px 32px; text-align: center; color: #999999; font-size: 12px; background: #fafafa; }
    .detail-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .detail-table td { padding: 8px 12px; border-bottom: 1px solid #eeeeee; }
    .detail-table td:first-child { font-weight: bold; color: #666666; width: 35%; }
    .line-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .line-table th { background: #1565C0; color: #ffffff; padding: 8px 12px; text-align: left; }
    .line-table td { padding: 8px 12px; border-bottom: 1px solid #eeeeee; }
    .line-table .amount { text-align: right; }
    .totals td { font-weight: bold; }
    .highlight { background: #e3f2fd; padding: 16px; border-radius: 6px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header" style="display: flex; align-items: center;">
      <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM2MEE1RkEiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzQjgyRjYiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSIxNCIgZmlsbD0idXJsKCNnKSIvPjxwYXRoIGQ9Ik0xNSAyMCBMMjUgNDQgTDMyIDI4IEwzOSA0NCBMNDkgMjAiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBmaWxsPSJub25lIi8+PGNpcmNsZSBjeD0iMzIiIGN5PSIyOCIgcj0iMi41IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==" width="36" height="36" alt="Vent" style="margin-right: 12px; vertical-align: middle; border-radius: 8px;" />
      <h1 style="display: inline-block; vertical-align: middle; margin: 0;">Vent</h1>
    </div>
    <div class="body">${body}</div>
    <div class="footer">
      <p>Sent from Vent Accounting</p>
    </div>
  </div>
</body>
</html>`;
}

// ---- Invitation Email ----

export function invitationEmail(data: {
  inviteeEmail: string;
  orgName: string;
  role: string;
  inviterName: string;
  appUrl: string;
}): { subject: string; html: string } {
  const roleDisplay = data.role.charAt(0).toUpperCase() + data.role.slice(1);
  return {
    subject: `You've been invited to ${data.orgName} on Vent`,
    html: wrap(`
      <h2>You're Invited!</h2>
      <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.orgName}</strong> as <strong>${roleDisplay}</strong> on Vent Accounting.</p>
      <table class="detail-table">
        <tr><td>Organization</td><td>${data.orgName}</td></tr>
        <tr><td>Role</td><td>${roleDisplay}</td></tr>
        <tr><td>Invited by</td><td>${data.inviterName}</td></tr>
      </table>
      <p>Sign in to accept the invitation:</p>
      <a href="${data.appUrl}" class="btn">Open Vent</a>
      <p class="footer-text" style="color: #999; font-size: 13px; margin-top: 24px;">
        If you don't have a Vent account, you'll be asked to create one using this email address (${data.inviteeEmail}).
      </p>
    `),
  };
}

// ---- Invoice Email ----

export function invoiceEmail(data: {
  customerName: string;
  customerEmail: string;
  orgName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  lines: Array<{ description: string; quantity: number; unitPrice: number; taxRate: number; amount: number }>;
  subtotal: number;
  taxTotal: number;
  total: number;
  amountDue: number;
  notes?: string;
}): { subject: string; html: string } {
  const fmt = (n: number) => `${data.currency} ${n.toFixed(2)}`;
  const lineRows = data.lines
    .map(
      (l) => `
    <tr>
      <td>${l.description}</td>
      <td class="amount">${l.quantity}</td>
      <td class="amount">${fmt(l.unitPrice)}</td>
      <td class="amount">${l.taxRate}%</td>
      <td class="amount">${fmt(l.amount)}</td>
    </tr>`
    )
    .join("");

  return {
    subject: `Invoice ${data.invoiceNumber} from ${data.orgName}`,
    html: wrap(`
      <h2>Invoice ${data.invoiceNumber}</h2>
      <p>Dear ${data.customerName},</p>
      <p>Please find your invoice details below from <strong>${data.orgName}</strong>.</p>

      <table class="detail-table">
        <tr><td>Invoice #</td><td>${data.invoiceNumber}</td></tr>
        <tr><td>Date</td><td>${data.invoiceDate}</td></tr>
        <tr><td>Due Date</td><td>${data.dueDate}</td></tr>
      </table>

      <table class="line-table">
        <thead>
          <tr><th>Description</th><th class="amount">Qty</th><th class="amount">Price</th><th class="amount">Tax</th><th class="amount">Amount</th></tr>
        </thead>
        <tbody>
          ${lineRows}
        </tbody>
        <tfoot>
          <tr><td colspan="4" class="amount">Subtotal</td><td class="amount">${fmt(data.subtotal)}</td></tr>
          <tr><td colspan="4" class="amount">Tax</td><td class="amount">${fmt(data.taxTotal)}</td></tr>
          <tr class="totals"><td colspan="4" class="amount">Total</td><td class="amount">${fmt(data.total)}</td></tr>
        </tfoot>
      </table>

      <div class="highlight">
        <strong>Amount Due: ${fmt(data.amountDue)}</strong>
      </div>

      ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ""}
      <p>Thank you for your business.</p>
    `),
  };
}

// ---- Payment Receipt Email ----

export function paymentReceiptEmail(data: {
  customerName: string;
  orgName: string;
  invoiceNumber: string;
  paymentDate: string;
  amount: number;
  method: string;
  reference: string;
  currency: string;
  remainingBalance: number;
}): { subject: string; html: string } {
  const fmt = (n: number) => `${data.currency} ${n.toFixed(2)}`;
  return {
    subject: `Payment received — ${data.invoiceNumber} from ${data.orgName}`,
    html: wrap(`
      <h2>Payment Received</h2>
      <p>Dear ${data.customerName},</p>
      <p>We have received your payment. Thank you!</p>

      <table class="detail-table">
        <tr><td>Invoice</td><td>${data.invoiceNumber}</td></tr>
        <tr><td>Payment Date</td><td>${data.paymentDate}</td></tr>
        <tr><td>Amount Paid</td><td><strong>${fmt(data.amount)}</strong></td></tr>
        <tr><td>Method</td><td>${data.method}</td></tr>
        ${data.reference ? `<tr><td>Reference</td><td>${data.reference}</td></tr>` : ""}
        <tr><td>Remaining Balance</td><td>${fmt(data.remainingBalance)}</td></tr>
      </table>

      ${data.remainingBalance <= 0
        ? '<div class="highlight"><strong>This invoice is now paid in full.</strong></div>'
        : `<div class="highlight">Remaining balance: <strong>${fmt(data.remainingBalance)}</strong></div>`
      }

      <p>Thank you for your business.</p>
    `),
  };
}

// ---- Welcome Email ----

export function welcomeEmail(data: {
  displayName: string;
  email: string;
  appUrl: string;
}): { subject: string; html: string } {
  return {
    subject: "Welcome to Vent Accounting",
    html: wrap(`
      <h2>Welcome, ${data.displayName}!</h2>
      <p>Your Vent account has been created successfully.</p>
      <table class="detail-table">
        <tr><td>Email</td><td>${data.email}</td></tr>
      </table>
      <p>Get started by creating your organization and setting up your chart of accounts.</p>
      <a href="${data.appUrl}" class="btn">Get Started</a>
    `),
  };
}
