import type { ChatInputCommandInteraction } from 'discord.js';
import type { GameManager } from '../game/GameManager';
import { buildPlayerListEmbed } from '../ui/EmbedBuilder';

export async function handleWolfSpectate(
  interaction: ChatInputCommandInteraction,
  manager: GameManager
): Promise<void> {
  const guildId = interaction.guildId!;
  const session = manager.getSession(guildId);

  if (!session || session.state === 'waiting') {
    await interaction.reply({ content: '観戦できるゲームがありません。', ephemeral: true });
    return;
  }

  const embed = buildPlayerListEmbed(session, false);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
