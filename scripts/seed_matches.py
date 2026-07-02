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

# Step 2 — create Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Step 3 — call the API
response = requests.get(
    "https://api.football-data.org/v4/competitions/WC/matches",
    headers={"X-Auth-Token": FOOTBALL_API_KEY}
)

# Get all team IDs we already have in Supabase
existing_teams = supabase.table("teams").select("id").execute()
existing_ids = {row["id"] for row in existing_teams.data}

# Step 4 — seed fixtures only. Scores and status-driven score fields are owned
# by update_results.py; this script must NOT write home_score / away_score,
# to avoid overwriting end-of-ET scores with penalty-inclusive fullTime values.
match_data = response.json()

for match in match_data["matches"]:
    home_id = match["homeTeam"]["id"]
    away_id = match["awayTeam"]["id"]

    # Skip matches with TBD teams for now
    if home_id is None or away_id is None:
        print(f"Skipping TBD match: {match['stage']}")
        continue

    # Skip matches with teams not in our DB
    if home_id not in existing_ids or away_id not in existing_ids:
        print(f"Skipping missing team match: {match['homeTeam']['name']} vs {match['awayTeam']['name']}")
        continue

    supabase.table("matches").upsert({
        "id": match["id"],
        "home_team_id": match["homeTeam"]["id"],
        "away_team_id": match["awayTeam"]["id"],
        "kickoff_utc": match["utcDate"],
        "stage": match["stage"],
        "status": match["status"],
        "group_name": match["group"],
    }, on_conflict="id").execute()

    print(f"Seeded: {match['homeTeam']['name']} vs {match['awayTeam']['name']}")