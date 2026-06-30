import os
import sys
import requests
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from supabase import create_client
from generate_summary import generate_summary
from supabase import create_client
from httpx import Timeout

# Step 1 — load .env
load_dotenv()
FOOTBALL_API_KEY = os.getenv("FOOTBALL_DATA_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Step 2.0 — create Supabase client (use service key)
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
supabase.postgrest.session.timeout = Timeout(30.0)

# Step 2.5 — live-match gate: exit early if nothing is live or imminent
LIVE_STATUSES = ["IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT"]

now = datetime.now(timezone.utc)
window_start = (now - timedelta(hours=3)).isoformat()
window_end = (now + timedelta(hours=3)).isoformat()

live = (
    supabase.table("matches")
    .select("id")
    .in_("status", LIVE_STATUSES)
    .limit(1)
    .execute()
)

imminent = (
    supabase.table("matches")
    .select("id")
    .gte("kickoff_utc", window_start)
    .lte("kickoff_utc", window_end)
    .limit(1)
    .execute()
)

if not live.data and not imminent.data:
    print("No live or imminent matches — exiting cleanly")
    sys.exit(0)

# Step 3 — load current state for all matches (used for change detection)
current_state_resp = (
    supabase.table("matches")
    .select("id, status, home_score, away_score, home_penalties, away_penalties")
    .execute()
)
current_state = {
    row["id"]: {
        "status": row["status"],
        "home_score": row["home_score"],
        "away_score": row["away_score"],
        "home_penalties": row["home_penalties"],
        "away_penalties": row["away_penalties"],
    }
    for row in current_state_resp.data
}
already_finished_ids = {mid for mid, s in current_state.items() if s["status"] == "FINISHED"}

# Step 3.5 — find matches that already have a post-match summary in ai_briefs.
# Used to skip Claude calls for already-summarised matches AND to auto-retry
# matches where generate_summary failed in a previous run (the row will still
# be missing post_match_summary, so this run will pick it up).
existing_summary_resp = (
    supabase.table("ai_briefs")
    .select("match_id")
    .not_.is_("post_match_summary", "null")
    .execute()
)
matches_with_summaries = {row["match_id"] for row in existing_summary_resp.data}

# Step 4 — call football-data.org matches endpoint
try:
    response = requests.get(
        "https://api.football-data.org/v4/competitions/WC/matches",
        headers={"X-Auth-Token": FOOTBALL_API_KEY},
        timeout=15
    )
    response.raise_for_status()
    results_data = response.json()
except requests.exceptions.RequestException as e:
    status = e.response.status_code if e.response is not None else "no response"
    print(f"  ✗ football-data.org request failed ({status}): {e}")
    print("  → exiting cleanly, next poll will retry in 5 minutes")
    sys.exit(0)

print(f"Processed {len(results_data['matches'])} matches from football-data.org")

# Step 5 — loop through matches and sync scores + status
# Each branch computes new values first, then writes only if they differ
# from what's already in the DB — avoids redundant Realtime pushes
newly_finished = []
writes_skipped = 0

for match in results_data["matches"]:
    status = match["status"]
    score  = match["score"]  # full score object
    match_id = match["id"]
    current = current_state.get(match_id, {})
    if match_id in already_finished_ids and status != "FINISHED":
        writes_skipped += 1
        continue

    if status == "FINISHED":
        duration = score["duration"]

        # Group stage and knockouts decided in 90 use fullTime
        # (regularTime is null in these cases).
        # Knockouts past 90 use end-of-ET (regularTime + extraTime),
        # excluding penalty goals.
        if duration == "REGULAR":
            home_score = score["fullTime"]["home"]
            away_score = score["fullTime"]["away"]
        else:  # EXTRA_TIME or PENALTY_SHOOTOUT
            regular = score["regularTime"]
            extra   = score["extraTime"]
            home_score = regular["home"] + extra["home"]
            away_score = regular["away"] + extra["away"]

        # Extract penalty scores if the match went to a shootout
        home_penalties = None
        away_penalties = None
        if duration == "PENALTY_SHOOTOUT":
            home_penalties = score["penalties"]["home"]
            away_penalties = score["penalties"]["away"]

        # Only write if status or score changed — catches post-match corrections
        # from football-data.org without re-pushing unchanged rows every poll
        if (
            current.get("status") != status
            or current.get("home_score") != home_score
            or current.get("away_score") != away_score
            or current.get("home_penalties") != home_penalties
            or current.get("away_penalties") != away_penalties
        ):
            supabase.table("matches").update({
                "home_score": home_score,
                "away_score": away_score,
                "winner": score["winner"],  # HOME_TEAM, AWAY_TEAM, or DRAW
                "status": status,
                "home_penalties": home_penalties,
                "away_penalties": away_penalties,
            }).eq("id", match_id).execute()
        else:
            writes_skipped += 1

        # Only run points calculation for matches that just transitioned to FINISHED
        if match_id not in already_finished_ids:
            supabase.rpc("calculate_points", {"match_id_input": match_id}).execute()
            newly_finished.append(match_id)

    elif status in ("IN_PLAY", "PAUSED", "EXTRA_TIME"):
        # score.fullTime is the current cumulative live score (including any ET goals as they happen)
        new_home = score["fullTime"]["home"]
        new_away = score["fullTime"]["away"]
        if (
            current.get("status") != status
            or current.get("home_score") != new_home
            or current.get("away_score") != new_away
        ):
            supabase.table("matches").update({
                "home_score": new_home,
                "away_score": new_away,
                "status": status
            }).eq("id", match_id).execute()
        else:
            writes_skipped += 1

    elif status == "PENALTY_SHOOTOUT":
        # During a live pen shootout, keep displaying the end-of-ET score (excluding pen goals)
        # so the score field stays stable. The status field signals to the UI that pens are happening.
        regular = score["regularTime"]
        extra   = score["extraTime"]
        new_home = regular["home"] + extra["home"]
        new_away = regular["away"] + extra["away"]
        if (
            current.get("status") != status
            or current.get("home_score") != new_home
            or current.get("away_score") != new_away
        ):
            supabase.table("matches").update({
                "home_score": new_home,
                "away_score": new_away,
                "status": status
            }).eq("id", match_id).execute()
        else:
            writes_skipped += 1

if writes_skipped:
    print(f"Skipped {writes_skipped} no-op write(s)")

# Step 6 — generate post-match summaries.
# Fire for every FINISHED match that doesn't yet have a post_match_summary in
# ai_briefs. Covers both cases:
#   1. Match transitioned to FINISHED in this run (just-finished)
#   2. Match finished in a previous run but generate_summary failed silently
#      (row in ai_briefs is missing the summary, so this run retries it)
# Note: refresh_leaderboard() removed — leaderboard is now a live view
all_finished = already_finished_ids | set(newly_finished)
needs_summary = all_finished - matches_with_summaries

if needs_summary:
    print(f"Generating summaries for {len(needs_summary)} match(es)")

for match_id in needs_summary:
    try:
        generate_summary(match_id)
    except Exception as e:
        # generate_summary already retried MAX_RETRIES times — log and move on.
        # Next run will pick it up again since the row still has no summary.
        print(f"  ✗ Summary permanently failed for match {match_id}: {e}")

if newly_finished:
    print(f"\n{len(newly_finished)} match(es) newly finished this run")
elif not needs_summary:
    print("No new results")