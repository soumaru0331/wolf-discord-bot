import type { TextChannel, DMChannel } from 'discord.js';
import type { GameSession } from '../game/GameSession';
import type { PhaseEvent } from '../game/PhaseEngine';
import type { PhaseChangeCallback } from '../game/PhaseEngine';
import {
  buildDayEmbed,
  buildVoteEmbed,
  buildNightEmbed,
  buildNightResultEmbed,
  buildExecutionEmbed,
  buildGameEndEmbed,
  buildRoleEmbed,
  buildPlayerListEmbed,
} from '../ui/EmbedBuilder';
import { buildVoteButtons, buildNightActionButtons } from '../ui/ButtonBuilder';
import { getRole, hasNightAction } from '../roles/RoleHandler';
import { manager } from '../bot';
import logger from '../utils/logger';
import { insertLog } from '../db/Database';

let botClient: import('discord.js').Client | null = null;

export function setBotClient(client: import('discord.js').Client): void {
  botClient = client;
}

export const handlePhaseEvent: PhaseChangeCallback = async (session: GameSession, event: PhaseEvent) => {
  const client = botClient;
  if (!client) return;

  const channel = await client.channels.fetch(session.channelId).catch(() => null) as TextChannel | null;
  if (!channel) return;

  insertLog(session.gameId, 'info', event.type, event);

  switch (event.type) {
    case 'day_start': {
      const embed = buildDayEmbed(session);
      await channel.send({ embeds: [embed] });

      if (session.day === 1) {
        // Send role DMs to all players
        for (const player of session.players.values()) {
          if (!player.roleId) continue;
          const user = await client.users.fetch(player.userId).catch(() => null);
          if (user) {
            await user.send({ embeds: [buildRoleEmbed(player)] }).catch(() => {});
          }
        }
        await channel.send('📩 役職をDMで送信しました。1日目は議論のみです（投票なし）。');
      }
      break;
    }

    case 'vote_start': {
      const alive = session.getAlivePlayers();
      const embed = buildVoteEmbed(session, session.voteEngine.getRevoteCount());
      const rows = buildVoteButtons(alive, '');
      await channel.send({ embeds: [embed], components: rows });
      break;
    }

    case 'vote_end': {
      const embed = buildExecutionEmbed(event.executed, event.isTie, event.tied);
      await channel.send({ embeds: [embed] });

      if (event.executed && session.settings.revealRoleOnDeath) {
        const player = session.players.get(event.executed);
        if (player?.roleId) {
          const role = getRole(player.roleId);
          await channel.send(`<@${event.executed}> の役職は **${role.name}** でした。`);
        }
      }
      break;
    }

    case 'night_start': {
      const embed = buildNightEmbed(session);
      await channel.send({ embeds: [embed] });

      // Send night action DMs
      for (const player of session.getAlivePlayers()) {
        if (!hasNightAction(player.roleId)) continue;
        const user = await client.users.fetch(player.userId).catch(() => null);
        if (!user) continue;

        const targets = session.getAlivePlayers().filter(p => p.userId !== player.userId);
        const role = getRole(player.roleId);
        const rows = buildNightActionButtons(targets, role.name);
        await user.send({
          content: `🌙 **${role.name}** として行動を選んでください:`,
          components: rows,
        }).catch(() => {});
      }
      break;
    }

    case 'night_end': {
      const embed = buildNightResultEmbed(event.killed);
      await channel.send({ embeds: [embed] });

      if (event.killed.length > 0 && session.settings.revealRoleOnDeath) {
        for (const userId of event.killed) {
          const player = session.players.get(userId);
          if (player?.roleId) {
            const role = getRole(player.roleId);
            await channel.send(`<@${userId}> の役職は **${role.name}** でした。`);
          }
        }
      }

      // Send personal night result DMs
      for (const [userId, message] of event.notifications) {
        const user = await client.users.fetch(userId).catch(() => null);
        if (user) await user.send(message).catch(() => {});
      }
      break;
    }

    case 'game_end': {
      const embed = buildGameEndEmbed(event.winner, event.reason);
      await channel.send({ embeds: [embed] });
      const listEmbed = buildPlayerListEmbed(session, true);
      await channel.send({ embeds: [listEmbed] });
      manager.endGame(session.guildId);
      break;
    }
  }
};
