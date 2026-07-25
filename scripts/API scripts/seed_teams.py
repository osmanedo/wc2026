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
    "https://api.football-data.org/v4/competitions/WC/teams",
    headers={"X-Auth-Token": FOOTBALL_API_KEY}
)

# Step 4 — loop and insert
data = response.json()
for team in data["teams"]:
    supabase.table("teams").insert({
        "id": team["id"],
        "name": team["name"],
        "flag_url": team["crest"],
        "group_name": None,
        "confederation": None
    }).execute()

data = response.json()
print(data)
