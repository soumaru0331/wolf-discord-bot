import { getRole, getAllRoles, getRolesByTeam, isWerewolfTeam, getTeam, hasNightAction } from '../src/roles/RoleHandler';

describe('RoleHandler', () => {
  test('getRole returns correct role', () => {
    const role = getRole('villager');
    expect(role.id).toBe('villager');
    expect(role.team).toBe('village');
  });

  test('getRole throws for unknown role', () => {
    expect(() => getRole('unknown_role')).toThrow('Unknown role: unknown_role');
  });

  test('getAllRoles returns all defined roles', () => {
    const roles = getAllRoles();
    expect(roles.length).toBeGreaterThanOrEqual(20);
  });

  test('getRolesByTeam filters correctly', () => {
    const werewolves = getRolesByTeam('werewolf');
    expect(werewolves.every(r => r.team === 'werewolf')).toBe(true);
    expect(werewolves.length).toBeGreaterThanOrEqual(1);
  });

  test('isWerewolfTeam returns true for werewolf', () => {
    expect(isWerewolfTeam('werewolf')).toBe(true);
  });

  test('isWerewolfTeam returns false for village', () => {
    expect(isWerewolfTeam('villager')).toBe(false);
  });

  test('getTeam returns fox for fox role', () => {
    expect(getTeam('fox')).toBe('fox');
  });

  test('hasNightAction true for seer', () => {
    expect(hasNightAction('seer')).toBe(true);
  });

  test('hasNightAction false for villager', () => {
    expect(hasNightAction('villager')).toBe(false);
  });
});
