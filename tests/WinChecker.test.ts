import { checkWin } from '../src/game/WinChecker';
import type { Player } from '../src/types';

function makePlayer(userId: string, roleId: string, isAlive = true): Player {
  return { userId, roleId, isAlive, isProtected: false, isCursed: false, voteWeight: 1, isBlocked: false };
}

describe('WinChecker', () => {
  test('village wins when no werewolves remain', () => {
    const players = [
      makePlayer('u1', 'villager'),
      makePlayer('u2', 'seer'),
      makePlayer('u3', 'werewolf', false),
    ];
    const result = checkWin(players, null);
    expect(result.winner).toBe('village');
  });

  test('werewolf wins when count equals villagers', () => {
    const players = [
      makePlayer('u1', 'villager'),
      makePlayer('u2', 'werewolf'),
    ];
    const result = checkWin(players, null);
    expect(result.winner).toBe('werewolf');
  });

  test('no winner when game continues', () => {
    const players = [
      makePlayer('u1', 'villager'),
      makePlayer('u2', 'villager'),
      makePlayer('u3', 'werewolf'),
    ];
    const result = checkWin(players, null);
    expect(result.winner).toBeNull();
  });

  test('fox wins when werewolves eliminated and fox alive', () => {
    const players = [
      makePlayer('u1', 'villager'),
      makePlayer('u2', 'fox'),
      makePlayer('u3', 'werewolf', false),
    ];
    const result = checkWin(players, null);
    expect(result.winner).toBe('fox');
  });

  test('tanner wins when executed', () => {
    const players = [
      makePlayer('u1', 'villager'),
      makePlayer('u2', 'tanner', false),
      makePlayer('u3', 'werewolf'),
    ];
    const result = checkWin(players, null, 'u2');
    expect(result.winner).toBe('tanner');
  });

  test('lover wins when only 2 lovers remain', () => {
    const players = [
      makePlayer('u1', 'villager'),
      makePlayer('u2', 'werewolf'),
      makePlayer('u3', 'seer', false),
    ];
    const result = checkWin(players, ['u1', 'u2']);
    expect(result.winner).toBe('lover');
  });
});
