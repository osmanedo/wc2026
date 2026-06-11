"""Quick diagnostic — what does football-data.org actually say right now?"""
import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

# adjust env var name if yours is different
API_KEY = os.getenv("FOOTBALL_DATA_API_KEY")

if not API_KEY:
    raise SystemExit("no API key — check .env or paste it directly into API_KEY above")

url = "https://api.football-data.org/v4/competitions/WC/matches"
resp = requests.get(url, headers={"X-Auth-Token": API_KEY}, params={"stage": "GROUP_STAGE"})
resp.raise_for_status()
matches = resp.json().get("matches", [])

# add this right after you fetch from football-data.org
mex = next((m for m in matches if "Mexico" in m["homeTeam"]["name"] or "Mexico" in m["awayTeam"]["name"]), None)
if mex:
    print(f"DEBUG MEXICO: status={mex['status']} score={mex['score']['fullTime']} minute={mex.get('minute')} lastUpdated={mex.get('lastUpdated')}")

print(f"total matches returned: {len(matches)}")
print(f"statuses seen across all: {sorted(set(m['status'] for m in matches))}")
print()

# anything f-d.org thinks is live?
live_states = {"IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT"}
live = [m for m in matches if m["status"] in live_states]
print(f"matches in live states: {len(live)}")
for m in live:
    print(f"  {m['homeTeam']['name']} vs {m['awayTeam']['name']} — {m['status']} — minute {m.get('minute')}")
print()

# mexico match detail
for m in matches:
    if "Mexico" in m["homeTeam"]["name"] or "Mexico" in m["awayTeam"]["name"]:
        print("=== MEXICO MATCH ===")
        print(f"teams: {m['homeTeam']['name']} vs {m['awayTeam']['name']}")
        print(f"status: {m['status']}")
        print(f"score (fullTime): {m['score']['fullTime']}")
        print(f"minute: {m.get('minute', 'N/A')}")
        print(f"last updated: {m.get('lastUpdated', 'N/A')}")
        print()
        print("full match object:")
        print(json.dumps(m, indent=2))
        break