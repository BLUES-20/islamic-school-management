-- Add passport column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS passport VARCHAR(50);

-- Update existing records to have NULL for passport (optional)
-- This is already handled by the IF NOT EXISTS clause