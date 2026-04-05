/**
 * BonusBridge Amortization Engine
 * 
 * Correct TVM calculation for forgivable promissory notes.
 * 
 * Key concepts:
 * - Interest accrues from disbursement date (when funds were paid)
 * - Forgiveness begins on forgiveness_start_date (when employee starts)
 * - Gap between disbursement and forgiveness start = pre-forgiveness interest accrual
 * - Each period: forgiven principal (constant) + forgiven interest (declining) = total forgiven (taxable)
 * - Outstanding balance decreases by forgiven principal each period
 * - Forgiven interest is calculated on opening balance for that period
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
 * This is simple daily interest from disbursement to forgiveness start.
 * 
 * @param {number} principal
 * @param {number} annualRatePct - e.g. 5.27 for 5.27%
 * @param {string|Date} disbursementDate
 * @param {string|Date} forgivenessStartDate
 * @returns {number} accrued interest amount
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
 * Generate full amortization schedule for a promissory note.
 * 
 * @param {object} params
 * @param {number}  params.principal           - Original principal amount
 * @param {number}  params.annualRatePct        - Annual interest rate (e.g. 5.27)
 * @param {number}  params.periods             - Total forgiveness periods
 * @param {string}  params.frequency           - biweekly | semi_monthly | monthly | quarterly | annual | custom
 * @param {string}  [params.disbursementDate]  - Date funds were paid (interest starts here)
 * @param {string}  [params.forgivenessStartDate] - Date forgiveness begins
 * @returns {object} schedule summary + period array
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

  // Pre-forgiveness accrued interest (added to opening balance of Period 1)
  const preAccruedInterest = calcPreForgivenessInterest(
    principal, rate, disbursementDate, forgivenessStartDate
  )

  // Opening balance includes any pre-accrued interest
  const openingBalance    = principal + preAccruedInterest
  const forgivenPrincipalPerPeriod = principal / periods

  const schedule = []
  let balance = openingBalance

  let totalForgivenPrincipal = 0
  let totalForgivenInterest  = 0
  let totalForgiven          = 0

  for (let i = 1; i <= periods; i++) {
    const forgivenInterest   = balance * periodRate
    const forgivenPrincipal  = forgivenPrincipalPerPeriod
    const totalForgivenPeriod = forgivenPrincipal + forgivenInterest
    const closingBalance     = Math.max(balance - forgivenPrincipal, 0)

    schedule.push({
      period:           i,
      openingBalance:   balance,
      forgivenPrincipal,
      forgivenInterest,
      totalForgiven:    totalForgivenPeriod, // this is taxable income / imputed income
      closingBalance,
    })

    totalForgivenPrincipal += forgivenPrincipal
    totalForgivenInterest  += forgivenInterest
    totalForgiven          += totalForgivenPeriod
    balance                 = closingBalance
  }

  return {
    // Summary
    principal,
    annualRatePct:          rate,
    periods,
    frequency,
    periodsPerYear:         ppy,
    preAccruedInterest,
    openingBalance,
    forgivenPrincipalPerPeriod,

    // Per-period (first period — for preview display)
    firstPeriod: schedule[0],
    lastPeriod:  schedule[schedule.length - 1],

    // Totals
    totalForgivenPrincipal,
    totalForgivenInterest,
    totalForgiven,           // total taxable income over life of note

    // Full schedule array
    schedule,
  }
}

/**
 * Quick preview summary — used in the form live preview.
 * Returns just the numbers needed for display without the full schedule array.
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
    // Pre-forgiveness
    preAccruedInterest:          result.preAccruedInterest,
    openingBalance:              result.openingBalance,

    // Period 1 (highest interest, good for showing the range)
    period1ForgivenPrincipal:    result.firstPeriod.forgivenPrincipal,
    period1ForgivenInterest:     result.firstPeriod.forgivenInterest,
    period1TotalForgiven:        result.firstPeriod.totalForgiven,

    // Last period (lowest interest)
    lastPeriodForgivenInterest:  result.lastPeriod.forgivenInterest,
    lastPeriodTotalForgiven:     result.lastPeriod.totalForgiven,

    // Life of note totals
    totalForgivenPrincipal:      result.totalForgivenPrincipal,
    totalForgivenInterest:       result.totalForgivenInterest,
    totalForgiven:               result.totalForgiven,

    periodsPerYear:              result.periodsPerYear,
  }
}

/**
 * Estimate outstanding balance at a given date.
 * Used in the recipient portal balance estimator.
 * 
 * @param {object} agreement - agreement record from Supabase
 * @param {string} hypotheticalDate - YYYY-MM-DD
 * @returns {object} { balance, periodsElapsed, forgivenToDate, accruedInterestToDate }
 */
export function estimateBalanceAtDate(agreement, hypotheticalDate) {
  const principal     = parseFloat(agreement.principal_amount) || 0
  const ratePct       = parseFloat(agreement.interest_rate) || 0
  const periods       = parseInt(agreement.forgiveness_periods) || 0
  const frequency     = agreement.forgiveness_frequency
  const startDate     = agreement.forgiveness_start_date
  const disbDate      = agreement.custom_terms?.disbursement_date ?? startDate

  if (!principal || !periods || !startDate) {
    return { balance: principal, periodsElapsed: 0, forgivenToDate: 0, accruedInterestToDate: 0 }
  }

  const termDate  = new Date(hypotheticalDate + 'T00:00:00')
  const forgStart = new Date(startDate + 'T00:00:00')

  // If departure is before forgiveness starts, full balance including pre-accrued interest
  const preAccrued = calcPreForgivenessInterest(principal, ratePct, disbDate, startDate)
  if (termDate <= forgStart) {
    const daysBeforeStart = Math.max((termDate - new Date(disbDate + 'T00:00:00')) / (1000 * 60 * 60 * 24), 0)
    const accruedToTerm   = principal * (ratePct / 100) * (daysBeforeStart / 365)
    return {
      balance:              principal + accruedToTerm,
      periodsElapsed:       0,
      forgivenToDate:       0,
      accruedInterestToDate: accruedToTerm,
    }
  }

  // Generate full schedule and find how many periods have elapsed
  const result = generateAmortizationSchedule({
    principal, annualRatePct: ratePct, periods, frequency,
    disbursementDate: disbDate, forgivenessStartDate: startDate,
  })
  if (!result) return { balance: principal, periodsElapsed: 0, forgivenToDate: 0, accruedInterestToDate: 0 }

  const ppy           = PERIODS_PER_YEAR[frequency] ?? 12
  const daysPerPeriod = 365 / ppy
  const daysElapsed   = (termDate - forgStart) / (1000 * 60 * 60 * 24)
  const periodsElapsed = Math.min(Math.floor(daysElapsed / daysPerPeriod), periods)

  if (periodsElapsed >= periods) {
    return { balance: 0, periodsElapsed: periods, forgivenToDate: result.totalForgiven, accruedInterestToDate: result.totalForgivenInterest }
  }

  // Sum up forgiven amounts through elapsed periods
  const forgivenToDate = result.schedule
    .slice(0, periodsElapsed)
    .reduce((s, p) => s + p.totalForgiven, 0)

  const accruedInterestToDate = result.schedule
    .slice(0, periodsElapsed)
    .reduce((s, p) => s + p.forgivenInterest, 0)

  const balance = result.schedule[periodsElapsed]?.openingBalance ?? 0

  return { balance, periodsElapsed, forgivenToDate, accruedInterestToDate }
}
