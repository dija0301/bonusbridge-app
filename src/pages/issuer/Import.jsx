import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ── CSV template columns ───────────────────────────────────
const TEMPLATE_COLUMNS = [
  'first_name','last_name','email','personal_email','mobile_phone','work_phone',
  'title','department','employee_id','hire_date','termination_date',
  'address_line1','address_line2','city','state','zip',
  'bonus_type','principal_amount','current_outstanding_balance',
  'interest_rate','interest_rate_type','forgiveness_frequency','forgiveness_periods',
  'execution_date','effective_date','forgiveness_start_date',
  'recipient_state','agreement_number','status','notes',
]

const BONUS_TYPES    = ['signing_bonus','starting_bonus','retention_bonus','performance_bonus','custom']
const RATE_TYPES     = ['fixed','zero','afr_short','afr_mid','prime_based']
const FREQ_TYPES     = ['biweekly','semi_monthly','monthly','quarterly','annual']
const VALID_STATUSES = ['draft','onboarding','active','forgiven','terminated','collected','cancelled']
const US_STATE_CODES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

// ── Helpers ────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, '_'))
  const rows = lines.slice(1).map(line => {
    const vals = []
    let inQuote = false, cur = ''
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuote = !inQuote }
      else if (line[i] === ',' && !inQuote) { vals.push(cur.trim()); cur = '' }
      else { cur += line[i] }
    }
    vals.push(cur.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    return obj
  }).filter(r => Object.values(r).some(v => v !== ''))
  return { headers, rows }
}

function validateRow(row, index) {
  const errors = []
  if (!row.first_name) errors.push('first_name required')
  if (!row.last_name)  errors.push('last_name required')
  if (!row.email)      errors.push('email required')
  if (!row.email?.includes('@')) errors.push('invalid email')
  if (!row.bonus_type) errors.push('bonus_type required')
  if (row.bonus_type && !BONUS_TYPES.includes(row.bonus_type)) errors.push(`invalid bonus_type: ${row.bonus_type}`)
  if (!row.principal_amount) errors.push('principal_amount required')
  if (row.principal_amount && isNaN(parseFloat(row.principal_amount))) errors.push('principal_amount must be a number')
  if (row.interest_rate_type && !RATE_TYPES.includes(row.interest_rate_type)) errors.push(`invalid interest_rate_type`)
  if (row.forgiveness_frequency && !FREQ_TYPES.includes(row.forgiveness_frequency)) errors.push(`invalid forgiveness_frequency`)
  if (row.status && !VALID_STATUSES.includes(row.status)) errors.push(`invalid status: ${row.status}`)
  if (row.recipient_state && !US_STATE_CODES.includes(row.recipient_state?.toUpperCase())) errors.push(`invalid recipient_state`)
  return errors
}

function downloadTemplate() {
  const csv = TEMPLATE_COLUMNS.join(',') + '\n' +
    'Jane,Smith,jane.smith@company.com,jane@personal.com,(612) 555-0101,,HR Director,Human Resources,EMP001,2023-01-15,,123 Main St,,Minneapolis,MN,55401,signing_bonus,50000,47916.67,0,,monthly,24,2023-01-15,2023-02-01,2023-03-01,MN,BB-2023-001,active,Example import row'
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'bonusbridge-import-template.csv'; a.click()
  URL.revokeObjectURL(url)
}

function fmt(n) { return n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(parseFloat(n)) : '—' }

// ── Step components ────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = ['Upload', 'Validate', 'Preview', 'Import']
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition ${
            i + 1 < step ? 'bg-emerald-500 text-white' :
            i + 1 === step ? 'bg-brand-600 text-white' :
            'bg-slate-800 text-slate-500'
          }`}>
            {i + 1 < step ? '✓' : i + 1}
          </div>
          <span className={`text-sm font-medium ${i + 1 === step ? 'text-white' : 'text-slate-500'}`}>{s}</span>
          {i < steps.length - 1 && <div className="w-8 h-px bg-slate-700 mx-1" />}
        </div>
      ))}
    </div>
  )
}

// ── Main Import page ───────────────────────────────────────
export default function Import() {
  const { profile } = useAuth()
  const issuerId    = profile?.issuer_id
  const fileRef     = useRef(null)

  const [step, setStep]         = useState(1)
  const [rows, setRows]         = useState([])
  const [headers, setHeaders]   = useState([])
  const [errors, setErrors]     = useState([])
  const [importing, setImporting] = useState(false)
  const [results, setResults]   = useState(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
      alert('Please upload a CSV file.')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const { headers, rows } = parseCSV(e.target.result)
      setHeaders(headers)
      setRows(rows)
      // Validate
      const allErrors = []
      rows.forEach((row, i) => {
        const errs = validateRow(row, i)
        if (errs.length) allErrors.push({ row: i + 2, errors: errs, email: row.email })
      })
      setErrors(allErrors)
      setStep(2)
    }
    reader.readAsText(file)
  }

  async function runImport() {
    setImporting(true)
    let created = 0, updated = 0, agreementsCreated = 0, skipped = 0
    const importErrors = []

    for (const row of rows) {
      if (validateRow(row, 0).length > 0) { skipped++; continue }

      try {
        // 1. Upsert recipient by email
        const recipientData = {
          issuer_id:        issuerId,
          first_name:       row.first_name,
          last_name:        row.last_name,
          email:            row.email,
          personal_email:   row.personal_email || null,
          mobile_phone:     row.mobile_phone || null,
          work_phone:       row.work_phone || null,
          title:            row.title || null,
          department:       row.department || null,
          employee_id:      row.employee_id || null,
          address_line1:    row.address_line1 || null,
          address_line2:    row.address_line2 || null,
          city:             row.city || null,
          state:            row.state || null,
          zip:              row.zip || null,
          is_active:        !row.termination_date,
        }

        // Check if recipient exists
        const { data: existing } = await supabase
          .from('recipients').select('id').eq('email', row.email).eq('issuer_id', issuerId).single()

        let recipientId
        if (existing) {
          await supabase.from('recipients').update(recipientData).eq('id', existing.id)
          recipientId = existing.id
          updated++
        } else {
          const { data: newRec } = await supabase.from('recipients').insert(recipientData).select().single()
          recipientId = newRec.id
          created++
        }

        // 2. Create agreement
        const principal   = parseFloat(row.principal_amount) || 0
        const outstanding = row.current_outstanding_balance
          ? parseFloat(row.current_outstanding_balance)
          : principal

        const agreementData = {
          issuer_id:              issuerId,
          recipient_id:           recipientId,
          bonus_type:             row.bonus_type,
          principal_amount:       principal,
          original_principal:     principal,
          outstanding_balance:    outstanding,
          interest_rate:          row.interest_rate ? parseFloat(row.interest_rate) : null,
          interest_rate_type:     row.interest_rate_type || 'fixed',
          forgiveness_frequency:  row.forgiveness_frequency || 'monthly',
          forgiveness_periods:    row.forgiveness_periods ? parseInt(row.forgiveness_periods) : null,
          execution_date:         row.execution_date || null,
          effective_date:         row.effective_date || null,
          forgiveness_start_date: row.forgiveness_start_date || null,
          recipient_state:        row.recipient_state?.toUpperCase() || null,
          agreement_number:       row.agreement_number || null,
          status:                 row.status || 'active',
          notes:                  row.notes || null,
        }

        await supabase.from('agreements').insert(agreementData)
        agreementsCreated++

      } catch (e) {
        importErrors.push({ email: row.email, error: e.message })
      }
    }

    setResults({ created, updated, agreementsCreated, skipped, errors: importErrors })
    setImporting(false)
    setStep(4)
  }

  const validRows   = rows.filter((_, i) => !errors.find(e => e.row === i + 2))
  const invalidRows = rows.filter((_, i) =>  errors.find(e => e.row === i + 2))

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-semibold">Import Agreements</h1>
        <p className="text-slate-400 text-sm mt-1">Bulk import recipients and agreements from a CSV file</p>
      </div>

      <StepIndicator step={step} />

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          {/* Template download */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-medium">Download Import Template</p>
              <p className="text-slate-400 text-sm mt-0.5">Use our CSV template for best results. Includes all supported fields with an example row.</p>
            </div>
            <button onClick={downloadTemplate}
              className="flex items-center gap-2 border border-slate-700 text-slate-300 hover:text-white text-sm font-medium px-4 py-2.5 rounded-lg transition shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3"/><path d="M2 12v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1"/></svg>
              Download Template
            </button>
          </div>

          {/* Upload area */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition ${
              dragOver ? 'border-brand-400 bg-brand-500/5' : 'border-slate-700 hover:border-slate-500'
            }`}>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
            <div className="flex flex-col items-center gap-3">
              <svg className="w-10 h-10 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <div>
                <p className="text-white font-medium">Drop your CSV file here</p>
                <p className="text-slate-400 text-sm mt-1">or click to browse</p>
              </div>
            </div>
          </div>

          {/* Field reference */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-slate-300 text-sm font-medium mb-3">Required fields</p>
            <div className="flex flex-wrap gap-2">
              {['first_name','last_name','email','bonus_type','principal_amount'].map(f => (
                <span key={f} className="px-2.5 py-1 bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs rounded-lg font-mono">{f}</span>
              ))}
            </div>
            <p className="text-slate-300 text-sm font-medium mt-4 mb-3">Recommended fields</p>
            <div className="flex flex-wrap gap-2">
              {['personal_email','mobile_phone','current_outstanding_balance','execution_date','effective_date','forgiveness_start_date','recipient_state'].map(f => (
                <span key={f} className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-400 text-xs rounded-lg font-mono">{f}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Validate */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
              <p className="text-slate-400 text-xs mb-1">Total Rows</p>
              <p className="text-white text-xl font-semibold">{rows.length}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
              <p className="text-slate-400 text-xs mb-1">Valid</p>
              <p className="text-emerald-400 text-xl font-semibold">{validRows.length}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
              <p className="text-slate-400 text-xs mb-1">Errors</p>
              <p className={`text-xl font-semibold ${errors.length > 0 ? 'text-red-400' : 'text-slate-500'}`}>{errors.length}</p>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-400 text-sm font-medium mb-3">{errors.length} row{errors.length !== 1 ? 's' : ''} have errors and will be skipped</p>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {errors.map((e, i) => (
                  <div key={i} className="text-xs">
                    <span className="text-slate-400">Row {e.row} ({e.email || 'no email'}):</span>
                    <span className="text-red-400 ml-2">{e.errors.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {validRows.length === 0 ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
              <p className="text-red-400 font-medium">No valid rows to import</p>
              <p className="text-slate-400 text-sm mt-1">Fix the errors in your CSV and try again</p>
              <button onClick={() => setStep(1)} className="mt-3 text-brand-400 hover:text-brand-300 text-sm font-medium transition">← Upload a new file</button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
                ← Upload Different File
              </button>
              <button onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition">
                Preview {validRows.length} Valid Rows →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Preview */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-300 text-sm font-medium mb-1">Ready to import {validRows.length} record{validRows.length !== 1 ? 's' : ''}</p>
            <p className="text-slate-500 text-xs">Existing recipients matched by email will be updated. New recipients will be created. Agreements will be added for all rows.</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-3 py-2.5 font-medium">Recipient</th>
                  <th className="text-left px-3 py-2.5 font-medium">Email</th>
                  <th className="text-left px-3 py-2.5 font-medium">Bonus Type</th>
                  <th className="text-right px-3 py-2.5 font-medium">Principal</th>
                  <th className="text-right px-3 py-2.5 font-medium">Outstanding</th>
                  <th className="text-left px-3 py-2.5 font-medium">Status</th>
                  <th className="text-left px-3 py-2.5 font-medium">Work State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {validRows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2.5 text-slate-200">{row.first_name} {row.last_name}</td>
                    <td className="px-3 py-2.5 text-slate-400">{row.email}</td>
                    <td className="px-3 py-2.5 text-slate-400">{row.bonus_type}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300 font-mono">{fmt(row.principal_amount)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {row.current_outstanding_balance
                        ? <span className="text-yellow-400">{fmt(row.current_outstanding_balance)} <span className="text-slate-600 text-xs">(imported)</span></span>
                        : <span className="text-slate-500 text-xs italic">BonusBridge calc</span>
                      }
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 capitalize">{row.status || 'active'}</td>
                    <td className="px-3 py-2.5 text-slate-400">{row.recipient_state?.toUpperCase() || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invalidRows.length > 0 && (
            <p className="text-slate-500 text-xs">{invalidRows.length} row{invalidRows.length !== 1 ? 's' : ''} with errors will be skipped.</p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)}
              className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
              ← Back
            </button>
            <button onClick={runImport} disabled={importing}
              className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium transition">
              {importing ? 'Importing…' : `Confirm Import — ${validRows.length} Records`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Results */}
      {step === 4 && results && (
        <div className="flex flex-col gap-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 text-center">
            <p className="text-emerald-400 text-xl font-semibold mb-1">Import Complete</p>
            <p className="text-slate-400 text-sm">Your data has been imported successfully</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ResultCard label="Recipients Created" value={results.created} color="emerald" />
            <ResultCard label="Recipients Updated" value={results.updated} color="blue" />
            <ResultCard label="Agreements Created" value={results.agreementsCreated} color="brand" />
            <ResultCard label="Rows Skipped" value={results.skipped + results.errors.length} color="slate" />
          </div>

          {results.errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-400 text-sm font-medium mb-2">{results.errors.length} rows failed during import</p>
              {results.errors.map((e, i) => (
                <p key={i} className="text-xs text-slate-400">{e.email}: {e.error}</p>
              ))}
            </div>
          )}

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-300 text-sm font-medium mb-1">Next steps</p>
            <div className="flex flex-col gap-1.5 text-slate-500 text-xs">
              <p>• Recipients with agreements are ready — send invite emails from the Recipients page</p>
              <p>• Review agreements in the Agreements page — generate amortization schedules for signing and starting bonus agreements</p>
              <p>• Terminated employees will appear in the Departure Response page</p>
              <p>• Outstanding balances marked as "imported" reflect your existing records — BonusBridge will recalculate as periods are processed</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setStep(1); setRows([]); setErrors([]); setResults(null) }}
              className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
              Import Another File
            </button>
            <a href="/issuer/agreements"
              className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition text-center">
              View Agreements →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({ label, value, color }) {
  const colors = {
    emerald: 'text-emerald-400',
    blue:    'text-blue-400',
    brand:   'text-brand-400',
    slate:   'text-slate-400',
  }
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-center">
      <p className={`text-2xl font-semibold font-mono ${colors[color]}`}>{value}</p>
      <p className="text-slate-500 text-xs mt-1">{label}</p>
    </div>
  )
}
