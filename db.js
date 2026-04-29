// db.js - Pure JS in-memory JSON file database, no native deps
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || '/tmp/laisheng.json';

function getDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { users: [], factions: [], seasons: [], quests: [], userQuests: [], consumption: [], _seqs: {} };
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function genId(table) {
  const db = getDb();
  const key = `_seq_${table}`;
  const seq = (db._seqs && db._seqs[key]) || 1;
  if (!db._seqs) db._seqs = {};
  db._seqs[key] = seq + 1;
  saveDb(db);
  return String(seq);
}

function initSchema() {
  const db = getDb();
  let changed = false;

  if (!db.factions || db.factions.length === 0) {
    db.factions = [
      { id: 'corp', name: '公司阵营', type: 'corp', total_points: 0, member_count: 0 },
      { id: 'gang', name: '帮派阵营', type: 'gang', total_points: 0, member_count: 0 },
      { id: 'solo', name: '独狼阵营', type: 'solo', total_points: 0, member_count: 0 },
    ];
    changed = true;
  }

  if (!db.seasons || db.seasons.length === 0) {
    const now = Date.now();
    db.seasons = [{
      id: 's1', name: '第1赛季 · 夜之城争霸',
      start_date: now, end_date: now + 60 * 24 * 60 * 60 * 1000,
      status: 'active', corp_points: 0, gang_points: 0, solo_points: 0, winners: '[]'
    }];
    changed = true;
  }

  if (!db.quests || db.quests.length === 0) {
    db.quests = [
      { id: 'q1', name: '阵营消费挑战', description: '本周阵营成员累计消费满¥2000', type: 'personal', euros_reward: 0, bd_reward: 0, sup_reward: 0, sp_reward: 20, target: 2000 },
      { id: 'q2', name: '个人消费¥500', description: '本周个人消费满¥500', type: 'personal', euros_reward: 0, bd_reward: 5, sup_reward: 10, sp_reward: 10, target: 500 },
      { id: 'q3', name: '带队入店', description: '带新成员到店并完成打卡', type: 'personal', euros_reward: 50, bd_reward: 10, sup_reward: 5, sp_reward: 15, target: 1 },
      { id: 'q4', name: '分享海报', description: '在社交媒体发布来生内容并@官方账号', type: 'personal', euros_reward: 30, bd_reward: 5, sup_reward: 5, sp_reward: 25, target: 1 },
      { id: 'q5', name: '首充奖励', description: '首次充值或消费满¥200', type: 'personal', euros_reward: 100, bd_reward: 20, sup_reward: 10, sp_reward: 5, target: 200 },
    ];
    changed = true;
  }

  if (changed) saveDb(db);
}

initSchema();

module.exports = { getDb, saveDb, genId };
