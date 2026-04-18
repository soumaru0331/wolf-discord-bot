import type { ChatInputCommandInteraction } from 'discord.js';
import type { GameManager } from '../game/GameManager';
import { buildWaitingEmbed, buildPlayerListEmbed } from '../ui/EmbedBuilder';
import { buildJoinLeaveButtons, buildStartButton } from '../ui/ButtonBuilder';
import { setBotClient } from './phaseHandler';
import logger from '../utils/logger';

export async function handleWolf(
  interaction: ChatInputCommandInteraction,
  manager: GameManager
): Promise<void> {
  const guildId = interaction.guildId!;
  const channelId = interaction.channelId;

  setBotClient(interaction.client);

  if (manager.hasActiveGame(guildId)) {
    await interaction.reply({ content: '既にゲームが進行中です。', ephemeral: true });
    return;
  }

  const session = manager.createGame(guildId, channelId);
  session.addPlayer(interaction.user.id);

  const embed = buildWaitingEmbed(session);
  const joinRow = buildJoinLeaveButtons();
  const startRow = buildStartButton();

  await interaction.reply({
    embeds: [embed],
    components: [joinRow, startRow],
  });

  logger.info(`Wolf game created in guild ${guildId} by ${interaction.user.id}`);
}
