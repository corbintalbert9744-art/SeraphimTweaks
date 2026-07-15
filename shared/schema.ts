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

/** Auth / account */
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
