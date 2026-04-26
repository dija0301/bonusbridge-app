-- Bulk demo data: 150 fake recipients + 200 agreements for Meridian Health System.
-- All emails use 'demo_bulk_<n>@demo.bonusbridge.invalid' so they're identifiable
-- and the cleanup block at the top is idempotent (safe to re-run).
--
-- Bonus type distribution roughly mirrors realistic mix:
--   ~13% signing, ~19% starting, ~13% relocation, ~6% tuition,
--   ~19% retention, ~13% performance, ~13% referral, ~6% custom
-- Status mostly 'active' with a few 'terminated' / 'forgiven' / 'onboarding'.
--
-- No amortization schedules are generated (would be ~4,000 rows). Open any
-- individual agreement and click Save to trigger the edge function for that one.

-- ── Cleanup any prior bulk demo rows ──
DELETE FROM amortization_schedule WHERE agreement_id IN (
  SELECT a.id FROM agreements a
  JOIN recipients r ON r.id = a.recipient_id
  WHERE r.email LIKE 'demo_bulk_%@demo.bonusbridge.invalid'
);
DELETE FROM recipient_events WHERE recipient_id IN (
  SELECT id FROM recipients WHERE email LIKE 'demo_bulk_%@demo.bonusbridge.invalid'
);
DELETE FROM agreements WHERE recipient_id IN (
  SELECT id FROM recipients WHERE email LIKE 'demo_bulk_%@demo.bonusbridge.invalid'
);
DELETE FROM recipients WHERE email LIKE 'demo_bulk_%@demo.bonusbridge.invalid';

-- ── 150 recipients ──
INSERT INTO recipients (
  issuer_id, first_name, last_name, email, title, department,
  employee_id, is_active, onboarding_complete
)
SELECT
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  (ARRAY[
    'Sarah','James','Maria','David','Emily','Michael','Jessica','Christopher','Ashley','Matthew',
    'Jennifer','Joshua','Amanda','Daniel','Stephanie','Andrew','Melissa','Justin','Nicole','Brandon',
    'Elizabeth','Ryan','Heather','Tyler','Megan','Brian','Amy','Kevin','Rachel','Eric',
    'Alyssa','Brett','Caroline','Derek','Erin','Frank','Grace','Henry','Ivy','Jacob'
  ])[1 + (i * 13 % 40)],
  (ARRAY[
    'Anderson','Brown','Chen','Davis','Garcia','Johnson','Kim','Lee','Martinez','Nguyen',
    'Patel','Rodriguez','Smith','Taylor','Wilson','Adams','Baker','Clark','Edwards','Foster',
    'Green','Hall','Irving','Jackson','Knight','Lopez','Mitchell','Nelson','Owens','Parker',
    'Quinn','Rivera','Stewart','Thompson','Underwood','Vasquez','White','Young','Zimmerman','Allen'
  ])[1 + (i * 7 % 40)],
  'demo_bulk_' || i || '@demo.bonusbridge.invalid',
  (ARRAY[
    'Hospitalist','Cardiologist','Surgeon','Anesthesiologist','Radiologist',
    'ER Physician','Pediatrician','OB-GYN','Oncologist','Neurologist',
    'RN','LPN','Nurse Practitioner','PA','CNA',
    'Pharmacist','Dietitian','Physical Therapist','Respiratory Therapist','Lab Tech',
    'IT Specialist','HR Coordinator','Finance Analyst','Operations Manager','Quality Director'
  ])[1 + (i * 11 % 25)],
  (ARRAY[
    'Cardiology','Surgery','Emergency','Pediatrics','Oncology',
    'Nursing','Pharmacy','Operations','Finance','Information Technology'
  ])[1 + (i * 5 % 10)],
  'EMP-' || lpad((10000 + i)::text, 5, '0'),
  true, true
FROM generate_series(1, 150) AS i;

-- ── 200 agreements ──
INSERT INTO agreements (
  issuer_id, recipient_id, bonus_type, agreement_number, status,
  principal_amount, original_principal, outstanding_balance,
  interest_rate, interest_rate_type,
  forgiveness_frequency, forgiveness_periods, forgiveness_amount_per_period,
  execution_date, effective_date, forgiveness_start_date,
  recipient_state, eligibility_criteria, custom_terms
)
SELECT
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  r.id,
  agg.bonus_type,
  'MHS-DEMO-' || lpad(agg.i::text, 4, '0'),
  agg.status,
  agg.principal,
  agg.principal,
  CASE agg.status
    WHEN 'forgiven'::agreement_status THEN 0
    ELSE round(agg.principal * (1 - LEAST(0.95, agg.months_elapsed::numeric / 36)), 2)
  END,
  CASE agg.bonus_type
    WHEN 'signing_bonus'::bonus_type         THEN 5.27
    WHEN 'relocation_bonus'::bonus_type      THEN 5.27
    WHEN 'tuition_reimbursement'::bonus_type THEN 5.27
    ELSE 0
  END,
  (CASE agg.bonus_type
    WHEN 'signing_bonus'::bonus_type         THEN 'afr_mid'
    WHEN 'relocation_bonus'::bonus_type      THEN 'afr_mid'
    WHEN 'tuition_reimbursement'::bonus_type THEN 'afr_mid'
    ELSE 'fixed'
  END)::interest_rate_type,
  'monthly'::forgiveness_frequency,
  CASE agg.bonus_type
    WHEN 'tuition_reimbursement'::bonus_type THEN 24
    WHEN 'referral_bonus'::bonus_type        THEN 4
    WHEN 'retention_bonus'::bonus_type       THEN 12
    WHEN 'performance_bonus'::bonus_type     THEN 12
    ELSE 36
  END,
  agg.principal / CASE agg.bonus_type
    WHEN 'tuition_reimbursement'::bonus_type THEN 24
    WHEN 'referral_bonus'::bonus_type        THEN 4
    WHEN 'retention_bonus'::bonus_type       THEN 12
    WHEN 'performance_bonus'::bonus_type     THEN 12
    ELSE 36
  END,
  (current_date - (agg.days_ago || ' days')::interval)::date,
  (current_date - (agg.days_ago || ' days')::interval + INTERVAL '14 days')::date,
  (current_date - (agg.days_ago || ' days')::interval + INTERVAL '14 days')::date,
  (ARRAY['MN','CA','TX','NY','FL','IL','PA','OH','GA','NC'])[1 + (agg.i % 10)],
  '{"benefits_eligible":true,"maintain_role":true,"licensure_required":false}'::jsonb,
  CASE agg.bonus_type
    WHEN 'tuition_reimbursement'::bonus_type THEN
      '{"program_institution":"Local University Graduate Program"}'::jsonb
    WHEN 'referral_bonus'::bonus_type THEN
      jsonb_build_object(
        'referred_employee_name', 'Referred Hire ' || agg.i,
        'installments', jsonb_build_array(
          jsonb_build_object(
            'date', ((current_date - (agg.days_ago || ' days')::interval + INTERVAL '90 days')::date)::text,
            'amount', round(agg.principal / 2)
          ),
          jsonb_build_object(
            'date', ((current_date - (agg.days_ago || ' days')::interval + INTERVAL '270 days')::date)::text,
            'amount', round(agg.principal / 2)
          )
        )
      )
    ELSE '{}'::jsonb
  END
FROM (
  SELECT
    i,
    (CASE i % 16
      WHEN 0  THEN 'signing_bonus'
      WHEN 1  THEN 'signing_bonus'
      WHEN 2  THEN 'starting_bonus'
      WHEN 3  THEN 'starting_bonus'
      WHEN 4  THEN 'starting_bonus'
      WHEN 5  THEN 'relocation_bonus'
      WHEN 6  THEN 'relocation_bonus'
      WHEN 7  THEN 'tuition_reimbursement'
      WHEN 8  THEN 'retention_bonus'
      WHEN 9  THEN 'retention_bonus'
      WHEN 10 THEN 'retention_bonus'
      WHEN 11 THEN 'performance_bonus'
      WHEN 12 THEN 'performance_bonus'
      WHEN 13 THEN 'referral_bonus'
      WHEN 14 THEN 'referral_bonus'
      ELSE         'custom'
    END)::bonus_type AS bonus_type,
    (CASE
      WHEN i % 20 = 0 THEN 'terminated'
      WHEN i % 25 = 1 THEN 'forgiven'
      WHEN i % 30 = 2 THEN 'onboarding'
      ELSE                 'active'
    END)::agreement_status AS status,
    (CASE i % 16
      WHEN 0  THEN 50000 + ((i * 41) % 10) * 2500
      WHEN 1  THEN 50000 + ((i * 41) % 10) * 2500
      WHEN 2  THEN 10000 + ((i * 17) %  5) * 1000
      WHEN 3  THEN 10000 + ((i * 17) %  5) * 1000
      WHEN 4  THEN 10000 + ((i * 17) %  5) * 1000
      WHEN 5  THEN 35000 + ((i * 31) %  8) * 1500
      WHEN 6  THEN 35000 + ((i * 31) %  8) * 1500
      WHEN 7  THEN 25000 + ((i * 23) %  6) * 1500
      WHEN 8  THEN 15000 + ((i * 19) %  6) * 1000
      WHEN 9  THEN 15000 + ((i * 19) %  6) * 1000
      WHEN 10 THEN 15000 + ((i * 19) %  6) * 1000
      WHEN 11 THEN 18000 + ((i * 29) %  5) * 1500
      WHEN 12 THEN 18000 + ((i * 29) %  5) * 1500
      WHEN 13 THEN  5000 + ((i * 37) %  4) * 1000
      WHEN 14 THEN  5000 + ((i * 37) %  4) * 1000
      ELSE        10000
    END)::numeric AS principal,
    (1 + (i * 23) % 720) AS days_ago,
    GREATEST(0, ((1 + (i * 23) % 720) / 30)::int - 2) AS months_elapsed,
    'demo_bulk_' || (1 + ((i - 1) * 17) % 150) || '@demo.bonusbridge.invalid' AS rec_email
  FROM generate_series(1, 200) AS i
) agg
JOIN recipients r ON r.email = agg.rec_email
  AND r.issuer_id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;
