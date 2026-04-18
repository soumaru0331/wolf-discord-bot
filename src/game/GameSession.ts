import type { Player, GameSettings, GameState, PhaseType, NightAction } from '../types';
import { VoteEngine } from './VoteEngine';
import { NightEngine } from './NightEngine';
import { checkWin, type WinResult } from './WinChecker';
import { getTeam, hasNightAction, getNightPriority } from '../roles/RoleHandler';
import * as db from '../db/Database';
import logger from '../utils/logger';

export class GameSession {
  readonly gameId: number;
  readonly guildId: string;
  readonly channelId: string;
  settings: GameSettings;
  state: GameState = 'waiting';
  phase: PhaseType = 'day';
  day = 0;
  players: Map<string, Player> = new Map();
  lovers: [string, string] | null = null;
  voteEngine: VoteEngine;
  nightEngine: NightEngine = new NightEngine();
  lastExecuted: string | null = null;

  constructor(gameId: number, guildId: string, channelId: string, settings: GameSettings) {
    this.gameId = gameId;
    this.guildId = guildId;
    this.channelId = channelId;
    this.settings = settings;
    this.voteEngine = this.makeVoteEngine();
  }

  private makeVoteEngine(): VoteEngine {
    const weights = new Map(
      Array.from(this.players.values()).map(p => [p.userId, p.voteWeight])
    );
    return new VoteEngine(weights, this.settings.maxRevotes, this.settings.tieDeath);
  }

  addPlayer(userId: string): void {
    if (this.players.has(userId)) return;
    this.players.set(userId, {
      userId,
      roleId: '',
      isAlive: true,
      isProtected: false,
      isCursed: false,
      voteWeight: 1,
      isBlocked: false,
    });
    db.upsertPlayer(this.gameId, userId);
  }

  removePlayer(userId: string): void {
    this.players.delete(userId);
  }

  assignRole(userId: string, roleId: string): void {
    const player = this.players.get(userId);
    if (!player) throw new Error(`Player ${userId} not found`);
    player.roleId = roleId;
    db.updatePlayer(this.gameId, userId, { role_id: roleId });
  }

  getAlivePlayers(): Player[] {
    return Array.from(this.players.values()).filter(p => p.isAlive);
  }

  getAliveWerewolves(): Player[] {
    return this.getAlivePlayers().filter(p => getTeam(p.roleId) === 'werewolf');
  }

  startGame(): void {
    this.state = 'playing';
    this.day = 0;
    this.phase = 'day';
    db.updateGameState(this.gameId, 'playing');
    db.updateGamePhase(this.gameId, 'day', 0);
    this.voteEngine = this.makeVoteEngine();
    logger.info(`Game ${this.gameId} started in guild ${this.guildId}`);
  }

  checkWin(justExecuted?: string): WinResult {
    return checkWin(Array.from(this.players.values()), this.lovers, justExecuted);
  }

  endGame(): void {
    this.state = 'ended';
    db.updateGameState(this.gameId, 'ended');
  }

  killPlayer(userId: string, cause: string): void {
    const player = this.players.get(userId);
    if (!player) return;
    player.isAlive = false;
    player.deathCause = cause;
    player.deathPhase = this.day;
    db.updatePlayer(this.gameId, userId, {
      is_alive: 0,
      death_cause: cause,
      death_phase: this.day,
    });
  }

  whoNeedsToAct(): string[] {
    return this.getAlivePlayers()
      .filter(p => hasNightAction(p.roleId))
      .filter(p => !this.nightEngine.hasSubmitted(p.userId))
      .map(p => p.userId);
  }

  submitNightAction(userId: string): void {
    const player = this.players.get(userId);
    if (!player || !player.isAlive) return;
    const priority = getNightPriority(player.roleId);
  }

  refreshVoteEngine(): void {
    this.voteEngine = this.makeVoteEngine();
  }
}
