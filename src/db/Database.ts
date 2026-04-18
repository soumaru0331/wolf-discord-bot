import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import logger from '../utils/logger';
import type { GameState, PhaseType, GameSettings, PlayerRow } from '../types';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'wolf.db');

let db: BetterSqlite3.Database;

export function getDb(): BetterSqlite3.Database {
  if (!db) {
    db = new BetterSqlite3(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    logger.info(`Database opened at ${DB_PATH}`);
  }
  return db;
}

function initSchema(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'waiting',
      settings TEXT NOT NULL DEFAULT '{}',
      phase TEXT NOT NULL DEFAULT 'day',
      day INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS players (
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL DEFAULT '',
      is_alive INTEGER NOT NULL DEFAULT 1,
      is_protected INTEGER NOT NULL DEFAULT 0,
      is_cursed INTEGER NOT NULL DEFAULT 0,
      vote_weight INTEGER NOT NULL DEFAULT 1,
      is_blocked INTEGER NOT NULL DEFAULT 0,
      death_phase INTEGER,
      death_cause TEXT,
      PRIMARY KEY (game_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS game_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT
    );
  `);
}

export function createGame(guildId: string, channelId: string, settings: GameSettings): number {
  const stmt = getDb().prepare(
    `INSERT INTO games (guild_id, channel_id, settings) VALUES (?, ?, ?)`
  );
  const result = stmt.run(guildId, channelId, JSON.stringify(settings));
  return result.lastInsertRowid as number;
}

export function getActiveGame(guildId: string): { id: number; channel_id: string; state: GameState; settings: string; phase: PhaseType; day: number } | undefined {
  return getDb()
    .prepare(`SELECT * FROM games WHERE guild_id = ? AND state != 'ended' ORDER BY id DESC LIMIT 1`)
    .get(guildId) as any;
}

export function updateGameState(gameId: number, state: GameState): void {
  getDb()
    .prepare(`UPDATE games SET state = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(state, gameId);
}

export function updateGamePhase(gameId: number, phase: PhaseType, day: number): void {
  getDb()
    .prepare(`UPDATE games SET phase = ?, day = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(phase, day, gameId);
}

export function updateGameSettings(gameId: number, settings: GameSettings): void {
  getDb()
    .prepare(`UPDATE games SET settings = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(settings), gameId);
}

export function upsertPlayer(gameId: number, userId: string): void {
  getDb()
    .prepare(`INSERT OR IGNORE INTO players (game_id, user_id) VALUES (?, ?)`)
    .run(gameId, userId);
}

export function getPlayers(gameId: number): PlayerRow[] {
  return getDb()
    .prepare(`SELECT * FROM players WHERE game_id = ?`)
    .all(gameId) as PlayerRow[];
}

export function updatePlayer(gameId: number, userId: string, fields: Partial<Omit<PlayerRow, 'game_id' | 'user_id'>>): void {
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(fields), gameId, userId];
  getDb()
    .prepare(`UPDATE players SET ${sets} WHERE game_id = ? AND user_id = ?`)
    .run(...values);
}

export function insertLog(gameId: number, level: string, message: string, data?: unknown): void {
  getDb()
    .prepare(`INSERT INTO game_logs (game_id, level, message, data) VALUES (?, ?, ?, ?)`)
    .run(gameId, level, message, data ? JSON.stringify(data) : null);
}

export function getGameLogs(gameId: number, limit = 100): { timestamp: string; level: string; message: string; data: string | null }[] {
  return getDb()
    .prepare(`SELECT timestamp, level, message, data FROM game_logs WHERE game_id = ? ORDER BY id DESC LIMIT ?`)
    .all(gameId, limit) as any[];
}
