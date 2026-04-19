import { EmbedBuilder } from 'discord.js';
import type { GameSession } from '../game/GameSession';
import type { Player } from '../types';
import { getRole } from '../roles/RoleHandler';

export function buildWaitingEmbed(session: GameSession): EmbedBuilder {
  const playerList = Array.from(session.players.values())
    .map((p, i) => `${i + 1}. <@${p.userId}>`)
    .join('\n') || '（まだ誰もいません）';

  return new EmbedBuilder()
    .setTitle('🐺 人狼ゲーム 参加受付中')
    .setColor(0x5865f2)
    .addFields(
      { name: '参加者', value: playerList },
      { name: '人数', value: `${session.players.size}人` }
    )
    .setFooter({ text: '参加するには「参加」ボタンを押してください' });
}

export function buildSetupEmbed(session: GameSession): EmbedBuilder {
  const comp = session.roleComposition;
  const playerCount = session.players.size;

  const roleLines: string[] = [];
  let total = 0;
  for (const [roleId, count] of comp) {
    if (count <= 0) continue;
    try {
      const role = getRole(roleId);
      roleLines.push(`${role.name} × ${count}`);
      total += count;
    } catch {}
  }
  const villagerCount = playerCount - total;
  if (villagerCount > 0) roleLines.push(`村人 × ${villagerCount}`);
  if (roleLines.length === 0) roleLines.push('（未設定）');

  const wolfCount = comp.get('werewolf') ?? 0;

  return new EmbedBuilder()
    .setTitle('⚙️ ゲーム設定')
    .setColor(0x5865f2)
    .addFields(
      { name: '👥 参加者数', value: `${playerCount}人`, inline: true },
      { name: '🐺 人狼数', value: `${wolfCount}人`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '📋 役職内訳', value: roleLines.join('\n') },
      { name: '⏱ 時間設定', value: [
        `☀️ 昼の議論: **${session.settings.dayDuration}秒**`,
        `🌙 夜の行動: **${session.settings.nightDuration}秒**`,
        `🗳 投票時間: **${session.settings.voteDuration}秒**`,
      ].join('\n') },
    )
    .setFooter({ text: '設定を確認して「確定してスタート」を押してください' });
}

export function buildDayEmbed(session: GameSession): EmbedBuilder {
  const alive = session.getAlivePlayers();
  const playerList = alive.map(p => `• <@${p.userId}>`).join('\n') || '（なし）';

  return new EmbedBuilder()
    .setTitle(`☀️ ${session.day}日目 - 昼の議論`)
    .setColor(0xfee75c)
    .addFields(
      { name: '生存者', value: playerList },
      { name: '生存人数', value: `${alive.length}人` }
    );
}

export function buildVoteEmbed(session: GameSession, revoteCount: number): EmbedBuilder {
  const alive = session.getAlivePlayers();
  const playerList = alive.map(p => `• <@${p.userId}>`).join('\n') || '（なし）';
  const title = revoteCount > 0
    ? `🗳️ ${session.day}日目 - 再投票 (${revoteCount}回目)`
    : `🗳️ ${session.day}日目 - 投票`;

  return new EmbedBuilder()
    .setTitle(title)
    .setColor(0xeb459e)
    .addFields({ name: '投票対象', value: playerList })
    .setFooter({ text: '処刑する人を選んでください' });
}

export function buildNightEmbed(session: GameSession): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`🌙 ${session.day}日目の夜`)
    .setColor(0x23272a)
    .setDescription('夜になりました。各役職は行動を選んでください。\nDMを確認してください。')
    .addFields({ name: '生存者', value: `${session.getAlivePlayers().length}人` });
}

export function buildRoleEmbed(player: Player): EmbedBuilder {
  const role = getRole(player.roleId);
  return new EmbedBuilder()
    .setTitle(`あなたの役職: ${role.name}`)
    .setColor(0x57f287)
    .setDescription(role.description)
    .addFields(
      { name: '陣営', value: role.team },
      { name: '勝利条件', value: role.winCondition }
    );
}

export function buildNightResultEmbed(killed: string[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🌅 夜明け')
    .setColor(0xffa500);

  if (killed.length === 0) {
    embed.setDescription('昨夜は犠牲者がいませんでした。');
  } else {
    const killedList = killed.map(id => `• <@${id}>`).join('\n');
    embed.setDescription(`昨夜、以下のプレイヤーが死亡しました:\n${killedList}`);
  }
  return embed;
}

export function buildExecutionEmbed(executed: string | null, isTie: boolean, tied: string[]): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(0xed4245);

  if (executed === null && isTie) {
    embed
      .setTitle('⚖️ 投票結果 - 同票')
      .setDescription(`同票のため、処刑なしです。\n候補: ${tied.map(id => `<@${id}>`).join(', ')}`);
  } else if (executed) {
    embed
      .setTitle('⚖️ 投票結果')
      .setDescription(`<@${executed}> が処刑されました。`);
  } else {
    embed.setTitle('⚖️ 投票結果').setDescription('誰も処刑されませんでした。');
  }
  return embed;
}

export function buildGameEndEmbed(winner: string, reason: string): EmbedBuilder {
  const colors: Record<string, number> = {
    village: 0x57f287,
    werewolf: 0xed4245,
    fox: 0xffa500,
    lover: 0xff69b4,
    tanner: 0x9b59b6,
    zombie: 0x2ecc71,
  };

  const titles: Record<string, string> = {
    village: '🏡 村人陣営の勝利！',
    werewolf: '🐺 人狼陣営の勝利！',
    fox: '🦊 妖狐の勝利！',
    lover: '💑 恋人の勝利！',
    tanner: '🪓 処刑人の勝利！',
    zombie: '🧟 ゾンビ陣営の勝利！',
  };

  return new EmbedBuilder()
    .setTitle(titles[winner] ?? `${winner} の勝利！`)
    .setColor(colors[winner] ?? 0x95a5a6)
    .setDescription(reason);
}

export function buildPlayerListEmbed(session: GameSession, revealRoles: boolean): EmbedBuilder {
  const players = Array.from(session.players.values());
  const lines = players.map(p => {
    const status = p.isAlive ? '✅' : '💀';
    const role = revealRoles && p.roleId ? ` (${getRole(p.roleId).name})` : '';
    return `${status} <@${p.userId}>${role}`;
  });

  return new EmbedBuilder()
    .setTitle('📋 プレイヤー一覧')
    .setColor(0x5865f2)
    .setDescription(lines.join('\n') || '（なし）');
}
