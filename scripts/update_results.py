import os
import requests
from dotenv import load_dotenv
from supabase import create_client

# Step 1 — load .env
load_dotenv()
FOOTBALL_API_KEY = os.getenv("FOOTBALL_DATA_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Step 2 — create Supabase client (use service key)
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Step 3 — call football-data.org matches endpoint
response = requests.get(
    "https://api.football-data.org/v4/competitions/WC/matches",
    headers={"X-Auth-Token": FOOTBALL_API_KEY}
)

# Step 4 — loop through matches
results_data = response.json()

for results in results_data["matches"]:
    if results["status"] == "FINISHED":
        supabase.table("matches").update({
            "home_score": results["score"]["fullTime"]["home"],
            "away_score": results["score"]["fullTime"]["away"],
            "status": results["status"]
        }).eq("id", results["id"]).execute()

        supabase.rpc("calculate_points", {"match_id_input": results["id"]}).execute()

# Step 5Call refresh_leaderboard at the end
supabase.rpc("refresh_leaderboard", {}).execute()