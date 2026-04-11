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

# Step 3 — get matches already marked FINISHED in our DB (so we know which ones are NEW)
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

# Step 5 — loop through matches and sync scores + status
# FINISHED:      write final scores, calculate points, flag for summary generation
# IN_PLAY/PAUSED: write live scores and status so leaderboard view reflects current game
newly_finished = []

for match in results_data["matches"]:
    status = match["status"]
    score  = match["score"]["fullTime"]

    if status == "FINISHED":
        supabase.table("matches").update({
            "home_score": score["home"],
            "away_score": score["away"],
            "status": status
        }).eq("id", match["id"]).execute()

        supabase.rpc("calculate_points", {"match_id_input": match["id"]}).execute()

        if match["id"] not in already_finished_ids:
            newly_finished.append(match["id"])

    elif status in ("IN_PLAY", "PAUSED"):
        # score.fullTime holds the current live score in football-data.org v4
        supabase.table("matches").update({
            "home_score": score["home"],
            "away_score": score["away"],
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