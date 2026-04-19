import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import type { GameState, PhaseType, GameSettings, PlayerRow } from '../types';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'wolf.db');

let db: Database;
let SQL: SqlJsStatic;

function saveDb(): void {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export async function initDb(): Promise<void> {
  SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  initSchema();
  logger.info(`Database opened at ${DB_PATH}`);
}

function getDb(): Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

function initSchema(): void {
  getDb().run(`
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
      game_id INTEGER NOT NULL,
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
      game_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT
    );
  `);
  saveDb();
}

function queryAll<T>(sql: string, params: (string | number | null | Uint8Array)[] = []): T[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

function queryOne<T>(sql: string, params: (string | number | null | Uint8Array)[] = []): T | undefined {
  return queryAll<T>(sql, params)[0];
}

function run(sql: string, params: (string | number | null | Uint8Array)[] = []): void {
  getDb().run(sql, params);
  saveDb();
}

export function createGame(guildId: string, channelId: string, settings: GameSettings): number {
  run(`INSERT INTO games (guild_id, channel_id, settings) VALUES (?, ?, ?)`,
    [guildId, channelId, JSON.stringify(settings)]);
  const row = queryOne<{ id: number }>(`SELECT last_insert_rowid() as id`);
  return row!.id;
}

export function getActiveGame(guildId: string): { id: number; channel_id: string; state: GameState; settings: string; phase: PhaseType; day: number } | undefined {
  return queryOne(`SELECT * FROM games WHERE guild_id = ? AND state != 'ended' ORDER BY id DESC LIMIT 1`, [guildId]);
}

export function updateGameState(gameId: number, state: GameState): void {
  run(`UPDATE games SET state = ?, updated_at = datetime('now') WHERE id = ?`, [state, gameId]);
}

export function updateGamePhase(gameId: number, phase: PhaseType, day: number): void {
  run(`UPDATE games SET phase = ?, day = ?, updated_at = datetime('now') WHERE id = ?`, [phase, day, gameId]);
}

export function updateGameSettings(gameId: number, settings: GameSettings): void {
  run(`UPDATE games SET settings = ?, updated_at = datetime('now') WHERE id = ?`, [JSON.stringify(settings), gameId]);
}

export function upsertPlayer(gameId: number, userId: string): void {
  run(`INSERT OR IGNORE INTO players (game_id, user_id) VALUES (?, ?)`, [gameId, userId]);
}

export function getPlayers(gameId: number): PlayerRow[] {
  return queryAll<PlayerRow>(`SELECT * FROM players WHERE game_id = ?`, [gameId]);
}

export function updatePlayer(gameId: number, userId: string, fields: Partial<Omit<PlayerRow, 'game_id' | 'user_id'>>): void {
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(fields), gameId, userId];
  run(`UPDATE players SET ${sets} WHERE game_id = ? AND user_id = ?`, values);
}

export function insertLog(gameId: number, level: string, message: string, data?: unknown): void {
  run(`INSERT INTO game_logs (game_id, level, message, data) VALUES (?, ?, ?, ?)`,
    [gameId, level, message, data ? JSON.stringify(data) : null]);
}

export function getGameLogs(gameId: number, limit = 100): { timestamp: string; level: string; message: string; data: string | null }[] {
  return queryAll(`SELECT timestamp, level, message, data FROM game_logs WHERE game_id = ? ORDER BY id DESC LIMIT ?`, [gameId, limit]);
}
