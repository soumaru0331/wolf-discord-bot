import type { ChatInputCommandInteraction } from 'discord.js';
import type { GameManager } from '../game/GameManager';
import { getGameLogs } from '../db/Database';

export async function handleWolfLogs(
  interaction: ChatInputCommandInteraction,
  manager: GameManager
): Promise<void> {
  const guildId = interaction.guildId!;
  const session = manager.getSession(guildId);

  if (!session) {
    await interaction.reply({ content: '進行中のゲームがありません。', ephemeral: true });
    return;
  }

  const limit = interaction.options.getInteger('limit') ?? 20;
  const logs = getGameLogs(session.gameId, limit);

  if (logs.length === 0) {
    await interaction.reply({ content: 'ログがありません。', ephemeral: true });
    return;
  }

  const lines = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`);
  const content = lines.join('\n');
  const truncated = content.length > 1900 ? content.slice(0, 1900) + '\n...' : content;

  await interaction.reply({
    content: `\`\`\`\n${truncated}\n\`\`\``,
    ephemeral: true,
  });
}
