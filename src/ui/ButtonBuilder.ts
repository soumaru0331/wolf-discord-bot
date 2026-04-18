import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import type { Player } from '../types';

export function buildJoinLeaveButtons(): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('join_game')
      .setLabel('参加')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('leave_game')
      .setLabel('辞退')
      .setStyle(ButtonStyle.Secondary)
  );
}

export function buildStartButton(): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('start_game')
      .setLabel('ゲーム開始')
      .setStyle(ButtonStyle.Success)
  );
}

export function buildVoteButtons(
  candidates: Player[],
  voterId: string
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  const chunks = chunkArray(candidates, 5);

  for (const chunk of chunks) {
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      ...chunk.map(p =>
        new ButtonBuilder()
          .setCustomId(`vote_${p.userId}`)
          .setLabel(`<@${p.userId}>`)
          .setStyle(ButtonStyle.Danger)
          .setDisabled(p.userId === voterId)
      )
    );
    rows.push(row);
  }
  return rows;
}

export function buildNightActionButtons(
  targets: Player[],
  label: string
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  const chunks = chunkArray(targets, 5);

  for (const chunk of chunks) {
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      ...chunk.map(p =>
        new ButtonBuilder()
          .setCustomId(`night_${p.userId}`)
          .setLabel(`@${p.userId}`)
          .setStyle(ButtonStyle.Primary)
      )
    );
    rows.push(row);
  }
  return rows;
}

export function buildAdminButtons(): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_force_end')
      .setLabel('強制終了')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('admin_force_vote')
      .setLabel('投票強制終了')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('admin_force_night')
      .setLabel('夜強制終了')
      .setStyle(ButtonStyle.Secondary)
  );
}

export function buildSpectateButton(): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('spectate_join')
      .setLabel('観戦する')
      .setStyle(ButtonStyle.Secondary)
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
