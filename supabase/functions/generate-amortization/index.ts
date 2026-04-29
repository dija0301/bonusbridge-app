import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PERIODS_PER_YEAR: Record<string, number> = {
  biweekly:     26,
  semi_monthly: 24,
  monthly:      12,
  quarterly:     4,
  annual:        1,
  custom:       12,
}

function calcPreForgivenessInterest(
  principal: number,
  annualRatePct: number,
  disbursementDate: string,
  forgivenessStartDate: string
): number {
  if (!disbursementDate || !forgivenessStartDate || !annualRatePct) return 0
  const d1 = new Date(disbursementDate)
  const d2 = new Date(forgivenessStartDate)
  if (d2 <= d1) return 0
  const days = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)
  return principal * (annualRatePct / 100) * (days / 365)
}

function calcFixedPayment(openingBalance: number, periodRate: number, periods: number): number {
  if (periodRate === 0) return openingBalance / periods
  return openingBalance * (periodRate * Math.pow(1 + periodRate, periods)) / (Math.pow(1 + periodRate, periods) - 1)
}

function addPeriodDays(date: Date, frequency: string): Date {
  const d = new Date(date)
  const ppy = PERIODS_PER_YEAR[frequency] ?? 12
  const daysPerPeriod = Math.round(365 / ppy)
  d.setDate(d.getDate() + daysPerPeriod)
  return d
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { agreement_id } = await req.json()
    if (!agreement_id) return new Response(JSON.stringify({ error: 'agreement_id required' }), { status: 400, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch agreement
    const { data: ag, error: agErr } = await supabase
      .from('agreements')
      .select('*')
      .eq('id', agreement_id)
      .single()

    if (agErr || !ag) return new Response(JSON.stringify({ error: 'Agreement not found' }), { status: 404 })

    // Rate limit: 30 calls per minute per issuer.
    const { data: rateAllowed, error: rateErr } = await supabase.rpc('check_and_increment_rate_limit', {
      p_issuer_id:      ag.issuer_id,
      p_function_name:  'generate-amortization',
      p_max_calls:      30,
      p_window_seconds: 60,
    })
    if (rateErr) {
      console.warn('Rate limit check failed (continuing):', rateErr.message)
    } else if (rateAllowed === false) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded — try again in a moment' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Only generate for promissory-note types
    const PROMISSORY_NOTE_TYPES = ['signing_bonus', 'starting_bonus', 'relocation_bonus', 'tuition_reimbursement']
    if (!PROMISSORY_NOTE_TYPES.includes(ag.bonus_type)) {
      return new Response(JSON.stringify({ message: 'Schedule not applicable for this bonus type' }), { status: 200 })
    }

    const principal   = parseFloat(ag.principal_amount)
    const ratePct     = parseFloat(ag.interest_rate) || 0
    const periods     = parseInt(ag.forgiveness_periods)
    const frequency   = ag.forgiveness_frequency
    const startDate   = ag.forgiveness_start_date
    const disbDate    = ag.custom_terms?.disbursement_date ?? ag.execution_date ?? startDate

    if (!principal || !periods || !startDate) {
      return new Response(JSON.stringify({ error: 'Missing required fields for schedule generation' }), { status: 400 })
    }

    const ppy         = PERIODS_PER_YEAR[frequency] ?? 12
    const periodRate  = ratePct / 100 / ppy
    const preAccrued  = calcPreForgivenessInterest(principal, ratePct, disbDate, startDate)
    const openingBal  = principal + preAccrued
    const fixedPayment = calcFixedPayment(openingBal, periodRate, periods)

    // Delete existing schedule rows for this agreement
    await supabase.from('amortization_schedule').delete().eq('agreement_id', agreement_id)

    // Generate schedule rows
    const rows = []
    let balance = openingBal
    let periodStart = new Date(startDate)

    for (let i = 1; i <= periods; i++) {
      const periodEnd = addPeriodDays(periodStart, frequency)
      const forgivenInterest  = balance * periodRate
      const forgivenPrincipal = fixedPayment - forgivenInterest
      const totalForgiven     = fixedPayment
      const endingBalance     = Math.max(balance - forgivenPrincipal, 0)

      rows.push({
        agreement_id,
        issuer_id:          ag.issuer_id,
        period_number:      i,
        period_start_date:  toDateStr(periodStart),
        period_end_date:    toDateStr(periodEnd),
        pay_date:           toDateStr(periodEnd),
        beginning_balance:  Math.round(balance * 100) / 100,
        interest_amount:    Math.round(forgivenInterest * 100) / 100,
        forgiveness_amount: Math.round(forgivenPrincipal * 100) / 100,
        imputed_income:     Math.round(totalForgiven * 100) / 100,
        ending_balance:     Math.round(endingBalance * 100) / 100,
        is_processed:       false,
        exported_to_payroll: false,
      })

      balance     = endingBalance
      periodStart = periodEnd
    }

    // Insert all rows
    const { error: insertErr } = await supabase.from('amortization_schedule').insert(rows)
    if (insertErr) return new Response(JSON.stringify({ error: insertErr.message }), { status: 500 })

    // Update agreement with projected end date and outstanding balance
    const lastPeriodEnd = rows[rows.length - 1].period_end_date
    await supabase.from('agreements').update({
      projected_end_date:  lastPeriodEnd,
      outstanding_balance: openingBal,
      original_principal:  principal,
    }).eq('id', agreement_id)

    return new Response(JSON.stringify({
      success: true,
      periods_generated: rows.length,
      projected_end_date: lastPeriodEnd,
      opening_balance: openingBal,
      pre_accrued_interest: preAccrued,
      fixed_payment: Math.round(fixedPayment * 100) / 100,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})