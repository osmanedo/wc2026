import requests, os
from dotenv import load_dotenv
from supabase import create_client
load_dotenv()
r = requests.get(
    'https://api.football-data.org/v4/competitions/WC/teams',
    headers={'X-Auth-Token': os.getenv('FOOTBALL_DATA_API_KEY')}
)
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY'))
for t in r.json()['teams']:
    if t['id'] in [8062, 1934]:
        print(f"{t['name']} ({t['id']}) — {t['crest']}")
        supabase.table('teams').upsert({
            'id': t['id'],
            'name': t['name'],
            'flag_url': t['crest'],
        }).execute()
        print(f"  ✓ Seeded")