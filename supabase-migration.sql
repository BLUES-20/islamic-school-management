-- Run this in Supabase Dashboard → SQL Editor
-- Project: wkezgixefbywotgutoao

ALTER TABLE students ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed'));

UPDATE students SET payment_status = 'pending' WHERE payment_status IS NULL;

-- Verify
SELECT COUNT(*) as total_students, payment_status, COUNT(*) as count FROM students GROUP BY payment_status ORDER BY payment_status;

-- Test query
SELECT * FROM students WHERE payment_status = 'paid' ORDER BY created_at DESC LIMIT 5;
