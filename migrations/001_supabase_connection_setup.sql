-- Migration: Supabase Connection Setup
-- Project Ref: wkezgixefbywotgutoao
-- This migration sets up the database connection configuration for Supabase
-- Database Host: db.wkezgixefbywotgutoao.supabase.co

-- Note: The actual connection is configured via environment variables
-- DATABASE_URL should be set to: postgres://postgres:[YOUR_PASSWORD]@db.wkezgixefbywotgutoao.supabase.co:5432/postgres

-- Create enum types if they don't exist (for Supabase compatibility)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'staff', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gender_type AS ENUM ('male', 'female', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Verify Supabase connection
SELECT 
    current_database() as database_name,
    current_user as db_user,
    inet_server_addr() as server_ip,
    inet_server_port() as server_port;

-- List all tables to verify setup
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

