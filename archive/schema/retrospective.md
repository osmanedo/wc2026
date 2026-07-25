# WC2026 Fantasy Retrospective

Written at end-of-tournament. Purpose: capture the reasoning behind decisions that aren't obvious from reading the code, and the bugs that took hours to find so we don't rediscover them in 2028.

## Design principles that held up

### SQL owns data, Python owns orchestration

Scoring logic lives in Postgres (`calculate_points`). Python scripts trigger it via RPC but never recompute points themselves. Benefits:

- One source of truth. If scoring is wrong it's wrong in one place.
- Easy to backfill. Running `select calculate_points(match_id)` in the SQL editor re-scores a match without re-running the Python.
- Testable in isolation. SQL can be exercised against a single match without booting the whole automation.

The temptation to "just do it in Python" is real when you're prototyping. Resist it.

### Leaderboard as a live view, not a materialized table

The leaderboard is computed at read time from picks + matches. It is not stored, not cached, not refreshed on a schedule.

The earlier version used a materialized view and a `refresh_leaderboard()` function called from `update_results.py`. That created:
- Refresh lag (users saw stale points for seconds to minutes after a match ended)
- Extra scheduled work
- A whole class of "did the refresh fire" bugs

Killing the materialized view and going to a live view removed all of that. Cost: slightly heavier per-request compute, which was fine at this scale.

Note: `refresh_leaderboard()` is still in the schema as dead code. Drop it in the tech debt cleanup.

### RLS policies as RESTRICTIVE for AND logic

Supabase RLS defaults to PERMISSIVE, where multiple policies OR together. For any case where you want two conditions ANDed (like "user must own the row AND the match must not be locked"), use `AS RESTRICTIVE`. This trips people up because the default behavior is not what most people expect.

### SECURITY DEFINER for RPCs that need elevated access

`calculate_points` and `get_user_wrapped_stats` are SECURITY DEFINER because they need to read/write across tables the calling role wouldn't otherwise have direct access to under RLS. The function runs with the definer's permissions, not the caller's. Standard Postgres pattern but easy to forget.

### AI briefs and summaries via Claude API, not a self-hosted model

Trivial to integrate, cheap per call, results were consistently good enough that no user complained about brief quality. The `show_ai_briefs` boolean on profiles let users opt out. Would use the same approach again.

### Marketing

The most attraction and retention that the App received was through reddit. By posting about it in channels, and commenting on posts that people would ask about solutions like mine. I received a lot of users from the UK and Europe. There was also a potential to do it for Colombia and South A, but the language might have been a barrier.

## Bugs that took hours to find

### The football-data.org winner-null race condition

The API sometimes returned `status: FINISHED` with `winner: null` on one poll, then populated `winner` on the next poll. If the poll cycle was unlucky, the DB would end up with FINISHED but no winner set. Because `calculate_points` derives the advancement bonus from `matches.winner`, this silently zero'd out the bonus for every user's pick on that match.

Fix in `update_results.py`: track `winner_changed` explicitly, include it in the update-diff gate and in the calculate_points re-trigger gate. See the fix commit in git history.

This bug had never fired in production before the final because we got lucky with polling timing for the KO shootouts. If you see the same pattern with another data provider in 2028, apply the same fix.

### GHA scheduled crons have a 5-minute effective minimum

GitHub Actions documents cron schedules but under load the runners can be delayed by several minutes. A "*/1 * * * *" schedule does not actually run every minute. It runs whenever GHA has a runner free.

Two workarounds:
1. **Self-gating in the script.** `update_results.py` exits early if no match is live or imminent. This means we can schedule aggressively without paying the cost of API calls when there's nothing to do.
2. **pg_cron + pg_net trigger.** Later in the tournament we moved to Supabase-internal pg_cron firing `workflow_dispatch` via HTTP. More reliable than GHA schedules under load.

Use the pg_cron trigger pattern from the start next time. It solves the reliability issue entirely.

### JWT library version incompatibility

Somewhere in the Python side there is an incompatibility between recent versions of supabase-py, postgrest-py, httpx, and PyJWT that causes JWT verification to fail on service key auth. Pinning versions solved it:

```
supabase==2.3.0
postgrest==0.13.2
httpx==0.24.1
anthropic==0.18.1
```

These pins are non-negotiable until the upstream libs sort it out. In 2028 check if these are still needed, unpin if possible.

Note: at some point we had to re-enable legacy JWT keys on Supabase as a temporary fix. That's tech debt for a proper JWT migration.

### The football-data.org paid tier "unlimited" isn't

The paid tier advertises unlimited calls but there is an implicit fair-use limit. Getting rate-limited during a match is disastrous. Cache aggressively, gate hard on whether polling is needed, and never poll in a tight loop from the frontend.

## Things I'd do differently next time

### Use proper schema migrations from day one

Everything was managed by hand in the Supabase SQL editor. That was fine for a solo project but it meant:
- No history of what changed when
- Rebuilding the schema from scratch requires this archive
- Rolling back a change means writing the reverse SQL by hand

Next tournament: use Supabase CLI migrations from day one. `supabase migration new <name>` for every schema change. Cheap discipline, huge payoff.

### Offload football-data.org polling to Supabase Edge Functions

The Python + GHA pattern works but it's heavier than it needs to be. An edge function on Supabase, triggered by pg_cron, could do the whole "poll API, diff, update DB, fire calculate_points" loop without touching GHA. Fewer moving parts.

Kept it as Python + GHA this time because I was learning Python and wanted the practice.

### Separate `generated_at` timestamps on ai_briefs

The `ai_briefs` table currently uses one `generated_at` column for both the pre-match brief and the post-match summary. When one is generated but not the other, the timestamp is ambiguous. Split into `brief_generated_at` and `summary_generated_at`.

### Add an `is_exact` boolean on picks

The current leaderboard view checks `points % 5 = 0` to detect exact scores, which is brittle if scoring changes. A dedicated `is_exact` boolean on the picks table, backfilled once, would be cleaner and faster to query.

### Added user feedback

It will be good to add the bonus such as 'Team Champion' and 'Top goal scorer' for the user to predict at the beginning of the tournament

### Frontend disambiguation for colliding display names

Users pick their display name at signup. Some pick the same name. The leaderboard currently shows duplicate rows with no way to tell them apart. Add a suffix (initials of email, or last 4 of user ID) when a collision is detected.

### Push notifications, not just in-app

The Wrapped modal fires on next login. Users who never logged back in never saw it. Web push notifications would have solved that. Bigger investment though, likely not worth it at this scale.

## Things to verify before the next tournament build

Non-technical stuff that's easy to forget:

- **Does FIFA/UEFA/whoever have trademark concerns?** WC2026 was on the edge. Naming the next thing "Euro 2028 Fantasy" might attract a cease and desist. Consider a more oblique name.
- **Is Ko-fi still the tip jar of choice?** Alternatives: Buy Me a Coffee, Stripe direct. Ko-fi's embed was fine but its analytics are thin.
- **Is football-data.org still supporting the competition on the tier you can afford?** Check before committing.
- **Does Anthropic API pricing still make the briefs feature affordable?** Total cost for briefs + summaries during WC2026 was approximately $5.62 USD across the 30 days of measured tournament activity. That's less than a beer for 104 matches worth of AI briefs and post-match summaries served to 1,320 users. Even if model prices doubled or tripled, the feature remains trivially cheap. Do it again.
- **PWA vs App Store still the right call?** WC2026 stayed PWA-only because of FIFA trademark exposure and webview wrapping complexity. May be worth revisiting for a less trademark-heavy tournament.

## Deprecated stuff still in the schema at end-of-tournament

Left as-is because dropping columns/functions during a live tournament was risky. Clean up in the tech debt sprint:

- `refresh_leaderboard()` function (dead, replaced by live view)
- `picks.points_earned` column (dead, leaderboard view recomputes from picks + matches)
- `leaderboard_new` view (test copy from a debugging session, never used in production)
- Legacy JWT key support on Supabase (temporary fix, needs proper migration)
- `ai_briefs.generated_at` conflation (see above)