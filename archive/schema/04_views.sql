-- Leaderboard
create view public.leaderboard as
with
  scored_picks as (
    select
      p.user_id,
      p.id as pick_id,
      m.kickoff_utc,
      (
        case
          when p.pick_home = m.home_score
          and p.pick_away = m.away_score then 5
          when get_result (p.pick_home, p.pick_away) = get_result (m.home_score, m.away_score) then 2
          else 0
        end + case
          when m.stage::text <> 'GROUP_STAGE'::text
          and m.winner is not null
          and case
            when p.pick_home > p.pick_away then 'HOME_TEAM'::text
            when p.pick_away > p.pick_home then 'AWAY_TEAM'::text
            else p.pick_winner
          end = m.winner then 1
          else 0
        end
      ) * case
        when m.stage::text = 'FINAL'::text then 3
        when m.stage::text = any (
          array[
            'LAST_32'::text,
            'LAST_16'::text,
            'QUARTER_FINALS'::text,
            'SEMI_FINALS'::text,
            'THIRD_PLACE'::text
          ]
        ) then 2
        else 1
      end as points,
      p.pick_home = m.home_score
      and p.pick_away = m.away_score as is_exact,
      get_result (p.pick_home, p.pick_away) = get_result (m.home_score, m.away_score) as is_correct
    from
      picks p
      join matches m on m.id = p.match_id
    where
      m.home_score is not null
      and m.away_score is not null
  ),
  ranked_picks as (
    select
      sp.user_id,
      sp.pick_id,
      sp.kickoff_utc,
      sp.points,
      sp.is_exact,
      sp.is_correct,
      row_number() over (
        partition by
          sp.user_id
        order by
          sp.kickoff_utc desc,
          sp.pick_id desc
      ) as rn
    from
      scored_picks sp
  ),
  agg as (
    select
      ranked_picks.user_id,
      COALESCE(sum(ranked_picks.points), 0::bigint) as total_points,
      count(*) filter (
        where
          ranked_picks.is_exact
      ) as exact_scores,
      count(*) filter (
        where
          ranked_picks.is_correct
          and not ranked_picks.is_exact
      ) as correct_results,
      count(*) as total_finished,
      COALESCE(max(ranked_picks.points), 0) as best_single_match,
      min(ranked_picks.rn) filter (
        where
          not ranked_picks.is_correct
      ) as first_wrong_rn,
      max(ranked_picks.rn) as total_rn,
      string_agg(
        case
          when ranked_picks.is_exact then 'E'::text
          when ranked_picks.is_correct then 'W'::text
          else 'L'::text
        end,
        ''::text
        order by
          ranked_picks.rn desc
      ) filter (
        where
          ranked_picks.rn <= 10
      ) as last_5_form
    from
      ranked_picks
    group by
      ranked_picks.user_id
  )
select
  user_id,
  total_points,
  exact_scores,
  correct_results,
  case
    when total_finished > 0 then round(
      (correct_results + exact_scores)::numeric / total_finished::numeric * 100::numeric,
      1
    )
    else 0::numeric
  end as accuracy_pct,
  COALESCE(first_wrong_rn - 1, total_rn, 0::bigint) as current_streak,
  COALESCE(last_5_form, ''::text) as last_5_form,
  best_single_match
from
  agg;