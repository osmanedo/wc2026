import requests, os
from dotenv import load_dotenv
load_dotenv()
r = requests.get(
    'https://api.football-data.org/v4/competitions/WC/matches',
    headers={'X-Auth-Token': os.getenv('FOOTBALL_DATA_API_KEY')}
)
tbd = 0
for m in r.json()['matches']:
    if m['homeTeam']['id'] is None or m['awayTeam']['id'] is None:
        tbd += 1
print(f'TBD matches: {tbd}')
print(f'Non-TBD matches: {len(r.json()["matches"]) - tbd}')