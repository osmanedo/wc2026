-- =============================================================================
-- Triggers for WC2026 Fantasy
-- =============================================================================
-- Two triggers total:
--
--   1. on_auth_user_created  Table trigger on auth.users. Fires our
--                            handle_new_user function to create a matching
--                            row in public.profiles.
--
--   2. ensure_rls            Event trigger on any DDL end. Fires
--                            rls_auto_enable to auto-enable RLS on any
--                            newly-created table in the public schema.
--                            This one is Supabase-managed: every fresh
--                            Supabase project has it pre-installed.
--
-- Depends on:
--   - Functions: handle_new_user, rls_auto_enable (03_functions.sql)
--   - Table:     auth.users (Supabase-managed, exists on every project)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Table triggers
-- -----------------------------------------------------------------------------

-- on_auth_user_created: fires after a new row is inserted into auth.users
-- (i.e. a user signs up via Google OAuth). Creates the corresponding profile
-- row via handle_new_user, pulling display name and avatar from the auth
-- metadata payload.
--
-- Rebuild-safe: this trigger belongs to us (public schema function targeting
-- auth.users). Supabase does not install a competing trigger with the same
-- name, so the CREATE below will succeed on a fresh project.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();


-- -----------------------------------------------------------------------------
-- 2. Event triggers
-- -----------------------------------------------------------------------------

-- ensure_rls: fires rls_auto_enable at the end of any DDL command that
-- creates a table, auto-enabling RLS on tables in the public schema.
--
-- IMPORTANT: this event trigger is auto-installed on every Supabase project.
-- The wrapper below tolerates the "already exists" case so you can run this
-- file on a fresh Supabase project without hitting a duplicate object error.
--
-- If it does already exist (the normal case), the wrapper is a no-op and
-- logs a NOTICE. If it does not exist (e.g. Supabase changes their defaults
-- one day), the CREATE fires and installs it fresh.
DO $$
BEGIN
  CREATE EVENT TRIGGER ensure_rls
    ON ddl_command_end
    EXECUTE FUNCTION rls_auto_enable();
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'ensure_rls event trigger already exists, skipping (this is expected on Supabase)';
END
$$;