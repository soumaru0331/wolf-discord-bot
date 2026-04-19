import type { ButtonInteraction } from 'discord.js';
import type { GameManager } from '../game/GameManager';
import { buildWaitingEmbed, buildSetupEmbed } from '../ui/EmbedBuilder';
import { buildJoinLeaveButtons, buildStartButton, buildSetupButtons } from '../ui/ButtonBuilder';
import { getAllRoles } from '../roles/RoleHandler';
import logger from '../utils/logger';

export async function handleButton(
  interaction: ButtonInteraction,
  manager: GameManager
): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const customId = interaction.customId;

  if (customId === 'join_game') {
    const session = manager.getSession(guildId);
    if (!session || session.state !== 'waiting') {
      await interaction.reply({ content: '現在参加受付中のゲームがありません。', ephemeral: true });
      return;
    }
    if (session.players.has(userId)) {
      await interaction.reply({ content: '既に参加しています。', ephemeral: true });
      return;
    }
    session.addPlayer(userId);
    const embed = buildWaitingEmbed(session);
    await interaction.update({ embeds: [embed], components: [buildJoinLeaveButtons(), buildStartButton()] });
    return;
  }

  if (customId === 'leave_game') {
    const session = manager.getSession(guildId);
    if (!session || session.state !== 'waiting') {
      await interaction.reply({ content: '参加受付中のゲームがありません。', ephemeral: true });
      return;
    }
    if (!session.players.has(userId)) {
      await interaction.reply({ content: '参加していません。', ephemeral: true });
      return;
    }
    session.removePlayer(userId);
    // 全員が抜けたら自動キャンセル
    if (session.players.size === 0) {
      manager.endGame(guildId);
      await interaction.update({ content: '参加者がいなくなったためゲームをキャンセルしました。', embeds: [], components: [] });
      return;
    }
    const embed = buildWaitingEmbed(session);
    await interaction.update({ embeds: [embed], components: [buildJoinLeaveButtons(), buildStartButton()] });
    return;
  }

  if (customId === 'cancel_game') {
    const session = manager.getSession(guildId);
    if (!session || session.state !== 'waiting') {
      await interaction.reply({ content: '参加受付中のゲームがありません。', ephemeral: true });
      return;
    }
    manager.endGame(guildId);
    await interaction.update({ content: 'ゲームをキャンセルしました。', embeds: [], components: [] });
    return;
  }

  if (customId === 'start_game') {
    const session = manager.getSession(guildId);
    if (!session || session.state !== 'waiting') {
      await interaction.reply({ content: '参加受付中のゲームがありません。', ephemeral: true });
      return;
    }
    if (session.players.size < 2) {
      await interaction.reply({ content: '最低2人必要です。', ephemeral: true });
      return;
    }
    // Initialize default composition
    if (session.roleComposition.size === 0) {
      const wolfCount = Math.max(1, Math.floor(session.players.size / 4));
      session.roleComposition.set('werewolf', wolfCount);
      session.roleComposition.set('seer', 1);
    }
    const embed = buildSetupEmbed(session);
    await interaction.update({ embeds: [embed], components: buildSetupButtons() });
    return;
  }

  // Setup screen buttons
  if (customId.startsWith('setup_')) {
    const session = manager.getSession(guildId);
    if (!session || session.state !== 'waiting') {
      await interaction.reply({ content: 'ゲームが見つかりません。', ephemeral: true });
      return;
    }

    const comp = session.roleComposition;

    if (customId === 'setup_wolf_add') {
      comp.set('werewolf', (comp.get('werewolf') ?? 1) + 1);
    } else if (customId === 'setup_wolf_remove') {
      comp.set('werewolf', Math.max(1, (comp.get('werewolf') ?? 1) - 1));
    } else if (customId.startsWith('setup_toggle_')) {
      const roleId = customId.replace('setup_toggle_', '');
      comp.set(roleId, comp.get(roleId) ? 0 : 1);
    } else if (customId === 'setup_day_add') {
      session.settings.dayDuration = Math.min(600, session.settings.dayDuration + 60);
    } else if (customId === 'setup_day_remove') {
      session.settings.dayDuration = Math.max(60, session.settings.dayDuration - 60);
    } else if (customId === 'setup_night_add') {
      session.settings.nightDuration = Math.min(300, session.settings.nightDuration + 30);
    } else if (customId === 'setup_night_remove') {
      session.settings.nightDuration = Math.max(30, session.settings.nightDuration - 30);
    } else if (customId === 'setup_vote_toggle') {
      session.settings.voteDuration = session.settings.voteDuration >= 90
        ? 30 : session.settings.voteDuration + 15;
    } else if (customId === 'setup_back') {
      const waitEmbed = buildWaitingEmbed(session);
      await interaction.update({ embeds: [waitEmbed], components: [buildJoinLeaveButtons(), buildStartButton()] });
      return;
    } else if (customId === 'setup_confirm') {
      // Build final role list
      const playerIds = Array.from(session.players.keys());
      const assigned: string[] = [];
      for (const [roleId, count] of comp) {
        if (count > 0) {
          for (let i = 0; i < count; i++) assigned.push(roleId);
        }
      }
      while (assigned.length < playerIds.length) assigned.push('villager');
      assigned.splice(playerIds.length);
      assigned.sort(() => Math.random() - 0.5);
      for (let i = 0; i < playerIds.length; i++) {
        session.assignRole(playerIds[i], assigned[i]);
      }
      session.startGame();
      await interaction.update({ content: '🐺 ゲームを開始します！', components: [], embeds: [] });
      const phase = manager.getPhaseEngine(guildId);
      if (phase) await phase.startDay(session);
      return;
    }

    // Re-render setup screen
    const embed = buildSetupEmbed(session);
    await interaction.update({ embeds: [embed], components: buildSetupButtons() });
    return;
  }

  if (customId === 'spectate_join') {
    const session = manager.getSession(guildId);
    if (!session || session.state === 'waiting') {
      await interaction.reply({ content: '観戦できるゲームがありません。', ephemeral: true });
      return;
    }
    await interaction.reply({ content: '観戦モードで参加しました。ゲームの進行をチャンネルで確認できます。', ephemeral: true });
    return;
  }

  // Vote button: vote_<userId>
  if (customId.startsWith('vote_')) {
    const targetId = customId.slice(5);
    const session = manager.getSession(guildId);
    if (!session || session.state !== 'playing' || session.phase !== 'day') {
      await interaction.reply({ content: '現在投票フェーズではありません。', ephemeral: true });
      return;
    }
    const voter = session.players.get(userId);
    if (!voter?.isAlive) {
      await interaction.reply({ content: '死亡したプレイヤーは投票できません。', ephemeral: true });
      return;
    }
    session.voteEngine.castVote(userId, targetId);
    await interaction.reply({ content: `<@${targetId}> に投票しました。`, ephemeral: true });

    const aliveIds = session.getAlivePlayers().map(p => p.userId);
    if (session.voteEngine.allVoted(aliveIds)) {
      const phase = manager.getPhaseEngine(guildId);
      if (phase) await phase.forceResolveVote(session);
    }
    return;
  }

  // Night action button: night_<userId>
  if (customId.startsWith('night_')) {
    const targetId = customId.slice(6);
    const session = manager.getSession(guildId);
    if (!session || session.state !== 'playing' || session.phase !== 'night') {
      await interaction.reply({ content: '現在夜フェーズではありません。', ephemeral: true });
      return;
    }
    const actor = session.players.get(userId);
    if (!actor?.isAlive || !actor.roleId) {
      await interaction.reply({ content: '行動できません。', ephemeral: true });
      return;
    }
    const { getNightPriority } = await import('../roles/RoleHandler');
    session.nightEngine.submitAction({
      actorId: userId,
      targetId,
      roleId: actor.roleId,
      priority: getNightPriority(actor.roleId),
    });
    await interaction.reply({ content: `行動を選択しました。`, ephemeral: true });

    const remaining = session.whoNeedsToAct();
    if (remaining.length === 0) {
      const phase = manager.getPhaseEngine(guildId);
      if (phase) await phase.forceResolveNight(session);
    }
    return;
  }

  logger.warn(`Unknown button customId: ${customId}`);
  await interaction.reply({ content: '不明なボタンです。', ephemeral: true });
}
