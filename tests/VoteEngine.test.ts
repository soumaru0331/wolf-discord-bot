import { VoteEngine } from '../src/game/VoteEngine';

function makeEngine(tieDeath: 'random' | 'no_execute' | 'all_execute' = 'random', maxRevotes = 2) {
  const weights = new Map([['u1', 1], ['u2', 1], ['u3', 1], ['u4', 1]]);
  return new VoteEngine(weights, maxRevotes, tieDeath);
}

describe('VoteEngine', () => {
  test('cast and tally votes', () => {
    const engine = makeEngine();
    engine.castVote('u1', 'u3');
    engine.castVote('u2', 'u3');
    engine.castVote('u4', 'u2');
    const results = engine.tally();
    expect(results[0].targetId).toBe('u3');
    expect(results[0].count).toBe(2);
  });

  test('overwrite existing vote', () => {
    const engine = makeEngine();
    engine.castVote('u1', 'u3');
    engine.castVote('u1', 'u2');
    const results = engine.tally();
    expect(results.find(r => r.targetId === 'u3')).toBeUndefined();
    expect(results.find(r => r.targetId === 'u2')?.count).toBe(1);
  });

  test('resolve clears winner', () => {
    const engine = makeEngine();
    engine.castVote('u1', 'u3');
    engine.castVote('u2', 'u3');
    engine.castVote('u4', 'u2');
    const result = engine.resolve();
    expect(result.executed).toBe('u3');
    expect(result.isTie).toBe(false);
  });

  test('resolve tie with no_execute returns null', () => {
    const engine = makeEngine('no_execute');
    engine.castVote('u1', 'u3');
    engine.castVote('u2', 'u4');
    const result = engine.resolve();
    expect(result.executed).toBeNull();
    expect(result.isTie).toBe(true);
    expect(result.tied).toContain('u3');
    expect(result.tied).toContain('u4');
  });

  test('resolve tie with all_execute returns tied list', () => {
    const engine = makeEngine('all_execute');
    engine.castVote('u1', 'u3');
    engine.castVote('u2', 'u4');
    const result = engine.resolve();
    expect(result.isTie).toBe(true);
    expect(result.tied.length).toBe(2);
  });

  test('allVoted returns true when everyone voted', () => {
    const engine = makeEngine();
    engine.castVote('u1', 'u2');
    engine.castVote('u2', 'u1');
    engine.castVote('u3', 'u1');
    engine.castVote('u4', 'u1');
    expect(engine.allVoted(['u1', 'u2', 'u3', 'u4'])).toBe(true);
  });

  test('allVoted returns false when someone has not voted', () => {
    const engine = makeEngine();
    engine.castVote('u1', 'u2');
    expect(engine.allVoted(['u1', 'u2', 'u3'])).toBe(false);
  });

  test('canRevote respects maxRevotes', () => {
    const engine = makeEngine('random', 1);
    expect(engine.canRevote()).toBe(true);
    engine.startRevote(['u3', 'u4']);
    expect(engine.canRevote()).toBe(false);
  });

  test('vote weight applied correctly', () => {
    const weights = new Map([['u1', 2], ['u2', 1]]);
    const engine = new VoteEngine(weights, 2, 'random');
    engine.castVote('u1', 'u3');
    engine.castVote('u2', 'u4');
    const results = engine.tally();
    expect(results.find(r => r.targetId === 'u3')?.count).toBe(2);
    expect(results.find(r => r.targetId === 'u4')?.count).toBe(1);
  });
});
