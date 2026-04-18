import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

const commands = [
  new SlashCommandBuilder()
    .setName('wolf')
    .setDescription('人狼ゲームを開始する'),

  new SlashCommandBuilder()
    .setName('wolfsetup')
    .setDescription('ゲーム設定を変更する')
    .addIntegerOption(o => o.setName('day').setDescription('昼の長さ（秒）').setMinValue(30))
    .addIntegerOption(o => o.setName('night').setDescription('夜の長さ（秒）').setMinValue(30))
    .addIntegerOption(o => o.setName('vote').setDescription('投票の長さ（秒）').setMinValue(15))
    .addIntegerOption(o => o.setName('maxrevotes').setDescription('最大再投票回数').setMinValue(0).setMaxValue(5))
    .addStringOption(o =>
      o.setName('tiedeath')
        .setDescription('同票時の処理')
        .addChoices(
          { name: 'ランダム', value: 'random' },
          { name: '処刑なし', value: 'no_execute' },
          { name: '全員処刑', value: 'all_execute' }
        )
    )
    .addBooleanOption(o => o.setName('anonymous').setDescription('匿名投票'))
    .addBooleanOption(o => o.setName('revealrole').setDescription('死亡時に役職公開')),

  new SlashCommandBuilder()
    .setName('wolfadmin')
    .setDescription('ゲーム管理コマンド（管理者のみ）')
    .addSubcommand(s => s.setName('end').setDescription('ゲームを強制終了する'))
    .addSubcommand(s =>
      s.setName('assignrole')
        .setDescription('役職を手動で割り当てる')
        .addUserOption(o => o.setName('user').setDescription('対象プレイヤー').setRequired(true))
        .addStringOption(o => o.setName('role').setDescription('役職ID').setRequired(true))
    )
    .addSubcommand(s => s.setName('forcevote').setDescription('投票を強制終了する'))
    .addSubcommand(s => s.setName('forcenight').setDescription('夜を強制終了する')),

  new SlashCommandBuilder()
    .setName('wolflogs')
    .setDescription('ゲームログを表示する')
    .addIntegerOption(o => o.setName('limit').setDescription('表示件数').setMinValue(1).setMaxValue(50)),

  new SlashCommandBuilder()
    .setName('wolfspectate')
    .setDescription('ゲームを観戦する'),
].map(cmd => cmd.toJSON());

const token = process.env.BOT_TOKEN!;
const clientId = process.env.CLIENT_ID!;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('BOT_TOKEN と CLIENT_ID を .env に設定してください');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('スラッシュコマンドを登録中...');
    const route = guildId
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);
    await rest.put(route, { body: commands });
    console.log('✅ スラッシュコマンドの登録が完了しました');
  } catch (err) {
    console.error(err);
  }
})();
