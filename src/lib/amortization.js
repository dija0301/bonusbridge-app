/**
 * BonusBridge Amortization Engine
 *
 * Standard amortizing loan mechanics for forgivable promissory notes.
 *
 * Key concepts:
 * - Interest accrues from disbursement date (when funds were paid)
 * - Forgiveness begins on forgiveness_start_date
 * - Gap between disbursement and forgiveness start = pre-forgiveness interest accrual
 *   added to opening balance before Period 1
 * - Each period has a FIXED total forgiven amount (like a mortgage payment)
 * - Interest portion = outstanding balance × period rate (DECREASING each period)
 * - Principal portion = total forgiven − interest (INCREASING each period)
 * - Both forgiven principal + forgiven interest = taxable income each period
 */

const PERIODS_PER_YEAR = {
  biweekly:     26,
  semi_monthly: 24,
  monthly:      12,
  quarterly:     4,
  annual:        1,
  custom:       12,
}

/**
 * Calculate pre-forgiveness accrued interest.
 * Simple daily interest from disbursement to forgiveness start.
 */
export function calcPreForgivenessInterest(principal, annualRatePct, disbursementDate, forgivenessStartDate) {
  if (!disbursementDate || !forgivenessStartDate || !annualRatePct) return 0
  const d1 = new Date(disbursementDate)
  const d2 = new Date(forgivenessStartDate)
  if (d2 <= d1) return 0
  const days = (d2 - d1) / (1000 * 60 * 60 * 24)
  return principal * (annualRatePct / 100) * (days / 365)
}

/**
 * Calculate fixed payment amount using standard amortization formula.
 * If rate is 0, payment = principal / periods (straight line).
 */
function calcFixedPayment(openingBalance, periodRate, periods) {
  if (periodRate === 0) return openingBalance / periods
  return openingBalance * (periodRate * Math.pow(1 + periodRate, periods)) / (Math.pow(1 + periodRate, periods) - 1)
}

/**
 * Generate full amortization schedule for a promissory note.
 */
export function generateAmortizationSchedule({
  principal,
  annualRatePct,
  periods,
  frequency,
  disbursementDate,
  forgivenessStartDate,
}) {
  if (!principal || !periods || periods < 1) return null

  const ppy        = PERIODS_PER_YEAR[frequency] ?? 12
  const rate       = parseFloat(annualRatePct) || 0
  const periodRate = rate / 100 / ppy

  // Pre-forgiveness accrued interest added to opening balance
  const preAccruedInterest = calcPreForgivenessInterest(
    principal, rate, disbursementDate, forgivenessStartDate
  )
  const openingBalance = principal + preAccruedInterest

  // Fixed payment per period (constant throughout)
  const fixedPayment = calcFixedPayment(openingBalance, periodRate, periods)

  const schedule = []
  let balance = openingBalance
  let totalForgivenPrincipal = 0
  let totalForgivenInterest  = 0

  for (let i = 1; i <= periods; i++) {
    const forgivenInterest  = balance * periodRate
    const forgivenPrincipal = fixedPayment - forgivenInterest
    const closingBalance    = Math.max(balance - forgivenPrincipal, 0)

    schedule.push({
      period:           i,
      openingBalance:   balance,
      forgivenInterest,
      forgivenPrincipal,
      totalForgiven:    fixedPayment, // constant — this is taxable income each period
      closingBalance,
    })

    totalForgivenPrincipal += forgivenPrincipal
    totalForgivenInterest  += forgivenInterest
    balance                 = closingBalance
  }

  return {
    principal,
    annualRatePct:          rate,
    periods,
    frequency,
    periodsPerYear:         ppy,
    preAccruedInterest,
    openingBalance,
    fixedPayment,           // same every period

    firstPeriod: schedule[0],
    lastPeriod:  schedule[schedule.length - 1],

    totalForgivenPrincipal,
    totalForgivenInterest,
    totalForgiven: totalForgivenPrincipal + totalForgivenInterest,

    schedule,
  }
}

/**
 * Quick preview summary for the form live preview.
 */
export function amortPreview({
  principal,
  annualRatePct,
  periods,
  frequency,
  disbursementDate,
  forgivenessStartDate,
}) {
  const result = generateAmortizationSchedule({
    principal, annualRatePct, periods, frequency,
    disbursementDate, forgivenessStartDate,
  })
  if (!result) return null

  return {
    preAccruedInterest:         result.preAccruedInterest,
    openingBalance:             result.openingBalance,
    fixedPayment:               result.fixedPayment,        // constant total forgiven per period

    // Period 1 — highest interest, lowest principal
    period1ForgivenInterest:    result.firstPeriod.forgivenInterest,
    period1ForgivenPrincipal:   result.firstPeriod.forgivenPrincipal,

    // Last period — lowest interest, highest principal
    lastPeriodForgivenInterest:  result.lastPeriod.forgivenInterest,
    lastPeriodForgivenPrincipal: result.lastPeriod.forgivenPrincipal,

    totalForgivenPrincipal:     result.totalForgivenPrincipal,
    totalForgivenInterest:      result.totalForgivenInterest,
    totalForgiven:              result.totalForgiven,

    periodsPerYear:             result.periodsPerYear,
  }
}

/**
 * Estimate outstanding balance at a given date.
 * Used in the recipient portal balance estimator.
 */
export function estimateBalanceAtDate(agreement, hypotheticalDate) {
  const principal  = parseFloat(agreement.principal_amount) || 0
  const ratePct    = parseFloat(agreement.interest_rate) || 0
  const periods    = parseInt(agreement.forgiveness_periods) || 0
  const frequency  = agreement.forgiveness_frequency
  const startDate  = agreement.forgiveness_start_date
  const disbDate   = agreement.custom_terms?.disbursement_date ?? startDate

  if (!principal || !periods || !startDate) {
    return { balance: principal, periodsElapsed: 0, forgivenToDate: 0, accruedInterestToDate: 0 }
  }

  const termDate  = new Date(hypotheticalDate + 'T00:00:00')
  const forgStart = new Date(startDate + 'T00:00:00')

  // Before forgiveness starts — full balance including pre-accrued interest to term date
  const preAccrued = calcPreForgivenessInterest(principal, ratePct, disbDate, startDate)
  if (termDate <= forgStart) {
    const daysBeforeStart = Math.max((termDate - new Date((disbDate ?? startDate) + 'T00:00:00')) / (1000 * 60 * 60 * 24), 0)
    const accruedToTerm   = principal * (ratePct / 100) * (daysBeforeStart / 365)
    return {
      balance:               principal + accruedToTerm,
      periodsElapsed:        0,
      forgivenToDate:        0,
      accruedInterestToDate: accruedToTerm,
    }
  }

  const result = generateAmortizationSchedule({
    principal, annualRatePct: ratePct, periods, frequency,
    disbursementDate: disbDate, forgivenessStartDate: startDate,
  })
  if (!result) return { balance: principal, periodsElapsed: 0, forgivenToDate: 0, accruedInterestToDate: 0 }

  const ppy            = PERIODS_PER_YEAR[frequency] ?? 12
  const daysPerPeriod  = 365 / ppy
  const daysElapsed    = (termDate - forgStart) / (1000 * 60 * 60 * 24)
  const periodsElapsed = Math.min(Math.floor(daysElapsed / daysPerPeriod), periods)

  if (periodsElapsed >= periods) {
    return { balance: 0, periodsElapsed: periods, forgivenToDate: result.totalForgiven, accruedInterestToDate: result.totalForgivenInterest }
  }

  const forgivenToDate = result.schedule.slice(0, periodsElapsed).reduce((s, p) => s + p.totalForgiven, 0)
  const accruedInterestToDate = result.schedule.slice(0, periodsElapsed).reduce((s, p) => s + p.forgivenInterest, 0)
  const balance = result.schedule[periodsElapsed]?.openingBalance ?? 0

  return { balance, periodsElapsed, forgivenToDate, accruedInterestToDate }
}
