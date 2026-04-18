import rolesData from './roles.json';
import type { RoleDef, Team, EffectType } from '../types';

const rolesMap = new Map<string, RoleDef>(
  (rolesData as RoleDef[]).map(r => [r.id, r])
);

export function getRole(id: string): RoleDef {
  const role = rolesMap.get(id);
  if (!role) throw new Error(`Unknown role: ${id}`);
  return role;
}

export function getAllRoles(): RoleDef[] {
  return Array.from(rolesMap.values());
}

export function getRolesByTeam(team: Team): RoleDef[] {
  return getAllRoles().filter(r => r.team === team);
}

export function isWerewolfTeam(roleId: string): boolean {
  return getRole(roleId).team === 'werewolf';
}

export function getTeam(roleId: string): Team {
  return getRole(roleId).team;
}

export function getEffect(roleId: string): EffectType {
  return getRole(roleId).effect;
}

export function hasNightAction(roleId: string): boolean {
  const role = getRole(roleId);
  return role.timing === 'night' && role.hasTarget;
}

export function getNightPriority(roleId: string): number {
  return getRole(roleId).priority;
}
