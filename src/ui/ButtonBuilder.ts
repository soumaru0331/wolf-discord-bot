import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import type { Player } from '../types';
import { getAllRoles } from '../roles/RoleHandler';

export function buildJoinLeaveButtons(): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('join_game').setLabel('参加').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('leave_game').setLabel('辞退').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cancel_game').setLabel('ゲームをキャンセル').setStyle(ButtonStyle.Danger)
  );
}

export function buildStartButton(): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('start_game').setLabel('⚙️ 設定してスタート').setStyle(ButtonStyle.Success)
  );
}

export function buildSetupComponents(selectedRoles: Map<string, number>): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const allRoles = getAllRoles();

  const villageRoles = allRoles
    .filter(r => r.team === 'village' && r.id !== 'villager')
    .slice(0, 25);

  const wolfSideRoles = allRoles
    .filter(r => r.team === 'werewolf' && r.id !== 'werewolf')
    .slice(0, 25);

  const thirdRoles = allRoles
    .filter(r => !['village', 'werewolf'].includes(r.team))
    .slice(0, 25);

  const villageSelected = villageRoles
    .filter(r => (selectedRoles.get(r.id) ?? 0) > 0)
    .map(r => r.id);

  const wolfSideSelected = wolfSideRoles
    .filter(r => (selectedRoles.get(r.id) ?? 0) > 0)
    .map(r => r.id);

  const thirdSelected = thirdRoles
    .filter(r => (selectedRoles.get(r.id) ?? 0) > 0)
    .map(r => r.id);

  const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('setup_select_village')
      .setPlaceholder('🏡 村人陣営の特殊役職を選択（複数可）')
      .setMinValues(0)
      .setMaxValues(villageRoles.length)
      .addOptions(villageRoles.map(r => ({
        label: r.name,
        value: r.id,
        description: r.description.slice(0, 50),
        default: villageSelected.includes(r.id),
      })))
  );

  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('setup_select_wolfside')
      .setPlaceholder('🐺 人狼陣営の特殊役職を選択（複数可）')
      .setMinValues(0)
      .setMaxValues(wolfSideRoles.length)
      .addOptions(wolfSideRoles.map(r => ({
        label: r.name,
        value: r.id,
        description: r.description.slice(0, 50),
        default: wolfSideSelected.includes(r.id),
      })))
  );

  const row3 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('setup_select_third')
      .setPlaceholder('🦊 第三陣営の役職を選択（複数可）')
      .setMinValues(0)
      .setMaxValues(thirdRoles.length)
      .addOptions(thirdRoles.map(r => ({
        label: r.name,
        value: r.id,
        description: r.description.slice(0, 50),
        default: thirdSelected.includes(r.id),
      })))
  );

  const wolfCount = selectedRoles.get('werewolf') ?? 1;
  const row4 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('setup_wolf_add').setLabel(`🐺 人狼+1 (現在${wolfCount})`).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('setup_wolf_remove').setLabel('🐺 人狼-1').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_day_add').setLabel('☀️+60s').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_night_add').setLabel('🌙+30s').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_vote_toggle').setLabel('🗳 投票±15s').setStyle(ButtonStyle.Secondary),
  );

  const row5 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('setup_back').setLabel('← 戻る').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_day_remove').setLabel('☀️-60s').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_night_remove').setLabel('🌙-30s').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup_confirm').setLabel('✅ 確定してスタート').setStyle(ButtonStyle.Success),
  );

  return [row1, row2, row3, row4, row5];
}

export function buildVoteButtons(candidates: Player[], voterId: string): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  const chunks = chunkArray(candidates, 5);
  for (const chunk of chunks) {
    rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      ...chunk.map(p =>
        new ButtonBuilder()
          .setCustomId(`vote_${p.userId}`)
          .setLabel(`@${p.userId.slice(0, 10)}`)
          .setStyle(ButtonStyle.Danger)
          .setDisabled(p.userId === voterId)
      )
    ));
  }
  return rows;
}

export function buildNightActionButtons(targets: Player[], label: string): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  const chunks = chunkArray(targets, 5);
  for (const chunk of chunks) {
    rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      ...chunk.map(p =>
        new ButtonBuilder()
          .setCustomId(`night_${p.userId}`)
          .setLabel(`@${p.userId.slice(0, 10)}`)
          .setStyle(ButtonStyle.Primary)
      )
    ));
  }
  return rows;
}

export function buildAdminButtons(): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('admin_force_end').setLabel('強制終了').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('admin_force_vote').setLabel('投票強制終了').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_force_night').setLabel('夜強制終了').setStyle(ButtonStyle.Secondary)
  );
}

export function buildSpectateButton(): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('spectate_join').setLabel('観戦する').setStyle(ButtonStyle.Secondary)
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
