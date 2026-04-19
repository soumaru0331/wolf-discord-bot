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
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('cancel_game')
      .setLabel('ゲームをキャンセル')
      .setStyle(ButtonStyle.Danger)
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

export function buildSetupButtons(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('setup_wolf_add').setLabel('🐺 人狼+1').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('setup_wolf_remove').setLabel('🐺 人狼-1').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_toggle_seer').setLabel('占い師').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup_toggle_hunter').setLabel('狩人').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup_toggle_medium').setLabel('霊能者').setStyle(ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('setup_toggle_madman').setLabel('狂人').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_toggle_fox').setLabel('妖狐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_toggle_witch').setLabel('魔女').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_toggle_nekomata').setLabel('猫又').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_toggle_tanner').setLabel('処刑人').setStyle(ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('setup_day_add').setLabel('☀️+60s').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_day_remove').setLabel('☀️-60s').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_night_add').setLabel('🌙+30s').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_night_remove').setLabel('🌙-30s').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_vote_toggle').setLabel('🗳 投票±15s').setStyle(ButtonStyle.Secondary),
  );
  const row4 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('setup_back').setLabel('← 戻る').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_confirm').setLabel('✅ 確定してスタート').setStyle(ButtonStyle.Success),
  );
  return [row1, row2, row3, row4];
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
