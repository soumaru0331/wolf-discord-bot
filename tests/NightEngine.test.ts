import { NightEngine } from '../src/game/NightEngine';
import type { Player } from '../src/types';

function makePlayer(userId: string, roleId: string, isAlive = true): Player {
  return { userId, roleId, isAlive, isProtected: false, isCursed: false, voteWeight: 1, isBlocked: false };
}

function makeMap(players: Player[]): Map<string, Player> {
  return new Map(players.map(p => [p.userId, p]));
}

describe('NightEngine', () => {
  test('werewolf kills unprotected target', () => {
    const engine = new NightEngine();
    const players = makeMap([
      makePlayer('wolf', 'werewolf'),
      makePlayer('victim', 'villager'),
    ]);
    engine.submitAction({ actorId: 'wolf', targetId: 'victim', roleId: 'werewolf', priority: 3 });
    const result = engine.process(players);
    expect(result.killed).toContain('victim');
    expect(players.get('victim')?.isAlive).toBe(false);
  });

  test('hunter protects target from werewolf', () => {
    const engine = new NightEngine();
    const players = makeMap([
      makePlayer('wolf', 'werewolf'),
      makePlayer('victim', 'villager'),
      makePlayer('hunter', 'hunter'),
    ]);
    engine.submitAction({ actorId: 'hunter', targetId: 'victim', roleId: 'hunter', priority: 2 });
    engine.submitAction({ actorId: 'wolf', targetId: 'victim', roleId: 'werewolf', priority: 3 });
    const result = engine.process(players);
    expect(result.killed).not.toContain('victim');
    expect(players.get('victim')?.isAlive).toBe(true);
  });

  test('fox is immune to werewolf attack', () => {
    const engine = new NightEngine();
    const players = makeMap([
      makePlayer('wolf', 'werewolf'),
      makePlayer('fox1', 'fox'),
    ]);
    engine.submitAction({ actorId: 'wolf', targetId: 'fox1', roleId: 'werewolf', priority: 3 });
    const result = engine.process(players);
    expect(result.killed).not.toContain('fox1');
    expect(players.get('fox1')?.isAlive).toBe(true);
  });

  test('seer gets werewolf result', () => {
    const engine = new NightEngine();
    const players = makeMap([
      makePlayer('seer1', 'seer'),
      makePlayer('wolf', 'werewolf'),
    ]);
    engine.submitAction({ actorId: 'seer1', targetId: 'wolf', roleId: 'seer', priority: 1 });
    const result = engine.process(players);
    expect(result.notifications.get('seer1')).toContain('人狼');
  });

  test('seer curses and kills fox', () => {
    const engine = new NightEngine();
    const players = makeMap([
      makePlayer('seer1', 'seer'),
      makePlayer('fox1', 'fox'),
    ]);
    engine.submitAction({ actorId: 'seer1', targetId: 'fox1', roleId: 'seer', priority: 1 });
    const result = engine.process(players);
    expect(result.killed).toContain('fox1');
  });

  test('hasSubmitted returns correct state', () => {
    const engine = new NightEngine();
    expect(engine.hasSubmitted('u1')).toBe(false);
    engine.submitAction({ actorId: 'u1', targetId: 'u2', roleId: 'werewolf', priority: 3 });
    expect(engine.hasSubmitted('u1')).toBe(true);
  });

  test('overwriting action replaces previous', () => {
    const engine = new NightEngine();
    engine.submitAction({ actorId: 'u1', targetId: 'u2', roleId: 'werewolf', priority: 3 });
    engine.submitAction({ actorId: 'u1', targetId: 'u3', roleId: 'werewolf', priority: 3 });
    expect(engine.getActions()).toHaveLength(1);
    expect(engine.getActions()[0].targetId).toBe('u3');
  });
});
