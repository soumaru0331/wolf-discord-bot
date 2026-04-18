import { GameSession } from '../src/game/GameSession';
import type { GameSettings } from '../src/types';

jest.mock('../src/db/Database', () => ({
  upsertPlayer: jest.fn(),
  updatePlayer: jest.fn(),
  updateGameState: jest.fn(),
  updateGamePhase: jest.fn(),
}));

const defaultSettings: GameSettings = {
  dayDuration: 300,
  nightDuration: 120,
  voteDuration: 60,
  maxRevotes: 2,
  tieDeath: 'random',
  anonymousVote: false,
  revealRoleOnDeath: true,
};

function makeSession(): GameSession {
  return new GameSession(1, 'guild1', 'channel1', defaultSettings);
}

describe('GameSession', () => {
  test('addPlayer adds to map', () => {
    const session = makeSession();
    session.addPlayer('u1');
    expect(session.players.has('u1')).toBe(true);
  });

  test('addPlayer ignores duplicates', () => {
    const session = makeSession();
    session.addPlayer('u1');
    session.addPlayer('u1');
    expect(session.players.size).toBe(1);
  });

  test('assignRole sets roleId', () => {
    const session = makeSession();
    session.addPlayer('u1');
    session.assignRole('u1', 'villager');
    expect(session.players.get('u1')?.roleId).toBe('villager');
  });

  test('startGame sets state to playing', () => {
    const session = makeSession();
    session.addPlayer('u1');
    session.addPlayer('u2');
    session.startGame();
    expect(session.state).toBe('playing');
    expect(session.day).toBe(0);
  });

  test('killPlayer sets isAlive false', () => {
    const session = makeSession();
    session.addPlayer('u1');
    session.killPlayer('u1', 'night');
    expect(session.players.get('u1')?.isAlive).toBe(false);
  });

  test('getAlivePlayers filters dead', () => {
    const session = makeSession();
    session.addPlayer('u1');
    session.addPlayer('u2');
    session.killPlayer('u1', 'night');
    expect(session.getAlivePlayers()).toHaveLength(1);
    expect(session.getAlivePlayers()[0].userId).toBe('u2');
  });

  test('checkWin with no werewolves returns village win', () => {
    const session = makeSession();
    session.addPlayer('u1');
    session.addPlayer('u2');
    session.assignRole('u1', 'villager');
    session.assignRole('u2', 'werewolf');
    session.killPlayer('u2', 'executed');
    const result = session.checkWin();
    expect(result.winner).toBe('village');
  });
});
