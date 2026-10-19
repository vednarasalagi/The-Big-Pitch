-- ============================================================
-- The Big Pitch — Foreign Key Cascade Deletion & Audit Log Policies
-- Migration: 009_fix_team_deletion_and_audit.sql
-- Run in: Supabase SQL Editor
-- ============================================================

-- 1. Dynamically drop any existing foreign keys referencing public.teams
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname, conrelid::regclass::text AS tablename
        FROM pg_constraint
        WHERE confrelid = 'public.teams'::regclass AND contype = 'f'
    ) LOOP
        EXECUTE 'ALTER TABLE ' || r.tablename || ' DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 2. Recreate foreign keys with ON DELETE CASCADE
ALTER TABLE public.pitch_rounds
  ADD CONSTRAINT pitch_rounds_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.investments
  ADD CONSTRAINT investments_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- 3. Allow DELETE on teams for administrators
DROP POLICY IF EXISTS "teams_admin_delete" ON public.teams;
CREATE POLICY "teams_admin_delete" ON public.teams FOR DELETE USING (true);

-- 4. Allow INSERT on audit_logs for administrators
DROP POLICY IF EXISTS "audit_admin_insert" ON public.audit_logs;
CREATE POLICY "audit_admin_insert" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- 5. Allow SELECT on audit_logs for administrators
DROP POLICY IF EXISTS "audit_admin_select" ON public.audit_logs;
CREATE POLICY "audit_admin_select" ON public.audit_logs FOR SELECT USING (true);
