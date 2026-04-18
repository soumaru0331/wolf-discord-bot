import type { Player, NightAction, NightResult } from '../types';
import { getTeam, getEffect, getRole } from '../roles/RoleHandler';

export class NightEngine {
  private actions: NightAction[] = [];

  submitAction(action: NightAction): void {
    this.actions = this.actions.filter(a => a.actorId !== action.actorId);
    this.actions.push(action);
  }

  hasSubmitted(actorId: string): boolean {
    return this.actions.some(a => a.actorId === actorId);
  }

  process(players: Map<string, Player>): NightResult {
    const sorted = [...this.actions].sort((a, b) => a.priority - b.priority);
    const killed = new Set<string>();
    const notifications = new Map<string, string>();
    const protected_ = new Set<string>();

    // Stage 1: state changes (priority 1) - handled inline
    // Stage 2: defend (priority 2)
    for (const action of sorted.filter(a => a.priority === 2)) {
      const effect = getEffect(action.roleId);
      if (effect === 'protect') {
        const target = players.get(action.targetId);
        if (target?.isAlive) {
          protected_.add(action.targetId);
          notifications.set(action.actorId, `${action.targetId} を守りました`);
        }
      }
    }

    // Stage 3: attack (priority 3)
    for (const action of sorted.filter(a => a.priority === 3)) {
      const effect = getEffect(action.roleId);
      if (effect === 'kill') {
        const target = players.get(action.targetId);
        if (!target?.isAlive) continue;
        const targetTeam = getTeam(action.targetId in Object.fromEntries(players) ? players.get(action.targetId)!.roleId : '');
        const foxCheck = players.get(action.targetId);
        if (foxCheck && getTeam(foxCheck.roleId) === 'fox') {
          // Fox is immune to werewolf attacks
          continue;
        }
        if (!protected_.has(action.targetId)) {
          killed.add(action.targetId);
        }
      }
    }

    // Stage 4: judge (priority 4) — seer / reveal actions
    for (const action of sorted.filter(a => a.priority === 1)) {
      const effect = getEffect(action.roleId);
      if (effect === 'reveal_team') {
        const target = players.get(action.targetId);
        if (!target) continue;
        const targetTeam = getTeam(target.roleId);
        // cursed_wolf: seer gets cursed and dies
        if (target.roleId === 'cursed_wolf') {
          killed.add(action.actorId);
          notifications.set(action.actorId, '呪いを受けて死亡しました');
          notifications.set(action.targetId, '占い師を呪い殺しました');
        } else if (targetTeam === 'fox') {
          // Seer curses the fox
          const foxPlayer = players.get(action.targetId);
          if (foxPlayer) foxPlayer.isCursed = true;
          killed.add(action.targetId);
          notifications.set(action.actorId, `${action.targetId} は人狼ではありません（呪殺）`);
        } else {
          const isWolf = targetTeam === 'werewolf';
          notifications.set(action.actorId, `${action.targetId} は${isWolf ? '人狼' : '人狼ではありません'}`);
        }
      }
    }

    // Stage 5: death confirm — apply kills
    for (const userId of killed) {
      const player = players.get(userId);
      if (player) {
        player.isAlive = false;
        player.deathCause = 'night';
      }
    }

    // Stage 6: notify
    for (const userId of killed) {
      if (!notifications.has(userId)) {
        notifications.set(userId, '夜の間に死亡しました');
      }
    }

    this.actions = [];
    return { killed: Array.from(killed), notifications };
  }

  reset(): void {
    this.actions = [];
  }

  getActions(): NightAction[] {
    return [...this.actions];
  }
}
