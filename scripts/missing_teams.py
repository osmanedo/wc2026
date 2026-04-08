import requests, os
from dotenv import load_dotenv
from supabase import create_client
load_dotenv()
r = requests.get(
    'https://api.football-data.org/v4/competitions/WC/matches',
    headers={'X-Auth-Token': os.getenv('FOOTBALL_DATA_API_KEY')}
)
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))
existing = {row['id'] for row in supabase.table('teams').select('id').execute().data}
for m in r.json()['matches']:
    h, a = m['homeTeam']['id'], m['awayTeam']['id']
    if h and a:
        missing = []
        if h not in existing: missing.append(f"{m['homeTeam']['name']} ({h})")
        if a not in existing: missing.append(f"{m['awayTeam']['name']} ({a})")
        if missing: print(f"Missing: {', '.join(missing)}")