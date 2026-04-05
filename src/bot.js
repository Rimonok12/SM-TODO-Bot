require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Partials,
} = require('discord.js');
const db = require('./database');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

// ─── SLASH COMMAND HANDLER ──────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, guild, channel, user } = interaction;

  // /assign @user <task> [due_date]
  if (commandName === 'assign') {
    const target = options.getUser('user');
    const task = options.getString('task');
    const dueDate = options.getString('due_date') || null;

    if (!target || !task) {
      return interaction.reply({
        content: '❌ Please provide a user and a task.',
        ephemeral: true,
      });
    }

    const taskId = db.createTask({
      guildId: guild.id,
      channelId: channel.id,
      assignedBy: user.id,
      assignedByTag: user.tag,
      assignedTo: target.id,
      assignedToTag: target.tag,
      task,
      dueDate,
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle('✅ Task Created')
      .addFields(
        { name: 'Task ID', value: `#${taskId}`, inline: true },
        { name: 'Assigned To', value: `<@${target.id}>`, inline: true },
        { name: 'Assigned By', value: `<@${user.id}>`, inline: true },
        { name: 'Task', value: task },
      );
    if (dueDate)
      embed.addFields({ name: 'Due Date', value: dueDate, inline: true });
    embed.setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // /mytasks [status]
  if (commandName === 'mytasks') {
    const status = options.getString('status') || null;
    const tasks = db.getTasksForUser(guild.id, user.id, status);

    if (tasks.length === 0) {
      return interaction.reply({
        content: '📭 You have no tasks.',
        ephemeral: true,
      });
    }

    const lines = tasks.map((t) => {
      const statusIcon = t.status === 'done' ? '✅' : '🔲';
      const due = t.due_date ? ` | Due: ${t.due_date}` : '';
      return `${statusIcon} **#${t.id}** — ${t.task}${due}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`📋 Tasks for ${user.tag}`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${tasks.length} task(s)` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // /alltasks [status]
  if (commandName === 'alltasks') {
    const status = options.getString('status') || null;
    const tasks = db.getAllTasks(guild.id, status);

    if (tasks.length === 0) {
      return interaction.reply({
        content: '📭 No tasks found.',
        ephemeral: true,
      });
    }

    const lines = tasks.slice(0, 25).map((t) => {
      const statusIcon = t.status === 'done' ? '✅' : '🔲';
      const due = t.due_date ? ` | Due: ${t.due_date}` : '';
      return `${statusIcon} **#${t.id}** → <@${t.assigned_to}> — ${t.task}${due}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('📋 All Tasks')
      .setDescription(lines.join('\n'))
      .setFooter({
        text: `Showing ${Math.min(tasks.length, 25)} of ${tasks.length} task(s)`,
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // /done <task_id>
  if (commandName === 'done') {
    const taskId = options.getInteger('task_id');
    const task = db.getTaskById(taskId, guild.id);

    if (!task) {
      return interaction.reply({
        content: `❌ Task #${taskId} not found.`,
        ephemeral: true,
      });
    }

    // Only the assigned person or the assigner can mark it done
    if (task.assigned_to !== user.id && task.assigned_by !== user.id) {
      return interaction.reply({
        content: '❌ You can only complete tasks assigned to or by you.',
        ephemeral: true,
      });
    }

    const success = db.completeTask(taskId, guild.id);
    if (success) {
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Task Completed')
        .addFields(
          { name: 'Task ID', value: `#${taskId}`, inline: true },
          { name: 'Task', value: task.task },
          { name: 'Completed By', value: `<@${user.id}>`, inline: true },
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }
    return interaction.reply({
      content: '❌ Could not complete that task.',
      ephemeral: true,
    });
  }

  // /deletetask <task_id>
  if (commandName === 'deletetask') {
    const taskId = options.getInteger('task_id');
    const task = db.getTaskById(taskId, guild.id);

    if (!task) {
      return interaction.reply({
        content: `❌ Task #${taskId} not found.`,
        ephemeral: true,
      });
    }

    if (task.assigned_by !== user.id) {
      return interaction.reply({
        content: '❌ Only the person who created the task can delete it.',
        ephemeral: true,
      });
    }

    const success = db.deleteTask(taskId, guild.id);
    if (success) {
      return interaction.reply({ content: `🗑️ Task **#${taskId}** deleted.` });
    }
    return interaction.reply({
      content: '❌ Could not delete that task.',
      ephemeral: true,
    });
  }
});

// ─── MESSAGE-BASED TASK DETECTION ───────────────────────────────────────────
// Detects: @TodoBot @SomeUser fix the login bug [by tomorrow]
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Check if the bot is mentioned in the message
  if (!message.mentions.has(client.user)) return;

  // Get the first mentioned user that is NOT the bot
  const target = message.mentions.users.find((u) => u.id !== client.user.id);
  if (!target) {
    return message.reply(
      '💡 **Usage:** Mention me + a user + the task.\nExample: `@TodoBot @John fix the login bug`',
    );
  }

  // Strip all mentions to get the task text
  let taskText = message.content
    .replace(/<@!?\d+>/g, '') // remove user mentions
    .replace(/<@&\d+>/g, '') // remove role mentions
    .trim();

  if (!taskText) {
    return message.reply(
      '❌ Please include a task description after the mentions.',
    );
  }

  // Extract optional "by <date>" at the end
  let dueDate = null;
  const byMatch = taskText.match(/\bby\s+(.+)$/i);
  if (byMatch) {
    dueDate = byMatch[1].trim();
    taskText = taskText.replace(/\bby\s+.+$/i, '').trim();
  }

  if (!taskText) {
    return message.reply('❌ Please include a task description.');
  }

  const taskId = db.createTask({
    guildId: message.guild.id,
    channelId: message.channel.id,
    assignedBy: message.author.id,
    assignedByTag: message.author.tag,
    assignedTo: target.id,
    assignedToTag: target.tag,
    task: taskText,
    dueDate,
  });

  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle('✅ Task Created')
    .addFields(
      { name: 'Task ID', value: `#${taskId}`, inline: true },
      { name: 'Assigned To', value: `<@${target.id}>`, inline: true },
      { name: 'Assigned By', value: `<@${message.author.id}>`, inline: true },
      { name: 'Task', value: taskText },
    );
  if (dueDate)
    embed.addFields({ name: 'Due Date', value: dueDate, inline: true });
  embed.setTimestamp();

  return message.reply({ embeds: [embed] });
});

// ─── READY ──────────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  console.log(`   Servers: ${client.guilds.cache.size}`);
});

// ─── HTTP HEALTH SERVER (required for Azure App Service) ────────────────────
const http = require('http');
const PORT = process.env.PORT || 8080;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SM TODO BOT is running');
  })
  .listen(PORT, () => {
    console.log(`   Health server on port ${PORT}`);
  });

client.login(process.env.DISCORD_TOKEN);
