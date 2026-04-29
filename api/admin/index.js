// api/admin/index.js - 合并的管理员工具（updateQuest + resetSeason）
const { getDb, saveDb } = require('../db');
const jwt = require('jsonwebtoken');
const config = require('../../config');

function auth(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;
  try { return jwt.verify(token, config.JWT_SECRET); }
  catch { return null; }
}

module.exports = async (req, res) => {
  const payload = auth(req);
  if (!payload) return res.status(401).json({ code: 401, msg: '未授权' });

  const adminIds = (config.ADMIN_OPENIDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!adminIds.includes(payload.openid)) {
    return res.status(403).json({ code: 403, msg: '权限不足' });
  }

  const { action, ...params } = req.body || {};

  if (action === 'updateQuest') {
    const { questId, openid, progress } = params;
    if (!questId || !openid || progress === undefined) {
      return res.status(400).json({ code: 400, msg: '参数不全' });
    }
    const db = getDb();
    let uq = db.userQuests.find(x => x.openid === openid && x.quest_id === questId);
    if (!uq) {
      db.userQuests.push({ id: db._seqs['_seq_userQuests'] || 1, openid, quest_id: questId, progress: 0, completed: 0, claimed: 0 });
      db._seqs['_seq_userQuests'] = (db._seqs['_seq_userQuests'] || 1) + 1;
      uq = db.userQuests[db.userQuests.length - 1];
    }
    uq.progress = progress;
    if (params.claimed !== undefined) uq.claimed = params.claimed;
    saveDb(db);
    return res.json({ code: 200, msg: 'ok', data: uq });

  } else if (action === 'resetSeason') {
    const db = getDb();
    const currentSeason = db.seasons.find(s => s.status === 'active');
    if (!currentSeason) return res.status(404).json({ code: 404, msg: '无进行中赛季' });

    // 归档：三阵营各前三名
    const winners = [];
    for (const ft of ['corp', 'gang', 'solo']) {
      const top = db.users
        .filter(u => u.faction_type === ft)
        .sort((a, b) => b.season_points - a.season_points)
        .slice(0, 3);
      winners.push(...top.map(u => ({ openid: u.openid, nickname: u.nickname, faction: ft, points: u.season_points })));
    }
    currentSeason.winners = JSON.stringify(winners);

    // 重置用户赛季分
    db.users.forEach(u => { u.season_points = 0; });
    // 重置阵营赛季分
    db.factions.forEach(f => { f.total_points = 0; });
    // 创建新赛季
    const now = Date.now();
    db.seasons.push({
      id: 's' + Date.now(),
      name: '第' + (db.seasons.length + 1) + '赛季 · 夜之城争霸',
      start_date: now,
      end_date: now + 60 * 24 * 60 * 60 * 1000,
      status: 'active',
      corp_points: 0, gang_points: 0, solo_points: 0,
      winners: '[]'
    });
    currentSeason.status = 'archived';
    saveDb(db);
    return res.json({ code: 200, msg: 'ok', data: { archived: winners, newSeason: db.seasons[db.seasons.length - 1].name } });

  } else {
    return res.status(400).json({ code: 400, msg: '未知操作，试试 action=updateQuest 或 resetSeason' });
  }
};
