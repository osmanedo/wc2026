# WC2026 Fantasy: Final Stats

Snapshot of tournament state at end-of-final. All numbers pulled from the live DB after the whistle.

## Users and engagement

- Total signups: 1,320
- Users with at least one pick: 1,085
- Users with zero picks: 235
- Total picks submitted: 76,043
- Average picks per active user: ~70 (of 104 possible matches, ~67% completion)
- Total private groups: 264

Engagement breakdown:

| Bucket | Users |
|---|---|
| Never picked | 235 |
| Low (1-10 picks) | 183 |
| Mid (11-40 picks) | 103 |
| High (41-80 picks) | 168 |
| Super engaged (>80 picks) | 631 |
| **Total** | **1,320** |

The super-engaged bucket (>80 picks out of 104 possible) is 48% of all signups and 58% of everyone who picked at least once. This was not a casual audience.

Signup timing: 88% of signups happened in the two weeks immediately before kickoff. The week of 8 June alone brought in 828 users (63% of the total base). Interest is tournament-time interest.

| Signup week | New users |
|---|---|
| Weeks of Mar to mid-May | 8 |
| Week of 18 May | 3 |
| Week of 25 May | 33 |
| Week of 1 June | 329 |
| **Week of 8 June (kickoff week)** | **828** |
| Week of 15 June | 54 |
| Week of 22 June | 28 |
| Week of 29 June | 29 |
| Weeks of 6 July onward | 11 |

## Tournament coverage

- Total matches: 104
- Total exact scores called across all users: 7,825
- Total correct results called (not including exacts): 37,328
- Combined "any correct": 45,153 out of 76,043 picks (~59.4%)

### Matches with the most exact scores (crowd got it right)

| Match | Score | Stage | Exact scores called |
|---|---|---|---|
| Mexico vs South Africa | 2-0 | Group | 313 |
| Brazil vs Haiti | 3-0 | Group | 274 |
| Ivory Coast vs Norway | 1-2 | Last 32 | 273 |
| Curaçao vs Ivory Coast | 0-2 | Group | 272 |
| France vs Iraq | 3-0 | Group | 246 |

### Matches with the fewest correct picks (crowd got it wrong)

| Match | Score | Stage | Picks | Correct | % |
|---|---|---|---|---|---|
| Spain vs Cape Verde Islands | 0-0 | Group | 806 | 3 | 0.4% |
| Portugal vs Congo DR | 1-1 | Group | 816 | 11 | 1.3% |
| Germany vs Paraguay | 1-1 | Last 32 | 624 | 9 | 1.4% |
| England vs Ghana | 0-0 | Group | 777 | 20 | 2.6% |
| Ecuador vs Germany | 2-1 | Group | 760 | 21 | 2.8% |

Spain 0-0 Cape Verde is the collective massacre of the tournament: 806 people picked it, 3 got the result right.

## Winners

Global leaderboard top 10:

| Rank | Player | Points | Exact | Correct | Accuracy |
|---|---|---|---|---|---|
| 1 | IrinaF | 332 | 21 | 47 | 65.4% |
| 2 | GameChanger | 326 | 24 | 45 | 66.3% |
| 3 | Elton Jr. | 321 | 18 | 54 | 69.2% |
| 4 | Hansen | 318 | 21 | 45 | 65.3% |
| 5 | Chic's champions | 316 | 19 | 50 | 66.3% |
| 6 | The Norway Row | 315 | 17 | 55 | 69.2% |
| 7 | Brian Damelio | 314 | 16 | 53 | 66.3% |
| 8 | smacthat | 313 | 19 | 54 | 73.7% |
| 9 | KMacK | 312 | 13 | 58 | 68.3% |
| 10 | Andjelo | 310 | 18 | 52 | 67.3% |

IrinaF won by 6 points over GameChanger. Fun observation: smacthat (rank 8) had the highest accuracy of anyone in the top 10 (73.7%) but the fewest points, which means they got the direction right often but the score wrong.

## Group highlights

Largest groups by member count:

| Group | Code | Members |
|---|---|---|
| DTOS Group World Cup 2026 | FC0DIQ | 96 |
| EPSRC World Cup 2026 Prediction League | LA4TQH | 57 |
| DTOS Corporate League WC 2026 | Y6VMXL | 39 |
| FLEXPORT WC 2026 | JQHGRJ | 35 |
| AIC World Cup 2026 | F26THJ | 29 |

Notable: the top groups are corporate leagues, not friend groups. Not the crowd I built this for, but the crowd that ran with it.

Polla Mundial (14 members, code W5CJ63): Hanah Velez
Benji Campeon (9 active): Luis Perez/Dad

## Final match

Spain 1-0 Argentina. Regulation-time win, no penalties.

- Total picks for the final: 492
- Predicted winner correctly: 332 (67.5%)
- Predicted exact score (Spain 1-0): 29 (5.9%)

The 29 who called the exact score with the correct winner scored 18 points on this match alone (5 base + 1 advancement bonus, × 3 FINAL multiplier).

## AI briefs and summaries

- Pre-match briefs generated: 91 of 104 matches (87.5%)
- Post-match summaries generated: 104 of 104 (100%)
- 13 matches missing briefs, likely early group stage matches where the briefs script wasn't yet firing, or matches where the API call failed and wasn't retried
- Users opted into AI briefs: 1,221 of 1,320 (92.5%)
- Users opted out: 99 (7.5%)

92.5% opt-in is a strong signal that the AI feature landed. Given the total spend was ~$5.62 USD for the feature, that's genuinely great value.

## Community

- Ko-fi tips received: $45

## Retention notes

Unique daily pickers tracked the tournament shape closely: high during group stage (peak 888 on day 2), plateaued through knockouts, dropped noticeably after quarterfinals.

| Phase | Approx daily unique pickers |
|---|---|
| Group stage (11-27 June) | 800-880 |
| Late group + Last 32 (28 June to 2 July) | 640-690 |
| Last 16 (3-7 July) | 620-700 |
| Quarterfinals (9-12 July) | 560-640 |
| Semifinals + third place (14-18 July) | 430-575 |
| Final (19 July) | 492 |

Two things worth noting:

- The drop from ~800 group-stage pickers to ~490 for the final is meaningful (~40% drop). Tournament fatigue, or people's teams losing and disengaging, or both.
- Despite that, 492 people picked the final. That's still a real audience for a solo-built app that ran for six weeks.

## What worked that surprised me

The feedback about opening the scores post each game starting and the added stats within each game component

## What didn't work that surprised me

The AI briefs content and predictions were not as good, perhaps more trial and error around the prompt would've helped. 