import type { Player } from '../types';
import { getTeam } from '../roles/RoleHandler';

export type WinResult =
  | { winner: 'village'; reason: string }
  | { winner: 'werewolf'; reason: string }
  | { winner: 'fox'; reason: string; winnerId: string }
  | { winner: 'lover'; reason: string; winnerIds: string[] }
  | { winner: 'tanner'; reason: string; winnerId: string }
  | { winner: 'zombie'; reason: string }
  | { winner: null };

export function checkWin(
  players: Player[],
  lovers: [string, string] | null,
  justExecuted?: string
): WinResult {
  const alive = players.filter(p => p.isAlive);

  // Tanner wins if executed during day
  if (justExecuted) {
    const executedPlayer = players.find(p => p.userId === justExecuted);
    if (executedPlayer && getTeam(executedPlayer.roleId) === 'solo' && executedPlayer.roleId === 'tanner') {
      return { winner: 'tanner', reason: '処刑人が昼処刑されました', winnerId: justExecuted };
    }
  }

  const aliveWerewolves = alive.filter(p => getTeam(p.roleId) === 'werewolf');
  const aliveVillagers = alive.filter(p => getTeam(p.roleId) !== 'werewolf');
  const aliveFoxes = alive.filter(p => getTeam(p.roleId) === 'fox');

  // Lover win: lovers are the last 2 alive (takes priority)
  if (lovers) {
    const [l1, l2] = lovers;
    const loversAlive = alive.filter(p => p.userId === l1 || p.userId === l2);
    if (alive.length === 2 && loversAlive.length === 2) {
      return { winner: 'lover', reason: '恋人2人だけが残りました', winnerIds: lovers };
    }
  }

  // Fox win: fox survives when all werewolves are eliminated
  if (aliveWerewolves.length === 0 && aliveFoxes.length > 0) {
    return { winner: 'fox', reason: '妖狐が生き残りました', winnerId: aliveFoxes[0].userId };
  }

  // Werewolf win: werewolves equal or outnumber non-werewolves
  if (aliveWerewolves.length >= aliveVillagers.length && aliveWerewolves.length > 0) {
    return { winner: 'werewolf', reason: '人狼の数が村人以上になりました' };
  }

  // Village win: all werewolves eliminated (and no fox)
  if (aliveWerewolves.length === 0 && aliveFoxes.length === 0) {
    return { winner: 'village', reason: 'すべての人狼が追放されました' };
  }

  // Zombie win: all non-zombie players eliminated
  const aliveZombies = alive.filter(p => getTeam(p.roleId) === 'zombie');
  if (aliveZombies.length > 0 && alive.every(p => getTeam(p.roleId) === 'zombie')) {
    return { winner: 'zombie', reason: 'ゾンビ陣営が制圧しました' };
  }

  return { winner: null };
}
