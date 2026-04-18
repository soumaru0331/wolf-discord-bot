import type { ButtonInteraction } from 'discord.js';
import type { GameManager } from '../game/GameManager';
import { buildWaitingEmbed } from '../ui/EmbedBuilder';
import { buildJoinLeaveButtons, buildStartButton } from '../ui/ButtonBuilder';
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
    const embed = buildWaitingEmbed(session);
    await interaction.update({ embeds: [embed], components: [buildJoinLeaveButtons(), buildStartButton()] });
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

    // Assign roles randomly
    const playerIds = Array.from(session.players.keys());
    const roles = getAllRoles().filter(r => r.timing !== 'passive' || r.team === 'village' || r.team === 'werewolf');
    const shuffled = [...roles].sort(() => Math.random() - 0.5);
    // Ensure at least 1 werewolf
    const wolfRoles = shuffled.filter(r => r.team === 'werewolf');
    const otherRoles = shuffled.filter(r => r.team !== 'werewolf');
    const assigned: string[] = [];
    if (wolfRoles.length > 0) assigned.push(wolfRoles[0].id);
    for (const r of otherRoles) {
      if (assigned.length >= playerIds.length) break;
      assigned.push(r.id);
    }
    while (assigned.length < playerIds.length) assigned.push('villager');

    assigned.sort(() => Math.random() - 0.5);
    for (let i = 0; i < playerIds.length; i++) {
      session.assignRole(playerIds[i], assigned[i]);
    }

    session.startGame();
    await interaction.update({ content: 'ゲームを開始します！', components: [], embeds: [] });

    const phase = manager.getPhaseEngine(guildId);
    if (phase) await phase.startDay(session);
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
