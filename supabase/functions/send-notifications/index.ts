// send-notifications: daily cron-triggered edge function that scans for
// notification-worthy events and emails the right people.
//
// v1 scope: forgiveness period reminders only. Subsequent versions will add
// acknowledgment reminders, departure follow-ups, and milestone reminders.
//
// Auth: this function is called by pg_cron (no JWT), so verify_jwt is set to
// false in config.toml. We protect against random callers by requiring a
// shared secret header (X-Cron-Secret) that matches the CRON_SECRET env var.
//
// To trigger manually for testing:
//   curl -X POST -H "X-Cron-Secret: <your-secret>" \
//     https://tlyvvuqnambojiiagrvt.supabase.co/functions/v1/send-notifications

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const FROM_ADDRESS = 'BonusBridge <noreply@thebonusbridge.com>'

interface Stats {
  issuers_processed: number
  forgiveness_reminders_sent: number
  forgiveness_reminders_skipped_optout: number
  forgiveness_reminders_skipped_duplicate: number
  errors: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── Shared-secret auth ──
  const expectedSecret = Deno.env.get('CRON_SECRET')
  const providedSecret = req.headers.get('x-cron-secret')
  if (!expectedSecret) {
    return jsonResponse({ error: 'CRON_SECRET env var not set on this function' }, 500)
  }
  if (providedSecret !== expectedSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const stats: Stats = {
    issuers_processed: 0,
    forgiveness_reminders_sent: 0,
    forgiveness_reminders_skipped_optout: 0,
    forgiveness_reminders_skipped_duplicate: 0,
    errors: [],
  }

  try {
    // ── Find issuers with the notifications feature enabled ──
    const { data: featureRows, error: featureErr } = await supabase
      .from('issuer_features')
      .select('issuer_id')
      .eq('feature', 'notifications')
      .eq('enabled', true)

    if (featureErr) throw new Error(`feature lookup: ${featureErr.message}`)
    const issuerIds: string[] = (featureRows ?? []).map((r: { issuer_id: string }) => r.issuer_id)

    if (issuerIds.length === 0) {
      return jsonResponse({ message: 'No issuers with notifications enabled', stats }, 200)
    }

    // ── Process each issuer ──
    for (const issuerId of issuerIds) {
      stats.issuers_processed++
      try {
        await processIssuerForgivenessReminders(supabase, issuerId, stats)
      } catch (e) {
        stats.errors.push(`issuer ${issuerId}: ${(e as Error).message}`)
      }
    }

    return jsonResponse({ success: true, stats }, 200)
  } catch (e) {
    return jsonResponse({ error: (e as Error).message, stats }, 500)
  }
})

// ── Forgiveness reminders ────────────────────────────────────────────────
async function processIssuerForgivenessReminders(supabase: any, issuerId: string, stats: Stats) {
  // Load notification settings
  const { data: settings } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('issuer_id', issuerId)
    .maybeSingle()

  if (!settings || !settings.forgiveness_reminders) return

  const daysBefore = Number(settings.forgiveness_days_before ?? 7)
  if (daysBefore <= 0) return

  // Load issuer name (for the email "from" identity)
  const { data: issuer } = await supabase
    .from('issuers')
    .select('name')
    .eq('id', issuerId)
    .single()

  const today = new Date()
  const windowEnd = new Date(today.getTime() + daysBefore * 86400000)
  const todayStr = today.toISOString().split('T')[0]
  const windowEndStr = windowEnd.toISOString().split('T')[0]

  // Find upcoming unprocessed periods for active agreements in this org
  const { data: periods, error: perErr } = await supabase
    .from('amortization_schedule')
    .select(`
      period_number, period_start_date, imputed_income, agreement_id,
      agreements!inner (
        id, agreement_number, recipient_id, bonus_type, status, issuer_id,
        recipients!inner (id, first_name, last_name, email, personal_email, notifications_opted_out)
      )
    `)
    .eq('agreements.issuer_id', issuerId)
    .eq('agreements.status', 'active')
    .eq('is_processed', false)
    .gte('period_start_date', todayStr)
    .lte('period_start_date', windowEndStr)

  if (perErr) throw new Error(`period lookup: ${perErr.message}`)

  for (const p of periods ?? []) {
    const agreement = p.agreements
    const recipient = agreement?.recipients
    if (!agreement || !recipient) continue
    const subtype = `period-${p.period_number}`

    // Already sent for this period?
    const { count: alreadySent } = await supabase
      .from('notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('notification_type', 'forgiveness_reminder')
      .eq('subtype', subtype)
      .eq('agreement_id', agreement.id)

    if ((alreadySent ?? 0) > 0) {
      stats.forgiveness_reminders_skipped_duplicate++
      continue
    }

    // Recipient opted out
    if (recipient.notifications_opted_out) {
      stats.forgiveness_reminders_skipped_optout++
      await supabase.from('notification_log').insert({
        issuer_id:         issuerId,
        recipient_id:      recipient.id,
        agreement_id:      agreement.id,
        notification_type: 'forgiveness_reminder',
        subtype,
        sent_to_email:     recipient.personal_email || recipient.email,
        sent_to_role:      'recipient',
        status:            'skipped_opted_out',
      })
      continue
    }

    // Send to recipient if enabled
    if (settings.notify_recipient !== false) {
      const toEmail = recipient.personal_email || recipient.email
      const subject = `Upcoming forgiveness period — ${issuer?.name ?? 'BonusBridge'}`
      const ok = await sendForgivenessReminder({
        to:               toEmail,
        recipientName:    `${recipient.first_name} ${recipient.last_name}`,
        issuerName:       issuer?.name ?? '',
        agreementNumber:  agreement.agreement_number,
        periodStartDate:  p.period_start_date,
        forgivenAmount:   Number(p.imputed_income),
        hrEmail:          settings.portal_hr_contact_email,
        hrName:           settings.portal_hr_contact_name,
      })
      await supabase.from('notification_log').insert({
        issuer_id:         issuerId,
        recipient_id:      recipient.id,
        agreement_id:      agreement.id,
        notification_type: 'forgiveness_reminder',
        subtype,
        sent_to_email:     toEmail,
        sent_to_role:      'recipient',
        subject,
        status:            ok ? 'sent' : 'failed',
      })
      if (ok) stats.forgiveness_reminders_sent++
    }

    // Optionally also CC the issuer's notify_email
    if (settings.notify_issuer && settings.issuer_notify_email) {
      const subject = `Forgiveness reminder issued — ${recipient.first_name} ${recipient.last_name}`
      const ok = await sendForgivenessReminderCopy({
        to:              settings.issuer_notify_email,
        recipientName:   `${recipient.first_name} ${recipient.last_name}`,
        issuerName:      issuer?.name ?? '',
        agreementNumber: agreement.agreement_number,
        periodStartDate: p.period_start_date,
        forgivenAmount:  Number(p.imputed_income),
      })
      await supabase.from('notification_log').insert({
        issuer_id:         issuerId,
        recipient_id:      recipient.id,
        agreement_id:      agreement.id,
        notification_type: 'forgiveness_reminder',
        subtype,
        sent_to_email:     settings.issuer_notify_email,
        sent_to_role:      'issuer',
        subject,
        status:            ok ? 'sent' : 'failed',
      })
    }
  }
}

// ── Email sending helpers ───────────────────────────────────────────────
async function sendForgivenessReminder(opts: {
  to: string
  recipientName: string
  issuerName: string
  agreementNumber: string | null
  periodStartDate: string
  forgivenAmount: number
  hrEmail: string | null
  hrName:  string | null
}): Promise<boolean> {
  const periodDate = formatLongDate(opts.periodStartDate)
  const amount = formatUsd(opts.forgivenAmount)
  const agreementLine = opts.agreementNumber ? `Agreement: ${opts.agreementNumber}<br>` : ''
  const contactLine = opts.hrEmail
    ? `<p>Questions? Contact ${opts.hrName ? `${opts.hrName} at ` : ''}<a href="mailto:${opts.hrEmail}" style="color:#4f46e5">${opts.hrEmail}</a>.</p>`
    : ''

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;color:#1e293b">
  <h2 style="color:#4f46e5;margin:0 0 12px;font-size:20px">Upcoming forgiveness period</h2>
  <p>Hello ${opts.recipientName},</p>
  <p>The next forgiveness period for your bonus agreement with <strong>${opts.issuerName}</strong> is coming up.</p>
  <div style="background:#eef2ff;border-radius:10px;padding:16px 18px;margin:18px 0;font-size:15px;line-height:1.6">
    ${agreementLine}
    <strong>Period date:</strong> ${periodDate}<br>
    <strong>Amount being forgiven:</strong> ${amount}
  </div>
  <p style="font-size:14px;color:#475569">This amount represents taxable income that will be reported through payroll on or around the period date.</p>
  ${contactLine}
  <p style="color:#94a3b8;font-size:12px;margin-top:28px">— BonusBridge, sent on behalf of ${opts.issuerName}</p>
</div>`

  return sendEmail({
    to: opts.to,
    subject: `Upcoming forgiveness period — ${opts.issuerName}`,
    html,
  })
}

async function sendForgivenessReminderCopy(opts: {
  to: string
  recipientName: string
  issuerName: string
  agreementNumber: string | null
  periodStartDate: string
  forgivenAmount: number
}): Promise<boolean> {
  const html = `
<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:28px 20px;color:#1e293b">
  <h3 style="color:#4f46e5;margin:0 0 12px;font-size:16px">Forgiveness reminder issued</h3>
  <p style="font-size:14px">Recipient: <strong>${opts.recipientName}</strong><br>
  Agreement: ${opts.agreementNumber ?? '—'}<br>
  Period date: ${formatLongDate(opts.periodStartDate)}<br>
  Amount: ${formatUsd(opts.forgivenAmount)}</p>
  <p style="color:#94a3b8;font-size:12px">Automated notification from BonusBridge.</p>
</div>`

  return sendEmail({
    to: opts.to,
    subject: `Forgiveness reminder issued — ${opts.recipientName}`,
    html,
  })
}

async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM_ADDRESS,
        to:      opts.to,
        subject: opts.subject,
        html:    opts.html,
      }),
    })
    if (!res.ok) {
      console.error('Resend error', await res.text())
      return false
    }
    return true
  } catch (e) {
    console.error('Email send failed', e)
    return false
  }
}

// ── Utilities ────────────────────────────────────────────────────────────
function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function formatLongDate(yyyyMmDd: string): string {
  return new Date(yyyyMmDd + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}
