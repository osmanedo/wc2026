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

# Step 5 — loop through matches, detect newly finished
newly_finished = []

for results in results_data["matches"]:
    if results["status"] == "FINISHED":
        supabase.table("matches").update({
            "home_score": results["score"]["fullTime"]["home"],
            "away_score": results["score"]["fullTime"]["away"],
            "status": results["status"]
        }).eq("id", results["id"]).execute()

        supabase.rpc("calculate_points", {"match_id_input": results["id"]}).execute()

        # If this match wasn't FINISHED before, it just completed
        if results["id"] not in already_finished_ids:
            newly_finished.append(results["id"])

# Step 6 — refresh leaderboard
supabase.rpc("refresh_leaderboard", {}).execute()

# Step 7 — generate post-match summaries for newly finished matches
for match_id in newly_finished:
    try:
        generate_summary(match_id)
    except Exception as e:
        print(f"  ✗ Summary error for match {match_id}: {e}")

if newly_finished:
    print(f"\n{len(newly_finished)} new match(es) finished — summaries generated")
else:
    print("No new results")