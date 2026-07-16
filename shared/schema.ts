import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/** Auth / account + Stripe membership */
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  /** Stripe */
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  membershipStatus: text("membership_status").notNull().default("inactive"),
  plan: text("plan"),
  billingInterval: text("billing_interval"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teams = pgTable(
  "teams",
  {
    id: varchar("id").primaryKey(),
    league: text("league").notNull(),
    abbreviation: text("abbreviation").notNull(),
    name: text("name").notNull(),
    city: text("city"),
    logoUrl: text("logo_url"),
    provider: text("provider").default("espn"),
    externalId: text("external_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("teams_league_abbr_idx").on(t.league, t.abbreviation)],
);

export const players = pgTable(
  "players",
  {
    id: varchar("id").primaryKey(),
    league: text("league").notNull(),
    teamId: varchar("team_id").references(() => teams.id),
    fullName: text("full_name").notNull(),
    shortName: text("short_name"),
    position: text("position"),
    jersey: text("jersey"),
    headshotUrl: text("headshot_url"),
    provider: text("provider").default("espn"),
    externalId: text("external_id"),
    active: boolean("active").default(true).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("players_league_idx").on(t.league),
    index("players_team_idx").on(t.teamId),
    uniqueIndex("players_provider_ext_idx").on(t.provider, t.externalId),
  ],
);

export const games = pgTable(
  "games",
  {
    id: varchar("id").primaryKey(),
    league: text("league").notNull(),
    season: text("season"),
    tipoffAt: timestamp("tipoff_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    homeTeamId: varchar("home_team_id").references(() => teams.id),
    awayTeamId: varchar("away_team_id").references(() => teams.id),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    venue: text("venue"),
    provider: text("provider").default("espn"),
    externalId: text("external_id"),
    raw: jsonb("raw"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("games_league_tipoff_idx").on(t.league, t.tipoffAt),
    uniqueIndex("games_provider_ext_idx").on(t.provider, t.externalId),
  ],
);

export const sportsbooks = pgTable("sportsbooks", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  active: boolean("active").default(true).notNull(),
});

export const props = pgTable(
  "props",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    league: text("league").notNull(),
    gameId: varchar("game_id").references(() => games.id),
    playerId: varchar("player_id").references(() => players.id),
    market: text("market").notNull(),
    side: text("side").notNull(),
    line: real("line").notNull(),
    status: text("status").default("open").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("props_league_idx").on(t.league),
    index("props_player_idx").on(t.playerId),
    index("props_game_idx").on(t.gameId),
  ],
);

export const odds = pgTable(
  "odds",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    propId: varchar("prop_id")
      .references(() => props.id)
      .notNull(),
    sportsbookId: varchar("sportsbook_id")
      .references(() => sportsbooks.id)
      .notNull(),
    americanOdds: integer("american_odds").notNull(),
    line: real("line").notNull(),
    impliedProb: real("implied_prob"),
    provider: text("provider").default("mock"),
    isMock: boolean("is_mock").default(false).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("odds_prop_book_idx").on(t.propId, t.sportsbookId)],
);

export const playerGameLogs = pgTable(
  "player_game_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    playerId: varchar("player_id")
      .references(() => players.id)
      .notNull(),
    gameId: varchar("game_id").references(() => games.id),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    opponent: text("opponent"),
    home: boolean("home"),
    minutes: real("minutes"),
    points: real("points"),
    rebounds: real("rebounds"),
    assists: real("assists"),
    threes: real("threes"),
    steals: real("steals"),
    blocks: real("blocks"),
    raw: jsonb("raw"),
  },
  (t) => [index("pgl_player_played_idx").on(t.playerId, t.playedAt)],
);

export const injuries = pgTable(
  "injuries",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    playerId: varchar("player_id").references(() => players.id),
    teamId: varchar("team_id").references(() => teams.id),
    league: text("league").notNull(),
    status: text("status").notNull(),
    detail: text("detail"),
    reportedAt: timestamp("reported_at", { withTimezone: true }).defaultNow().notNull(),
    provider: text("provider").default("espn"),
  },
  (t) => [index("injuries_league_idx").on(t.league)],
);

export const savedParlays = pgTable("saved_parlays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  title: text("title"),
  legs: jsonb("legs").notNull(),
  avgHitRate: real("avg_hit_rate"),
  combinedEv: real("combined_ev"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Team defensive / pace rankings for matchup analysis (warehouse). */
export const teamStats = pgTable(
  "team_stats",
  {
    id: varchar("id").primaryKey(),
    teamId: varchar("team_id")
      .references(() => teams.id)
      .notNull(),
    league: text("league").notNull(),
    season: text("season").notNull(),
    statKey: text("stat_key").notNull(),
    statValue: real("stat_value").notNull(),
    rank: integer("rank"),
    provider: text("provider").default("derived"),
    isMock: boolean("is_mock").default(false).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("team_stats_unique").on(t.teamId, t.season, t.statKey)],
);

/** Cached prop analytics — recalculated by the data-platform scheduler. */
export const propAnalytics = pgTable(
  "prop_analytics",
  {
    id: varchar("id").primaryKey(),
    propId: varchar("prop_id")
      .references(() => props.id)
      .notNull()
      .unique(),
    league: text("league").notNull(),
    l5Hits: integer("l5_hits"),
    l5Samples: integer("l5_samples"),
    l5Rate: real("l5_rate"),
    l10Hits: integer("l10_hits"),
    l10Samples: integer("l10_samples"),
    l10Rate: real("l10_rate"),
    l20Hits: integer("l20_hits"),
    l20Samples: integer("l20_samples"),
    l20Rate: real("l20_rate"),
    seasonHits: integer("season_hits"),
    seasonSamples: integer("season_samples"),
    seasonRate: real("season_rate"),
    homeRate: real("home_rate"),
    awayRate: real("away_rate"),
    restDays: integer("rest_days"),
    streak: integer("streak"),
    noVigProb: real("no_vig_prob"),
    evPercent: real("ev_percent"),
    researchScore: integer("research_score"),
    confidenceScore: integer("confidence_score"),
    dataQualityScore: integer("data_quality_score"),
    /** Seraphim model-native prediction fields (rule-based engine) */
    projectedValue: real("projected_value"),
    overProbability: real("over_probability"),
    underProbability: real("under_probability"),
    comparisonLine: real("comparison_line"),
    edgeVsLine: real("edge_vs_line"),
    residualSigma: real("residual_sigma"),
    modelVersion: text("model_version"),
    factorBreakdown: jsonb("factor_breakdown"),
    influentialFactors: jsonb("influential_factors"),
    matchupNote: text("matchup_note"),
    explainBullets: jsonb("explain_bullets"),
    whyPayload: jsonb("why_payload"),
    checks: jsonb("checks"),
    isModelEstimate: boolean("is_model_estimate").default(true).notNull(),
    oddsAreMock: boolean("odds_are_mock").default(false).notNull(),
    disclaimer: text("disclaimer"),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("prop_analytics_league_score_idx").on(t.league, t.researchScore)],
);

export const lineSnapshots = pgTable(
  "line_snapshots",
  {
    id: varchar("id").primaryKey(),
    propId: varchar("prop_id")
      .references(() => props.id)
      .notNull(),
    line: real("line").notNull(),
    americanOdds: integer("american_odds"),
    source: text("source").default("derived"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("line_snap_prop_idx").on(t.propId, t.capturedAt)],
);

export const providerRuns = pgTable("provider_runs", {
  id: varchar("id").primaryKey(),
  provider: text("provider").notNull(),
  league: text("league").notNull(),
  job: text("job").notNull(),
  status: text("status").notNull(),
  rowsWritten: integer("rows_written").default(0).notNull(),
  message: text("message"),
  isMock: boolean("is_mock").default(false).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/** Legacy insert helper kept for existing MemStorage */
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  passwordHash: true,
  displayName: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Prop = typeof props.$inferSelect;
export type OddsRow = typeof odds.$inferSelect;
export type PlayerGameLog = typeof playerGameLogs.$inferSelect;
export type Injury = typeof injuries.$inferSelect;
export type SavedParlay = typeof savedParlays.$inferSelect;
