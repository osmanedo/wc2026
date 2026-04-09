"""
generate_briefs.py
Generates pre-match AI briefs for WC2026 matches using Claude API.

Usage:
  python generate_briefs.py --all              # All matches without a brief
  python generate_briefs.py --scheduled        # Matches within 60hrs, no brief yet
  python generate_briefs.py --refresh          # Regenerate ALL briefs (overwrites)
  python generate_briefs.py --refresh 12 45    # Regenerate specific match IDs only
"""

import os
import argparse
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client
import anthropic

# ── Step 1: Load environment variables ──────────────────────────────
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# ── Step 2: Parse command-line arguments ────────────────────────────
parser = argparse.ArgumentParser(description="Generate WC2026 pre-match briefs")
group = parser.add_mutually_exclusive_group(required=True)
group.add_argument("--all", action="store_true",
                   help="Generate briefs for all matches missing one")
group.add_argument("--scheduled", action="store_true",
                   help="Matches within 60 hours without a brief")
group.add_argument("--refresh", nargs="*", type=int, metavar="MATCH_ID",
                   help="Regenerate briefs. No IDs = all, or pass specific match IDs")

args = parser.parse_args()

# ── Step 3: Fetch matches based on mode ─────────────────────────────
SELECT_FIELDS = (
    "id, kickoff_utc, stage, "
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

    # ── --refresh: regenerate (ignore existing briefs) ──────────────
    if args.refresh is not None:
        if len(args.refresh) > 0:
            # Specific match IDs
            matches = (
                supabase.table("matches")
                .select(SELECT_FIELDS)
                .in_("id", args.refresh)
                .execute()
            ).data
            print(f"Refresh mode: {len(matches)} specific match(es)")
            return matches

        # No IDs provided = refresh everything
        matches = (
            supabase.table("matches")
            .select(SELECT_FIELDS)
            .execute()
        ).data
        print(f"Refresh mode: regenerating all {len(matches)} matches")
        return matches

    # For --all and --scheduled, skip matches that already have a brief
    briefed_ids = get_briefed_ids()

    # ── --scheduled: within 60 hours, no existing brief ─────────────
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

    # ── --all: every match without a brief ──────────────────────────
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


# ── Step 4: Prompt template ─────────────────────────────────────────
SYSTEM_PROMPT = """You are a sharp football analyst writing pre-match takes \
for the FIFA World Cup 2026. Your audience is a group chat, not a newspaper.

Hard rules:
- Zero markdown. No asterisks, no bold, no italics, no headers, no bullet points, \
no dashes as list markers. Plain flowing prose only.
- Be opinionated. Pick a narrative, back a side.
- Stay under 200 words.
- Your predicted scoreline must reflect these specific teams — consider their \
defensive records, attacking output, and head-to-head history. \
Not every World Cup game ends 2-1. Vary it: 1-0, 3-2, 0-0, 1-1, 4-1 — \
whatever fits the matchup. Never default to 2-1 unless it genuinely fits."""


def build_user_prompt(match):
    """Build the per-match prompt with real data injected."""
    home = match["home_team"]["name"]
    away = match["away_team"]["name"]
    stage = match["stage"]
    kickoff = match["kickoff_utc"]

    return f"""Write a punchy pre-match brief for this World Cup fixture:

{home} vs {away} | {stage} | Kickoff (UTC): {kickoff}

In plain prose, cover: the vibe and what's at stake, a line on head-to-head history \
and recent form, one or two key players per side, predicted odds as percentages \
(home win / draw / away win), and your specific predicted scoreline. \
End with a sharp tip — but sneak in a cheeky nod to the underdog."""


def generate_brief(match):
    """Call Claude API and return the brief text."""
    response = claude.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": build_user_prompt(match)}
        ],
    )
    return response.content[0].text


# ── Step 5: Generate and store briefs ───────────────────────────────
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
            brief_text = generate_brief(match)

            # Upsert: inserts if no row for this match, updates if one exists
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