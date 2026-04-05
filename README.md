# Discord Todo Bot

A Discord bot that lets you assign tasks to team members using **slash commands** or **message mentions**. Tasks are stored in a local SQLite database.

---

## Features

| Feature              | How                                                               |
| -------------------- | ----------------------------------------------------------------- |
| Assign a task        | `/assign @user fix the login bug` or mention the bot in a message |
| View your tasks      | `/mytasks`                                                        |
| View all tasks       | `/alltasks`                                                       |
| Mark task done       | `/done 3`                                                         |
| Delete a task        | `/deletetask 3`                                                   |
| Message-based assign | `@TodoBot @John fix homepage navbar by tomorrow`                  |

---

## Setup Guide (Full Detail)

### Step 1: Create a Discord Bot

1. Go to **https://discord.com/developers/applications**
2. Click **"New Application"** → give it a name like `TodoBot`
3. Go to the **"Bot"** tab on the left sidebar
4. Click **"Reset Token"** → copy the token (you'll need this)
5. Scroll down and enable these **Privileged Gateway Intents**:
   - ✅ **MESSAGE CONTENT INTENT** (required for message-based detection)
6. Go to **"OAuth2" > "URL Generator"** on the left sidebar
7. Under **Scopes**, check:
   - ✅ `bot`
   - ✅ `applications.commands`
8. Under **Bot Permissions**, check:
   - ✅ Send Messages
   - ✅ Read Message History
   - ✅ Embed Links
   - ✅ Use Slash Commands
9. Copy the generated URL at the bottom and **open it in your browser** to invite the bot to your server

### Step 2: Get Your Client ID

1. On the Discord Developer Portal, go to your application
2. Under **"General Information"**, copy the **Application ID** — this is your `CLIENT_ID`

### Step 3: Configure the Bot

Open the `.env` file and fill in your values:

```
DISCORD_TOKEN=paste_your_bot_token_here
CLIENT_ID=paste_your_application_id_here
```

### Step 4: Install Dependencies

```bash
cd EXTRA
npm install
```

### Step 5: Register Slash Commands

Run this **once** (or whenever you change commands):

```bash
npm run register
```

You should see: `✅ Slash commands registered globally!`

> Note: Global commands can take up to 1 hour to show up in all servers.

### Step 6: Start the Bot

```bash
npm start
```

You should see: `✅ Bot is online as TodoBot#1234`

---

## How to Use

### Method 1: Slash Commands (Recommended)

```
/assign @John fix the login bug
/assign @John update phone dataset SQL due_date:2026-04-05
/mytasks
/mytasks status:pending
/alltasks
/done 1
/deletetask 1
```

### Method 2: Message Mentions

Just mention the bot and a user in a message:

```
@TodoBot @John fix the login bug
@TodoBot @John update homepage by Friday
```

The bot will automatically:

- Detect the tagged person
- Extract the task text
- Detect optional "by <date>" for due dates
- Save the task to the database
- Reply with a confirmation embed

---

## Project Structure

```
EXTRA/
├── .env                      # Your bot token & client ID
├── .gitignore
├── package.json
├── src/
│   ├── bot.js                # Main bot file
│   ├── database.js           # SQLite database helper
│   └── register-commands.js  # Registers slash commands with Discord
└── data/
    └── tasks.db              # Auto-created SQLite database
```

---

## Example Flow

1. You type: `@TodoBot @John update phone dataset SQL`
2. Bot reads it
3. **Assignee:** John
4. **Task:** update phone dataset SQL
5. Bot saves it to SQLite
6. Bot replies with a nice embed: **"✅ Task Created for John"**

---

## Troubleshooting

| Problem                        | Fix                                                                 |
| ------------------------------ | ------------------------------------------------------------------- |
| Commands not showing up        | Wait up to 1 hour for global commands, or re-run `npm run register` |
| Bot not responding to messages | Make sure **MESSAGE CONTENT INTENT** is enabled in Developer Portal |
| "Missing Access" error         | Re-invite the bot with proper permissions using the OAuth2 URL      |
| Database errors                | Delete `data/tasks.db` and restart — it will be recreated           |
