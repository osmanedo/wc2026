--ai_briefs
create table public.ai_briefs (
  id serial not null,
  match_id integer not null,
  pre_match_brief text null,
  post_match_summary text null,
  generated_at timestamp with time zone null default now(),
  constraint ai_briefs_pkey primary key (id),
  constraint unique_brief unique (match_id),
  constraint fk_ai_briefs_id foreign KEY (match_id) references matches (id)
) TABLESPACE pg_default;

--group_members
create table public.group_members (
  id serial not null,
  group_id integer not null,
  user_id uuid null,
  joined_at timestamp with time zone null default now(),
  constraint group_members_pkey primary key (id),
  constraint unique_groups unique (group_id, user_id),
  constraint fk_group_id foreign KEY (group_id) references groups (id),
  constraint fk_profile_id foreign KEY (user_id) references profiles (id)
) TABLESPACE pg_default;

--groups
create table public.groups (
  id serial not null,
  name text not null,
  code text not null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  constraint groups_pkey primary key (id),
  constraint groups_code_key unique (code),
  constraint fk_created_by foreign KEY (created_by) references profiles (id)
) TABLESPACE pg_default;

--matches
create table public.groups (
  id serial not null,
  name text not null,
  code text not null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  constraint groups_pkey primary key (id),
  constraint groups_code_key unique (code),
  constraint fk_created_by foreign KEY (created_by) references profiles (id)
) TABLESPACE pg_default;

--picks
create table public.matches (
  id integer not null,
  home_team_id integer not null,
  away_team_id integer null,
  kickoff_utc timestamp with time zone null,
  stage character varying(50) not null,
  home_score integer null,
  away_score integer null,
  status character varying(50) not null,
  group_name text null,
  winner text null,
  home_penalties integer null,
  away_penalties integer null,
  constraint matches_pkey primary key (id),
  constraint fk_away_team foreign KEY (away_team_id) references teams (id),
  constraint fk_home_team foreign KEY (home_team_id) references teams (id)
) TABLESPACE pg_default;

--profiles
create table public.profiles (
  id uuid not null,
  display_name text null,
  avatar_url character varying(255) null,
  created_at timestamp with time zone null default now(),
  show_ai_briefs boolean not null default true,
  constraint profiles_pkey primary key (id),
  constraint fk_profiles foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

-- teams
create table public.profiles (
  id uuid not null,
  display_name text null,
  avatar_url character varying(255) null,
  created_at timestamp with time zone null default now(),
  show_ai_briefs boolean not null default true,
  constraint profiles_pkey primary key (id),
  constraint fk_profiles foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;