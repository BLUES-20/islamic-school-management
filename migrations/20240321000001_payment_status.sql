-- Add payment_status to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed'));

-- Update existing students to pending (safe default)
UPDATE students SET payment_status = 'pending' WHERE payment_status IS NULL;

-- Verify
SELECT payment_status, COUNT(*) FROM students GROUP BY payment_status;
-- Run: Supabase Dashboard → SQL Editor
