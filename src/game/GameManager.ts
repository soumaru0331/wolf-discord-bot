import { GameSession } from './GameSession';
import { PhaseEngine, type PhaseChangeCallback } from './PhaseEngine';
import type { GameSettings } from '../types';
import * as db from '../db/Database';
import defaults from '../../config/defaults.json';
import logger from '../utils/logger';

interface ManagedSession {
  session: GameSession;
  phase: PhaseEngine;
}

export class GameManager {
  private sessions = new Map<string, ManagedSession>();
  private readonly callback: PhaseChangeCallback;

  constructor(callback: PhaseChangeCallback) {
    this.callback = callback;
  }

  getSession(guildId: string): GameSession | undefined {
    return this.sessions.get(guildId)?.session;
  }

  hasActiveGame(guildId: string): boolean {
    const session = this.getSession(guildId);
    return session !== undefined && session.state !== 'ended';
  }

  createGame(guildId: string, channelId: string, overrides: Partial<GameSettings> = {}): GameSession {
    if (this.hasActiveGame(guildId)) {
      throw new Error('このサーバーでは既にゲームが進行中です');
    }

    const settings: GameSettings = { ...(defaults as GameSettings), ...overrides };
    const gameId = db.createGame(guildId, channelId, settings);
    const session = new GameSession(gameId, guildId, channelId, settings);
    const phase = new PhaseEngine(this.callback);
    this.sessions.set(guildId, { session, phase });
    logger.info(`GameManager: created game ${gameId} for guild ${guildId}`);
    return session;
  }

  getPhaseEngine(guildId: string): PhaseEngine | undefined {
    return this.sessions.get(guildId)?.phase;
  }

  endGame(guildId: string): void {
    const managed = this.sessions.get(guildId);
    if (!managed) return;
    managed.phase.stop();
    managed.session.endGame();
    this.sessions.delete(guildId);
    logger.info(`GameManager: ended game for guild ${guildId}`);
  }

  restoreFromDb(): void {
    // Restore any active sessions from DB on bot restart
    // For now, mark any non-ended games as ended (safe restart)
    // Full session restore would require re-reading all player rows
    logger.info('GameManager: skipping session restore (clean restart)');
  }

  getAllSessions(): GameSession[] {
    return Array.from(this.sessions.values()).map(m => m.session);
  }
}
