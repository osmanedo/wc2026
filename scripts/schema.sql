-- 1 Teams table for sports metadata
CREATE TABLE teams (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  flag_url VARCHAR(255),
  group_name VARCHAR(50) NOT NULL,
  confederation VARCHAR(50) NOT NULL
);

-- 2 Store Soccer Match Results
CREATE TABLE matches (
  id INT PRIMARY KEY,
  home_team_id INT NOT NULL,
  away_team_id INT,
  kickoff_utc TIMESTAMPTZ,
  stage VARCHAR(50) NOT NULL,
  home_score INT,
  away_score INT,
  status VARCHAR(50) NOT NULL,
 CONSTRAINT fk_home_team
  FOREIGN KEY (home_team_id)
  REFERENCES teams(id),
   CONSTRAINT fk_away_team
  FOREIGN KEY (away_team_id)
  REFERENCES teams(id)
);

-- 3 User Profile Table with Avatar metadata
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  display_name TEXT,
  avatar_url VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
CONSTRAINT fk_profiles
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE
 );

-- 4 User Match Picks Table
CREATE TABLE picks (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  match_id INT NOT NULL,
  pick_home INT,
  pick_away INT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  points_earned INT,
  CONSTRAINT fk_user_id
  FOREIGN KEY (user_id)
  REFERENCES profiles(id),
  CONSTRAINT fk_match_id
  FOREIGN KEY (match_id)
  REFERENCES matches(id),
  CONSTRAINT unique_pick
  UNIQUE (user_id, match_id)
 );

 -- 5 Leaderboard table
 CREATE TABLE leaderboard(
  user_id UUID PRIMARY KEY,
  total_points INT DEFAULT 0,
  exact_scores INT DEFAULT 0,
  correct_results INT DEFAULT 0,
  rank INT,
  CONSTRAINT fk_leaderboard_id
  FOREIGN KEY (user_id)
  REFERENCES profiles(id)
 );

 -- 6 Store AI Match Briefs
 CREATE TABLE ai_briefs(
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL,
  pre_match_brief TEXT,
  post_match_summary TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_ai_briefs_id
  FOREIGN KEY (match_id)
  REFERENCES matches(id),
  CONSTRAINT unique_brief
  UNIQUE (match_id)
 );

 -- 7 Orphan Team IDs from Matches
SELECT DISTINCT away_team_id 
FROM matches 
WHERE away_team_id NOT IN (SELECT id FROM teams)
UNION
SELECT DISTINCT home_team_id 
FROM matches 
WHERE home_team_id NOT IN (SELECT id FROM teams);

- 8 Teams Records Insertion
INSERT INTO teams (id, name) VALUES
(798, 'Czechia'),
(1060, 'Bosnia-Herzegovina'),
(803, 'Turkey'),
(792, 'Sweden');

-- 9 Add Group Name to Matches
ALTER TABLE matches ADD COLUMN group_name TEXT;

-- 10 Clear All Match Records (testing)
DELETE FROM matches;

-- 11 Sync team group names in matches
UPDATE teams
SET group_name = m.group_name
FROM (
    SELECT DISTINCT home_team_id AS team_id, group_name
    FROM matches
    WHERE group_name IS NOT NULL
    UNION
    SELECT DISTINCT away_team_id AS team_id, group_name
    FROM matches
    WHERE group_name IS NOT NULL
) m
WHERE teams.id = m.team_id;

-- 12 Enable Public Read Access to Teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read teams"
ON teams
FOR SELECT
USING (true);

-- 13 Enable Public Read Access to Matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read matches"
ON matches
FOR SELECT
USING (true);

-- 14 Sync New Auth Users to Profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 15 Sync ExistingAuth Users to Profiles 
INSERT INTO profiles (id, display_name)
SELECT id, email FROM auth.users;

-- 16 Determine Match Outcome
CREATE OR REPLACE FUNCTION get_result(home INT, away INT)
RETURNS TEXT AS $$
BEGIN
  IF home > away THEN RETURN 'HOME';
  ELSIF away > home THEN RETURN 'AWAY';
  ELSE RETURN 'DRAW';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 17 Calculate Points for a Pick
CREATE OR REPLACE FUNCTION calculate_points(match_id_input INT)
RETURNS VOID AS $$
DECLARE
  match_row matches%ROWTYPE;
  actual_result TEXT;
  predicted_result TEXT;
  base_points INT;
  multiplier INT;
  pick_row picks%ROWTYPE;
BEGIN
  -- Get the match
  SELECT * INTO match_row FROM matches WHERE id = match_id_input;

  -- Get actual result
  actual_result := get_result(match_row.home_score, match_row.away_score);

  -- Get multiplier
  IF match_row.stage = 'FINAL' THEN multiplier := 3;
  ELSIF match_row.stage IN ('LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS') THEN multiplier := 2;
  ELSE multiplier := 1;
  END IF;

  -- Loop through every pick for this match
  FOR pick_row IN SELECT * FROM picks WHERE match_id = match_id_input LOOP
    predicted_result := get_result(pick_row.pick_home, pick_row.pick_away);

    -- Calculate base points
    IF pick_row.pick_home = match_row.home_score AND 
       pick_row.pick_away = match_row.away_score THEN
      base_points := 5;
    ELSIF predicted_result = actual_result THEN
      base_points := 2;
    ELSE
      base_points := 0;
    END IF;

    -- Update the pick
    UPDATE picks 
    SET points_earned = base_points * multiplier
    WHERE id = pick_row.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 18 Update Match Results (Testing)
-- Pick any group stage match ID from your matches table
-- Update the first match to have a result
UPDATE matches 
SET home_score = 2, away_score = 1, status = 'FINISHED'
WHERE id = 537327;

SELECT calculate_points(537327);

SELECT p.*, m.home_score, m.away_score 
FROM picks p
JOIN matches m ON m.id = p.match_id
WHERE p.match_id = 537327;

-- 19 Enable secure reads on Leaderboard table
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read leaderboard"
ON leaderboard FOR SELECT
USING (true);