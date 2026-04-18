import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter | null = null
let verified = false

function maskValue(v: string | undefined): string {
  if (!v) return '<empty>'
  if (v.length <= 4) return '****'
  return v.slice(0, 3) + '***' + v.slice(-2)
}

function log(level: 'info' | 'warn' | 'error', msg: string, data?: any) {
  const prefix = { info: '📧', warn: '⚠️', error: '❌' }[level]
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    `${prefix} [SMTP] ${msg}`,
    data ? JSON.stringify(data) : ''
  )
}

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST
    const port = parseInt(process.env.SMTP_PORT || '587', 10)
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    const fromEmail = process.env.SMTP_FROM_EMAIL

    log('info', 'Creating transporter', {
      host: host || '<empty>',
      port,
      secure: port === 465,
      user: user || '<empty>',
      passLength: pass?.length || 0,
      passMasked: maskValue(pass),
      fromEmail: fromEmail || '<empty>',
    })

    if (!host || !user || !pass || !fromEmail) {
      const missing: string[] = []
      if (!host) missing.push('SMTP_HOST')
      if (!user) missing.push('SMTP_USER')
      if (!pass) missing.push('SMTP_PASS')
      if (!fromEmail) missing.push('SMTP_FROM_EMAIL')
      log('error', 'Missing required config', { missing })
      throw new Error(`SMTP not configured. Missing: ${missing.join(', ')}`)
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })

    log('info', 'Transporter created')
  }
  return transporter
}

async function verifyTransporter(transport: nodemailer.Transporter): Promise<void> {
  if (verified) return
  try {
    log('info', 'Verifying connection...')
    await transport.verify()
    verified = true
    log('info', '✅ Connection verified')
  } catch (err: any) {
    log('error', 'Verification failed', {
      code: err.code,
      message: err.message,
      response: err.response,
      responseCode: err.responseCode,
    })
    throw err
  }
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const t0 = Date.now()
  log('info', 'Sending email', {
    to: options.to,
    subject: options.subject,
    htmlLength: options.html.length,
  })

  try {
    const transport = getTransporter()
    await verifyTransporter(transport)

    const fromName = process.env.SMTP_FROM_NAME || 'Vent Accounting'
    const fromEmail = process.env.SMTP_FROM_EMAIL
    const fromHeader = `"${fromName}" <${fromEmail}>`

    const info = await transport.sendMail({
      from: fromHeader,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
      replyTo: options.replyTo,
    })

    log('info', '✅ Email sent', {
      to: options.to,
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
      durationMs: Date.now() - t0,
    })
  } catch (err: any) {
    log('error', 'Failed to send email', {
      to: options.to,
      code: err.code,
      command: err.command,
      response: err.response,
      responseCode: err.responseCode,
      message: err.message,
      durationMs: Date.now() - t0,
    })
    throw err
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}
