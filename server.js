const Database = require('better-sqlite3');
const path = require('path');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'laisheng.db');

// 确保数据目录存在
const fs = require('fs');
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  // Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      openid       TEXT UNIQUE NOT NULL,
      nickname     TEXT DEFAULT '',
      avatar       TEXT DEFAULT '',
      faction_type TEXT CHECK(faction_type IN ('corp','gang','solo')) DEFAULT NULL,
      sub_faction TEXT DEFAULT '',
      level        INTEGER DEFAULT 0,
      euros        INTEGER DEFAULT 0,
      braindance   INTEGER DEFAULT 0,
      supplies     INTEGER DEFAULT 0,
      season_points INTEGER DEFAULT 0,
      total_consumed INTEGER DEFAULT 0,
      created_at   INTEGER DEFAULT (strftime('%s','now')*1000),
      updated_at   INTEGER DEFAULT (strftime('%s','now')*1000),
      last_season_check INTEGER DEFAULT 0
    )
  `);

  // Factions
  db.exec(`
    CREATE TABLE IF NOT EXISTS factions (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      type         TEXT NOT NULL,
      total_points INTEGER DEFAULT 0,
      member_count INTEGER DEFAULT 0,
      updated_at   INTEGER DEFAULT (strftime('%s','now')*1000)
    )
  `);

  // Seasons
  db.exec(`
    CREATE TABLE IF NOT EXISTS seasons (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      start_date   INTEGER,
      end_date     INTEGER,
      status       TEXT DEFAULT 'active',
      corp_points  INTEGER DEFAULT 0,
      gang_points  INTEGER DEFAULT 0,
      solo_points   INTEGER DEFAULT 0,
      winners      TEXT DEFAULT '[]'
    )
  `);

  // Quests
  db.exec(`
    CREATE TABLE IF NOT EXISTS quests (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      description  TEXT DEFAULT '',
      type         TEXT DEFAULT 'personal',
      euros_reward INTEGER DEFAULT 0,
      bd_reward    INTEGER DEFAULT 0,
      sup_reward   INTEGER DEFAULT 0,
      sp_reward    INTEGER DEFAULT 0,
      target       INTEGER DEFAULT 1,
      current      INTEGER DEFAULT 0,
      expires_at   INTEGER
    )
  `);

  // User Quests (progress)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_quests (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      openid       TEXT NOT NULL,
      quest_id     TEXT NOT NULL,
      progress     INTEGER DEFAULT 0,
      completed    INTEGER DEFAULT 0,
      claimed      INTEGER DEFAULT 0,
      claimed_at   INTEGER,
      UNIQUE(openid, quest_id)
    )
  `);

  // Consumption records
  db.exec(`
    CREATE TABLE IF NOT EXISTS consumption (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      openid   TEXT NOT NULL,
      amount   INTEGER NOT NULL,
      remark   TEXT DEFAULT '',
      created_at INTEGER DEFAULT (strftime('%s','now')*1000)
    )
  `);

  // Indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_faction ON users(faction_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_season_points ON users(season_points DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_quests_openid ON user_quests(openid)`);

  // Seed initial data if empty
  seedData();
}

function seedData() {
  const factionCount = db.prepare('SELECT COUNT(*) as c FROM factions').get().c;
  if (factionCount === 0) {
    const insertF = db.prepare('INSERT INTO factions (id, name, type) VALUES (?, ?, ?)');
    insertF.run('corp', '公司阵营', 'corp');
    insertF.run('gang', '帮派阵营', 'gang');
    insertF.run('solo', '独狼阵营', 'solo');
  }

  const seasonCount = db.prepare('SELECT COUNT(*) as c FROM seasons').get().c;
  if (seasonCount === 0) {
    const now = Date.now();
    const seasonEnd = now + 60 * 24 * 60 * 60 * 1000; // 60 days from now
    db.prepare(`
      INSERT INTO seasons (id, name, start_date, end_date, status)
      VALUES (?, ?, ?, ?, 'active')
    `).run('s1', '第1赛季 · 夜之城争霸', now, seasonEnd);
  }

  const questCount = db.prepare('SELECT COUNT(*) as c FROM quests').get().c;
  if (questCount === 0) {
    const insertQ = db.prepare(`
      INSERT INTO quests (id, name, description, type, euros_reward, bd_reward, sup_reward, sp_reward, target)
      VALUES (?, ?, ?, 'personal', ?, ?, ?, ?, ?)
    `);
    insertQ.run('q1', '阵营消费挑战', '本周阵营成员累计消费满¥2000', 0, 0, 0, 20, 2000);
    insertQ.run('q2', '个人消费¥500', '本周个人消费满¥500', 0, 5, 10, 10, 500);
    insertQ.run('q3', '带队入店', '带新成员到店并完成打卡', 50, 10, 5, 15, 1);
    insertQ.run('q4', '分享海报', '在社交媒体发布来生内容并@官方账号', 30, 5, 5, 25, 1);
    insertQ.run('q5', '首充奖励', '首次充值或消费满¥200', 100, 20, 10, 5, 200);
  }
}

module.exports = { getDb };
