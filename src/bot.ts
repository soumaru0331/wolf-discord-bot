import 'dotenv/config';
import { Client, GatewayIntentBits, Events, type Interaction } from 'discord.js';
import { GameManager } from './game/GameManager';
import { handlePhaseEvent } from './commands/phaseHandler';
import { handleWolf } from './commands/start';
import { handleWolfSetup } from './commands/setup';
import { handleWolfAdmin } from './commands/admin';
import { handleWolfLogs } from './commands/logs';
import { handleWolfSpectate } from './commands/spectate';
import { handleButton } from './commands/buttonHandler';
import logger from './utils/logger';
import { initDb } from './db/Database';

const token = process.env.BOT_TOKEN;
if (!token) {
  logger.error('BOT_TOKEN が設定されていません');
  process.exit(1);
}

export const manager = new GameManager(handlePhaseEvent);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once(Events.ClientReady, async c => {
  await initDb();
  logger.info(`Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case 'wolf': return await handleWolf(interaction, manager);
        case 'wolfsetup': return await handleWolfSetup(interaction, manager);
        case 'wolfadmin': return await handleWolfAdmin(interaction, manager);
        case 'wolflogs': return await handleWolfLogs(interaction, manager);
        case 'wolfspectate': return await handleWolfSpectate(interaction, manager);
      }
    } else if (interaction.isButton()) {
      await handleButton(interaction, manager);
    }
  } catch (err) {
    logger.error('Interaction error', { error: err });
    const msg = { content: 'エラーが発生しました。', ephemeral: true };
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
  }
});

client.login(token);
