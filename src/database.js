const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'tasks.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        assigned_by TEXT NOT NULL,
        assigned_by_tag TEXT NOT NULL,
        assigned_to TEXT NOT NULL,
        assigned_to_tag TEXT NOT NULL,
        task TEXT NOT NULL,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }
  return db;
}

function createTask({
  guildId,
  channelId,
  assignedBy,
  assignedByTag,
  assignedTo,
  assignedToTag,
  task,
  dueDate,
}) {
  const stmt = getDb().prepare(`
    INSERT INTO tasks (guild_id, channel_id, assigned_by, assigned_by_tag, assigned_to, assigned_to_tag, task, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    guildId,
    channelId,
    assignedBy,
    assignedByTag,
    assignedTo,
    assignedToTag,
    task,
    dueDate || null,
  );
  return result.lastInsertRowid;
}

function getTasksForUser(guildId, userId, status = null) {
  let query = 'SELECT * FROM tasks WHERE guild_id = ? AND assigned_to = ?';
  const params = [guildId, userId];
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';
  return getDb()
    .prepare(query)
    .all(...params);
}

function getAllTasks(guildId, status = null) {
  let query = 'SELECT * FROM tasks WHERE guild_id = ?';
  const params = [guildId];
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';
  return getDb()
    .prepare(query)
    .all(...params);
}

function completeTask(taskId, guildId) {
  const stmt = getDb().prepare(
    'UPDATE tasks SET status = ? WHERE id = ? AND guild_id = ?',
  );
  return stmt.run('done', taskId, guildId).changes > 0;
}

function deleteTask(taskId, guildId) {
  const stmt = getDb().prepare(
    'DELETE FROM tasks WHERE id = ? AND guild_id = ?',
  );
  return stmt.run(taskId, guildId).changes > 0;
}

function getTaskById(taskId, guildId) {
  return getDb()
    .prepare('SELECT * FROM tasks WHERE id = ? AND guild_id = ?')
    .get(taskId, guildId);
}

module.exports = {
  createTask,
  getTasksForUser,
  getAllTasks,
  completeTask,
  deleteTask,
  getTaskById,
};
