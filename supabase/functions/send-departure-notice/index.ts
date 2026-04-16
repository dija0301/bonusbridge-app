import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n ?? 0)
const fmtDate = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const {
      agreement_id,
      outstanding_balance_override,
      custom_message,
    } = await req.json()

    if (!agreement_id) {
      return new Response(JSON.stringify({ error: 'agreement_id is required' }), { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch agreement with recipient and issuer data
    const { data: ag, error: agErr } = await supabase
      .from('agreements')
      .select('*, recipients(*), issuers(*)')
      .eq('id', agreement_id)
      .single()

    if (agErr || !ag) {
      return new Response(JSON.stringify({ error: 'Agreement not found' }), { status: 404, headers: corsHeaders })
    }

    const rec    = ag.recipients
    const issuer = ag.issuers

    // Use override balance if provided, otherwise use agreement outstanding balance
    const outstandingBalance = outstanding_balance_override ?? ag.outstanding_balance

    // Use personal email if available, fall back to work email
    const toEmail = rec.personal_email || rec.email

    // Get notification settings for HR contact info
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('portal_hr_contact_name, portal_hr_contact_email, portal_welcome_message')
      .eq('issuer_id', ag.issuer_id)
      .single()

    const hrName  = settings?.portal_hr_contact_name  || issuer?.primary_contact_name  || 'Human Resources'
    const hrEmail = settings?.portal_hr_contact_email || issuer?.primary_contact_email || ''

    const BONUS_TYPE_LABELS: Record<string, string> = {
      signing_bonus:     'Signing Bonus (Promissory Note)',
      starting_bonus:    'Starting Bonus',
      retention_bonus:   'Retention Bonus',
      performance_bonus: 'Performance Bonus',
    }

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#1e293b;">
  
  <div style="margin-bottom:32px;">
    <svg width="40" height="26" viewBox="0 0 80 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="4" y1="40" x2="76" y2="40" stroke="#4f46e5" stroke-width="5" stroke-linecap="round"/>
      <line x1="4" y1="40" x2="4" y2="24" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="40" y1="40" x2="40" y2="24" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="76" y1="40" x2="76" y2="24" stroke="#4f46e5" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M4 24 A18 10 0 0 1 40 24" stroke="#4f46e5" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M40 24 A18 10 0 0 1 76 24" stroke="#4f46e5" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </svg>
  </div>

  <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#0f172a;">
    Notice Regarding Your Bonus Agreement
  </h1>
  <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 28px;">
    Dear ${rec.first_name} ${rec.last_name},
  </p>

  ${custom_message ? `
  <p style="font-size:15px;color:#1e293b;line-height:1.7;margin:0 0 24px;">${custom_message}</p>
  ` : ''}

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
    <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:0 0 16px;">Agreement Details</p>
    
    <table style="width:100%;border-collapse:collapse;">
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;font-size:13px;color:#64748b;width:50%;">Organization</td>
        <td style="padding:10px 0;font-size:13px;font-weight:600;color:#1e293b;">${issuer?.name ?? ''}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;font-size:13px;color:#64748b;">Agreement Number</td>
        <td style="padding:10px 0;font-size:13px;font-weight:600;color:#1e293b;">${ag.agreement_number ?? '—'}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;font-size:13px;color:#64748b;">Agreement Type</td>
        <td style="padding:10px 0;font-size:13px;font-weight:600;color:#1e293b;">${BONUS_TYPE_LABELS[ag.bonus_type] ?? ag.bonus_type}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;font-size:13px;color:#64748b;">Original Amount</td>
        <td style="padding:10px 0;font-size:13px;font-weight:600;color:#1e293b;">${fmt(ag.principal_amount)}</td>
      </tr>
      ${ag.acknowledged_at ? `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;font-size:13px;color:#64748b;">Agreement Acknowledged</td>
        <td style="padding:10px 0;font-size:13px;font-weight:600;color:#1e293b;">${fmtDate(ag.acknowledged_at.split('T')[0])}</td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding:10px 0;font-size:13px;color:#64748b;">Estimated Outstanding Balance</td>
        <td style="padding:10px 0;font-size:18px;font-weight:800;color:#4f46e5;">${fmt(outstandingBalance)}</td>
      </tr>
    </table>
  </div>

  <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:16px;margin-bottom:28px;">
    <p style="font-size:13px;color:#92400e;line-height:1.6;margin:0;">
      <strong>Important:</strong> The estimated outstanding balance above reflects the gross principal and accrued interest as of the date of this notice. This amount does not account for tax withholding, offsets, credits, or other deductions that may apply. The actual repayment amount will be determined by ${issuer?.name ?? 'your employer'} and may differ. Please contact ${hrName} to discuss your specific situation.
    </p>
  </div>

  <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 24px;">
    Please contact us at the information below to discuss next steps regarding your agreement.
  </p>

  <div style="background:#f1f5f9;border-radius:10px;padding:16px;margin-bottom:32px;">
    <p style="font-size:13px;font-weight:700;color:#1e293b;margin:0 0 6px;">${hrName}</p>
    ${hrEmail ? `<p style="font-size:13px;color:#4f46e5;margin:0;"><a href="mailto:${hrEmail}" style="color:#4f46e5;">${hrEmail}</a></p>` : ''}
  </div>

  <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
    <p style="font-size:12px;color:#94a3b8;margin:0 0 2px;">This notice was sent via BonusBridge — Secure Bonus Agreement Administration</p>
    <p style="font-size:11px;color:#cbd5e1;margin:0;">The BonusBridge LLC · thebonusbridge.com</p>
  </div>
</div>`

    // Send email
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BonusBridge <noreply@thebonusbridge.com>',
        to: toEmail,
        reply_to: hrEmail || undefined,
        subject: `Important Notice: Bonus Agreement — ${issuer?.name ?? ''}`,
        html,
      }),
    })

    if (!emailRes.ok) {
      const err = await emailRes.text()
      return new Response(JSON.stringify({ error: `Email failed: ${err}` }), { status: 500, headers: corsHeaders })
    }

    // Log the event
    await supabase.from('recipient_events').insert({
      recipient_id: rec.id,
      issuer_id:    ag.issuer_id,
      event_type:   'departure_notice_sent',
      new_value:    `Sent to ${toEmail}. Outstanding balance: ${fmt(outstandingBalance)}`,
    })

    return new Response(JSON.stringify({
      success: true,
      sent_to: toEmail,
      outstanding_balance: outstandingBalance,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
