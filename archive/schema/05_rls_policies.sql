-- =============================================================================
-- Row Level Security policies for WC2026 Fantasy
-- =============================================================================
-- All user-touching tables have RLS enabled. Public read tables (matches,
-- teams, profiles, ai_briefs, groups) are readable by anyone including
-- unauthenticated. Write and private-read tables are gated on ownership
-- and, for picks, on match kickoff time via RESTRICTIVE policies (AND logic).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Enable RLS on all public-schema tables
-- -----------------------------------------------------------------------------

ALTER TABLE public.ai_briefs                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picks                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picks_archive_dual_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                       ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- ai_briefs: public read only. Writes happen via service key from GHA scripts.
-- -----------------------------------------------------------------------------

CREATE POLICY "Anyone can read briefs" ON public.ai_briefs
  AS PERMISSIVE FOR SELECT TO public
  USING (true);


-- -----------------------------------------------------------------------------
-- matches: public read only. Writes happen via service key from update_results.py.
-- -----------------------------------------------------------------------------

CREATE POLICY "Public can read matches" ON public.matches
  AS PERMISSIVE FOR SELECT TO public
  USING (true);


-- -----------------------------------------------------------------------------
-- teams: public read only. Writes happen via service key from the seeder.
-- -----------------------------------------------------------------------------

CREATE POLICY "Public can read teams" ON public.teams
  AS PERMISSIVE FOR SELECT TO public
  USING (true);


-- -----------------------------------------------------------------------------
-- profiles: public read, self-update only.
-- Public read is required so leaderboards can show display names and avatars
-- for other users. Only the owner (auth.uid() = id) can update.
-- -----------------------------------------------------------------------------

CREATE POLICY "Public can read profiles" ON public.profiles
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- -----------------------------------------------------------------------------
-- groups: anyone can read (needed for group discovery via code), authenticated
-- users can create (created_by must equal the caller).
-- -----------------------------------------------------------------------------

CREATE POLICY "Public can read groups" ON public.groups
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Users can create groups" ON public.groups
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (auth.uid() = created_by);


-- -----------------------------------------------------------------------------
-- group_members: anyone can read memberships, users can insert themselves only.
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can read group members" ON public.group_members
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Users can join groups" ON public.group_members
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- picks: the most complex table. Combines ownership rules (PERMISSIVE) with
-- kickoff-time gating (RESTRICTIVE). Under Supabase RLS, all PERMISSIVE
-- policies OR together, then all RESTRICTIVE policies AND with that result.
-- This is how "user owns pick AND match hasn't kicked off" is enforced.
--
-- Read model:
--   1. Users can read their own picks any time
--   2. Users can read other users' picks IF (a) they share a group AND
--      (b) the match has already kicked off (so no cheating by peeking)
--
-- Write model:
--   3. Users can only insert picks with their own user_id
--   4. Users can only update picks they own
--   5. RESTRICTIVE: insert or update only allowed before match kickoff
--
-- Deletes are NOT permitted for any authenticated user. There is no DELETE
-- policy, so RLS denies all deletes. This prevents users from deleting picks
-- after seeing a result to hide bad predictions. Service key can still delete
-- for admin cleanup if needed.
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can read own picks" ON public.picks
  AS PERMISSIVE FOR SELECT TO public
  USING (auth.uid() = user_id);

CREATE POLICY "League members see each other's picks after kickoff" ON public.picks
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM matches
      WHERE matches.id = picks.match_id
        AND matches.kickoff_utc <= now()
    )
    AND EXISTS (
      SELECT 1
      FROM group_members viewer
      JOIN group_members owner ON viewer.group_id = owner.group_id
      WHERE viewer.user_id = auth.uid()
        AND owner.user_id = picks.user_id
    )
  );

CREATE POLICY "Users can insert own picks" ON public.picks
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own picks" ON public.picks
  AS PERMISSIVE FOR UPDATE TO public
  USING (auth.uid() = user_id);

-- RESTRICTIVE policies AND on top of the PERMISSIVE ownership rules. These
-- enforce the kickoff lockdown regardless of who is trying to write.
CREATE POLICY "Picks kickoff lockdown" ON public.picks
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (
    (SELECT matches.kickoff_utc FROM matches WHERE matches.id = picks.match_id) > now()
  );

CREATE POLICY "Picks kickoff restrict" ON public.picks
  AS RESTRICTIVE FOR UPDATE TO public
  WITH CHECK (
    (SELECT matches.kickoff_utc FROM matches WHERE matches.id = picks.match_id) > now()
  );


-- -----------------------------------------------------------------------------
-- picks_archive_dual_accounts: no policies. RLS enabled with no policies
-- means the table is effectively locked to all non-service-role callers.
-- This is intentional. The table stores picks from duplicate accounts that
-- were consolidated during the tournament and should not be user-visible.
-- Only service_role can access it for admin queries.
-- -----------------------------------------------------------------------------