const { getDb, saveDb } = require('../db');
const config = require('../../config');
const authUser = require('../auth/middleware');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 405, msg: '只支持POST' });
  }

  const payload = authUser(req);
  if (!payload) {
    return res.status(401).json({ code: 401, msg: '未授权，请重新登录' });
  }

  const { openid } = payload;
  const { faction_type, sub_faction } = req.body || {};

  if (!faction_type || !['corp', 'gang', 'solo'].includes(faction_type)) {
    return res.status(400).json({ code: 400, msg: '缺少或无效的 faction_type，支持: corp, gang, solo' });
  }

  if (!sub_faction || typeof sub_faction !== 'string' || sub_faction.trim() === '') {
    return res.status(400).json({ code: 400, msg: '缺少 sub_faction（子阵营名称）' });
  }

  try {
    const db = getDb();
    const cleanSub = sub_faction.trim();

    const userIdx = db.users.findIndex(u => u.openid === openid);
    if (userIdx < 0) {
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }

    const user = db.users[userIdx];
    if (user.faction_type) {
      return res.status(400).json({ code: 400, msg: `你已经加入了阵营，无法重复选择（当前: ${user.faction_type}）` });
    }

    const now = Date.now();

    // 更新用户阵营
    db.users[userIdx].faction_type = faction_type;
    db.users[userIdx].sub_faction = cleanSub;
    db.users[userIdx].updated_at = now;

    // 增加阵营成员数
    const factionIdx = db.factions.findIndex(f => f.id === faction_type);
    if (factionIdx >= 0) {
      db.factions[factionIdx].member_count = (db.factions[factionIdx].member_count || 0) + 1;
      db.factions[factionIdx].updated_at = now;
    }

    // 发放入伙奖励：+100 euros, +10 supplies
    db.users[userIdx].euros = (db.users[userIdx].euros || 0) + 100;
    db.users[userIdx].supplies = (db.users[userIdx].supplies || 0) + 10;
    db.users[userIdx].updated_at = now;

    saveDb(db);

    const updatedUser = db.users.find(u => u.openid === openid);
    const updatedFaction = db.factions.find(f => f.id === faction_type);

    res.json({
      code: 200,
      msg: 'ok',
      data: {
        user: {
          openid: updatedUser.openid,
          faction: updatedUser.faction_type,
          subFaction: updatedUser.sub_faction,
          euros: updatedUser.euros,
          supplies: updatedUser.supplies,
          seasonPoints: updatedUser.season_points
        },
        faction: updatedFaction,
        bonusApplied: { euros: 100, supplies: 10 }
      }
    });
  } catch (e) {
    console.error('faction/choose error:', e);
    res.status(500).json({ code: 500, msg: '服务器错误: ' + e.message });
  }
};
