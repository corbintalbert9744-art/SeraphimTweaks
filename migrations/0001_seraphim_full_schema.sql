-- Seraphim Analytics — full PostgreSQL schema
-- Migration: 0001_seraphim_full_schema
-- Apply: psql "$DATABASE_URL" -f migrations/0001_seraphim_full_schema.sql
-- Or:    npm run db:push  (Drizzle, against shared/schema.ts)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Auth / membership
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'member',
  stripe_customer_id text,
  stripe_subscription_id text,
  membership_status text NOT NULL DEFAULT 'inactive',
  plan text,
  billing_interval text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan text NOT NULL,
  billing_interval text NOT NULL,
  status text NOT NULL DEFAULT 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_sub_idx ON subscriptions(stripe_subscription_id);

-- ---------------------------------------------------------------------------
-- Sports catalog
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sports (
  code varchar(16) PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sports (code, name, category, active, sort_order) VALUES
  ('NBA', 'National Basketball Association', 'basketball', true, 1),
  ('NFL', 'National Football League', 'football', true, 2),
  ('WNBA', 'Women''s National Basketball Association', 'basketball', true, 3),
  ('ATP', 'ATP Tour', 'tennis', true, 4),
  ('WTA', 'WTA Tour', 'tennis', true, 5),
  ('MLB', 'Major League Baseball', 'baseball', false, 6)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS teams (
  id varchar PRIMARY KEY,
  league text NOT NULL,
  abbreviation text NOT NULL,
  name text NOT NULL,
  city text,
  logo_url text,
  provider text DEFAULT 'espn',
  external_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_league_abbr_idx ON teams(league, abbreviation);
CREATE INDEX IF NOT EXISTS teams_league_idx ON teams(league);

CREATE TABLE IF NOT EXISTS players (
  id varchar PRIMARY KEY,
  league text NOT NULL,
  team_id varchar REFERENCES teams(id),
  full_name text NOT NULL,
  short_name text,
  position text,
  jersey text,
  headshot_url text,
  provider text DEFAULT 'espn',
  external_id text,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS players_league_idx ON players(league);
CREATE INDEX IF NOT EXISTS players_team_idx ON players(team_id);
CREATE UNIQUE INDEX IF NOT EXISTS players_provider_ext_idx ON players(provider, external_id);

CREATE TABLE IF NOT EXISTS games (
  id varchar PRIMARY KEY,
  league text NOT NULL,
  season text,
  tipoff_at timestamptz NOT NULL,
  status text NOT NULL,
  home_team_id varchar REFERENCES teams(id),
  away_team_id varchar REFERENCES teams(id),
  home_score integer,
  away_score integer,
  venue text,
  provider text DEFAULT 'espn',
  external_id text,
  raw jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS games_league_tipoff_idx ON games(league, tipoff_at);
CREATE UNIQUE INDEX IF NOT EXISTS games_provider_ext_idx ON games(provider, external_id);

-- ---------------------------------------------------------------------------
-- Stats / injuries
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS player_game_logs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  player_id varchar NOT NULL REFERENCES players(id),
  game_id varchar REFERENCES games(id),
  played_at timestamptz NOT NULL,
  opponent text,
  home boolean,
  minutes real,
  points real,
  rebounds real,
  assists real,
  threes real,
  steals real,
  blocks real,
  raw jsonb
);
CREATE INDEX IF NOT EXISTS pgl_player_played_idx ON player_game_logs(player_id, played_at);

CREATE TABLE IF NOT EXISTS injuries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  player_id varchar REFERENCES players(id),
  team_id varchar REFERENCES teams(id),
  league text NOT NULL,
  status text NOT NULL,
  detail text,
  reported_at timestamptz NOT NULL DEFAULT now(),
  provider text DEFAULT 'espn'
);
CREATE INDEX IF NOT EXISTS injuries_league_idx ON injuries(league);
CREATE INDEX IF NOT EXISTS injuries_player_idx ON injuries(player_id);

CREATE TABLE IF NOT EXISTS team_stats (
  id varchar PRIMARY KEY,
  team_id varchar NOT NULL REFERENCES teams(id),
  league text NOT NULL,
  season text NOT NULL,
  stat_key text NOT NULL,
  stat_value real NOT NULL,
  rank integer,
  provider text DEFAULT 'derived',
  is_mock boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS team_stats_unique ON team_stats(team_id, season, stat_key);

-- ---------------------------------------------------------------------------
-- Props / lines / model projections
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sportsbooks (
  id varchar PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'sportsbook',
  provider text DEFAULT 'manual',
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS props (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  league text NOT NULL,
  game_id varchar REFERENCES games(id),
  player_id varchar REFERENCES players(id),
  market text NOT NULL,
  side text NOT NULL,
  line real NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS props_league_idx ON props(league);
CREATE INDEX IF NOT EXISTS props_player_idx ON props(player_id);
CREATE INDEX IF NOT EXISTS props_game_idx ON props(game_id);
CREATE INDEX IF NOT EXISTS props_status_idx ON props(status);

CREATE TABLE IF NOT EXISTS odds (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  prop_id varchar NOT NULL REFERENCES props(id),
  sportsbook_id varchar NOT NULL REFERENCES sportsbooks(id),
  side text,
  american_odds integer NOT NULL,
  line real NOT NULL,
  implied_prob real,
  provider text DEFAULT 'mock',
  is_mock boolean NOT NULL DEFAULT false,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS odds_prop_book_idx ON odds(prop_id, sportsbook_id);
CREATE INDEX IF NOT EXISTS odds_captured_idx ON odds(captured_at);

CREATE TABLE IF NOT EXISTS prop_analytics (
  id varchar PRIMARY KEY,
  prop_id varchar NOT NULL UNIQUE REFERENCES props(id),
  league text NOT NULL,
  l5_hits integer,
  l5_samples integer,
  l5_rate real,
  l10_hits integer,
  l10_samples integer,
  l10_rate real,
  l20_hits integer,
  l20_samples integer,
  l20_rate real,
  season_hits integer,
  season_samples integer,
  season_rate real,
  home_rate real,
  away_rate real,
  rest_days integer,
  streak integer,
  no_vig_prob real,
  ev_percent real,
  research_score integer,
  confidence_score integer,
  data_quality_score integer,
  projected_value real,
  over_probability real,
  under_probability real,
  comparison_line real,
  edge_vs_line real,
  residual_sigma real,
  model_version text,
  factor_breakdown jsonb,
  influential_factors jsonb,
  matchup_note text,
  explain_bullets jsonb,
  why_payload jsonb,
  checks jsonb,
  is_model_estimate boolean NOT NULL DEFAULT true,
  odds_are_mock boolean NOT NULL DEFAULT false,
  disclaimer text,
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prop_analytics_league_score_idx ON prop_analytics(league, research_score);
CREATE INDEX IF NOT EXISTS prop_analytics_confidence_idx ON prop_analytics(confidence_score);
CREATE INDEX IF NOT EXISTS prop_analytics_edge_idx ON prop_analytics(edge_vs_line);

CREATE TABLE IF NOT EXISTS line_snapshots (
  id varchar PRIMARY KEY,
  prop_id varchar NOT NULL REFERENCES props(id),
  sportsbook_id varchar REFERENCES sportsbooks(id),
  line real NOT NULL,
  american_odds integer,
  source text DEFAULT 'derived',
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS line_snap_prop_idx ON line_snapshots(prop_id, captured_at);

-- ---------------------------------------------------------------------------
-- User research artifacts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS saved_parlays (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text,
  legs jsonb NOT NULL,
  avg_hit_rate real,
  combined_ev real,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_parlays_user_idx ON saved_parlays(user_id);

CREATE TABLE IF NOT EXISTS saved_parlay_legs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  parlay_id varchar NOT NULL REFERENCES saved_parlays(id) ON DELETE CASCADE,
  prop_id varchar REFERENCES props(id),
  league text,
  player text,
  market text,
  side text,
  line real,
  american_odds integer,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS saved_parlay_legs_parlay_idx ON saved_parlay_legs(parlay_id);

CREATE TABLE IF NOT EXISTS alerts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prop_id varchar REFERENCES props(id),
  kind text NOT NULL,
  threshold real,
  active boolean NOT NULL DEFAULT true,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alerts_user_idx ON alerts(user_id);

-- ---------------------------------------------------------------------------
-- Ops
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS provider_runs (
  id varchar PRIMARY KEY,
  provider text NOT NULL,
  league text NOT NULL,
  job text NOT NULL,
  status text NOT NULL,
  rows_written integer NOT NULL DEFAULT 0,
  message text,
  is_mock boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- Seed common operators (sportsbooks + pick'em)
INSERT INTO sportsbooks (id, name, slug, kind, provider, active) VALUES
  ('book:draftkings', 'DraftKings', 'draftkings', 'sportsbook', 'the-odds-api', true),
  ('book:fanduel', 'FanDuel', 'fanduel', 'sportsbook', 'the-odds-api', true),
  ('book:betmgm', 'BetMGM', 'betmgm', 'sportsbook', 'the-odds-api', true),
  ('book:prizepicks', 'PrizePicks', 'prizepicks', 'pickem', 'mock-comparison-lines', true),
  ('book:underdog', 'Underdog', 'underdog', 'pickem', 'mock-comparison-lines', true),
  ('book:sleeper', 'Sleeper', 'sleeper', 'pickem', 'mock-comparison-lines', true),
  ('book:parlayplay', 'ParlayPlay', 'parlayplay', 'pickem', 'mock-comparison-lines', true)
ON CONFLICT (id) DO NOTHING;
