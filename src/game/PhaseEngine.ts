import type { GameSession } from './GameSession';
import { GameTimer } from '../utils/timer';
import { checkWin } from './WinChecker';
import * as db from '../db/Database';
import logger from '../utils/logger';

export type PhaseChangeCallback = (session: GameSession, event: PhaseEvent) => Promise<void>;

export type PhaseEvent =
  | { type: 'day_start'; day: number }
  | { type: 'vote_start'; day: number }
  | { type: 'vote_end'; executed: string | null; isTie: boolean; tied: string[] }
  | { type: 'night_start'; day: number }
  | { type: 'night_end'; killed: string[]; notifications: Map<string, string> }
  | { type: 'game_end'; winner: string; reason: string };

export class PhaseEngine {
  private timer = new GameTimer();
  private readonly callback: PhaseChangeCallback;

  constructor(callback: PhaseChangeCallback) {
    this.callback = callback;
  }

  async startDay(session: GameSession): Promise<void> {
    session.day++;
    session.phase = 'day';
    db.updateGamePhase(session.gameId, 'day', session.day);
    logger.info(`Game ${session.gameId} day ${session.day} started`);

    await this.callback(session, { type: 'day_start', day: session.day });

    // First day has no vote — discussion only
    if (session.day === 1) {
      this.timer.schedule(session.settings.dayDuration * 1000, () => this.startNight(session));
      return;
    }

    this.timer.schedule(session.settings.dayDuration * 1000, () => this.startVote(session));
  }

  async startVote(session: GameSession): Promise<void> {
    session.voteEngine.reset();
    session.refreshVoteEngine();
    await this.callback(session, { type: 'vote_start', day: session.day });
    this.timer.schedule(session.settings.voteDuration * 1000, () => this.resolveVote(session));
  }

  async resolveVote(session: GameSession): Promise<void> {
    this.timer.clear();
    const { executed, isTie, tied } = session.voteEngine.resolve();

    if (isTie && session.voteEngine.canRevote() && session.settings.tieDeath === 'random') {
      session.voteEngine.startRevote(tied);
      await this.callback(session, { type: 'vote_end', executed: null, isTie: true, tied });
      this.timer.schedule(session.settings.voteDuration * 1000, () => this.resolveVote(session));
      return;
    }

    if (executed) {
      session.killPlayer(executed, 'executed');
      session.lastExecuted = executed;
    }

    await this.callback(session, { type: 'vote_end', executed, isTie, tied });

    const winResult = session.checkWin(executed ?? undefined);
    if (winResult.winner !== null) {
      await this.endGame(session, winResult.winner as string, (winResult as any).reason);
      return;
    }

    await this.startNight(session);
  }

  async startNight(session: GameSession): Promise<void> {
    session.phase = 'night';
    session.nightEngine.reset();
    db.updateGamePhase(session.gameId, 'night', session.day);
    logger.info(`Game ${session.gameId} night ${session.day} started`);

    await this.callback(session, { type: 'night_start', day: session.day });
    this.timer.schedule(session.settings.nightDuration * 1000, () => this.resolveNight(session));
  }

  async resolveNight(session: GameSession): Promise<void> {
    this.timer.clear();
    const result = session.nightEngine.process(session.players);

    for (const userId of result.killed) {
      session.killPlayer(userId, 'night');
    }

    await this.callback(session, { type: 'night_end', killed: result.killed, notifications: result.notifications });

    const winResult = session.checkWin();
    if (winResult.winner !== null) {
      await this.endGame(session, winResult.winner as string, (winResult as any).reason);
      return;
    }

    await this.startDay(session);
  }

  async skipToNight(session: GameSession): Promise<void> {
    this.timer.clear();
    await this.startNight(session);
  }

  async endGame(session: GameSession, winner: string, reason: string): Promise<void> {
    this.timer.clear();
    session.endGame();
    await this.callback(session, { type: 'game_end', winner, reason });
  }

  forceResolveVote(session: GameSession): Promise<void> {
    this.timer.clear();
    return this.resolveVote(session);
  }

  forceResolveNight(session: GameSession): Promise<void> {
    this.timer.clear();
    return this.resolveNight(session);
  }

  stop(): void {
    this.timer.clear();
  }
}
