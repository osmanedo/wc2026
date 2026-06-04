import os
import requests
from dotenv import load_dotenv
from supabase import create_client
from generate_summary import generate_summary

# Step 1 — load .env
load_dotenv()
FOOTBALL_API_KEY = os.getenv("FOOTBALL_DATA_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Step 2 — create Supabase client (use service key)
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Step 3 — get matches already marked FINISHED in our DB
already_finished = (
    supabase.table("matches")
    .select("id")
    .eq("status", "FINISHED")
    .execute()
)
already_finished_ids = {row["id"] for row in already_finished.data}

# Step 4 — call football-data.org matches endpoint
response = requests.get(
    "https://api.football-data.org/v4/competitions/WC/matches",
    headers={"X-Auth-Token": FOOTBALL_API_KEY}
)

results_data = response.json()
print(f"Processed {len(results_data['matches'])} matches from football-data.org")

# Step 5 — loop through matches and sync scores + status
newly_finished = []

for match in results_data["matches"]:
    status = match["status"]
    score  = match["score"]  # full score object

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

        # Always update the score so any post-match corrections from football-data.org flow through
        supabase.table("matches").update({
            "home_score": home_score,
            "away_score": away_score,
            "winner": score["winner"],  # HOME_TEAM, AWAY_TEAM, or DRAW
            "status": status
        }).eq("id", match["id"]).execute()

        # Only run points calculation for matches that just transitioned to FINISHED
        if match["id"] not in already_finished_ids:
            supabase.rpc("calculate_points", {"match_id_input": match["id"]}).execute()
            newly_finished.append(match["id"])

    elif status in ("IN_PLAY", "PAUSED", "EXTRA_TIME"):
        # score.fullTime is the current cumulative live score (including any ET goals as they happen)
        supabase.table("matches").update({
            "home_score": score["fullTime"]["home"],
            "away_score": score["fullTime"]["away"],
            "status": status
        }).eq("id", match["id"]).execute()

    elif status == "PENALTY_SHOOTOUT":
        # During a live pen shootout, keep displaying the end-of-ET score (excluding pen goals)
        # so the score field stays stable. The status field signals to the UI that pens are happening.
        regular = score["regularTime"]
        extra   = score["extraTime"]
        supabase.table("matches").update({
            "home_score": regular["home"] + extra["home"],
            "away_score": regular["away"] + extra["away"],
            "status": status
        }).eq("id", match["id"]).execute()

# Step 6 — generate post-match summaries for newly finished matches
# Note: refresh_leaderboard() removed — leaderboard is now a live view
for match_id in newly_finished:
    try:
        generate_summary(match_id)
    except Exception as e:
        # generate_summary already retried MAX_RETRIES times — log and move on.
        # The frontend falls back to pre_match_brief until a later run succeeds.
        print(f"  ✗ Summary permanently failed for match {match_id}: {e}")

if newly_finished:
    print(f"\n{len(newly_finished)} new match(es) finished — summaries generated")
else:
    print("No new results")