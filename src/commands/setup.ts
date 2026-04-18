import type { ChatInputCommandInteraction } from 'discord.js';
import type { GameManager } from '../game/GameManager';
import type { GameSettings } from '../types';
import { updateGameSettings } from '../db/Database';

export async function handleWolfSetup(
  interaction: ChatInputCommandInteraction,
  manager: GameManager
): Promise<void> {
  const guildId = interaction.guildId!;
  const session = manager.getSession(guildId);

  if (!session || session.state !== 'waiting') {
    await interaction.reply({ content: '参加受付中のゲームがありません。', ephemeral: true });
    return;
  }

  const opts = interaction.options;
  const updates: Partial<GameSettings> = {};

  const day = opts.getInteger('day');
  if (day !== null) updates.dayDuration = day;

  const night = opts.getInteger('night');
  if (night !== null) updates.nightDuration = night;

  const vote = opts.getInteger('vote');
  if (vote !== null) updates.voteDuration = vote;

  const maxRevotes = opts.getInteger('maxrevotes');
  if (maxRevotes !== null) updates.maxRevotes = maxRevotes;

  const tieDeath = opts.getString('tiedeath') as GameSettings['tieDeath'] | null;
  if (tieDeath !== null) updates.tieDeath = tieDeath;

  const anonymous = opts.getBoolean('anonymous');
  if (anonymous !== null) updates.anonymousVote = anonymous;

  const revealRole = opts.getBoolean('revealrole');
  if (revealRole !== null) updates.revealRoleOnDeath = revealRole;

  Object.assign(session.settings, updates);
  updateGameSettings(session.gameId, session.settings);

  const lines = Object.entries(updates).map(([k, v]) => `• ${k}: ${v}`);
  await interaction.reply({
    content: `設定を更新しました:\n${lines.join('\n')}`,
    ephemeral: true,
  });
}
