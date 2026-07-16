/**
 * Seraphim Analytics — canonical PostgreSQL schema (Drizzle ORM).
 *
 * Covers: users, subscriptions, sports, teams, players, games,
 * player game logs, player props, sportsbook/pick'em lines,
 * model projections (research + confidence scores), injuries,
 * saved parlays, alerts, and provider audit runs.
 *
 * Python SQLAlchemy models in data-platform/app/db/models.py stay aligned.
 * Apply with: npm run db:push  OR  psql $DATABASE_URL -f migrations/0001_seraphim_full_schema.sql
 */
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

/* -------------------------------------------------------------------------- */
/* Auth / membership                                                          */
/* -------------------------------------------------------------------------- */

/** Application users (email/password + Stripe linkage). */
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  role: text("role").notNull().default("member"), // member | admin | owner
  stripeCustomerId: text("stripe_customer_id"),
  /** Denormalized active subscription snapshot (source of truth: subscriptions). */
  stripeSubscriptionId: text("stripe_subscription_id"),
  membershipStatus: text("membership_status").notNull().default("inactive"), // inactive | active | past_due | canceled | trialing
  plan: text("plan"), // standard | pro
  billingInterval: text("billing_interval"), // monthly | yearly
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Stripe / membership subscription history (one user may have many rows over time). */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    plan: text("plan").notNull(), // standard | pro
    billingInterval: text("billing_interval").notNull(), // monthly | yearly
    status: text("status").notNull().default("inactive"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("subscriptions_user_idx").on(t.userId),
    index("subscriptions_status_idx").on(t.status),
    uniqueIndex("subscriptions_stripe_sub_idx").on(t.stripeSubscriptionId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Sports catalog                                                             */
/* -------------------------------------------------------------------------- */

/** Supported leagues / sports (NBA first; NFL, ATP, WTA, WNBA next). */
export const sports = pgTable("sports", {
  code: varchar("code", { length: 16 }).primaryKey(), // NBA | NFL | WNBA | ATP | WTA | MLB
  name: text("name").notNull(),
  category: text("category").notNull(), // basketball | football | tennis | baseball
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const teams = pgTable(
  "teams",
  {
    id: varchar("id").primaryKey(),
    league: text("league").notNull(), // FK soft → sports.code
    abbreviation: text("abbreviation").notNull(),
    name: text("name").notNull(),
    city: text("city"),
    logoUrl: text("logo_url"),
    provider: text("provider").default("espn"),
    externalId: text("external_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("teams_league_abbr_idx").on(t.league, t.abbreviation),
    index("teams_league_idx").on(t.league),
  ],
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

/* -------------------------------------------------------------------------- */
/* Stats / injuries                                                           */
/* -------------------------------------------------------------------------- */

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
    /** Flexible metrics (tennis, NFL snaps, etc.) */
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
  (t) => [
    index("injuries_league_idx").on(t.league),
    index("injuries_player_idx").on(t.playerId),
  ],
);

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

/* -------------------------------------------------------------------------- */
/* Props / lines / projections                                                */
/* -------------------------------------------------------------------------- */

/** Sportsbooks and fantasy pick'em operators. */
export const sportsbooks = pgTable("sportsbooks", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  /** sportsbook | pickem */
  kind: text("kind").notNull().default("sportsbook"),
  provider: text("provider").default("manual"),
  active: boolean("active").default(true).notNull(),
});

/**
 * Player prop market row (one market/side/line consensus for a player+game).
 * Model recommendation side lives here; detailed projection in prop_analytics.
 */
export const props = pgTable(
  "props",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    league: text("league").notNull(),
    gameId: varchar("game_id").references(() => games.id),
    playerId: varchar("player_id").references(() => players.id),
    market: text("market").notNull(), // Points | Rebounds | Assists | …
    side: text("side").notNull(), // Over | Under (model recommendation)
    line: real("line").notNull(), // consensus / comparison line
    status: text("status").default("open").notNull(), // open | locked | graded | void
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("props_league_idx").on(t.league),
    index("props_player_idx").on(t.playerId),
    index("props_game_idx").on(t.gameId),
    index("props_status_idx").on(t.status),
  ],
);

/** Sportsbook / pick'em lines (comparison only — not our model). */
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
    /** Over | Under — null for pick'em entry lines */
    side: text("side"),
    americanOdds: integer("american_odds").notNull(),
    line: real("line").notNull(),
    impliedProb: real("implied_prob"),
    provider: text("provider").default("mock"),
    isMock: boolean("is_mock").default(false).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("odds_prop_book_idx").on(t.propId, t.sportsbookId),
    index("odds_captured_idx").on(t.capturedAt),
  ],
);

/**
 * Model projections + research / confidence scores for a prop.
 * Source of truth for Seraphim projected value (independent of sportsbooks).
 */
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
    /** Checklist-backed Research Score 0–100 */
    researchScore: integer("research_score"),
    /** Model Confidence Score 0–100 */
    confidenceScore: integer("confidence_score"),
    dataQualityScore: integer("data_quality_score"),
    /** Seraphim projected stat value */
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
  (t) => [
    index("prop_analytics_league_score_idx").on(t.league, t.researchScore),
    index("prop_analytics_confidence_idx").on(t.confidenceScore),
    index("prop_analytics_edge_idx").on(t.edgeVsLine),
  ],
);

/** Historical line ticks for movement charts. */
export const lineSnapshots = pgTable(
  "line_snapshots",
  {
    id: varchar("id").primaryKey(),
    propId: varchar("prop_id")
      .references(() => props.id)
      .notNull(),
    sportsbookId: varchar("sportsbook_id").references(() => sportsbooks.id),
    line: real("line").notNull(),
    americanOdds: integer("american_odds"),
    source: text("source").default("derived"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("line_snap_prop_idx").on(t.propId, t.capturedAt)],
);

/* -------------------------------------------------------------------------- */
/* User research artifacts                                                    */
/* -------------------------------------------------------------------------- */

export const savedParlays = pgTable(
  "saved_parlays",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title"),
    /** Full slip snapshot for fast reload (mirrors legs table). */
    legs: jsonb("legs").notNull(),
    avgHitRate: real("avg_hit_rate"),
    combinedEv: real("combined_ev"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("saved_parlays_user_idx").on(t.userId)],
);

/** Normalized parlay legs (optional join for analytics / grading). */
export const savedParlayLegs = pgTable(
  "saved_parlay_legs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    parlayId: varchar("parlay_id")
      .references(() => savedParlays.id, { onDelete: "cascade" })
      .notNull(),
    propId: varchar("prop_id").references(() => props.id),
    league: text("league"),
    player: text("player"),
    market: text("market"),
    side: text("side"),
    line: real("line"),
    americanOdds: integer("american_odds"),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (t) => [index("saved_parlay_legs_parlay_idx").on(t.parlayId)],
);

export const alerts = pgTable(
  "alerts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    propId: varchar("prop_id").references(() => props.id),
    kind: text("kind").notNull(), // line_move | injury | edge | custom
    threshold: real("threshold"),
    active: boolean("active").default(true).notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("alerts_user_idx").on(t.userId)],
);

/* -------------------------------------------------------------------------- */
/* Ops                                                                        */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Types / inserts                                                            */
/* -------------------------------------------------------------------------- */

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  passwordHash: true,
  displayName: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Sport = typeof sports.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Prop = typeof props.$inferSelect;
export type OddsRow = typeof odds.$inferSelect;
export type PlayerGameLog = typeof playerGameLogs.$inferSelect;
export type Injury = typeof injuries.$inferSelect;
export type PropAnalytics = typeof propAnalytics.$inferSelect;
export type SavedParlay = typeof savedParlays.$inferSelect;
export type SavedParlayLeg = typeof savedParlayLegs.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
