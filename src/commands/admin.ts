import type { ChatInputCommandInteraction } from 'discord.js';
import type { GameManager } from '../game/GameManager';
import { PermissionFlagsBits } from 'discord.js';

export async function handleWolfAdmin(
  interaction: ChatInputCommandInteraction,
  manager: GameManager
): Promise<void> {
  const member = interaction.member;
  const hasAdmin =
    member &&
    typeof member.permissions !== 'string' &&
    member.permissions.has(PermissionFlagsBits.ManageGuild);

  if (!hasAdmin) {
    await interaction.reply({ content: 'このコマンドは管理者のみ使用できます。', ephemeral: true });
    return;
  }

  const guildId = interaction.guildId!;
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'end': {
      if (!manager.hasActiveGame(guildId)) {
        await interaction.reply({ content: '進行中のゲームがありません。', ephemeral: true });
        return;
      }
      manager.endGame(guildId);
      await interaction.reply('ゲームを強制終了しました。');
      break;
    }

    case 'assignrole': {
      const session = manager.getSession(guildId);
      if (!session) {
        await interaction.reply({ content: '進行中のゲームがありません。', ephemeral: true });
        return;
      }
      const user = interaction.options.getUser('user', true);
      const roleId = interaction.options.getString('role', true);
      try {
        session.assignRole(user.id, roleId);
        await interaction.reply({ content: `<@${user.id}> に役職 ${roleId} を割り当てました。`, ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: `エラー: ${(err as Error).message}`, ephemeral: true });
      }
      break;
    }

    case 'forcevote': {
      const phase = manager.getPhaseEngine(guildId);
      const session = manager.getSession(guildId);
      if (!phase || !session || session.phase !== 'day') {
        await interaction.reply({ content: '投票フェーズではありません。', ephemeral: true });
        return;
      }
      await interaction.reply({ content: '投票を強制終了します。', ephemeral: true });
      await phase.forceResolveVote(session);
      break;
    }

    case 'forcenight': {
      const phase = manager.getPhaseEngine(guildId);
      const session = manager.getSession(guildId);
      if (!phase || !session || session.phase !== 'night') {
        await interaction.reply({ content: '夜フェーズではありません。', ephemeral: true });
        return;
      }
      await interaction.reply({ content: '夜を強制終了します。', ephemeral: true });
      await phase.forceResolveNight(session);
      break;
    }
  }
}
