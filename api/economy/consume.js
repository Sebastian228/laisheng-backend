const { getDb } = require('../../server');
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

    const user = db.prepare(`SELECT * FROM users WHERE openid = ?`).get(openid);
    if (!user) {
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }

    if (user.euros < amount) {
      return res.status(400).json({ code: 400, msg: `余额不足，当前余额: ${user.euros}` });
    }

    const now = Date.now();
    const seasonPointsEarned = amount; // 1 point per yuan

    // 事务：扣款 + 写消费记录 + 加赛季分 + 累计消费
    const tx = db.transaction(() => {
      db.prepare(`UPDATE users SET euros=euros-?, season_points=season_points+?, total_consumed=total_consumed+?, updated_at=? WHERE openid=?`)
        .run(amount, seasonPointsEarned, amount, now, openid);

      db.prepare(`INSERT INTO consumption (openid, amount, remark, created_at) VALUES (?, ?, ?, ?)`)
        .run(openid, amount, remark || '', now);

      // 更新赛季阵营分
      if (user.faction_type) {
        db.prepare(`UPDATE seasons SET ${user.faction_type}_points=${user.faction_type}_points+? WHERE status='active'`)
          .run(seasonPointsEarned);
        db.prepare(`UPDATE factions SET total_points=total_points+? WHERE id=?`)
          .run(seasonPointsEarned, user.faction_type);
      }
    });
    tx();

    const updated = db.prepare(`SELECT euros, season_points, total_consumed FROM users WHERE openid=?`).get(openid);

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
