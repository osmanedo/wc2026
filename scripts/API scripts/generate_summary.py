"""
generate_summary.py
Generates a post-match summary for a single match using Claude API.
Called by update_results.py when a match flips to FINISHED.

Reads the pre-match brief from ai_briefs (if one exists) and feeds it
into the prompt, so the summary can react directly to its prediction —
gloat if we called it, eat humble pie if we whiffed.

Can also be run standalone:
  python generate_summary.py 537327
"""

import os
import sys
import time
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client
import anthropic

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
claude = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """You are a sharp, opinionated football pundit covering the FIFA World Cup 2026 \
for a group chat of passionate fans. You've seen it all and you're not afraid to say what everyone's thinking.

Your writing rules — follow these without exception:
- Plain text only. No asterisks, no hyphens used as bullets, no pound signs, no underscores, no markdown of any kind. \
If you use any markdown symbols for formatting, you have failed.
- Write in flowing prose, not lists. No numbered points, no bullet points.
- Be direct, vivid, and a little provocative. This is a group chat, not a press conference.
- React emotionally to the result. Have a hot take. Don't sit on the fence.
- If a pre-match prediction is shown, react to it directly. Take the victory lap if we nailed it; \
eat humble pie with humour if we whiffed. The bolder our call was, the more we should eat.
- End with a memorable one-liner that stings or celebrates."""


MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds between retries


def generate_summary(match_id):
    """Fetch match data + pre-match brief, generate summary via Claude, store in ai_briefs.

    Retries up to MAX_RETRIES times on Claude API or Supabase failures,
    with a short delay between attempts.
    """

    # Get match with team names and scores
    match = (
        supabase.table("matches")
        .select(
            "id, kickoff_utc, stage, home_score, away_score, "
            "home_team:teams!home_team_id(name), "
            "away_team:teams!away_team_id(name)"
        )
        .eq("id", match_id)
        .single()
        .execute()
    ).data

    # Get the pre-match brief if one exists (may be None for early-tournament
    # summaries triggered before briefs were generated, or any edge case)
    brief_response = (
        supabase.table("ai_briefs")
        .select("pre_match_brief")
        .eq("match_id", match_id)
        .execute()
    )
    pre_match_brief = (
        brief_response.data[0]["pre_match_brief"]
        if brief_response.data and brief_response.data[0].get("pre_match_brief")
        else None
    )

    home = match["home_team"]["name"]
    away = match["away_team"]["name"]
    home_score = match["home_score"]
    away_score = match["away_score"]
    stage = match["stage"]

    # Build the brief-reference block if we have one
    if pre_match_brief:
        brief_block = (
            "\n\nHere's the pre-match brief we ran for this game:\n"
            f'"""\n{pre_match_brief}\n"""\n\n'
            "Reference our prediction directly. If the scoreline or narrative was on the money, "
            "take the victory lap with some swagger. If we got it wrong, own it with humour — "
            "the bolder our call, the more we should eat. Make the meta-narrative land."
        )
    else:
        brief_block = ""

    prompt = f"""Write a post-match summary for this World Cup 2026 game in 100 to 150 words.

{home} {home_score} - {away_score} {away} ({stage}){brief_block}

Cover what happened: was this a shock, a deserved win, or a tedious slog? Touch on the key moment \
that decided it. Say what it means for both teams from here. Give your honest hot take on the performance. \
Close with a punchy line that captures the mood.

If it was an upset, go in hard on it. If it was a dominant performance, make the loser feel it. No fence-sitting."""

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = claude.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=300,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )

            summary_text = response.content[0].text

            supabase.table("ai_briefs").upsert({
                "match_id": match_id,
                "post_match_summary": summary_text,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="match_id").execute()

            print(f"  ✓ Summary stored for {home} {home_score}-{away_score} {away}")
            return  # success — exit early

        except Exception as e:
            last_error = e
            if attempt < MAX_RETRIES:
                print(f"  ✗ Attempt {attempt}/{MAX_RETRIES} failed for match {match_id}: {e} — retrying in {RETRY_DELAY}s")
                time.sleep(RETRY_DELAY)

    # All retries exhausted — re-raise so the caller can log it
    raise RuntimeError(
        f"Failed to generate summary for match {match_id} after {MAX_RETRIES} attempts: {last_error}"
    )


# Allow standalone usage: python generate_summary.py 537327
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_summary.py <match_id>")
        sys.exit(1)

    generate_summary(int(sys.argv[1]))