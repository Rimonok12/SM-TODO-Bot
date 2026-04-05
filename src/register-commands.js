require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('assign')
    .setDescription('Assign a task to someone')
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('Who to assign the task to')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('task').setDescription('What is the task?').setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName('due_date')
        .setDescription('Due date (e.g. "tomorrow", "2026-04-05")')
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('mytasks')
    .setDescription('View your assigned tasks')
    .addStringOption((opt) =>
      opt
        .setName('status')
        .setDescription('Filter by status')
        .addChoices(
          { name: 'Pending', value: 'pending' },
          { name: 'Done', value: 'done' },
        )
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('alltasks')
    .setDescription('View all tasks in this server')
    .addStringOption((opt) =>
      opt
        .setName('status')
        .setDescription('Filter by status')
        .addChoices(
          { name: 'Pending', value: 'pending' },
          { name: 'Done', value: 'done' },
        )
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('done')
    .setDescription('Mark a task as completed')
    .addIntegerOption((opt) =>
      opt
        .setName('task_id')
        .setDescription('The task ID number')
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('deletetask')
    .setDescription('Delete a task (only the creator can delete)')
    .addIntegerOption((opt) =>
      opt
        .setName('task_id')
        .setDescription('The task ID number')
        .setRequired(true),
    ),
].map((cmd) => cmd.toJSON());

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token || !clientId) {
    console.error('❌ Missing DISCORD_TOKEN or CLIENT_ID in .env file');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('⏳ Registering slash commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('✅ Slash commands registered globally!');
    console.log(
      '   Commands: /assign, /mytasks, /alltasks, /done, /deletetask',
    );
    console.log(
      '   Note: Global commands can take up to 1 hour to appear in all servers.',
    );
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
}

registerCommands();
