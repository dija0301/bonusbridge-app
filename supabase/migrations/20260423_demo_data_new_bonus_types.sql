-- Demo data: 4 agreements for Meridian Health System covering the three new bonus types.
-- Apply AFTER the 20260423_add_bonus_types_relocation_tuition_referral.sql migration.
-- Safe to re-run: the DELETE block at the top cleans up any prior demo rows before inserting.
--
-- Agreements:
--   Maria Gonzalez  — Radiologist  — relocation_bonus      — active, ~54% forgiven
--   Robert Kim      — ER Physician — relocation_bonus      — active, just started
--   Christine Park  — CNO          — tuition_reimbursement — active, ~40% forgiven
--   Eric Johnson    — IT Director  — referral_bonus        — active, 1 of 2 installments paid
--
-- After applying, run the `generate-amortization` edge function for Maria, Robert, and
-- Christine's agreements to populate amortization_schedule rows. Referral is milestone-based.

-- ── Clean up any prior demo rows (safe to run even if nothing exists) ──
DELETE FROM agreements
WHERE recipient_id IN (
  SELECT id FROM recipients
  WHERE email LIKE '%@demo.bonusbridge.invalid'
    AND issuer_id = 'aaaaaaaa-0000-0000-0000-000000000001'
);

DELETE FROM recipients
WHERE email LIKE '%@demo.bonusbridge.invalid'
  AND issuer_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ── Insert fresh demo data ──
DO $$
DECLARE
  meridian_id  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  maria_id     uuid;
  robert_id    uuid;
  christine_id uuid;
  eric_id      uuid;
BEGIN
  -- Recipients
  INSERT INTO recipients (issuer_id, first_name, last_name, email, title, department, employee_id, is_active, onboarding_complete)
  VALUES (meridian_id, 'Maria', 'Gonzalez', 'maria.gonzalez@demo.bonusbridge.invalid', 'Radiologist', 'Medical Imaging', 'MED-4211', true, true)
  RETURNING id INTO maria_id;

  INSERT INTO recipients (issuer_id, first_name, last_name, email, title, department, employee_id, is_active, onboarding_complete)
  VALUES (meridian_id, 'Robert', 'Kim', 'robert.kim@demo.bonusbridge.invalid', 'ER Physician', 'Emergency Department', 'MED-4598', true, true)
  RETURNING id INTO robert_id;

  INSERT INTO recipients (issuer_id, first_name, last_name, email, title, department, employee_id, is_active, onboarding_complete)
  VALUES (meridian_id, 'Christine', 'Park', 'christine.park@demo.bonusbridge.invalid', 'CNO', 'Nursing Administration', 'EXC-0012', true, true)
  RETURNING id INTO christine_id;

  INSERT INTO recipients (issuer_id, first_name, last_name, email, title, department, employee_id, is_active, onboarding_complete)
  VALUES (meridian_id, 'Eric', 'Johnson', 'eric.johnson@demo.bonusbridge.invalid', 'IT Director', 'Information Technology', 'IT-0034', true, true)
  RETURNING id INTO eric_id;

  -- Maria Gonzalez — Relocation, started ~18 months ago, 36-month term, ~54% forgiven
  INSERT INTO agreements (
    issuer_id, recipient_id, bonus_type, agreement_number, status,
    principal_amount, original_principal, outstanding_balance,
    interest_rate, interest_rate_type,
    forgiveness_frequency, forgiveness_periods, forgiveness_amount_per_period,
    execution_date, effective_date, forgiveness_start_date,
    recipient_state, eligibility_criteria, custom_terms
  ) VALUES (
    meridian_id, maria_id, 'relocation_bonus', 'MHS-RELO-2024-001', 'active',
    40000, 40000, 18500,
    5.27, 'afr_mid',
    'monthly', 36, 40000.0 / 36,
    DATE '2024-09-10', DATE '2024-10-01', DATE '2024-10-01',
    'MN',
    '{"benefits_eligible":true,"maintain_role":true,"licensure_required":true,"min_fte":0.8,"notes":"Must maintain Minnesota radiology license"}'::jsonb,
    '{}'::jsonb
  );

  -- Robert Kim — Relocation, recent, 36-month term
  INSERT INTO agreements (
    issuer_id, recipient_id, bonus_type, agreement_number, status,
    principal_amount, original_principal, outstanding_balance,
    interest_rate, interest_rate_type,
    forgiveness_frequency, forgiveness_periods, forgiveness_amount_per_period,
    execution_date, effective_date, forgiveness_start_date,
    recipient_state, eligibility_criteria, custom_terms
  ) VALUES (
    meridian_id, robert_id, 'relocation_bonus', 'MHS-RELO-2026-002', 'active',
    35000, 35000, 35000,
    5.27, 'afr_mid',
    'monthly', 36, 35000.0 / 36,
    DATE '2026-03-15', DATE '2026-04-01', DATE '2026-04-01',
    'MN',
    '{"benefits_eligible":true,"maintain_role":true,"licensure_required":true,"min_fte":1.0,"notes":"Must maintain Minnesota ER credentials and ACLS certification"}'::jsonb,
    '{}'::jsonb
  );

  -- Christine Park — Tuition / CE, started ~10 months ago, 24-month term, ~40% forgiven
  INSERT INTO agreements (
    issuer_id, recipient_id, bonus_type, agreement_number, status,
    principal_amount, original_principal, outstanding_balance,
    interest_rate, interest_rate_type,
    forgiveness_frequency, forgiveness_periods, forgiveness_amount_per_period,
    execution_date, effective_date, forgiveness_start_date,
    recipient_state, eligibility_criteria, custom_terms
  ) VALUES (
    meridian_id, christine_id, 'tuition_reimbursement', 'MHS-TUI-2025-001', 'active',
    28000, 28000, 16800,
    5.27, 'afr_mid',
    'monthly', 24, 28000.0 / 24,
    DATE '2025-06-05', DATE '2025-07-01', DATE '2025-07-01',
    'MN',
    '{"benefits_eligible":true,"maintain_role":true,"licensure_required":true,"min_fte":1.0,"notes":"Continues in CNO role through program completion"}'::jsonb,
    '{"program_institution":"University of Minnesota — Doctor of Nursing Practice (Executive Leadership)"}'::jsonb
  );

  -- Eric Johnson — Referral, milestone-based, 2 installments, 1 paid, 1 upcoming
  -- forgiveness_start_date, forgiveness_periods, forgiveness_amount_per_period
  -- are required by the schema; we fill placeholders that match the 2-installment structure
  -- since milestone-based agreements don't use the amortization schedule.
  INSERT INTO agreements (
    issuer_id, recipient_id, bonus_type, agreement_number, status,
    principal_amount, original_principal, outstanding_balance,
    execution_date, effective_date, forgiveness_start_date,
    forgiveness_frequency, forgiveness_periods, forgiveness_amount_per_period,
    recipient_state, eligibility_criteria, custom_terms
  ) VALUES (
    meridian_id, eric_id, 'referral_bonus', 'MHS-REF-2025-014', 'active',
    5000, 5000, 2500,
    DATE '2025-11-01', DATE '2025-11-15', DATE '2025-11-15',
    'custom', 2, 2500,
    'MN',
    '{"benefits_eligible":true,"maintain_role":true,"min_fte":1.0,"notes":"Referrer must remain employed through second installment date"}'::jsonb,
    jsonb_build_object(
      'referred_employee_name', 'Priya Desai (Sr. Network Engineer)',
      'installments', jsonb_build_array(
        jsonb_build_object('date','2026-02-15','amount',2500),
        jsonb_build_object('date','2026-08-15','amount',2500)
      )
    )
  );
END $$;
