import os
import requests
from dotenv import load_dotenv

# Step 1 — load .env
load_dotenv()
FOOTBALL_API_KEY = os.getenv("FOOTBALL_DATA_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Step 3 — call the API
response = requests.get(
    "https://api.football-data.org/v4/competitions/WC/matches",
    headers={"X-Auth-Token": FOOTBALL_API_KEY}
)

data = response.json()
print(f'API has {data["resultSet"]["count"]} matches')

# Stage breakdown
from collections import Counter
stages = Counter(m['stage'] for m in data['matches'])
print("\nStage breakdown:")
for stage, count in stages.items():
    print(f"  {stage}: {count}")

# Sample knockout match
knockout = next((m for m in data['matches'] if m['stage'] != 'GROUP_STAGE'), None)
if knockout:
    print(f"\nSample knockout match:")
    print(f"  Stage:  {knockout['stage']}")
    print(f"  Home:   {knockout['homeTeam']}")
    print(f"  Away:   {knockout['awayTeam']}")
    print(f"  Status: {knockout['status']}")
    print(f"  Date:   {knockout['utcDate']}")