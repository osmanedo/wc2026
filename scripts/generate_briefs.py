"""
generate_briefs.py
Generates pre-match AI briefs for WC2026 matches using Claude API.

Each brief is grounded in two sources:
  1. Actual tournament form for both teams, pulled from the matches table
  2. Recent news (past 7 days) via Claude's native web_search tool —
     injuries, lineup hints, manager quotes, off-field drama

The web_search tool is server-side at Anthropic, billed at $10/1000 searches
plus token costs for the results. Capped at 2 searches per match via max_uses.

Usage:
  python generate_briefs.py --all              # All matches without a brief
  python generate_briefs.py --scheduled        # Matches within 60hrs, no brief yet
  python generate_briefs.py --refresh          # Regenerate briefs for upcoming matches
  python generate_briefs.py --refresh 12 45    # Regenerate specific match IDs only
"""

import os
import sys
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client
import anthropic

# Ensure UTF-8 output on Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# ── Load env ────────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent / ".env", override=True)
load_dotenv(Path(__file__).parent.parent / ".env", override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# ── CLI args ────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Generate WC2026 pre-match briefs")
group = parser.add_mutually_exclusive_group(required=True)
group.add_argument("--all", action="store_true",
                   help="Generate briefs for all matches missing one")
group.add_argument("--scheduled", action="store_true",
                   help="Matches within 60 hours without a brief")
group.add_argument("--refresh", nargs="*", type=int, metavar="MATCH_ID",
                   help="Regenerate briefs. No IDs = all upcoming matches, or pass specific IDs")

args = parser.parse_args()

# ── Match selection ─────────────────────────────────────────────────
SELECT_FIELDS = (
    "id, kickoff_utc, stage, home_team_id, away_team_id, "
    "home_team:teams!home_team_id(name), "
    "away_team:teams!away_team_id(name)"
)


def get_briefed_ids():
    """Return a set of match_ids that already have a pre_match_brief."""
    existing = (
        supabase.table("ai_briefs")
        .select("match_id")
        .not_.is_("pre_match_brief", "null")
        .execute()
    )
    return {row["match_id"] for row in existing.data}


def get_matches():
    """Return list of matches to generate briefs for, based on CLI mode."""

    # ── --refresh ───────────────────────────────────────────────────
    if args.refresh is not None:
        if len(args.refresh) > 0:
            matches = (
                supabase.table("matches")
                .select(SELECT_FIELDS)
                .in_("id", args.refresh)
                .execute()
            ).data
            print(f"Refresh mode: {len(matches)} specific match(es)")
            return matches

        # No IDs = refresh upcoming matches only.
        # Past matches don't get any new context, so refreshing them burns API calls for no signal.
        now = datetime.now(timezone.utc)
        matches = (
            supabase.table("matches")
            .select(SELECT_FIELDS)
            .gte("kickoff_utc", now.isoformat())
            .execute()
        ).data
        print(f"Refresh mode: regenerating {len(matches)} upcoming match(es)")
        return matches

    # ── --scheduled / --all skip existing briefs ────────────────────
    briefed_ids = get_briefed_ids()

    if args.scheduled:
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(hours=60)
        matches = (
            supabase.table("matches")
            .select(SELECT_FIELDS)
            .gte("kickoff_utc", now.isoformat())
            .lte("kickoff_utc", cutoff.isoformat())
            .execute()
        ).data
        matches = [m for m in matches if m["id"] not in briefed_ids]
        print(f"Scheduled mode: {len(matches)} match(es) within 60hrs need briefs")
        return matches

    if args.all:
        matches = (
            supabase.table("matches")
            .select(SELECT_FIELDS)
            .execute()
        ).data
        matches = [m for m in matches if m["id"] not in briefed_ids]
        print(f"All mode: {len(matches)} match(es) need briefs")
        return matches

    return []


# ── Form fetch & format ─────────────────────────────────────────────
def get_team_form(team_id, before_kickoff):
    """Return prior FINISHED matches for this team before given kickoff, oldest first."""
    return (
        supabase.table("matches")
        .select(
            "kickoff_utc, stage, home_score, away_score, "
            "home_team_id, away_team_id, "
            "home_team:teams!home_team_id(name), "
            "away_team:teams!away_team_id(name)"
        )
        .eq("status", "FINISHED")
        .lt("kickoff_utc", before_kickoff)
        .or_(f"home_team_id.eq.{team_id},away_team_id.eq.{team_id}")
        .order("kickoff_utc")
        .execute()
    ).data


def format_form(team_name, team_id, prior_matches):
    """Format prior matches into a one-line form string from this team's perspective."""
    parts = []
    for m in prior_matches:
        if m["home_score"] is None or m["away_score"] is None:
            continue
        if m["home_team_id"] == team_id:
            opp = m["away_team"]["name"]
            gs, gc = m["home_score"], m["away_score"]
        else:
            opp = m["home_team"]["name"]
            gs, gc = m["away_score"], m["home_score"]
        result = "W" if gs > gc else ("L" if gs < gc else "D")
        parts.append(f"{result} {gs}-{gc} vs {opp}")

    if not parts:
        return f"{team_name}: yet to play in this tournament."
    return f"{team_name}: " + " | ".join(parts)


# ── Prompt ──────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a sharp, opinionated football pundit and fan writing pre-match takes \
for the FIFA World Cup 2026. Your audience is a group chat of mates, not a newspaper.

Hard rules:
- Stay under 125 words. Two or three short paragraphs.
- Plain text only. No markdown, no asterisks, no bold, no italics, no headers, no bullets, no dashes as list markers. Flowing prose only.
- Be opinionated. Pick a narrative, back a side, take a swing.
- Ground every call in the form data AND any current news you find via web search. \
If a key player is injured, say so. If a manager is under pressure, weave it in. If a team's morale is shot, use it.
- Your predicted scoreline must reflect the actual form and current news, not a safe default. \
Avoid 2-1 unless the evidence genuinely points there. 3-0 demolitions and 1-1 grinds both happen — take a risk on the score.
- End with a sharp tip and a cheeky nod to the underdog if one fits.

Web search behavior:
- For every match, run 1 to 2 web searches for recent news from the past 7 days about each team: \
injuries, lineups, form, manager comments, off-field drama. Skip historical fixtures and old transfer rumours.
- Search silently. Don't write any preamble like "Let me look up..." or "Based on my search..." — \
just perform the searches and write only the final brief as your response.
- Don't cite sources or name outlets in the brief. Blend insights naturally into prose — group chat, not a press conference.
- If searches return nothing useful, proceed with form data alone. Don't invent news."""


def build_user_prompt(match, home_form, away_form):
    home = match["home_team"]["name"]
    away = match["away_team"]["name"]
    stage = match["stage"]
    kickoff = match["kickoff_utc"]

    return f"""Write a punchy pre-match brief for this World Cup fixture:

{home} vs {away} | {stage} | Kickoff (UTC): {kickoff}

Form so far in this tournament:
{home_form}
{away_form}

In plain prose, cover: the vibe and what's at stake, a line on the form above and any head-to-head \
history you know, one or two key players per side (informed by current news on injuries or form), \
predicted odds as percentages (home win / draw / away win), and your specific predicted scoreline backed \
by both the form and the news. End with a sharp tip — sneak in a cheeky nod to the underdog if there is one."""


def generate_brief(match, home_form, away_form):
    """Call Claude API with web search enabled and return the brief text."""
    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,  # bumped from 400: web search tool blocks count toward output budget
        system=SYSTEM_PROMPT,
        tools=[{
            "type": "web_search_20250305",
            "name": "web_search",
            "max_uses": 2,  # cap per match — controls cost and latency
        }],
        messages=[
            {"role": "user", "content": build_user_prompt(match, home_form, away_form)}
        ],
    )

    # Log web search usage for trial visibility / cost monitoring
    try:
        n = response.usage.server_tool_use.web_search_requests
        if n:
            print(f"  (web searches used: {n})")
    except (AttributeError, TypeError):
        pass

    # When web search runs, response.content is a mix of text + tool blocks.
    # Concatenate all text blocks — the system prompt suppresses preamble so this is the brief.
    text_parts = [b.text for b in response.content if b.type == "text"]
    return "".join(text_parts).strip()


# ── Main ────────────────────────────────────────────────────────────
matches = get_matches()

if not matches:
    print("No matches to process. Done!")
else:
    success = 0
    failed = 0

    for match in matches:
        home = match["home_team"]["name"]
        away = match["away_team"]["name"]
        print(f"Generating AI brief for {home} vs {away}...")

        try:
            home_prior = get_team_form(match["home_team_id"], match["kickoff_utc"])
            away_prior = get_team_form(match["away_team_id"], match["kickoff_utc"])
            home_form = format_form(home, match["home_team_id"], home_prior)
            away_form = format_form(away, match["away_team_id"], away_prior)

            brief_text = generate_brief(match, home_form, away_form)

            supabase.table("ai_briefs").upsert({
                "match_id": match["id"],
                "pre_match_brief": brief_text,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="match_id").execute()

            print(f"  ✓ Stored brief for {home} vs {away}")
            success += 1

        except Exception as e:
            print(f"  ✗ Error for {home} vs {away}: {e}")
            failed += 1

    print(f"\nDone! ✓ {success} generated, ✗ {failed} failed")