require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Partials,
} = require('discord.js');
const db = require('./database');

// NOTE: GuildMessages + MessageContent are *privileged* intents required for
// the @-mention message detection feature. Enable them in the Discord
// Developer Portal (Bot tab → Privileged Gateway Intents) and then add them
// here:
//   GatewayIntentBits.GuildMessages,
//   GatewayIntentBits.MessageContent,
// Until they're enabled in the portal, requesting them here will make
// client.login() fail with "Used disallowed intents" and the bot will not
// come online at all — so we keep only the Guilds intent by default. Slash
// commands work fine with just this.
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

// Pre-initialize the database synchronously at startup so the very first
// interaction does not pay the cost of opening the DB / creating the table
// (which can push us past Discord's 3-second ack window).
try {
  db.getAllTasks('__warmup__');
} catch (e) {
  console.error('DB warmup failed:', e);
}

// Surface unhandled errors instead of silently dying.
process.on('unhandledRejection', (err) =>
  console.error('unhandledRejection:', err),
);
process.on('uncaughtException', (err) =>
  console.error('uncaughtException:', err),
);
client.on('error', (err) => console.error('client error:', err));

// ─── SLASH COMMAND HANDLER ──────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Ack as fast as possible so Discord doesn't show "did not respond".
  try {
    await interaction.deferReply();
  } catch (e) {
    console.error('deferReply failed:', e);
    return;
  }

  try {
    await handleCommand(interaction);
  } catch (e) {
    console.error('command handler error:', e);
    try {
      await interaction.editReply({
        content: '❌ Something went wrong handling that command.',
      });
    } catch (_) {
      /* ignore */
    }
  }
});

async function handleCommand(interaction) {
  const { commandName, options, guild, channel, user } = interaction;

  // /assign @user <task> [due_date]
  if (commandName === 'assign') {
    const target = options.getUser('user');
    const task = options.getString('task');
    const dueDate = options.getString('due_date') || null;

    if (!target || !task) {
      return interaction.editReply({
        content: '❌ Please provide a user and a task.',
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

    return interaction.editReply({ embeds: [embed] });
  }

  // /mytasks [status]
  if (commandName === 'mytasks') {
    const status = options.getString('status') || null;
    const tasks = db.getTasksForUser(guild.id, user.id, status);

    if (tasks.length === 0) {
      return interaction.editReply({
        content: '📭 You have no tasks.',
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

    return interaction.editReply({ embeds: [embed] });
  }

  // /alltasks [status]
  if (commandName === 'alltasks') {
    const status = options.getString('status') || null;
    const tasks = db.getAllTasks(guild.id, status);

    if (tasks.length === 0) {
      return interaction.editReply({
        content: '📭 No tasks found.',
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

    return interaction.editReply({ embeds: [embed] });
  }

  // /done <task_id>
  if (commandName === 'done') {
    const taskId = options.getInteger('task_id');
    const task = db.getTaskById(taskId, guild.id);

    if (!task) {
      return interaction.editReply({
        content: `❌ Task #${taskId} not found.`,
      });
    }

    // Only the assigned person or the assigner can mark it done
    if (task.assigned_to !== user.id && task.assigned_by !== user.id) {
      return interaction.editReply({
        content: '❌ You can only complete tasks assigned to or by you.',
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
      return interaction.editReply({ embeds: [embed] });
    }
    return interaction.editReply({
      content: '❌ Could not complete that task.',
    });
  }

  // /deletetask <task_id>
  if (commandName === 'deletetask') {
    const taskId = options.getInteger('task_id');
    const task = db.getTaskById(taskId, guild.id);

    if (!task) {
      return interaction.editReply({
        content: `❌ Task #${taskId} not found.`,
      });
    }

    if (task.assigned_by !== user.id) {
      return interaction.editReply({
        content: '❌ Only the person who created the task can delete it.',
      });
    }

    const success = db.deleteTask(taskId, guild.id);
    if (success) {
      return interaction.editReply({
        content: `🗑️ Task **#${taskId}** deleted.`,
      });
    }
    return interaction.editReply({
      content: '❌ Could not delete that task.',
    });
  }
}

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

// ─── HTTP HEALTH SERVER (required for Azure App Service / Render) ──────────
const http = require('http');
const https = require('https');
const PORT = process.env.PORT || 8080;
// Azure App Service exposes WEBSITE_HOSTNAME; Render exposes RENDER_EXTERNAL_URL.
const SELF_URL =
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.WEBSITE_HOSTNAME
    ? `https://${process.env.WEBSITE_HOSTNAME}`
    : `http://localhost:${PORT}`);

http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SM TODO BOT is running');
  })
  .on('error', (err) => {
    // Don't crash the bot just because the health port is busy — log and
    // continue. The Discord client is what actually matters.
    if (err.code === 'EADDRINUSE') {
      console.error(
        `   ⚠️  Health server port ${PORT} is already in use — skipping. ` +
          `Set PORT=<other> if you need it.`,
      );
    } else {
      console.error('   ⚠️  Health server error:', err);
    }
  })
  .listen(PORT, () => {
    console.log(`   Health server on port ${PORT}`);
  });

// ─── KEEP-ALIVE PING (prevents free-tier sleep on Render / Azure) ──────────
setInterval(
  () => {
    const lib = SELF_URL.startsWith('https') ? https : http;
    lib
      .get(SELF_URL, (res) => {
        res.resume();
      })
      .on('error', () => {});
  },
  4 * 60 * 1000,
); // ping every 4 minutes

client.login(process.env.DISCORD_TOKEN);
