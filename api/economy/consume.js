const { getDb, saveDb } = require('../db');
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
  const { amount, remark } = req.body || {};

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ code: 400, msg: 'amount 必须为正整数' });
  }

  try {
    const db = getDb();

    const userIdx = db.users.findIndex(u => u.openid === openid);
    if (userIdx < 0) {
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }

    const user = db.users[userIdx];
    if (user.euros < amount) {
      return res.status(400).json({ code: 400, msg: `余额不足，当前余额: ${user.euros}` });
    }

    const now = Date.now();
    const seasonPointsEarned = amount;

    // 扣款 + 写消费记录 + 加赛季分 + 累计消费
    db.users[userIdx].euros -= amount;
    db.users[userIdx].season_points = (db.users[userIdx].season_points || 0) + seasonPointsEarned;
    db.users[userIdx].total_consumed = (db.users[userIdx].total_consumed || 0) + amount;
    db.users[userIdx].updated_at = now;

    // 写消费记录
    db.consumption.push({ openid, amount, remark: remark || '', created_at: now });

    // 更新赛季阵营分
    if (user.faction_type) {
      const seasonIdx = db.seasons.findIndex(s => s.status === 'active');
      if (seasonIdx >= 0) {
        const col = user.faction_type + '_points';
        if (db.seasons[seasonIdx][col] !== undefined) {
          db.seasons[seasonIdx][col] += seasonPointsEarned;
        }
      }
      const factionIdx = db.factions.findIndex(f => f.id === user.faction_type);
      if (factionIdx >= 0) {
        db.factions[factionIdx].total_points = (db.factions[factionIdx].total_points || 0) + seasonPointsEarned;
      }
    }

    saveDb(db);

    const updated = db.users.find(u => u.openid === openid);

    res.json({
      code: 200,
      msg: 'ok',
      data: {
        deducted: amount,
        seasonPointsEarned,
        remark: remark || '',
        user: {
          euros: updated.euros,
          seasonPoints: updated.season_points,
          totalConsumed: updated.total_consumed
        }
      }
    });
  } catch (e) {
    console.error('economy/consume error:', e);
    res.status(500).json({ code: 500, msg: '服务器错误: ' + e.message });
  }
};
