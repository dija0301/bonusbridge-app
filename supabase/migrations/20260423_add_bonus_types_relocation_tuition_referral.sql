-- Add three new bonus_type enum values.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block,
-- so each statement is standalone and must be applied individually.

ALTER TYPE bonus_type ADD VALUE IF NOT EXISTS 'relocation_bonus';
ALTER TYPE bonus_type ADD VALUE IF NOT EXISTS 'tuition_reimbursement';
ALTER TYPE bonus_type ADD VALUE IF NOT EXISTS 'referral_bonus';
