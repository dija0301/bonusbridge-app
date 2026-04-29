import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DOCUSIGN_BASE_URL = 'https://demo.docusign.net/restapi' // switch to 'https://na3.docusign.net/restapi' for production
const DOCUSIGN_AUTH_URL = 'https://account-d.docusign.com'    // switch to 'https://account.docusign.com' for production

async function getDocuSignToken(): Promise<string> {
  const integrationKey = Deno.env.get('DOCUSIGN_INTEGRATION_KEY')!
  const rsaPrivateKey   = Deno.env.get('DOCUSIGN_RSA_PRIVATE_KEY')!
  // sub = API User GUID (the user we impersonate via JWT Grant), NOT the account ID.
  // The account ID goes in the REST URL path, not the JWT claim.
  const userId          = Deno.env.get('DOCUSIGN_USER_ID')!

  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: integrationKey,
    sub: userId,
    aud: 'account-d.docusign.com',
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  }

  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payload = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const signingInput = `${header}.${payload}`

  // Supabase secrets sometimes strip newlines from PEM values — re-wrap if so
  let pemKey = rsaPrivateKey.trim()
  if (!pemKey.includes('\n')) {
    pemKey = pemKey
      .replace('-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----\n')
      .replace('-----END RSA PRIVATE KEY-----', '\n-----END RSA PRIVATE KEY-----')
      .replace(/-----BEGIN RSA PRIVATE KEY-----\n(.+)\n-----END RSA PRIVATE KEY-----/, (_m, b) => {
        const chunks = b.match(/.{1,64}/g) || []
        return `-----BEGIN RSA PRIVATE KEY-----\n${chunks.join('\n')}\n-----END RSA PRIVATE KEY-----`
      })
  }

  const pemContents = pemKey
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  // Try pkcs8 first (DocuSign generates pkcs8 via `openssl pkcs8 -topk8`);
  // if the key is raw PKCS#1 (BEGIN RSA PRIVATE KEY), wrap it in a PKCS#8 header
  let privateKey: CryptoKey
  try {
    privateKey = await crypto.subtle.importKey(
      'pkcs8', binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    )
  } catch {
    const pkcs8Header = new Uint8Array([
      0x30, 0x82, 0x00, 0x00,
      0x02, 0x01, 0x00,
      0x30, 0x0d,
        0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
        0x05, 0x00,
      0x04, 0x82, 0x00, 0x00,
    ])
    const totalLen = pkcs8Header.length - 4 + binaryDer.length
    pkcs8Header[2] = (totalLen >> 8) & 0xff
    pkcs8Header[3] = totalLen & 0xff
    pkcs8Header[pkcs8Header.length - 2] = (binaryDer.length >> 8) & 0xff
    pkcs8Header[pkcs8Header.length - 1] = binaryDer.length & 0xff
    const pkcs8 = new Uint8Array(pkcs8Header.length + binaryDer.length)
    pkcs8.set(pkcs8Header)
    pkcs8.set(binaryDer, pkcs8Header.length)
    privateKey = await crypto.subtle.importKey(
      'pkcs8', pkcs8,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    )
  }

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', privateKey,
    new TextEncoder().encode(signingInput)
  )

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${signingInput}.${sigB64}`

  const tokenRes = await fetch(`${DOCUSIGN_AUTH_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`DocuSign token error: ${err}`)
  }

  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n ?? 0)
}

function calcPerPeriodAmount(principal: number, rate: number, periods: number): number {
  if (!rate || rate === 0) return principal / periods
  const periodRate = rate / 100 / 12
  return (principal * periodRate) / (1 - Math.pow(1 + periodRate, -periods))
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly:       'weekly',
  biweekly:     'bi-weekly',
  semimonthly:  'semi-monthly',
  monthly:      'monthly',
  quarterly:    'quarterly',
  annual:       'annual',
}

const RATE_TYPE_LABELS: Record<string, string> = {
  fixed:      'fixed rate',
  afr_short:  'AFR short-term',
  afr_mid:    'AFR mid-term',
  prime:      'prime-based',
  zero:       '0% (non-interest bearing)',
}

const BONUS_TYPE_LABELS: Record<string, string> = {
  signing_bonus:         'Signing Bonus (Promissory Note)',
  starting_bonus:        'Starting Bonus (Promissory Note)',
  relocation_bonus:      'Relocation Bonus (Promissory Note)',
  tuition_reimbursement: 'Tuition / CE Reimbursement (Promissory Note)',
  retention_bonus:       'Retention Bonus',
  performance_bonus:     'Performance Bonus',
  referral_bonus:        'Referral Bonus',
  custom:                'Custom Agreement',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { agreement_id, issuer_signatory_email, issuer_signatory_name } = await req.json()

    if (!agreement_id) {
      return new Response(JSON.stringify({ error: 'agreement_id is required' }), { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: ag, error: agErr } = await supabase
      .from('agreements')
      .select('*, recipients(*), issuers(*)')
      .eq('id', agreement_id)
      .single()

    if (agErr || !ag) {
      return new Response(JSON.stringify({ error: 'Agreement not found' }), { status: 404, headers: corsHeaders })
    }

    // Rate limit: 10 calls per minute per issuer.
    // DocuSign envelopes cost real money — guard against runaway loops.
    const { data: rateAllowed, error: rateErr } = await supabase.rpc('check_and_increment_rate_limit', {
      p_issuer_id:      ag.issuer_id,
      p_function_name:  'send-for-signature',
      p_max_calls:      10,
      p_window_seconds: 60,
    })
    if (rateErr) {
      console.warn('Rate limit check failed (continuing):', rateErr.message)
    } else if (rateAllowed === false) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded — try again in a moment' }),
        { status: 429, headers: corsHeaders }
      )
    }

    const rec    = ag.recipients
    const issuer = ag.issuers

    const principal = parseFloat(ag.principal_amount) || 0
    const rate      = parseFloat(ag.interest_rate) || 0
    const periods   = parseInt(ag.forgiveness_periods) || 1
    const perPeriod = calcPerPeriodAmount(principal, rate, periods)

    const bonusTypeLabel = BONUS_TYPE_LABELS[ag.bonus_type] ?? ag.bonus_type ?? ''

    const tabs = {
      textTabs: [
        { tabLabel: 'bonus_type_label',      value: bonusTypeLabel },
        { tabLabel: 'agreement_number',      value: ag.agreement_number ?? '' },
        { tabLabel: 'effective_date',         value: formatDate(ag.effective_date) },
        { tabLabel: 'execution_date',         value: formatDate(ag.execution_date) },
        { tabLabel: 'disbursement_date',      value: formatDate(ag.custom_terms?.disbursement_date ?? ag.effective_date) },
        { tabLabel: 'issuer_name',            value: issuer?.name ?? '' },
        { tabLabel: 'issuer_state',           value: issuer?.default_work_state ?? '' },
        { tabLabel: 'recipient_name',         value: `${rec.first_name} ${rec.last_name}` },
        { tabLabel: 'recipient_title',        value: rec.title ?? '' },
        { tabLabel: 'recipient_state',        value: ag.recipient_state ?? '' },
        { tabLabel: 'principal_amount',       value: formatCurrency(principal) },
        { tabLabel: 'interest_rate',          value: rate ? `${rate}%` : '0%' },
        { tabLabel: 'interest_rate_type',     value: RATE_TYPE_LABELS[ag.interest_rate_type] ?? ag.interest_rate_type ?? '' },
        { tabLabel: 'forgiveness_start_date', value: formatDate(ag.forgiveness_start_date) },
        { tabLabel: 'forgiveness_frequency',  value: FREQUENCY_LABELS[ag.forgiveness_frequency] ?? ag.forgiveness_frequency ?? '' },
        { tabLabel: 'forgiveness_periods',    value: String(periods) },
        { tabLabel: 'per_period_amount',      value: formatCurrency(perPeriod) },
        { tabLabel: 'projected_end_date',     value: formatDate(ag.projected_end_date) },
        { tabLabel: 'eligibility_criteria',   value: ag.eligibility_criteria?.notes ?? 'None specified' },
      ]
    }

    const accessToken  = await getDocuSignToken()
    const accountId    = Deno.env.get('DOCUSIGN_ACCOUNT_ID')!
    const templateId   = Deno.env.get('DOCUSIGN_TEMPLATE_ID')!

    const signatoryEmail = issuer_signatory_email || issuer?.primary_contact_email
    const signatoryName  = issuer_signatory_name  || issuer?.primary_contact_name || issuer?.name

    const envelope = {
      templateId,
      status: 'sent',
      emailSubject: `${bonusTypeLabel} — ${issuer?.name ?? ''}`,
      emailBlurb: `Please review and sign your ${bonusTypeLabel} with ${issuer?.name ?? ''}. This document outlines the terms of your bonus agreement.`,
      templateRoles: [
        {
          roleName:  'Recipient',
          name:      `${rec.first_name} ${rec.last_name}`,
          email:     rec.email,
          routingOrder: '1',
          tabs,
        },
        {
          roleName:  'Issuer',
          name:      signatoryName,
          email:     signatoryEmail,
          routingOrder: '2',
        },
      ],
      eventNotification: {
        url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/docusign-webhook`,
        loggingEnabled: 'true',
        requireAcknowledgment: 'true',
        envelopeEvents: [
          { envelopeEventStatusCode: 'completed' },
          { envelopeEventStatusCode: 'declined' },
          { envelopeEventStatusCode: 'voided' },
        ],
      },
    }

    const envelopeRes = await fetch(
      `${DOCUSIGN_BASE_URL}/v2.1/accounts/${accountId}/envelopes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(envelope),
      }
    )

    if (!envelopeRes.ok) {
      const err = await envelopeRes.text()
      return new Response(JSON.stringify({ error: `DocuSign envelope error: ${err}` }), { status: 500, headers: corsHeaders })
    }

    const envelopeData = await envelopeRes.json()
    const envelopeId   = envelopeData.envelopeId

    await supabase.from('agreements').update({
      docusign_envelope_id:  envelopeId,
      docusign_status:       'sent',
      sent_for_signature_at: new Date().toISOString(),
      status:                'pending_signature',
    }).eq('id', agreement_id)

    await supabase.from('recipient_events').insert({
      recipient_id: rec.id,
      issuer_id:    ag.issuer_id,
      event_type:   'invite_sent',
      new_value:    `DocuSign envelope sent. Envelope ID: ${envelopeId}`,
    })

    return new Response(JSON.stringify({
      success:     true,
      envelope_id: envelopeId,
      sent_to:     rec.email,
      countersign: signatoryEmail,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
